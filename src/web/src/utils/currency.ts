// @version: typescript@5.0.x
// @version: currency.js@2.0.4

import currency from 'currency.js';
import { VALIDATION_RULES } from '../config/constants';

/**
 * Supported currencies in the system
 */
export const SUPPORTED_CURRENCIES = VALIDATION_RULES.CURRENCY.SUPPORTED_CURRENCIES;

/**
 * Default currency for the system
 */
export const DEFAULT_CURRENCY = 'USD' as const;

/**
 * Currency locale mapping for proper formatting
 */
export const CURRENCY_LOCALE_MAP: Record<string, string> = {
  USD: 'en-US',
  IDR: 'id-ID',
  INR: 'en-IN'
} as const;

/**
 * Currency symbol mapping
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  IDR: 'Rp',
  INR: '₹'
} as const;

/**
 * Currency-specific formatting options
 */
interface CurrencyFormatOptions {
  includeSymbol?: boolean;
  useGrouping?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/**
 * Currency validation result interface
 */
interface CurrencyValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Formats a numeric value into a localized currency string
 * @param amount - Numeric amount to format
 * @param currencyCode - ISO currency code (USD, IDR, INR)
 * @param options - Formatting options
 * @returns Formatted currency string
 * @throws Error if currency code is not supported
 */
export function formatCurrency(
  amount: number,
  currencyCode: typeof SUPPORTED_CURRENCIES[number] = DEFAULT_CURRENCY,
  options: CurrencyFormatOptions = {}
): string {
  if (!SUPPORTED_CURRENCIES.includes(currencyCode)) {
    throw new Error(`Unsupported currency code: ${currencyCode}`);
  }

  const {
    includeSymbol = true,
    useGrouping = true,
    minimumFractionDigits = VALIDATION_RULES.CURRENCY.DECIMAL_PLACES,
    maximumFractionDigits = VALIDATION_RULES.CURRENCY.DECIMAL_PLACES
  } = options;

  const locale = CURRENCY_LOCALE_MAP[currencyCode];
  const symbol = CURRENCY_SYMBOLS[currencyCode];

  const currencyInstance = currency(amount, {
    symbol: includeSymbol ? symbol : '',
    precision: maximumFractionDigits,
    separator: useGrouping ? ',' : '',
    decimal: '.',
  });

  return currencyInstance.format({
    symbol: includeSymbol ? symbol : '',
    pattern: currencyCode === 'IDR' ? '# !' : '! #', // Symbol position based on locale
    separator: useGrouping ? ',' : '',
    decimal: '.',
    formatWithSymbol: includeSymbol,
  });
}

/**
 * Parses a currency string into a numeric value
 * @param currencyString - String representation of currency amount
 * @param currencyCode - ISO currency code
 * @returns Parsed numeric value
 * @throws Error if parsing fails or value is invalid
 */
export function parseCurrency(
  currencyString: string,
  currencyCode: typeof SUPPORTED_CURRENCIES[number] = DEFAULT_CURRENCY
): number {
  if (!SUPPORTED_CURRENCIES.includes(currencyCode)) {
    throw new Error(`Unsupported currency code: ${currencyCode}`);
  }

  // Remove currency symbols and formatting
  const cleanString = currencyString
    .replace(CURRENCY_SYMBOLS[currencyCode], '')
    .replace(/[,\s]/g, '')
    .trim();

  try {
    const parsed = currency(cleanString, {
      precision: VALIDATION_RULES.CURRENCY.DECIMAL_PLACES
    }).value;

    if (parsed < VALIDATION_RULES.CURRENCY.MIN_VALUE) {
      throw new Error(VALIDATION_RULES.CURRENCY.ERROR_MESSAGES.MIN);
    }

    if (parsed > VALIDATION_RULES.CURRENCY.MAX_VALUE) {
      throw new Error(VALIDATION_RULES.CURRENCY.ERROR_MESSAGES.MAX);
    }

    return parsed;
  } catch (error) {
    throw new Error(`Invalid currency format: ${error.message}`);
  }
}

/**
 * Validates a currency amount against system rules
 * @param amount - Amount to validate
 * @param currencyCode - ISO currency code
 * @returns Validation result with detailed error information
 */
export function validateCurrencyInput(
  amount: number,
  currencyCode: typeof SUPPORTED_CURRENCIES[number] = DEFAULT_CURRENCY
): CurrencyValidationResult {
  const errors: string[] = [];

  // Check if amount is a valid number
  if (!Number.isFinite(amount)) {
    errors.push('Amount must be a valid number');
    return { isValid: false, errors };
  }

  // Check currency code
  if (!SUPPORTED_CURRENCIES.includes(currencyCode)) {
    errors.push(`Unsupported currency code: ${currencyCode}`);
    return { isValid: false, errors };
  }

  // Check minimum value
  if (amount < VALIDATION_RULES.CURRENCY.MIN_VALUE) {
    errors.push(VALIDATION_RULES.CURRENCY.ERROR_MESSAGES.MIN);
  }

  // Check maximum value
  if (amount > VALIDATION_RULES.CURRENCY.MAX_VALUE) {
    errors.push(VALIDATION_RULES.CURRENCY.ERROR_MESSAGES.MAX);
  }

  // Check decimal places
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  if (decimalPlaces > VALIDATION_RULES.CURRENCY.DECIMAL_PLACES) {
    errors.push(VALIDATION_RULES.CURRENCY.ERROR_MESSAGES.DECIMAL);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Checks if a currency amount needs rounding
 * @param amount - Amount to check
 * @returns Boolean indicating if rounding is needed
 */
export function needsRounding(amount: number): boolean {
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  return decimalPlaces > VALIDATION_RULES.CURRENCY.DECIMAL_PLACES;
}

/**
 * Rounds a currency amount to the specified decimal places
 * @param amount - Amount to round
 * @returns Rounded amount
 */
export function roundCurrency(amount: number): number {
  return currency(amount, {
    precision: VALIDATION_RULES.CURRENCY.DECIMAL_PLACES
  }).value;
}