// @version: crypto-js@4.1.1
import CryptoJS from 'crypto-js';
import { 
  ApiHeaders, 
  HttpMethod, 
  SecurityConfig, 
  RetryConfig,
  API_VERSION,
  DEFAULT_HEADERS
} from '../types/api';

/**
 * Environment-specific API base URLs
 */
const API_BASE_URLS = {
  development: 'https://api-dev.otpless-billing.com',
  staging: 'https://api-staging.otpless-billing.com',
  production: 'https://api.otpless-billing.com'
} as const;

/**
 * Global configuration constants
 */
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RATE_LIMIT_THRESHOLD = 1000; // requests per minute

/**
 * Returns the environment-specific API base URL
 * @returns {string} Base URL for API requests
 */
export const getBaseUrl = (): string => {
  const env = process.env.REACT_APP_ENV || 'development';
  return API_BASE_URLS[env as keyof typeof API_BASE_URLS];
};

/**
 * Generates HMAC signature for API requests
 * @param payload - Request payload to sign
 * @param secretKey - Secret key for signing
 * @returns {string} HMAC signature
 */
export const generateRequestSignature = (payload: unknown, secretKey: string): string => {
  const timestamp = Date.now().toString();
  const normalizedPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signatureString = `${timestamp}.${normalizedPayload}`;
  
  const hmac = CryptoJS.HmacSHA256(signatureString, secretKey);
  return CryptoJS.enc.Base64.stringify(hmac);
};

/**
 * API endpoints configuration
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    RESET_PASSWORD: '/auth/reset-password',
    MFA: '/auth/mfa'
  },
  BILLING: {
    PRICE_PLANS: '/billing/price-plans',
    USAGE: '/billing/usage',
    METRICS: '/billing/metrics',
    ANALYTICS: '/billing/analytics'
  },
  CUSTOMERS: {
    LIST: '/customers',
    DETAILS: '/customers/:id',
    CREATE: '/customers',
    UPDATE: '/customers/:id',
    AUDIT: '/customers/:id/audit'
  },
  INVOICES: {
    LIST: '/invoices',
    GENERATE: '/invoices/generate',
    DOWNLOAD: '/invoices/:id/download',
    PREVIEW: '/invoices/preview'
  },
  WALLET: {
    BALANCE: '/wallet/balance',
    TRANSACTIONS: '/wallet/transactions',
    TOPUP: '/wallet/topup',
    ALERTS: '/wallet/alerts'
  },
  SYSTEM: {
    HEALTH: '/system/health',
    VERSION: '/system/version',
    RATE_LIMITS: '/system/rate-limits',
    METRICS: '/system/metrics'
  }
} as const;

/**
 * Security configuration
 */
const securityConfig: SecurityConfig = {
  enableCSRF: true,
  csrfHeaderName: 'X-CSRF-Token',
  enableRequestSigning: true,
  signatureHeaderName: 'X-Request-Signature',
  rateLimitThreshold: RATE_LIMIT_THRESHOLD,
  allowedOrigins: [
    'https://billing.otpless.com',
    'https://staging-billing.otpless.com'
  ]
};

/**
 * Retry configuration
 */
const retryConfig: RetryConfig = {
  maxRetries: MAX_RETRIES,
  retryDelay: 1000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryCondition: (error: any) => {
    return retryConfig.retryableStatusCodes.includes(error?.response?.status);
  }
};

/**
 * Main API configuration object
 */
export const apiConfig = {
  baseURL: getBaseUrl(),
  timeout: DEFAULT_TIMEOUT,
  version: API_VERSION,
  headers: {
    ...DEFAULT_HEADERS,
    'X-API-Version': API_VERSION,
    'X-Client-Platform': 'web',
    'X-Request-ID': '', // Will be set per request
    'X-API-Key': process.env.REACT_APP_API_KEY || ''
  } as ApiHeaders,
  security: securityConfig,
  retry: retryConfig,
  validateStatus: (status: number) => status >= 200 && status < 300,
  methods: HttpMethod,
  transformRequest: [(data: any) => {
    return JSON.stringify(data);
  }],
  transformResponse: [(data: string) => {
    try {
      return JSON.parse(data);
    } catch (error) {
      return data;
    }
  }]
};

/**
 * Export default configuration
 */
export default apiConfig;