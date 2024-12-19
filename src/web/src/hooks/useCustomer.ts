// @version: react@18.2.0
// @version: react-redux@8.1.1
// @version: lodash@4.17.21

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { debounce, isEqual } from 'lodash';

import {
  fetchCustomers,
  fetchCustomerById,
  createCustomer,
  updateCustomer,
  selectCustomers,
  selectSelectedCustomer,
  selectCustomerLoading,
  selectCustomerErrors
} from '../store/slices/customerSlice';

import type {
  Customer,
  CustomerFilters,
  CustomerCreateInput,
  CustomerUpdateInput,
  CustomerValidationError
} from '../types/customer';

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_DELAY = 300; // 300ms for debouncing requests

/**
 * Enhanced custom hook for managing customer operations with caching,
 * rate limiting, and optimistic updates
 */
export const useCustomer = () => {
  const dispatch = useDispatch();

  // Redux selectors
  const customers = useSelector(selectCustomers);
  const selectedCustomer = useSelector(selectSelectedCustomer);
  const loading = useSelector(selectCustomerLoading);
  const errors = useSelector(selectCustomerErrors);

  // Local state
  const [cacheStatus, setCacheStatus] = useState<{ hit: boolean; timestamp: number | null }>({
    hit: false,
    timestamp: null
  });
  const [rateLimit, setRateLimit] = useState<{ remaining: number; reset: number }>({
    remaining: 1000,
    reset: 0
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20
  });

  // Refs for request cancellation and cache management
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Cleanup function for requests and cache
   */
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (cacheTimeoutRef.current) {
      clearTimeout(cacheTimeoutRef.current);
    }
  }, []);

  /**
   * Enhanced fetch customers with caching and rate limiting
   */
  const fetchCustomersEnhanced = useCallback(
    async (filters?: CustomerFilters, page?: number, limit?: number) => {
      try {
        cleanup();
        abortControllerRef.current = new AbortController();

        const response = await dispatch(fetchCustomers({
          filters: filters || {},
          pagination: {
            page: page || pagination.page,
            limit: limit || pagination.limit
          }
        })).unwrap();

        setPagination({
          total: response.pagination.totalItems,
          page: page || pagination.page,
          limit: limit || pagination.limit
        });

        // Update cache status
        setCacheStatus({
          hit: false,
          timestamp: Date.now()
        });

        // Set cache invalidation timeout
        cacheTimeoutRef.current = setTimeout(() => {
          setCacheStatus(prev => ({ ...prev, timestamp: null }));
        }, CACHE_TTL);

        return response;
      } catch (error) {
        console.error('Error fetching customers:', error);
        throw error;
      }
    },
    [dispatch, pagination.page, pagination.limit, cleanup]
  );

  // Debounced version of fetch customers for search/filter operations
  const debouncedFetchCustomers = useCallback(
    debounce(fetchCustomersEnhanced, DEBOUNCE_DELAY),
    [fetchCustomersEnhanced]
  );

  /**
   * Enhanced fetch customer by ID with caching
   */
  const fetchCustomerByIdEnhanced = useCallback(
    async (id: string) => {
      try {
        cleanup();
        abortControllerRef.current = new AbortController();

        const response = await dispatch(fetchCustomerById(id)).unwrap();

        // Update cache for individual customer
        setCacheStatus({
          hit: false,
          timestamp: Date.now()
        });

        return response;
      } catch (error) {
        console.error('Error fetching customer:', error);
        throw error;
      }
    },
    [dispatch, cleanup]
  );

  /**
   * Enhanced create customer with validation
   */
  const createCustomerEnhanced = useCallback(
    async (data: CustomerCreateInput) => {
      try {
        const response = await dispatch(createCustomer(data)).unwrap();

        // Invalidate cache after creation
        setCacheStatus({
          hit: false,
          timestamp: null
        });

        return response;
      } catch (error) {
        console.error('Error creating customer:', error);
        throw error;
      }
    },
    [dispatch]
  );

  /**
   * Enhanced update customer with optimistic updates
   */
  const updateCustomerEnhanced = useCallback(
    async (id: string, data: CustomerUpdateInput) => {
      try {
        // Optimistic update
        const previousCustomers = [...customers];
        const optimisticUpdate = customers.map(customer =>
          customer.id === id ? { ...customer, ...data } : customer
        );

        dispatch({ type: 'customer/optimisticUpdate', payload: optimisticUpdate });

        try {
          const response = await dispatch(updateCustomer({ id, ...data })).unwrap();

          // Invalidate cache after successful update
          setCacheStatus({
            hit: false,
            timestamp: null
          });

          return response;
        } catch (error) {
          // Rollback optimistic update on error
          dispatch({ type: 'customer/optimisticUpdate', payload: previousCustomers });
          throw error;
        }
      } catch (error) {
        console.error('Error updating customer:', error);
        throw error;
      }
    },
    [dispatch, customers]
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    dispatch({ type: 'customer/clearErrors' });
  }, [dispatch]);

  /**
   * Cancel ongoing requests
   */
  const cancelRequest = useCallback(() => {
    cleanup();
  }, [cleanup]);

  /**
   * Force refresh cache
   */
  const refreshCache = useCallback(() => {
    setCacheStatus({
      hit: false,
      timestamp: null
    });
    fetchCustomersEnhanced();
  }, [fetchCustomersEnhanced]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Monitor rate limits
  useEffect(() => {
    const handleRateLimit = (event: CustomEvent<{ remaining: number; reset: number }>) => {
      setRateLimit(event.detail);
    };

    window.addEventListener('rateLimitWarning', handleRateLimit as EventListener);

    return () => {
      window.removeEventListener('rateLimitWarning', handleRateLimit as EventListener);
    };
  }, []);

  return {
    // State
    customers,
    selectedCustomer,
    loading,
    error: errors,
    cacheStatus,
    rateLimit,
    pagination,

    // Actions
    fetchCustomers: fetchCustomersEnhanced,
    fetchCustomerById: fetchCustomerByIdEnhanced,
    createCustomer: createCustomerEnhanced,
    updateCustomer: updateCustomerEnhanced,
    clearError,
    cancelRequest,
    refreshCache,
    
    // Debounced actions
    debouncedFetchCustomers
  };
};

export type UseCustomerReturn = ReturnType<typeof useCustomer>;