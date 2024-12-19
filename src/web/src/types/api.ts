// @version: axios@1.x
import { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

/**
 * API version constant
 */
export const API_VERSION = 'v1';

/**
 * Default headers for API requests
 */
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
} as const;

/**
 * HTTP methods supported by the API
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH'
}

/**
 * Enhanced type definition for HTTP request headers
 * Includes security and rate limiting headers
 */
export interface ApiHeaders {
  'Authorization': string;
  'Content-Type': string;
  'Accept': string;
  'X-API-Key': string;
  'X-Request-ID': string;
  'X-Rate-Limit-Limit': number;
  'X-Rate-Limit-Remaining': number;
  'X-Rate-Limit-Reset': number;
}

/**
 * Type definition for pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/**
 * Type definition for pagination metadata
 */
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

/**
 * Type definition for response metadata
 */
export interface MetaData {
  timestamp: string;
  version: string;
  pagination?: PaginationMeta;
}

/**
 * Enhanced generic type for API responses
 */
export interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  meta: MetaData;
  error_code?: string;
  request_id: string;
}

/**
 * Type definition for field-level validation errors
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Enhanced type definition for API error responses
 */
export interface ApiError {
  status: 'error';
  code: string;
  message: string;
  details: Record<string, unknown>;
  validation_errors?: ValidationError[];
  retry_after?: number;
}

/**
 * Type definition for JWT authentication tokens
 */
export interface AuthToken {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope?: string;
}

/**
 * Type definition for rate limiting information
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Enhanced type for API error responses with Axios integration
 */
export type ApiErrorResponse = AxiosError<ApiError>;

/**
 * Type guard to check if an error is an API error
 */
export function isApiError(error: unknown): error is ApiErrorResponse {
  return (
    error instanceof Error &&
    'isAxiosError' in error &&
    error.isAxiosError === true &&
    error.response?.data?.status === 'error'
  );
}

/**
 * Enhanced type for API request configuration
 */
export interface ApiRequestConfig extends AxiosRequestConfig {
  skipAuth?: boolean;
  skipRetry?: boolean;
  retryCount?: number;
}

/**
 * Enhanced type for API response with rate limit information
 */
export interface ApiResponseWithRateLimit<T> extends AxiosResponse<ApiResponse<T>> {
  headers: {
    'x-rate-limit-limit': string;
    'x-rate-limit-remaining': string;
    'x-rate-limit-reset': string;
  };
}

/**
 * Type definition for API endpoints
 */
export interface ApiEndpoint {
  path: string;
  method: HttpMethod;
  requiresAuth: boolean;
  rateLimit: RateLimitInfo;
}

/**
 * Type definition for API error codes
 */
export enum ApiErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}

/**
 * Type definition for API response status
 */
export type ApiStatus = 'success' | 'error';

/**
 * Type definition for API sort order
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Type definition for API query parameters
 */
export interface ApiQueryParams extends Record<string, string | number | boolean | undefined> {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
  search?: string;
  filter?: string;
}