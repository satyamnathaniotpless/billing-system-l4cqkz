// Package service implements business logic for wallet operations
package service

import (
    "context"
    "errors"
    "fmt"
    "time"

    "github.com/google/uuid"      // v1.3.0
    "github.com/shopspring/decimal" // v1.3.1

    "internal/models"
    "internal/repository"
)

// Common service errors
var (
    ErrInsufficientBalance = errors.New("insufficient wallet balance")
    ErrInvalidAmount = errors.New("invalid transaction amount")
    ErrWalletNotFound = errors.New("wallet not found")
    ErrCurrencyMismatch = errors.New("currency mismatch between wallet and transaction")
    ErrOptimisticLock = errors.New("concurrent modification detected")
    ErrInvalidStateTransition = errors.New("invalid transaction state transition")
)

// Logger interface for service logging
type Logger interface {
    Info(msg string, fields ...interface{})
    Error(msg string, err error, fields ...interface{})
    Warn(msg string, fields ...interface{})
}

// TransactionFilter defines filtering options for transaction history
type TransactionFilter struct {
    Types    []models.TransactionType
    Statuses []models.TransactionStatus
    FromDate time.Time
    ToDate   time.Time
}

// Pagination defines pagination parameters
type Pagination struct {
    Limit  int
    Offset int
}

// WalletService defines the interface for wallet operations
type WalletService interface {
    GetWalletBalance(ctx context.Context, walletID uuid.UUID) (decimal.Decimal, string, error)
    ProcessTransaction(ctx context.Context, tx *models.Transaction) error
    GetTransactionHistory(ctx context.Context, walletID uuid.UUID, filter TransactionFilter, pagination Pagination) ([]*models.Transaction, int, error)
}

// walletService implements WalletService interface
type walletService struct {
    repo               repository.WalletRepository
    lowBalanceThreshold decimal.Decimal
    logger             Logger
}

// NewWalletService creates a new instance of WalletService
func NewWalletService(repo repository.WalletRepository, lowBalanceThreshold decimal.Decimal, logger Logger) (WalletService, error) {
    if repo == nil {
        return nil, errors.New("repository is required")
    }
    if logger == nil {
        return nil, errors.New("logger is required")
    }
    if lowBalanceThreshold.IsNegative() {
        return nil, errors.New("low balance threshold must be non-negative")
    }

    return &walletService{
        repo:               repo,
        lowBalanceThreshold: lowBalanceThreshold,
        logger:             logger,
    }, nil
}

// GetWalletBalance retrieves current wallet balance with currency information
func (s *walletService) GetWalletBalance(ctx context.Context, walletID uuid.UUID) (decimal.Decimal, string, error) {
    if walletID == uuid.Nil {
        return decimal.Zero, "", errors.New("invalid wallet ID")
    }

    wallet, err := s.repo.GetWallet(ctx, walletID)
    if err != nil {
        if errors.Is(err, repository.ErrWalletNotFound) {
            return decimal.Zero, "", ErrWalletNotFound
        }
        s.logger.Error("failed to get wallet", err, "walletID", walletID)
        return decimal.Zero, "", fmt.Errorf("failed to get wallet: %w", err)
    }

    s.logger.Info("wallet balance retrieved", 
        "walletID", walletID,
        "balance", wallet.Balance,
        "currency", wallet.Currency)

    return decimal.NewFromFloat(wallet.Balance), wallet.Currency, nil
}

// ProcessTransaction handles wallet transaction with comprehensive validation
func (s *walletService) ProcessTransaction(ctx context.Context, tx *models.Transaction) error {
    if tx == nil {
        return errors.New("transaction is required")
    }

    // Validate transaction data
    if err := tx.Validate(); err != nil {
        s.logger.Error("invalid transaction", err, "transactionID", tx.ID)
        return fmt.Errorf("transaction validation failed: %w", err)
    }

    // Get wallet for validation and processing
    wallet, err := s.repo.GetWallet(ctx, tx.WalletID)
    if err != nil {
        if errors.Is(err, repository.ErrWalletNotFound) {
            return ErrWalletNotFound
        }
        s.logger.Error("failed to get wallet", err, "walletID", tx.WalletID)
        return fmt.Errorf("failed to get wallet: %w", err)
    }

    // Validate currency match
    if wallet.Currency != tx.Currency {
        s.logger.Error("currency mismatch", nil,
            "walletCurrency", wallet.Currency,
            "transactionCurrency", tx.Currency)
        return ErrCurrencyMismatch
    }

    // Validate sufficient balance for debit transactions
    if tx.Type == models.TransactionTypeDebit && !wallet.HasSufficientBalance(tx.Amount) {
        s.logger.Warn("insufficient balance",
            "walletID", wallet.ID,
            "balance", wallet.Balance,
            "requestedAmount", tx.Amount)
        return ErrInsufficientBalance
    }

    // Process transaction with optimistic locking
    err = s.repo.UpdateBalance(ctx, tx)
    if err != nil {
        if errors.Is(err, repository.ErrOptimisticLock) {
            s.logger.Warn("concurrent modification detected",
                "walletID", wallet.ID,
                "transactionID", tx.ID)
            return ErrOptimisticLock
        }
        s.logger.Error("failed to process transaction", err,
            "walletID", wallet.ID,
            "transactionID", tx.ID)
        return fmt.Errorf("failed to process transaction: %w", err)
    }

    // Check for low balance condition after transaction
    if wallet.IsLowBalance() {
        s.logger.Warn("low balance alert",
            "walletID", wallet.ID,
            "balance", wallet.Balance,
            "threshold", wallet.LowBalanceThreshold)
        // Additional low balance handling could be implemented here
    }

    s.logger.Info("transaction processed successfully",
        "transactionID", tx.ID,
        "walletID", wallet.ID,
        "type", tx.Type,
        "amount", tx.Amount)

    return nil
}

// GetTransactionHistory retrieves paginated and filtered transaction history
func (s *walletService) GetTransactionHistory(ctx context.Context, walletID uuid.UUID, filter TransactionFilter, pagination Pagination) ([]*models.Transaction, int, error) {
    if walletID == uuid.Nil {
        return nil, 0, errors.New("invalid wallet ID")
    }

    // Validate pagination parameters
    if pagination.Limit <= 0 {
        pagination.Limit = 50 // Default limit
    }
    if pagination.Limit > 1000 {
        pagination.Limit = 1000 // Maximum limit
    }
    if pagination.Offset < 0 {
        pagination.Offset = 0
    }

    // Validate date range if provided
    if !filter.FromDate.IsZero() && !filter.ToDate.IsZero() && filter.FromDate.After(filter.ToDate) {
        return nil, 0, errors.New("invalid date range")
    }

    transactions, err := s.repo.GetTransactions(ctx, walletID, pagination.Limit, pagination.Offset)
    if err != nil {
        s.logger.Error("failed to get transactions", err, "walletID", walletID)
        return nil, 0, fmt.Errorf("failed to get transactions: %w", err)
    }

    // Apply filters
    var filtered []*models.Transaction
    for _, tx := range transactions {
        if s.matchesFilter(tx, filter) {
            filtered = append(filtered, tx)
        }
    }

    s.logger.Info("transaction history retrieved",
        "walletID", walletID,
        "count", len(filtered),
        "limit", pagination.Limit,
        "offset", pagination.Offset)

    return filtered, len(filtered), nil
}

// matchesFilter checks if a transaction matches the provided filter criteria
func (s *walletService) matchesFilter(tx *models.Transaction, filter TransactionFilter) bool {
    // Check transaction type
    if len(filter.Types) > 0 {
        typeMatch := false
        for _, t := range filter.Types {
            if tx.Type == t {
                typeMatch = true
                break
            }
        }
        if !typeMatch {
            return false
        }
    }

    // Check transaction status
    if len(filter.Statuses) > 0 {
        statusMatch := false
        for _, s := range filter.Statuses {
            if tx.Status == s {
                statusMatch = true
                break
            }
        }
        if !statusMatch {
            return false
        }
    }

    // Check date range
    if !filter.FromDate.IsZero() && tx.CreatedAt.Before(filter.FromDate) {
        return false
    }
    if !filter.ToDate.IsZero() && tx.CreatedAt.After(filter.ToDate) {
        return false
    }

    return true
}