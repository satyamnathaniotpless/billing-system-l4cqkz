// Package models provides core domain models for the wallet service
package models

import (
    "errors"
    "time"
    "github.com/google/uuid" // v1.3.0
)

// TransactionType represents the type of wallet transaction
type TransactionType int

// TransactionStatus represents the current status of a transaction
type TransactionStatus int

const (
    // TransactionTypeCredit represents a credit/deposit transaction
    TransactionTypeCredit TransactionType = iota
    // TransactionTypeDebit represents a debit/withdrawal transaction
    TransactionTypeDebit
    // TransactionTypeRefund represents a refund transaction
    TransactionTypeRefund
)

const (
    // TransactionStatusInitiated represents a newly created transaction
    TransactionStatusInitiated TransactionStatus = iota
    // TransactionStatusProcessing represents a transaction in progress
    TransactionStatusProcessing
    // TransactionStatusCompleted represents a successfully completed transaction
    TransactionStatusCompleted
    // TransactionStatusFailed represents a failed transaction
    TransactionStatusFailed
    // TransactionStatusReversed represents a reversed/rolled-back transaction
    TransactionStatusReversed
)

// Common error definitions for domain validation
var (
    ErrInvalidTransactionType   = errors.New("invalid transaction type")
    ErrInvalidTransactionStatus = errors.New("invalid transaction status")
    ErrInvalidAmount           = errors.New("invalid transaction amount")
    ErrInvalidCurrency         = errors.New("invalid currency code")
)

// Wallet represents a customer's wallet with balance management capabilities
type Wallet struct {
    ID                 uuid.UUID `json:"id"`
    CustomerID         uuid.UUID `json:"customer_id"`
    Balance           float64   `json:"balance"`
    Currency          string    `json:"currency"`
    LowBalanceThreshold float64   `json:"low_balance_threshold"`
    CreatedAt         time.Time `json:"created_at"`
    UpdatedAt         time.Time `json:"updated_at"`
    Version           int64     `json:"version"` // For optimistic locking
}

// Transaction represents a wallet transaction with comprehensive validation
type Transaction struct {
    ID          uuid.UUID         `json:"id"`
    WalletID    uuid.UUID         `json:"wallet_id"`
    Type        TransactionType   `json:"type"`
    Status      TransactionStatus `json:"status"`
    Amount      float64           `json:"amount"`
    Currency    string            `json:"currency"`
    Description string            `json:"description"`
    ReferenceID string            `json:"reference_id"`
    CreatedAt   time.Time         `json:"created_at"`
    UpdatedAt   time.Time         `json:"updated_at"`
}

// IsValidTransactionType checks if the transaction type is supported
func IsValidTransactionType(t TransactionType) bool {
    return t >= TransactionTypeCredit && t <= TransactionTypeRefund
}

// IsValidTransactionStatus checks if the transaction status is valid
func IsValidTransactionStatus(s TransactionStatus) bool {
    return s >= TransactionStatusInitiated && s <= TransactionStatusReversed
}

// IsLowBalance checks if the wallet balance is below the configured threshold
func (w *Wallet) IsLowBalance() bool {
    return w.Balance <= w.LowBalanceThreshold
}

// HasSufficientBalance checks if the wallet has sufficient balance for a debit operation
func (w *Wallet) HasSufficientBalance(amount float64) bool {
    if amount <= 0 {
        return false
    }
    return w.Balance >= amount
}

// Validate performs comprehensive validation of transaction data
func (t *Transaction) Validate() error {
    // Validate transaction type
    if !IsValidTransactionType(t.Type) {
        return ErrInvalidTransactionType
    }

    // Validate transaction status
    if !IsValidTransactionStatus(t.Status) {
        return ErrInvalidTransactionStatus
    }

    // Validate amount
    if t.Amount <= 0 {
        return ErrInvalidAmount
    }

    // Validate currency (basic check - in production, use a proper currency validation library)
    if len(t.Currency) != 3 {
        return ErrInvalidCurrency
    }

    // Validate reference ID format if provided
    if t.ReferenceID != "" {
        if len(t.ReferenceID) < 8 || len(t.ReferenceID) > 64 {
            return errors.New("invalid reference ID format")
        }
    }

    return nil
}

// String returns string representation of TransactionType
func (t TransactionType) String() string {
    switch t {
    case TransactionTypeCredit:
        return "CREDIT"
    case TransactionTypeDebit:
        return "DEBIT"
    case TransactionTypeRefund:
        return "REFUND"
    default:
        return "UNKNOWN"
    }
}

// String returns string representation of TransactionStatus
func (s TransactionStatus) String() string {
    switch s {
    case TransactionStatusInitiated:
        return "INITIATED"
    case TransactionStatusProcessing:
        return "PROCESSING"
    case TransactionStatusCompleted:
        return "COMPLETED"
    case TransactionStatusFailed:
        return "FAILED"
    case TransactionStatusReversed:
        return "REVERSED"
    default:
        return "UNKNOWN"
    }
}