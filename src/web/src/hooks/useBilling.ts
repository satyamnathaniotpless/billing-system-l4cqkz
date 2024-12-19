// @version: react@18.0.0
// @version: react-redux@8.0.0
// @version: typescript@5.0.x

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchBills,
  fetchBillById,
  createNewBill,
  updateBill,
  fetchPricePlans,
  calculateBill,
  selectBills,
  selectPricePlans
} from '../store/slices/billingSlice';
import {
  Bill,
  PricePlan,
  BillStatus,
  BillingFrequency,
  BillingError,
  CurrencyCode
} from '../types/billing';
import { formatCurrency, parseCurrency, validateCurrencyInput } from '../utils/currency';
import { CACHE_CONFIG } from '../config/constants';

// Constants for the hook configuration
const DEFAULT_POLL_INTERVAL = 300000; // 5 minutes
const DEFAULT_CACHE_TIMEOUT = CACHE_CONFIG.TTL.PRICE_PLANS * 1000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEBOUNCE_DELAY = 500;

interface UseBillingOptions {
  pollInterval?: number;
  cacheTimeout?: number;
  retryAttempts?: number;
}

interface BillingCache {
  timestamp: number;
  data: any;
}

/**
 * Advanced React hook for managing billing operations with optimized performance
 * and comprehensive error handling
 */
export function useBilling(options: UseBillingOptions = {}) {
  const dispatch = useDispatch();
  const {
    pollInterval = DEFAULT_POLL_INTERVAL,
    cacheTimeout = DEFAULT_CACHE_TIMEOUT,
    retryAttempts = DEFAULT_RETRY_ATTEMPTS
  } = options;

  // Local state management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<BillingError | null>(null);
  const [cache, setCache] = useState<Record<string, BillingCache>>({});

  // Memoized selectors
  const bills = useSelector(selectBills);
  const pricePlans = useSelector(selectPricePlans);

  /**
   * Cache management utilities
   */
  const getCachedData = useCallback((key: string) => {
    const cachedItem = cache[key];
    if (cachedItem && Date.now() - cachedItem.timestamp < cacheTimeout) {
      return cachedItem.data;
    }
    return null;
  }, [cache, cacheTimeout]);

  const setCachedData = useCallback((key: string, data: any) => {
    setCache(prev => ({
      ...prev,
      [key]: { data, timestamp: Date.now() }
    }));
  }, []);

  /**
   * Error handling with retry mechanism
   */
  const handleError = useCallback((error: any, operation: string) => {
    console.error(`Billing operation failed: ${operation}`, error);
    setError({
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      operation,
      timestamp: new Date().toISOString()
    });
    setLoading(false);
  }, []);

  /**
   * Fetch bills with advanced filtering and pagination
   */
  const handleFetchBills = useCallback(async (filters?: {
    status?: BillStatus[];
    dateRange?: { start: string; end: string };
    page?: number;
    limit?: number;
  }) => {
    const cacheKey = `bills_${JSON.stringify(filters)}`;
    const cachedBills = getCachedData(cacheKey);

    if (cachedBills) {
      return cachedBills;
    }

    try {
      setLoading(true);
      const response = await dispatch(fetchBills(filters)).unwrap();
      setCachedData(cacheKey, response);
      setLoading(false);
      return response;
    } catch (error) {
      handleError(error, 'FETCH_BILLS');
      return null;
    }
  }, [dispatch, getCachedData, setCachedData, handleError]);

  /**
   * Calculate bill with currency handling and validation
   */
  const handleCalculateBill = useCallback(async (params: {
    accountId: string;
    pricePlanId: string;
    usage: number;
    currency: CurrencyCode;
  }) => {
    try {
      const validationResult = validateCurrencyInput(params.usage, params.currency);
      if (!validationResult.isValid) {
        throw new Error(validationResult.errors.join(', '));
      }

      setLoading(true);
      const response = await dispatch(calculateBill(params)).unwrap();
      
      // Format currency values in response
      const formattedResponse = {
        ...response,
        amount: formatCurrency(response.amount, params.currency),
        taxAmount: formatCurrency(response.taxAmount, params.currency),
        totalAmount: formatCurrency(response.totalAmount, params.currency)
      };

      setLoading(false);
      return formattedResponse;
    } catch (error) {
      handleError(error, 'CALCULATE_BILL');
      return null;
    }
  }, [dispatch, handleError]);

  /**
   * Create new bill with validation
   */
  const handleCreateBill = useCallback(async (billData: {
    customerId: string;
    pricePlanId: string;
    usage: number;
    currency: CurrencyCode;
  }) => {
    try {
      setLoading(true);
      const response = await dispatch(createNewBill(billData)).unwrap();
      setLoading(false);
      return response;
    } catch (error) {
      handleError(error, 'CREATE_BILL');
      return null;
    }
  }, [dispatch, handleError]);

  /**
   * Update bill status with optimistic updates
   */
  const handleUpdateBillStatus = useCallback(async (
    billId: string,
    status: BillStatus
  ) => {
    try {
      setLoading(true);
      const response = await dispatch(updateBill({ billId, status })).unwrap();
      setLoading(false);
      return response;
    } catch (error) {
      handleError(error, 'UPDATE_BILL_STATUS');
      return null;
    }
  }, [dispatch, handleError]);

  /**
   * Retry failed operation with exponential backoff
   */
  const retryFailedOperation = useCallback(async (
    operation: () => Promise<any>,
    attempts: number = retryAttempts
  ) => {
    for (let i = 0; i < attempts; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === attempts - 1) throw error;
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, i) * 1000)
        );
      }
    }
  }, [retryAttempts]);

  // Set up polling for real-time updates
  useEffect(() => {
    if (pollInterval <= 0) return;

    const pollTimer = setInterval(() => {
      handleFetchBills();
    }, pollInterval);

    return () => clearInterval(pollTimer);
  }, [pollInterval, handleFetchBills]);

  // Clean up cache periodically
  useEffect(() => {
    const cleanup = () => {
      const now = Date.now();
      setCache(prev => {
        const newCache = { ...prev };
        Object.keys(newCache).forEach(key => {
          if (now - newCache[key].timestamp > cacheTimeout) {
            delete newCache[key];
          }
        });
        return newCache;
      });
    };

    const cleanupTimer = setInterval(cleanup, cacheTimeout);
    return () => clearInterval(cleanupTimer);
  }, [cacheTimeout]);

  return {
    // State
    bills,
    pricePlans,
    loading,
    error,

    // Actions
    fetchBills: handleFetchBills,
    calculateBill: handleCalculateBill,
    createBill: handleCreateBill,
    updateBillStatus: handleUpdateBillStatus,
    retryFailedOperation,

    // Cache management
    clearCache: useCallback(() => setCache({}), []),
    clearError: useCallback(() => setError(null), [])
  };
}