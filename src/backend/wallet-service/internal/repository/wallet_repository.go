// Package repository implements data persistence layer for wallet operations
package repository

import (
    "context"
    "database/sql"
    "encoding/json"
    "errors"
    "fmt"
    "time"

    "github.com/google/uuid"      // v1.3.0
    "github.com/lib/pq"           // v1.10.9
    "github.com/shopspring/decimal" // v1.3.1

    "internal/models"
)

// Common repository errors
var (
    ErrWalletNotFound = errors.New("wallet not found")
    ErrOptimisticLock = errors.New("wallet version conflict")
    ErrInvalidTransaction = errors.New("invalid transaction data")
    ErrInsufficientBalance = errors.New("insufficient wallet balance")
)

// WalletRepository defines the interface for wallet data operations
type WalletRepository interface {
    GetWallet(ctx context.Context, id uuid.UUID) (*models.Wallet, error)
    CreateWallet(ctx context.Context, wallet *models.Wallet) error
    UpdateBalance(ctx context.Context, tx *models.Transaction) error
    GetTransactions(ctx context.Context, walletID uuid.UUID, limit, offset int) ([]*models.Transaction, error)
    GetTransactionByID(ctx context.Context, id uuid.UUID) (*models.Transaction, error)
}

// walletRepository implements WalletRepository interface
type walletRepository struct {
    db         *sql.DB
    statements map[string]*sql.Stmt
}

// NewWalletRepository creates a new instance of WalletRepository
func NewWalletRepository(db *sql.DB) (WalletRepository, error) {
    if db == nil {
        return nil, errors.New("database connection is required")
    }

    repo := &walletRepository{
        db:         db,
        statements: make(map[string]*sql.Stmt),
    }

    if err := repo.prepareStatements(); err != nil {
        return nil, fmt.Errorf("failed to prepare statements: %w", err)
    }

    return repo, nil
}

// prepareStatements prepares SQL statements for reuse
func (r *walletRepository) prepareStatements() error {
    statements := map[string]string{
        "getWallet": `
            SELECT id, customer_id, balance, currency, low_balance_threshold, 
                   created_at, updated_at, version 
            FROM wallets 
            WHERE id = $1 AND deleted_at IS NULL`,
        "createWallet": `
            INSERT INTO wallets (id, customer_id, balance, currency, low_balance_threshold, 
                               created_at, updated_at, version) 
            VALUES ($1, $2, $3, $4, $5, $6, $6, 1)`,
        "updateWallet": `
            UPDATE wallets 
            SET balance = $1, updated_at = $2, version = version + 1 
            WHERE id = $3 AND version = $4 AND deleted_at IS NULL 
            RETURNING version`,
        "insertTransaction": `
            INSERT INTO wallet_transactions (id, wallet_id, type, status, amount, 
                                          currency, description, reference_id, created_at, updated_at) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
        "getTransaction": `
            SELECT id, wallet_id, type, status, amount, currency, description, 
                   reference_id, created_at, updated_at 
            FROM wallet_transactions 
            WHERE id = $1`,
        "getTransactions": `
            SELECT id, wallet_id, type, status, amount, currency, description, 
                   reference_id, created_at, updated_at 
            FROM wallet_transactions 
            WHERE wallet_id = $1 
            ORDER BY created_at DESC 
            LIMIT $2 OFFSET $3`,
    }

    for name, query := range statements {
        stmt, err := r.db.Prepare(query)
        if err != nil {
            return fmt.Errorf("failed to prepare statement %s: %w", name, err)
        }
        r.statements[name] = stmt
    }

    return nil
}

// GetWallet retrieves a wallet by ID
func (r *walletRepository) GetWallet(ctx context.Context, id uuid.UUID) (*models.Wallet, error) {
    wallet := &models.Wallet{}
    
    err := r.statements["getWallet"].QueryRowContext(ctx, id).Scan(
        &wallet.ID,
        &wallet.CustomerID,
        &wallet.Balance,
        &wallet.Currency,
        &wallet.LowBalanceThreshold,
        &wallet.CreatedAt,
        &wallet.UpdatedAt,
        &wallet.Version,
    )

    if err == sql.ErrNoRows {
        return nil, ErrWalletNotFound
    }
    if err != nil {
        return nil, fmt.Errorf("failed to get wallet: %w", err)
    }

    return wallet, nil
}

// CreateWallet creates a new wallet
func (r *walletRepository) CreateWallet(ctx context.Context, wallet *models.Wallet) error {
    wallet.ID = uuid.New()
    wallet.CreatedAt = time.Now().UTC()
    wallet.Version = 1

    _, err := r.statements["createWallet"].ExecContext(ctx,
        wallet.ID,
        wallet.CustomerID,
        wallet.Balance,
        wallet.Currency,
        wallet.LowBalanceThreshold,
        wallet.CreatedAt,
    )

    if err != nil {
        if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
            return fmt.Errorf("wallet already exists for customer: %w", err)
        }
        return fmt.Errorf("failed to create wallet: %w", err)
    }

    return nil
}

// UpdateBalance updates wallet balance with optimistic locking
func (r *walletRepository) UpdateBalance(ctx context.Context, tx *models.Transaction) error {
    if err := tx.Validate(); err != nil {
        return fmt.Errorf("%w: %v", ErrInvalidTransaction, err)
    }

    dbTx, err := r.db.BeginTx(ctx, &sql.TxOptions{
        Isolation: sql.LevelSerializable,
    })
    if err != nil {
        return fmt.Errorf("failed to begin transaction: %w", err)
    }
    defer dbTx.Rollback()

    // Get current wallet state with lock
    wallet, err := r.GetWallet(ctx, tx.WalletID)
    if err != nil {
        return err
    }

    // Validate balance for debit transactions
    if tx.Type == models.TransactionTypeDebit {
        if !wallet.HasSufficientBalance(tx.Amount) {
            return ErrInsufficientBalance
        }
    }

    // Calculate new balance
    newBalance := wallet.Balance
    switch tx.Type {
    case models.TransactionTypeCredit, models.TransactionTypeRefund:
        newBalance += tx.Amount
    case models.TransactionTypeDebit:
        newBalance -= tx.Amount
    }

    // Update wallet balance with optimistic locking
    var newVersion int64
    err = dbTx.QueryRowContext(ctx,
        "updateWallet",
        newBalance,
        time.Now().UTC(),
        wallet.ID,
        wallet.Version,
    ).Scan(&newVersion)

    if err == sql.ErrNoRows {
        return ErrOptimisticLock
    }
    if err != nil {
        return fmt.Errorf("failed to update wallet balance: %w", err)
    }

    // Insert transaction record
    tx.ID = uuid.New()
    tx.CreatedAt = time.Now().UTC()
    tx.UpdatedAt = tx.CreatedAt

    _, err = r.statements["insertTransaction"].ExecContext(ctx,
        tx.ID,
        tx.WalletID,
        tx.Type,
        tx.Status,
        tx.Amount,
        tx.Currency,
        tx.Description,
        tx.ReferenceID,
        tx.CreatedAt,
    )
    if err != nil {
        return fmt.Errorf("failed to insert transaction: %w", err)
    }

    return dbTx.Commit()
}

// GetTransactionByID retrieves a transaction by ID
func (r *walletRepository) GetTransactionByID(ctx context.Context, id uuid.UUID) (*models.Transaction, error) {
    tx := &models.Transaction{}
    
    err := r.statements["getTransaction"].QueryRowContext(ctx, id).Scan(
        &tx.ID,
        &tx.WalletID,
        &tx.Type,
        &tx.Status,
        &tx.Amount,
        &tx.Currency,
        &tx.Description,
        &tx.ReferenceID,
        &tx.CreatedAt,
        &tx.UpdatedAt,
    )

    if err == sql.ErrNoRows {
        return nil, errors.New("transaction not found")
    }
    if err != nil {
        return nil, fmt.Errorf("failed to get transaction: %w", err)
    }

    return tx, nil
}

// GetTransactions retrieves paginated transactions for a wallet
func (r *walletRepository) GetTransactions(ctx context.Context, walletID uuid.UUID, limit, offset int) ([]*models.Transaction, error) {
    rows, err := r.statements["getTransactions"].QueryContext(ctx, walletID, limit, offset)
    if err != nil {
        return nil, fmt.Errorf("failed to get transactions: %w", err)
    }
    defer rows.Close()

    var transactions []*models.Transaction
    for rows.Next() {
        tx := &models.Transaction{}
        err := rows.Scan(
            &tx.ID,
            &tx.WalletID,
            &tx.Type,
            &tx.Status,
            &tx.Amount,
            &tx.Currency,
            &tx.Description,
            &tx.ReferenceID,
            &tx.CreatedAt,
            &tx.UpdatedAt,
        )
        if err != nil {
            return nil, fmt.Errorf("failed to scan transaction: %w", err)
        }
        transactions = append(transactions, tx)
    }

    if err = rows.Err(); err != nil {
        return nil, fmt.Errorf("error iterating transactions: %w", err)
    }

    return transactions, nil
}