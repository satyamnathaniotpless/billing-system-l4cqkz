// @version: react@18.x
// @version: react-redux@8.1.x
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { walletService } from '../../services/wallet';
import {
  fetchWalletBalance,
  fetchTransactionHistory,
  topUpWallet,
  setWebsocketStatus,
  updateWalletBalance,
  resetError,
  updatePagination,
  selectWalletState,
  selectWalletBalance,
  selectTransactions,
  selectLowBalanceStatus,
  selectIsLoading,
  ConnectionStatus
} from '../../store/slices/walletSlice';
import type { 
  Wallet, 
  Transaction, 
  WalletBalance, 
  TopUpRequest,
  WalletStatus 
} from '../../types/wallet';

// Constants for retry and cache configuration
const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 3;
const CACHE_DURATION_MS = 300000; // 5 minutes
const WS_RECONNECT_DELAY_MS = 3000;

interface UseWalletOptions {
  enableRealTimeUpdates?: boolean;
  cacheTimeout?: number;
  lowBalanceThreshold?: number;
  retryAttempts?: number;
}

interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
}

/**
 * Enhanced custom hook for managing wallet operations with real-time updates and caching
 * @param customerId - Customer identifier for wallet operations
 * @param options - Configuration options for the hook
 */
export const useWallet = (
  customerId: string,
  options: UseWalletOptions = {}
) => {
  const dispatch = useDispatch();
  const walletState = useSelector(selectWalletState);
  const balance = useSelector(selectWalletBalance);
  const transactions = useSelector(selectTransactions);
  const isLowBalance = useSelector(selectLowBalanceStatus);
  const isLoading = useSelector(selectIsLoading);

  // Local state for enhanced error handling and WebSocket management
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);

  // Memoized configuration
  const config = useMemo(() => ({
    enableRealTimeUpdates: options.enableRealTimeUpdates ?? true,
    cacheTimeout: options.cacheTimeout ?? CACHE_DURATION_MS,
    lowBalanceThreshold: options.lowBalanceThreshold ?? 0,
    retryAttempts: options.retryAttempts ?? MAX_RETRIES
  }), [options]);

  /**
   * Fetches wallet balance with exponential backoff retry logic
   */
  const fetchBalanceWithRetry = useCallback(async () => {
    try {
      setError(null);
      const result = await dispatch(fetchWalletBalance(customerId)).unwrap();
      setRetryCount(0);
      return result;
    } catch (err) {
      if (retryCount < config.retryAttempts) {
        setRetryCount(prev => prev + 1);
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
        setTimeout(() => fetchBalanceWithRetry(), delay);
      } else {
        setError(err as Error);
      }
    }
  }, [customerId, dispatch, retryCount, config.retryAttempts]);

  /**
   * Fetches transaction history with pagination support
   */
  const fetchTransactionsWithPagination = useCallback(async (params: PaginationParams) => {
    if (!walletState.wallet?.id) return;

    try {
      setError(null);
      const result = await dispatch(fetchTransactionHistory({
        walletId: walletState.wallet.id,
        params
      })).unwrap();
      
      dispatch(updatePagination({
        page: params.page,
        limit: params.limit,
        total: result.meta.pagination?.totalItems ?? 0
      }));
      
      return result;
    } catch (err) {
      setError(err as Error);
    }
  }, [dispatch, walletState.wallet?.id]);

  /**
   * Handles wallet top-up operations
   */
  const handleTopUp = useCallback(async (topUpData: TopUpRequest) => {
    try {
      setError(null);
      const result = await dispatch(topUpWallet(topUpData)).unwrap();
      await fetchBalanceWithRetry();
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [dispatch, fetchBalanceWithRetry]);

  /**
   * Sets up WebSocket connection for real-time updates
   */
  const setupWebSocket = useCallback(() => {
    if (!config.enableRealTimeUpdates || !customerId) return;

    const ws = walletService.subscribeToWalletUpdates(customerId);
    
    ws.onopen = () => {
      dispatch(setWebsocketStatus(ConnectionStatus.CONNECTED));
      setWsConnection(ws);
    };

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data) as WalletBalance;
      dispatch(updateWalletBalance(update));
      
      if (update.status === WalletStatus.LOW_BALANCE) {
        walletService.checkLowBalance(update, config.lowBalanceThreshold);
      }
    };

    ws.onclose = () => {
      dispatch(setWebsocketStatus(ConnectionStatus.DISCONNECTED));
      setTimeout(setupWebSocket, WS_RECONNECT_DELAY_MS);
    };

    ws.onerror = () => {
      dispatch(setWebsocketStatus(ConnectionStatus.ERROR));
      ws.close();
    };

    return () => {
      ws.close();
      setWsConnection(null);
    };
  }, [customerId, config.enableRealTimeUpdates, config.lowBalanceThreshold, dispatch]);

  /**
   * Checks wallet balance against threshold
   */
  const checkLowBalanceStatus = useCallback(() => {
    if (!walletState.wallet) return false;
    return walletService.checkLowBalance(
      walletState.wallet,
      config.lowBalanceThreshold
    );
  }, [walletState.wallet, config.lowBalanceThreshold]);

  // Initial setup and cleanup
  useEffect(() => {
    if (!customerId) return;

    fetchBalanceWithRetry();
    const wsCleanup = setupWebSocket();

    return () => {
      wsCleanup?.();
      dispatch(resetError());
    };
  }, [customerId, fetchBalanceWithRetry, setupWebSocket, dispatch]);

  // Cache invalidation check
  useEffect(() => {
    if (!walletState.lastUpdated) return;

    const cacheTimeout = setTimeout(() => {
      if (Date.now() - walletState.lastUpdated >= config.cacheTimeout) {
        fetchBalanceWithRetry();
      }
    }, config.cacheTimeout);

    return () => clearTimeout(cacheTimeout);
  }, [walletState.lastUpdated, config.cacheTimeout, fetchBalanceWithRetry]);

  return {
    // Wallet state
    balance,
    transactions,
    isLowBalance,
    isLoading,
    error,
    
    // Pagination state
    pagination: walletState.pagination,
    
    // Connection state
    connectionStatus: walletState.websocketStatus,
    
    // Actions
    fetchBalance: fetchBalanceWithRetry,
    fetchTransactions: fetchTransactionsWithPagination,
    handleTopUp,
    checkLowBalanceStatus,
    
    // Retry state
    retryCount,
    resetError: () => dispatch(resetError())
  };
};