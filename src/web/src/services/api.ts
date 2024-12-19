// @version: axios@1.x
// @version: uuid@9.x
import axios, { AxiosInstance, AxiosResponse, AxiosError, AxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { 
  apiConfig, 
  API_ENDPOINTS, 
  generateRequestSignature 
} from '../config/api';
import {
  ApiHeaders,
  HttpMethod,
  ApiResponse,
  ApiError,
  PaginationParams,
  RateLimitInfo,
  ValidationError,
  ApiErrorCode,
  ApiStatus,
  isApiError
} from '../types/api';

/**
 * Global rate limit tracking
 */
let rateLimitInfo: RateLimitInfo = {
  limit: 0,
  remaining: 0,
  reset: 0
};

/**
 * Creates and configures an enhanced Axios instance with security and monitoring features
 */
const createApiClient = (): AxiosInstance => {
  const instance = axios.create(apiConfig);

  // Request interceptor for authentication and tracking
  instance.interceptors.request.use((config) => {
    const requestId = uuidv4();
    config.headers = {
      ...config.headers,
      'X-Request-ID': requestId
    };

    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add CSRF token for non-GET requests
    if (apiConfig.security.enableCSRF && config.method !== 'GET') {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      if (csrfToken) {
        config.headers[apiConfig.security.csrfHeaderName] = csrfToken;
      }
    }

    // Sign request if enabled
    if (apiConfig.security.enableRequestSigning && config.data) {
      const signature = generateRequestSignature(config.data, process.env.REACT_APP_API_SECRET || '');
      config.headers[apiConfig.security.signatureHeaderName] = signature;
    }

    return config;
  });

  // Response interceptor for error handling
  instance.interceptors.response.use(
    (response) => {
      // Update rate limit info
      monitorRateLimit(response);
      return response;
    },
    async (error: AxiosError) => {
      const enhancedError = await handleError(error);
      return Promise.reject(enhancedError);
    }
  );

  return instance;
};

/**
 * Enhanced error handling with validation and rate limit processing
 */
const handleError = async (error: AxiosError): Promise<ApiError> => {
  const apiError: ApiError = {
    status: 'error',
    code: ApiErrorCode.INTERNAL_SERVER_ERROR,
    message: 'An unexpected error occurred',
    details: {},
  };

  if (isApiError(error) && error.response) {
    const { data, headers } = error.response;
    
    apiError.code = data.code || apiError.code;
    apiError.message = data.message || apiError.message;
    apiError.details = data.details || {};

    // Handle validation errors
    if (data.validation_errors) {
      apiError.validation_errors = data.validation_errors;
    }

    // Handle rate limiting
    if (error.response.status === 429) {
      apiError.code = ApiErrorCode.RATE_LIMIT_EXCEEDED;
      apiError.retry_after = parseInt(headers['retry-after'] || '60', 10);
    }

    // Log error for monitoring
    console.error(`API Error [${apiError.code}]:`, {
      url: error.config?.url,
      method: error.config?.method,
      requestId: error.config?.headers['X-Request-ID'],
      error: apiError
    });
  }

  return apiError;
};

/**
 * Monitors and updates rate limit information
 */
const monitorRateLimit = (response: AxiosResponse): RateLimitInfo => {
  const headers = response.headers;
  const newRateLimitInfo: RateLimitInfo = {
    limit: parseInt(headers['x-rate-limit-limit'] || '0', 10),
    remaining: parseInt(headers['x-rate-limit-remaining'] || '0', 10),
    reset: parseInt(headers['x-rate-limit-reset'] || '0', 10)
  };

  rateLimitInfo = newRateLimitInfo;

  // Emit warning event if approaching limit
  if (newRateLimitInfo.remaining < (newRateLimitInfo.limit * 0.1)) {
    const event = new CustomEvent('rateLimitWarning', { detail: newRateLimitInfo });
    window.dispatchEvent(event);
  }

  return newRateLimitInfo;
};

/**
 * Enhanced GET request with pagination and monitoring
 */
const get = async <T>(
  endpoint: string, 
  params?: PaginationParams,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  try {
    const response = await apiClient.get<ApiResponse<T>>(endpoint, {
      params,
      ...config,
    });
    return response.data;
  } catch (error) {
    throw await handleError(error as AxiosError);
  }
};

/**
 * Enhanced POST request with security and monitoring
 */
const post = async <T>(
  endpoint: string,
  data: unknown,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  try {
    const response = await apiClient.post<ApiResponse<T>>(endpoint, data, config);
    return response.data;
  } catch (error) {
    throw await handleError(error as AxiosError);
  }
};

/**
 * Enhanced PUT request with security and monitoring
 */
const put = async <T>(
  endpoint: string,
  data: unknown,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  try {
    const response = await apiClient.put<ApiResponse<T>>(endpoint, data, config);
    return response.data;
  } catch (error) {
    throw await handleError(error as AxiosError);
  }
};

/**
 * Enhanced DELETE request with security and monitoring
 */
const del = async <T>(
  endpoint: string,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  try {
    const response = await apiClient.delete<ApiResponse<T>>(endpoint, config);
    return response.data;
  } catch (error) {
    throw await handleError(error as AxiosError);
  }
};

/**
 * Get current rate limit information
 */
const getRateLimitInfo = (): RateLimitInfo => {
  return { ...rateLimitInfo };
};

// Create and configure the API client instance
const apiClient = createApiClient();

// Export the enhanced API client with all methods
export {
  apiClient,
  get,
  post,
  put,
  del as delete,
  getRateLimitInfo,
  API_ENDPOINTS
};

export type {
  ApiResponse,
  ApiError,
  RateLimitInfo,
  ValidationError
};