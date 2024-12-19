// @version: @jest/globals@29.6.0

import { describe, test, expect } from '@jest/globals';
import { 
  validateEmail, 
  validatePhone, 
  validateCurrency, 
  validateDate 
} from '../../utils/validation';

// Test data constants
const VALID_EMAIL_SAMPLES = [
  'user@example.com',
  'user+tag@domain.com',
  'user.name@subdomain.domain.com',
  'user@international.香港',
  'very.common@example.com',
  'disposable.style.email.with+symbol@example.com',
  'other.email-with-hyphen@example.com',
  'fully-qualified-domain@example.com',
  'x@example.com' // One-letter local part
];

const INVALID_EMAIL_SAMPLES = [
  'invalid@',
  '@domain.com',
  'user@.com',
  'user@domain.',
  '<script>alert(1)</script>@domain.com',
  'Abc.example.com', // No @ character
  'A@b@c@example.com', // Multiple @ characters
  'a"b(c)d,e:f;g<h>i[j\\k]l@example.com', // Special characters
  'just"not"right@example.com', // Quoted strings
  'this\\ still\\"not\\\\allowed@example.com', // Escaped characters
  'i_like_underscore@but_its_not_allowed_in_this_part.example.com' // Underscore in domain
];

const VALID_PHONE_SAMPLES = [
  '+919876543210', // India
  '+12025550123',  // USA
  '+6281234567890', // Indonesia
  '+85212345678'   // Hong Kong
];

const INVALID_PHONE_SAMPLES = [
  '9876543210',    // Missing country code
  '12025550123',   // Missing plus
  '+1',            // Too short
  '+abc',          // Invalid characters
  '+911234',       // Invalid length for country
  '+1234567890123456' // Too long
];

const VALID_CURRENCY_SAMPLES = [
  { amount: 100.00, currency: 'USD' },
  { amount: 1000.50, currency: 'INR' },
  { amount: 1000000, currency: 'IDR' }
];

const INVALID_CURRENCY_SAMPLES = [
  { amount: -100, currency: 'USD' },
  { amount: 100.999, currency: 'INR' },
  { amount: 0, currency: 'USD' },
  { amount: NaN, currency: 'INR' },
  { amount: 100, currency: 'EUR' } // Unsupported currency
];

const VALID_DATE_SAMPLES = [
  '2023-12-31',
  '2023-12-31T23:59:59Z',
  '2023-12-31T23:59:59+05:30',
  '2023-01-01T00:00:00.000Z'
];

const INVALID_DATE_SAMPLES = [
  '2023-13-31',    // Invalid month
  '2023-12-32',    // Invalid day
  'invalid-date',  // Wrong format
  '2023-02-29',    // Invalid leap year date
  '2024-02-30'     // Invalid February date
];

describe('validateEmail', () => {
  test('should validate correct email formats', () => {
    VALID_EMAIL_SAMPLES.forEach(email => {
      const result = validateEmail(email);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedValue).toBeDefined();
    });
  });

  test('should reject invalid email formats', () => {
    INVALID_EMAIL_SAMPLES.forEach(email => {
      const result = validateEmail(email);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  test('should handle email length restrictions', () => {
    const longEmail = `${'a'.repeat(255)}@example.com`;
    const result = validateEmail(longEmail);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Email must not exceed 254 characters');
  });

  test('should sanitize HTML in email input', () => {
    const maliciousEmail = '<script>alert("xss")</script>@domain.com';
    const result = validateEmail(maliciousEmail);
    expect(result.isValid).toBe(false);
    expect(result.sanitizedValue).not.toContain('<script>');
  });

  test('should handle optional email validation', () => {
    const result = validateEmail('', { required: false });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('validatePhone', () => {
  test('should validate correct phone numbers for supported regions', () => {
    VALID_PHONE_SAMPLES.forEach(phone => {
      const result = validatePhone(phone, 'IN');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedValue).toMatch(/^\+[1-9]\d{1,14}$/);
    });
  });

  test('should reject invalid phone numbers', () => {
    INVALID_PHONE_SAMPLES.forEach(phone => {
      const result = validatePhone(phone, 'IN');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  test('should validate country-specific number formats', () => {
    const validUSNumber = '+12025550123';
    const result = validatePhone(validUSNumber, 'US');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe(validUSNumber);
  });

  test('should reject unsupported country codes', () => {
    const result = validatePhone('+12025550123', 'XX');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Unsupported country code');
  });

  test('should handle optional phone validation', () => {
    const result = validatePhone('', 'IN', { required: false });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('validateCurrency', () => {
  test('should validate correct currency amounts', () => {
    VALID_CURRENCY_SAMPLES.forEach(({ amount, currency }) => {
      const result = validateCurrency(amount, currency);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  test('should reject invalid currency amounts', () => {
    INVALID_CURRENCY_SAMPLES.forEach(({ amount, currency }) => {
      const result = validateCurrency(amount, currency);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  test('should enforce currency-specific decimal places', () => {
    const result = validateCurrency(100.999, 'USD');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Amount cannot have more than 2 decimal places for USD');
  });

  test('should handle zero and negative amounts', () => {
    const zeroResult = validateCurrency(0, 'USD');
    expect(zeroResult.isValid).toBe(false);
    expect(zeroResult.errors).toContain('Amount must be greater than zero');

    const negativeResult = validateCurrency(-100, 'USD');
    expect(negativeResult.isValid).toBe(false);
    expect(negativeResult.errors).toContain('Amount must be greater than zero');
  });

  test('should validate currency codes', () => {
    const result = validateCurrency(100, 'EUR');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Unsupported currency');
  });
});

describe('validateDate', () => {
  test('should validate correct ISO 8601 dates', () => {
    VALID_DATE_SAMPLES.forEach(date => {
      const result = validateDate(date);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedValue).toBeDefined();
    });
  });

  test('should reject invalid dates', () => {
    INVALID_DATE_SAMPLES.forEach(date => {
      const result = validateDate(date);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  test('should handle timezone conversions', () => {
    const date = '2023-12-31T23:59:59+05:30';
    const result = validateDate(date, { timezone: 'UTC' });
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBeDefined();
  });

  test('should validate future dates based on options', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    
    const defaultResult = validateDate(futureDate);
    expect(defaultResult.isValid).toBe(false);
    expect(defaultResult.errors).toContain('Future dates are not allowed');

    const allowFutureResult = validateDate(futureDate, { allowFuture: true });
    expect(allowFutureResult.isValid).toBe(true);
    expect(allowFutureResult.errors).toHaveLength(0);
  });

  test('should handle optional date validation', () => {
    const result = validateDate('', { required: false });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});