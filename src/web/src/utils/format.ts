// @version: lodash@4.17.21
// @version: @formatjs/intl@2.9.0

import { truncate } from 'lodash';
import { formatCurrency } from './currency';
import { formatDate } from './date';
import { VALIDATION_RULES } from '../config/constants';
import { Intl } from '@formatjs/intl';

// Constants for formatting configuration
const DEFAULT_DECIMAL_PLACES = 2;
const DEFAULT_TRUNCATE_LENGTH = 30;
const ID_PAD_LENGTH = 6;
const DEFAULT_LOCALE = 'en-US';

// Supported locales based on geographic coverage
export const SUPPORTED_LOCALES = ['en-US', 'en-IN', 'id-ID'] as const;

/**
 * Interface for number formatting options
 */
interface NumberFormatOptions {
  locale?: string;
  decimals?: number;
  style?: 'decimal' | 'currency' | 'percent';
  useGrouping?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/**
 * Interface for percentage formatting options
 */
interface PercentageFormatOptions {
  locale?: string;
  decimals?: number;
  includeSymbol?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/**
 * Interface for text truncation options
 */
interface TruncateOptions {
  htmlSafe?: boolean;
  rtl?: boolean;
  separator?: string;
}

/**
 * Interface for ID formatting options
 */
interface IdFormatOptions {
  region?: string;
  validate?: boolean;
  prefix?: string;
}

/**
 * Formats numeric values with locale-specific thousand separators and decimal places
 * @param value - Number to format
 * @param options - Formatting options
 * @returns Formatted number string
 */
export function formatNumber(
  value: number,
  options: NumberFormatOptions = {}
): string {
  try {
    if (!Number.isFinite(value)) {
      return '';
    }

    const {
      locale = DEFAULT_LOCALE,
      decimals = DEFAULT_DECIMAL_PLACES,
      style = 'decimal',
      useGrouping = true,
      minimumFractionDigits = decimals,
      maximumFractionDigits = decimals
    } = options;

    if (!SUPPORTED_LOCALES.includes(locale as typeof SUPPORTED_LOCALES[number])) {
      console.warn(`Unsupported locale: ${locale}, falling back to ${DEFAULT_LOCALE}`);
    }

    const formatter = new Intl.NumberFormat(locale, {
      style,
      useGrouping,
      minimumFractionDigits,
      maximumFractionDigits
    });

    return formatter.format(value);
  } catch (error) {
    console.error('Number formatting error:', error);
    return '';
  }
}

/**
 * Formats numeric values as locale-specific percentages
 * @param value - Number to format as percentage
 * @param options - Formatting options
 * @returns Formatted percentage string
 */
export function formatPercentage(
  value: number,
  options: PercentageFormatOptions = {}
): string {
  try {
    if (!Number.isFinite(value)) {
      return '';
    }

    const {
      locale = DEFAULT_LOCALE,
      decimals = DEFAULT_DECIMAL_PLACES,
      includeSymbol = true,
      minimumFractionDigits = decimals,
      maximumFractionDigits = decimals
    } = options;

    // Convert to percentage if value is in decimal form
    const percentageValue = value <= 1 ? value * 100 : value;

    const formatter = new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits,
      maximumFractionDigits
    });

    const formatted = formatter.format(percentageValue / 100);

    return includeSymbol ? formatted : formatted.replace('%', '').trim();
  } catch (error) {
    console.error('Percentage formatting error:', error);
    return '';
  }
}

/**
 * Truncates text with Unicode and RTL support
 * @param text - Text to truncate
 * @param length - Maximum length
 * @param options - Truncation options
 * @returns Truncated text
 */
export function truncateText(
  text: string,
  length: number = DEFAULT_TRUNCATE_LENGTH,
  options: TruncateOptions = {}
): string {
  try {
    if (!text) {
      return '';
    }

    const {
      htmlSafe = false,
      rtl = false,
      separator = '...'
    } = options;

    // Handle HTML entities if needed
    let processedText = text;
    if (htmlSafe) {
      processedText = text.replace(/&[^;]+;/g, '_');
    }

    // Add RTL markers if needed
    if (rtl) {
      processedText = `\u202B${processedText}\u202C`;
    }

    const truncated = truncate(processedText, {
      length,
      separator,
      omission: separator
    });

    // Restore HTML entities if needed
    if (htmlSafe) {
      return truncated.replace(/_/g, match => {
        const entity = text.match(/&[^;]+;/)?.[0];
        return entity || match;
      });
    }

    return truncated;
  } catch (error) {
    console.error('Text truncation error:', error);
    return text;
  }
}

/**
 * Formats system identifiers with region-specific patterns
 * @param id - Identifier to format
 * @param options - Formatting options
 * @returns Formatted identifier
 */
export function formatId(
  id: string | number,
  options: IdFormatOptions = {}
): string {
  try {
    const {
      region = 'IN',
      validate = true,
      prefix = ''
    } = options;

    // Convert to string and clean input
    const cleanId = String(id).replace(/\D/g, '');

    if (validate && !cleanId) {
      throw new Error('Invalid ID format');
    }

    // Pad with zeros to meet required length
    const paddedId = cleanId.padStart(ID_PAD_LENGTH, '0');

    // Apply region-specific formatting
    switch (region) {
      case 'IN':
        return `${prefix}${paddedId}`; // Indian format: PREFIX000000
      case 'ID':
        return `${prefix}-${paddedId}`; // Indonesian format: PREFIX-000000
      case 'US':
        return `${prefix}_${paddedId}`; // US format: PREFIX_000000
      default:
        return `${prefix}${paddedId}`;
    }
  } catch (error) {
    console.error('ID formatting error:', error);
    return String(id);
  }
}

// Export additional utility functions that might be needed by other modules
export {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  DEFAULT_DECIMAL_PLACES,
  DEFAULT_TRUNCATE_LENGTH,
  ID_PAD_LENGTH
};