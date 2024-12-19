// @version: typescript@5.0.x
import { ApiResponse } from './api';

/**
 * Enumeration of possible wallet states
 * Used to track wallet operational status and balance conditions
 */
export enum WalletStatus {
  ACTIVE = 'ACTIVE',           // Wallet is operational and can process transactions
  LOW_BALANCE = 'LOW_BALANCE', // Balance is below configured threshold
  SUSPENDED = 'SUSPENDED',     // Temporarily disabled, no transactions allowed
  CLOSED = 'CLOSED'           // Permanently closed, no operations possible
}

/**
 * Enumeration of supported transaction types
 * Defines the nature of wallet balance modifications
 */
export enum TransactionType {
  CREDIT = 'CREDIT',   // Incoming funds (top-up)
  DEBIT = 'DEBIT',     // Outgoing funds (usage charge)
  REFUND = 'REFUND'    // Return of previously debited funds
}

/**
 * Enumeration of possible transaction states
 * Tracks the lifecycle of a wallet transaction
 */
export enum TransactionStatus {
  INITIATED = 'INITIATED',     // Transaction created, pending processing
  PROCESSING = 'PROCESSING',   // Transaction is being processed
  COMPLETED = 'COMPLETED',     // Transaction successfully completed
  FAILED = 'FAILED',          // Transaction failed to process
  REVERSED = 'REVERSED'       // Transaction was reversed after completion
}

/**
 * Core wallet entity type definition
 * Represents a customer's wallet with balance and status tracking
 */
export interface Wallet {
  id: string;                    // Unique wallet identifier
  customerId: string;            // Associated customer identifier
  balance: number;               // Current wallet balance
  currency: string;              // Wallet currency (ISO 4217)
  lowBalanceThreshold: number;   // Threshold for low balance alerts
  status: WalletStatus;          // Current wallet status
  lastTransactionAt: string;     // ISO 8601 timestamp of last transaction
  createdAt: string;            // ISO 8601 timestamp of wallet creation
  updatedAt: string;            // ISO 8601 timestamp of last update
}

/**
 * Transaction entity type definition
 * Represents a single wallet transaction with enhanced tracking and metadata
 */
export interface Transaction {
  id: string;                              // Unique transaction identifier
  walletId: string;                        // Associated wallet identifier
  type: TransactionType;                   // Transaction type
  status: TransactionStatus;               // Current transaction status
  amount: number;                          // Transaction amount
  currency: string;                        // Transaction currency (ISO 4217)
  description: string;                     // Transaction description
  referenceId: string;                     // External reference identifier
  metadata: Record<string, unknown>;       // Additional transaction metadata
  createdAt: string;                       // ISO 8601 timestamp of creation
}

/**
 * Simplified wallet balance type for UI display
 * Used for real-time balance updates and status tracking
 */
export interface WalletBalance {
  balance: number;              // Current balance amount
  currency: string;             // Balance currency (ISO 4217)
  status: WalletStatus;         // Current wallet status
  lastUpdated: string;          // ISO 8601 timestamp of last update
}

/**
 * Type definition for wallet top-up request
 * Used when adding funds to a wallet
 */
export interface TopUpRequest {
  walletId: string;                        // Target wallet identifier
  amount: number;                          // Top-up amount
  currency: string;                        // Currency (ISO 4217)
  paymentMethod: string;                   // Payment method identifier
  metadata: Record<string, unknown>;       // Additional request metadata
}

/**
 * Type alias for wallet API responses
 * Wraps wallet data in standard API response format
 */
export type WalletResponse = ApiResponse<Wallet>;

/**
 * Type alias for transaction API responses
 * Wraps transaction data in standard API response format
 */
export type TransactionResponse = ApiResponse<Transaction>;