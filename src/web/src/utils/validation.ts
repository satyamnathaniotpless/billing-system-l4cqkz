// @version: validator@13.x
// @version: libphonenumber-js@1.x
// @version: sanitize-html@2.x
// @version: luxon@3.x

import { isEmail } from 'validator';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import sanitizeHtml from 'sanitize-html';
import { DateTime } from 'luxon';
import { ApiError } from '../types/api';
import { Customer } from '../types/customer';
import { Bill, SupportedCurrency } from '../types/billing';

// Constants for validation rules
const EMAIL_MAX_LENGTH = 254;
const PHONE_REGEX = /^\+[1-9]\d{1,14}$/;
const SUPPORTED_CURRENCIES = ['USD', 'INR', 'IDR'] as const;
const CURRENCY_DECIMALS: Record<SupportedCurrency, number> = {
  USD: 2,
  INR: 2,
  IDR: 0
};
const SUPPORTED_REGIONS = ['US', 'IN', 'ID'] as const;
const DEFAULT_TIMEZONE = 'UTC';
const DISPOSABLE_EMAIL_DOMAINS = [
  'tempmail.com',
  'throwaway.com',
  // Add more disposable email domains as needed
];

// Interfaces for validation results
interface ValidationResult<T = string> {
  isValid: boolean;
  value: T;
  errors: string[];
  sanitizedValue?: string;
}

interface ValidationOptions {
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  allowFuture?: boolean;
  timezone?: string;
}

/**
 * Enhanced email validation with RFC 5322 compliance and security measures
 * @param email - Email address to validate
 * @param options - Validation options
 * @returns ValidationResult with validation status and sanitized email
 */
export function validateEmail(
  email: string,
  options: ValidationOptions = { required: true }
): ValidationResult {
  const errors: string[] = [];
  let sanitizedValue = '';

  try {
    // Sanitize and trim input
    sanitizedValue = sanitizeHtml(email.trim(), {
      allowedTags: [],
      allowedAttributes: {}
    });

    // Required check
    if (options.required && !sanitizedValue) {
      errors.push('Email is required');
      return { isValid: false, value: email, errors, sanitizedValue };
    }

    // Length check
    if (sanitizedValue.length > EMAIL_MAX_LENGTH) {
      errors.push(`Email must not exceed ${EMAIL_MAX_LENGTH} characters`);
    }

    // Format validation using validator.js
    if (sanitizedValue && !isEmail(sanitizedValue, { allow_utf8_local_part: false })) {
      errors.push('Invalid email format');
    }

    // Check for disposable email domains
    const domain = sanitizedValue.split('@')[1]?.toLowerCase();
    if (domain && DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
      errors.push('Disposable email addresses are not allowed');
    }

  } catch (error) {
    errors.push('Email validation failed');
    console.error('Email validation error:', error);
  }

  return {
    isValid: errors.length === 0,
    value: email,
    errors,
    sanitizedValue
  };
}

/**
 * Enhanced phone validation with international support and E.164 compliance
 * @param phone - Phone number to validate
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @param options - Validation options
 * @returns ValidationResult with validation status and formatted phone
 */
export function validatePhone(
  phone: string,
  countryCode: string,
  options: ValidationOptions = { required: true }
): ValidationResult {
  const errors: string[] = [];
  let sanitizedValue = '';

  try {
    // Sanitize input
    sanitizedValue = sanitizeHtml(phone.trim(), {
      allowedTags: [],
      allowedAttributes: {}
    });

    // Required check
    if (options.required && !sanitizedValue) {
      errors.push('Phone number is required');
      return { isValid: false, value: phone, errors, sanitizedValue };
    }

    // Validate country code
    if (!SUPPORTED_REGIONS.includes(countryCode as typeof SUPPORTED_REGIONS[number])) {
      errors.push('Unsupported country code');
      return { isValid: false, value: phone, errors, sanitizedValue };
    }

    // Parse and validate phone number
    const phoneNumber = parsePhoneNumberFromString(sanitizedValue, countryCode);
    if (sanitizedValue && !phoneNumber?.isValid()) {
      errors.push('Invalid phone number format');
    } else if (phoneNumber) {
      sanitizedValue = phoneNumber.format('E.164');
      
      // Additional E.164 format validation
      if (!PHONE_REGEX.test(sanitizedValue)) {
        errors.push('Phone number must be in E.164 format');
      }
    }

  } catch (error) {
    errors.push('Phone validation failed');
    console.error('Phone validation error:', error);
  }

  return {
    isValid: errors.length === 0,
    value: phone,
    errors,
    sanitizedValue
  };
}

/**
 * Enhanced currency validation with multi-currency support
 * @param amount - Amount to validate
 * @param currency - Currency code
 * @param options - Validation options
 * @returns ValidationResult with validation status and formatted amount
 */
export function validateCurrency(
  amount: number,
  currency: string,
  options: ValidationOptions = { required: true }
): ValidationResult<number> {
  const errors: string[] = [];
  let validatedAmount = amount;

  try {
    // Validate currency code
    if (!SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency)) {
      errors.push('Unsupported currency');
      return { isValid: false, value: amount, errors };
    }

    // Required check
    if (options.required && (amount === undefined || amount === null)) {
      errors.push('Amount is required');
      return { isValid: false, value: amount, errors };
    }

    // Validate amount
    if (isNaN(amount) || !isFinite(amount)) {
      errors.push('Invalid amount');
    } else {
      // Check for positive amount
      if (amount <= 0) {
        errors.push('Amount must be greater than zero');
      }

      // Check decimal places
      const decimals = CURRENCY_DECIMALS[currency as SupportedCurrency];
      const decimalCount = amount.toString().split('.')[1]?.length || 0;
      if (decimalCount > decimals) {
        errors.push(`Amount cannot have more than ${decimals} decimal places for ${currency}`);
      }

      // Format amount to correct decimal places
      validatedAmount = Number(amount.toFixed(decimals));
    }

  } catch (error) {
    errors.push('Currency validation failed');
    console.error('Currency validation error:', error);
  }

  return {
    isValid: errors.length === 0,
    value: validatedAmount,
    errors
  };
}

/**
 * Enhanced date validation with timezone and ISO 8601 support
 * @param date - Date string to validate
 * @param options - Validation options
 * @returns ValidationResult with validation status and formatted date
 */
export function validateDate(
  date: string,
  options: ValidationOptions = { 
    required: true,
    allowFuture: false,
    timezone: DEFAULT_TIMEZONE
  }
): ValidationResult {
  const errors: string[] = [];
  let sanitizedValue = '';

  try {
    // Sanitize input
    sanitizedValue = sanitizeHtml(date.trim(), {
      allowedTags: [],
      allowedAttributes: {}
    });

    // Required check
    if (options.required && !sanitizedValue) {
      errors.push('Date is required');
      return { isValid: false, value: date, errors, sanitizedValue };
    }

    if (sanitizedValue) {
      // Parse date with timezone
      const parsedDate = DateTime.fromISO(sanitizedValue, {
        zone: options.timezone || DEFAULT_TIMEZONE
      });

      // Validate date format and parsing
      if (!parsedDate.isValid) {
        errors.push('Invalid date format. Use ISO 8601 format');
      } else {
        // Future date validation
        if (!options.allowFuture && parsedDate > DateTime.now()) {
          errors.push('Future dates are not allowed');
        }

        // Format date to ISO 8601
        sanitizedValue = parsedDate.toISO();
      }
    }

  } catch (error) {
    errors.push('Date validation failed');
    console.error('Date validation error:', error);
  }

  return {
    isValid: errors.length === 0,
    value: date,
    errors,
    sanitizedValue
  };
}

/**
 * Utility type guard to check if an error is a validation error
 * @param error - Error to check
 * @returns boolean indicating if error is a validation error
 */
export function isValidationError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    (error as ApiError).code === 'VALIDATION_ERROR'
  );
}

// Export validation types for external use
export type { ValidationResult, ValidationOptions };