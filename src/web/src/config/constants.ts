// @version: typescript@5.0.x
import { HttpMethod } from '../types/api';

/**
 * Core API configuration settings
 */
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:8080',
  VERSION: 'v1',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  MAX_CONCURRENT_REQUESTS: 10
} as const;

/**
 * API endpoints organized by domain
 */
export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    VERIFY_EMAIL: '/auth/verify-email',
    REFRESH_TOKEN: '/auth/refresh-token',
    LOGOUT: '/auth/logout'
  },
  BILLING: {
    PRICE_PLANS: '/billing/price-plans',
    INVOICES: '/billing/invoices',
    USAGE: '/billing/usage',
    PAYMENT_METHODS: '/billing/payment-methods',
    TAX_RATES: '/billing/tax-rates',
    SUBSCRIPTIONS: '/billing/subscriptions'
  },
  WALLET: {
    BALANCE: '/wallet/balance',
    TRANSACTIONS: '/wallet/transactions',
    TOPUP: '/wallet/topup',
    WITHDRAW: '/wallet/withdraw',
    LIMITS: '/wallet/limits',
    ALERTS: '/wallet/alerts'
  },
  USAGE: {
    METRICS: '/usage/metrics',
    ANALYTICS: '/usage/analytics',
    REPORTS: '/usage/reports',
    ALERTS: '/usage/alerts'
  }
} as const;

/**
 * Form validation rules and constraints based on technical specifications
 */
export const VALIDATION_RULES = {
  EMAIL: {
    MAX_LENGTH: 254, // RFC 5322 standard
    PATTERN: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
    ERROR_MESSAGES: {
      REQUIRED: 'Email is required',
      INVALID: 'Please enter a valid email address',
      MAX_LENGTH: 'Email must not exceed 254 characters'
    }
  },
  PHONE: {
    FORMAT: 'E.164',
    MIN_LENGTH: 10,
    MAX_LENGTH: 15,
    PATTERN: /^\+[1-9]\d{1,14}$/, // E.164 format
    ERROR_MESSAGES: {
      REQUIRED: 'Phone number is required',
      INVALID: 'Please enter a valid phone number',
      LENGTH: 'Phone number must be between 10 and 15 digits'
    }
  },
  CURRENCY: {
    DECIMAL_PLACES: 2,
    MIN_VALUE: 0,
    MAX_VALUE: 1000000,
    SUPPORTED_CURRENCIES: ['USD', 'INR', 'IDR'] as const,
    ERROR_MESSAGES: {
      REQUIRED: 'Amount is required',
      MIN: 'Amount must be greater than 0',
      MAX: 'Amount exceeds maximum limit',
      DECIMAL: 'Amount must have exactly 2 decimal places'
    }
  },
  DATE: {
    MIN_YEAR: 2020,
    MAX_YEAR: new Date().getFullYear() + 10,
    ERROR_MESSAGES: {
      REQUIRED: 'Date is required',
      INVALID: 'Please enter a valid date',
      FUTURE_ONLY: 'Date must be in the future',
      PAST_ONLY: 'Date must be in the past'
    }
  }
} as const;

/**
 * Responsive design breakpoints in pixels
 */
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1440,
  LARGE_DESKTOP: 1920
} as const;

/**
 * Pagination configuration
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100] as const
} as const;

/**
 * Date format configurations
 */
export const DATE_FORMATS = {
  DISPLAY: 'DD MMM YYYY',
  API: 'YYYY-MM-DD',
  TIMESTAMP: 'YYYY-MM-DD HH:mm:ss',
  TIME_ZONE: 'UTC',
  LOCALE: 'en-US'
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

/**
 * API request methods mapping
 */
export const REQUEST_METHODS = {
  GET: HttpMethod.GET,
  POST: HttpMethod.POST,
  PATCH: HttpMethod.PATCH,
  DELETE: HttpMethod.DELETE
} as const;

/**
 * Theme configuration constants
 */
export const THEME_CONFIG = {
  STORAGE_KEY: 'theme-preference',
  MODES: {
    LIGHT: 'light',
    DARK: 'dark'
  },
  COLORS: {
    PRIMARY: '#1976D2',
    SECONDARY: '#90CAF9',
    SUCCESS: '#4CAF50',
    ERROR: '#F44336',
    WARNING: '#FFC107'
  }
} as const;

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  TTL: {
    PRICE_PLANS: 3600, // 1 hour
    WALLET_BALANCE: 30, // 30 seconds
    USAGE_METRICS: 300, // 5 minutes
    CUSTOMER_PROFILE: 900 // 15 minutes
  },
  STORAGE_PREFIX: 'otpless_billing_'
} as const;