// @version: axios@1.x
// @version: uuid@9.x
import { v4 as uuidv4 } from 'uuid';
import { get, post } from './api';
import { API_ENDPOINTS } from '../config/api';
import {
  Wallet,
  Transaction,
  WalletBalance,
  TopUpRequest,
  WalletResponse,
  TransactionResponse,
  WalletStatus,
  TransactionStatus
} from '../types/wallet';

/**
 * Enhanced wallet service implementing real-time wallet operations
 * with multi-currency support and comprehensive error handling
 */
class WalletService {
  private readonly endpoints = API_ENDPOINTS.WALLET;
  private readonly BALANCE_CHECK_INTERVAL = 30000; // 30 seconds
  private balanceCheckIntervals: Map<string, NodeJS.Timer> = new Map();

  /**
   * Retrieves current wallet balance with real-time validation
   * @param customerId - Customer identifier
   * @returns Promise resolving to wallet balance response
   */
  async getWalletBalance(customerId: string): Promise<WalletResponse> {
    if (!customerId?.trim()) {
      throw new Error('Invalid customer ID provided');
    }

    const response = await get<Wallet>(
      `${this.endpoints.BALANCE}/${customerId}`,
      undefined,
      {
        headers: {
          'X-Idempotency-Key': uuidv4(),
          'X-Customer-ID': customerId
        }
      }
    );

    // Start real-time balance monitoring if not already active
    this.startBalanceMonitoring(customerId);

    return response;
  }

  /**
   * Retrieves paginated transaction history with enhanced filtering
   * @param walletId - Wallet identifier
   * @param params - Query parameters for filtering and pagination
   * @returns Promise resolving to transaction list response
   */
  async getTransactionHistory(
    walletId: string,
    params: {
      page: number;
      limit: number;
      sortBy?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<TransactionResponse[]> {
    if (!walletId?.trim()) {
      throw new Error('Invalid wallet ID provided');
    }

    // Validate date range if provided
    if (params.startDate && params.endDate) {
      const start = new Date(params.startDate);
      const end = new Date(params.endDate);
      if (start > end) {
        throw new Error('Invalid date range: start date must be before end date');
      }
    }

    return get<Transaction[]>(
      `${this.endpoints.TRANSACTIONS}/${walletId}`,
      {
        ...params,
        sortBy: params.sortBy || 'createdAt',
        sortOrder: 'desc'
      }
    );
  }

  /**
   * Initiates a wallet top-up transaction with enhanced validation
   * @param topUpData - Top-up request data
   * @returns Promise resolving to transaction response
   */
  async topUpWallet(topUpData: TopUpRequest): Promise<TransactionResponse> {
    // Validate amount and currency
    if (!this.isValidAmount(topUpData.amount)) {
      throw new Error('Invalid amount provided');
    }

    if (!this.isValidCurrency(topUpData.currency)) {
      throw new Error('Invalid or unsupported currency');
    }

    const idempotencyKey = uuidv4();
    
    return post<Transaction>(
      this.endpoints.TOPUP,
      {
        ...topUpData,
        referenceId: `TOP_UP_${idempotencyKey}`,
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          'X-Idempotency-Key': idempotencyKey,
          'X-Wallet-ID': topUpData.walletId
        }
      }
    );
  }

  /**
   * Checks if wallet balance is below threshold with currency-aware comparison
   * @param balance - Current wallet balance
   * @param threshold - Balance threshold
   * @returns Boolean indicating if balance is below threshold
   */
  checkLowBalance(balance: WalletBalance, threshold: number): boolean {
    if (!this.isValidAmount(balance.balance) || !this.isValidAmount(threshold)) {
      throw new Error('Invalid balance or threshold values');
    }

    const isLow = balance.balance < threshold;
    
    if (isLow) {
      this.emitLowBalanceAlert(balance);
    }

    return isLow;
  }

  /**
   * Starts real-time balance monitoring for a wallet
   * @param customerId - Customer identifier
   * @private
   */
  private startBalanceMonitoring(customerId: string): void {
    if (this.balanceCheckIntervals.has(customerId)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await this.getWalletBalance(customerId);
        const wallet = response.data;

        // Emit balance update event
        this.emitBalanceUpdate(wallet);

        // Check for low balance condition
        if (wallet.status === WalletStatus.LOW_BALANCE) {
          this.emitLowBalanceAlert({
            balance: wallet.balance,
            currency: wallet.currency,
            status: wallet.status,
            lastUpdated: wallet.updatedAt
          });
        }
      } catch (error) {
        console.error('Balance monitoring error:', error);
      }
    }, this.BALANCE_CHECK_INTERVAL);

    this.balanceCheckIntervals.set(customerId, interval);
  }

  /**
   * Stops real-time balance monitoring for a wallet
   * @param customerId - Customer identifier
   * @private
   */
  private stopBalanceMonitoring(customerId: string): void {
    const interval = this.balanceCheckIntervals.get(customerId);
    if (interval) {
      clearInterval(interval);
      this.balanceCheckIntervals.delete(customerId);
    }
  }

  /**
   * Validates amount precision and value
   * @param amount - Amount to validate
   * @private
   */
  private isValidAmount(amount: number): boolean {
    return (
      !isNaN(amount) &&
      isFinite(amount) &&
      amount >= 0 &&
      Number.isInteger(amount * 100) // Ensures max 2 decimal places
    );
  }

  /**
   * Validates currency code format
   * @param currency - Currency code to validate
   * @private
   */
  private isValidCurrency(currency: string): boolean {
    return /^[A-Z]{3}$/.test(currency);
  }

  /**
   * Emits balance update event
   * @param wallet - Updated wallet data
   * @private
   */
  private emitBalanceUpdate(wallet: Wallet): void {
    const event = new CustomEvent('walletBalanceUpdate', {
      detail: {
        walletId: wallet.id,
        balance: wallet.balance,
        currency: wallet.currency,
        status: wallet.status,
        timestamp: new Date().toISOString()
      }
    });
    window.dispatchEvent(event);
  }

  /**
   * Emits low balance alert event
   * @param balance - Current balance information
   * @private
   */
  private emitLowBalanceAlert(balance: WalletBalance): void {
    const event = new CustomEvent('walletLowBalanceAlert', {
      detail: {
        ...balance,
        timestamp: new Date().toISOString()
      }
    });
    window.dispatchEvent(event);
  }

  /**
   * Cleanup method to stop all monitoring intervals
   * Should be called when component unmounts
   */
  cleanup(): void {
    this.balanceCheckIntervals.forEach((interval, customerId) => {
      this.stopBalanceMonitoring(customerId);
    });
  }
}

// Export singleton instance
export const walletService = new WalletService();