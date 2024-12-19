// Package test provides comprehensive testing for the wallet service
package test

import (
    "context"
    "testing"
    "time"

    "github.com/google/uuid"          // v1.3.0
    "github.com/stretchr/testify/mock" // v1.8.4
    "github.com/stretchr/testify/require" // v1.8.4
    "github.com/shopspring/decimal"    // v1.3.1

    "internal/models"
    "internal/service"
    "internal/repository"
)

// Test constants
var (
    testWalletID = uuid.New()
    testCustomerID = uuid.New()
    testTimeout = time.Second * 5
    defaultCurrency = "USD"
)

// mockWalletRepository implements repository.WalletRepository for testing
type mockWalletRepository struct {
    mock.Mock
}

func (m *mockWalletRepository) GetWallet(ctx context.Context, id uuid.UUID) (*models.Wallet, error) {
    args := m.Called(ctx, id)
    if wallet, ok := args.Get(0).(*models.Wallet); ok {
        return wallet, args.Error(1)
    }
    return nil, args.Error(1)
}

func (m *mockWalletRepository) UpdateBalance(ctx context.Context, tx *models.Transaction) error {
    args := m.Called(ctx, tx)
    return args.Error(0)
}

func (m *mockWalletRepository) GetTransactions(ctx context.Context, walletID uuid.UUID, limit, offset int) ([]*models.Transaction, error) {
    args := m.Called(ctx, walletID, limit, offset)
    if txs, ok := args.Get(0).([]*models.Transaction); ok {
        return txs, args.Error(1)
    }
    return nil, args.Error(1)
}

func (m *mockWalletRepository) CreateWallet(ctx context.Context, wallet *models.Wallet) error {
    args := m.Called(ctx, wallet)
    return args.Error(0)
}

func (m *mockWalletRepository) GetTransactionByID(ctx context.Context, id uuid.UUID) (*models.Transaction, error) {
    args := m.Called(ctx, id)
    if tx, ok := args.Get(0).(*models.Transaction); ok {
        return tx, args.Error(1)
    }
    return nil, args.Error(1)
}

// TestMain handles test setup and teardown
func TestMain(m *testing.M) {
    // Run tests
    m.Run()
}

// TestGetWalletBalance tests wallet balance retrieval functionality
func TestGetWalletBalance(t *testing.T) {
    ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
    defer cancel()

    tests := []struct {
        name        string
        walletID    uuid.UUID
        mockWallet  *models.Wallet
        mockError   error
        wantBalance decimal.Decimal
        wantCurrency string
        wantErr     bool
    }{
        {
            name:     "successful balance retrieval",
            walletID: testWalletID,
            mockWallet: &models.Wallet{
                ID:          testWalletID,
                CustomerID:  testCustomerID,
                Balance:    1000.00,
                Currency:   defaultCurrency,
                Version:    1,
            },
            mockError:    nil,
            wantBalance:  decimal.NewFromFloat(1000.00),
            wantCurrency: defaultCurrency,
            wantErr:      false,
        },
        {
            name:        "wallet not found",
            walletID:    uuid.New(),
            mockWallet:  nil,
            mockError:   repository.ErrWalletNotFound,
            wantBalance: decimal.Zero,
            wantCurrency: "",
            wantErr:     true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Setup mock repository
            mockRepo := new(mockWalletRepository)
            mockRepo.On("GetWallet", ctx, tt.walletID).Return(tt.mockWallet, tt.mockError)

            // Create service with mock repository
            svc, err := service.NewWalletService(mockRepo, decimal.NewFromFloat(100), nil)
            require.NoError(t, err)

            // Execute test
            balance, currency, err := svc.GetWalletBalance(ctx, tt.walletID)

            // Verify results
            if tt.wantErr {
                require.Error(t, err)
            } else {
                require.NoError(t, err)
                require.Equal(t, tt.wantBalance.String(), balance.String())
                require.Equal(t, tt.wantCurrency, currency)
            }

            mockRepo.AssertExpectations(t)
        })
    }
}

// TestProcessTransaction tests transaction processing functionality
func TestProcessTransaction(t *testing.T) {
    ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
    defer cancel()

    tests := []struct {
        name        string
        wallet      *models.Wallet
        transaction *models.Transaction
        mockError   error
        wantErr     bool
    }{
        {
            name: "successful credit transaction",
            wallet: &models.Wallet{
                ID:         testWalletID,
                CustomerID: testCustomerID,
                Balance:   1000.00,
                Currency:  defaultCurrency,
                Version:   1,
            },
            transaction: &models.Transaction{
                ID:       uuid.New(),
                WalletID: testWalletID,
                Type:     models.TransactionTypeCredit,
                Amount:   500.00,
                Currency: defaultCurrency,
                Status:   models.TransactionStatusInitiated,
            },
            mockError: nil,
            wantErr:   false,
        },
        {
            name: "insufficient balance for debit",
            wallet: &models.Wallet{
                ID:         testWalletID,
                CustomerID: testCustomerID,
                Balance:   100.00,
                Currency:  defaultCurrency,
                Version:   1,
            },
            transaction: &models.Transaction{
                ID:       uuid.New(),
                WalletID: testWalletID,
                Type:     models.TransactionTypeDebit,
                Amount:   500.00,
                Currency: defaultCurrency,
                Status:   models.TransactionStatusInitiated,
            },
            mockError: repository.ErrInsufficientBalance,
            wantErr:   true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Setup mock repository
            mockRepo := new(mockWalletRepository)
            mockRepo.On("GetWallet", ctx, tt.wallet.ID).Return(tt.wallet, nil)
            mockRepo.On("UpdateBalance", ctx, tt.transaction).Return(tt.mockError)

            // Create service with mock repository
            svc, err := service.NewWalletService(mockRepo, decimal.NewFromFloat(100), nil)
            require.NoError(t, err)

            // Execute test
            err = svc.ProcessTransaction(ctx, tt.transaction)

            // Verify results
            if tt.wantErr {
                require.Error(t, err)
            } else {
                require.NoError(t, err)
            }

            mockRepo.AssertExpectations(t)
        })
    }
}

// TestTransactionStateTransitions tests transaction state transition validations
func TestTransactionStateTransitions(t *testing.T) {
    ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
    defer cancel()

    tests := []struct {
        name          string
        initialState  models.TransactionStatus
        targetState   models.TransactionStatus
        wantErr       bool
    }{
        {
            name:         "initiated to processing",
            initialState: models.TransactionStatusInitiated,
            targetState:  models.TransactionStatusProcessing,
            wantErr:      false,
        },
        {
            name:         "processing to completed",
            initialState: models.TransactionStatusProcessing,
            targetState:  models.TransactionStatusCompleted,
            wantErr:      false,
        },
        {
            name:         "completed to processing",
            initialState: models.TransactionStatusCompleted,
            targetState:  models.TransactionStatusProcessing,
            wantErr:      true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            tx := &models.Transaction{
                ID:       uuid.New(),
                WalletID: testWalletID,
                Status:   tt.initialState,
            }

            // Verify state transition
            isValid := models.IsValidTransactionStatus(tt.targetState)
            if tt.wantErr {
                require.False(t, isValid)
            } else {
                require.True(t, isValid)
            }
        })
    }
}

// TestConcurrentTransactions tests handling of concurrent transactions
func TestConcurrentTransactions(t *testing.T) {
    ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
    defer cancel()

    wallet := &models.Wallet{
        ID:         testWalletID,
        CustomerID: testCustomerID,
        Balance:   1000.00,
        Currency:  defaultCurrency,
        Version:   1,
    }

    // Setup mock repository
    mockRepo := new(mockWalletRepository)
    mockRepo.On("GetWallet", ctx, wallet.ID).Return(wallet, nil)
    mockRepo.On("UpdateBalance", ctx, mock.Anything).Return(repository.ErrOptimisticLock)

    // Create service with mock repository
    svc, err := service.NewWalletService(mockRepo, decimal.NewFromFloat(100), nil)
    require.NoError(t, err)

    // Create concurrent transactions
    tx1 := &models.Transaction{
        ID:       uuid.New(),
        WalletID: testWalletID,
        Type:     models.TransactionTypeDebit,
        Amount:   500.00,
        Currency: defaultCurrency,
        Status:   models.TransactionStatusInitiated,
    }

    // Execute test
    err = svc.ProcessTransaction(ctx, tx1)
    require.Error(t, err)
    require.Equal(t, service.ErrOptimisticLock, err)

    mockRepo.AssertExpectations(t)
}