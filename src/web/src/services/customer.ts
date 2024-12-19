// @version: axios@1.6.0
import { 
  get, 
  post, 
  put, 
  delete as del,
  handleApiError,
  monitorRateLimit 
} from '../services/api';
import { API_ENDPOINTS } from '../config/api';
import {
  Customer,
  CustomerAccount,
  CustomerFilters,
  CustomerListResponse,
  CustomerStatus,
  CustomerType,
  ApiError,
  CreateCustomerRequest,
  UpdateCustomerRequest
} from '../types/customer';

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_PREFIX = 'customer_';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * In-memory cache implementation
 */
const cache = new Map<string, CacheEntry<any>>();

/**
 * Retrieves data from cache if valid
 */
const getFromCache = <T>(key: string): T | null => {
  const entry = cache.get(`${CACHE_PREFIX}${key}`);
  if (!entry) return null;

  const isExpired = Date.now() - entry.timestamp > CACHE_TTL;
  if (isExpired) {
    cache.delete(`${CACHE_PREFIX}${key}`);
    return null;
  }

  return entry.data as T;
};

/**
 * Stores data in cache
 */
const setInCache = <T>(key: string, data: T): void => {
  cache.set(`${CACHE_PREFIX}${key}`, {
    data,
    timestamp: Date.now()
  });
};

/**
 * Enhanced customer service with caching, error handling, and rate limiting
 */
const customerService = {
  /**
   * Retrieves a paginated list of customers with filtering
   */
  async getCustomers(
    filters: CustomerFilters = {},
    pagination = { page: 1, limit: 20 }
  ): Promise<CustomerListResponse> {
    try {
      const cacheKey = `list_${JSON.stringify(filters)}_${JSON.stringify(pagination)}`;
      const cachedData = getFromCache<CustomerListResponse>(cacheKey);
      if (cachedData) return cachedData;

      const queryParams = {
        ...pagination,
        ...filters,
        dateRange: filters.dateRange ? {
          start: filters.dateRange.start,
          end: filters.dateRange.end
        } : undefined
      };

      const response = await get<CustomerListResponse>(
        API_ENDPOINTS.CUSTOMERS.LIST,
        queryParams
      );

      setInCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw handleApiError(error as ApiError);
    }
  },

  /**
   * Retrieves customer details by ID with caching
   */
  async getCustomerById(customerId: string): Promise<Customer> {
    try {
      const cacheKey = `detail_${customerId}`;
      const cachedData = getFromCache<Customer>(cacheKey);
      if (cachedData) return cachedData;

      const response = await get<Customer>(
        API_ENDPOINTS.CUSTOMERS.DETAILS.replace(':id', customerId)
      );

      setInCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw handleApiError(error as ApiError);
    }
  },

  /**
   * Creates a new customer with validation
   */
  async createCustomer(customerData: CreateCustomerRequest): Promise<Customer> {
    try {
      // Validate required fields
      if (!customerData.name || !customerData.email) {
        throw new Error('Name and email are required fields');
      }

      const response = await post<Customer>(
        API_ENDPOINTS.CUSTOMERS.CREATE,
        customerData
      );

      // Clear relevant cache entries
      cache.clear(); // Clear all customer cache on creation
      return response.data;
    } catch (error) {
      throw handleApiError(error as ApiError);
    }
  },

  /**
   * Updates existing customer information
   */
  async updateCustomer(
    customerId: string,
    updateData: UpdateCustomerRequest
  ): Promise<Customer> {
    try {
      const response = await put<Customer>(
        API_ENDPOINTS.CUSTOMERS.UPDATE.replace(':id', customerId),
        updateData
      );

      // Clear specific cache entries
      cache.delete(`${CACHE_PREFIX}detail_${customerId}`);
      cache.delete(`${CACHE_PREFIX}list_`); // Clear list cache
      return response.data;
    } catch (error) {
      throw handleApiError(error as ApiError);
    }
  },

  /**
   * Deletes a customer by ID
   */
  async deleteCustomer(customerId: string): Promise<void> {
    try {
      await del(API_ENDPOINTS.CUSTOMERS.DETAILS.replace(':id', customerId));
      
      // Clear relevant cache entries
      cache.delete(`${CACHE_PREFIX}detail_${customerId}`);
      cache.delete(`${CACHE_PREFIX}list_`); // Clear list cache
    } catch (error) {
      throw handleApiError(error as ApiError);
    }
  },

  /**
   * Retrieves customer account details with wallet information
   */
  async getCustomerAccount(customerId: string): Promise<CustomerAccount> {
    try {
      const cacheKey = `account_${customerId}`;
      const cachedData = getFromCache<CustomerAccount>(cacheKey);
      if (cachedData) return cachedData;

      const response = await get<CustomerAccount>(
        `${API_ENDPOINTS.CUSTOMERS.DETAILS.replace(':id', customerId)}/account`
      );

      setInCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw handleApiError(error as ApiError);
    }
  },

  /**
   * Updates customer status with validation
   */
  async updateCustomerStatus(
    customerId: string,
    status: CustomerStatus
  ): Promise<Customer> {
    try {
      const response = await put<Customer>(
        `${API_ENDPOINTS.CUSTOMERS.DETAILS.replace(':id', customerId)}/status`,
        { status }
      );

      // Clear relevant cache entries
      cache.delete(`${CACHE_PREFIX}detail_${customerId}`);
      cache.delete(`${CACHE_PREFIX}list_`); // Clear list cache
      return response.data;
    } catch (error) {
      throw handleApiError(error as ApiError);
    }
  },

  /**
   * Retrieves customer audit logs
   */
  async getCustomerAuditLogs(
    customerId: string,
    pagination = { page: 1, limit: 20 }
  ): Promise<any> {
    try {
      const response = await get(
        API_ENDPOINTS.CUSTOMERS.AUDIT.replace(':id', customerId),
        pagination
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error as ApiError);
    }
  }
};

export default customerService;