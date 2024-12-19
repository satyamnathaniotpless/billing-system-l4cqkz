// @version: date-fns@2.30.0
// @version: date-fns-tz@2.0.0

import {
  format,
  isValid,
  parseISO,
  addDays,
  addMonths,
  startOfMonth,
  endOfMonth,
  differenceInDays,
  getYear,
  setYear
} from 'date-fns';
import {
  format as formatTz,
  utcToZonedTime,
  zonedTimeToUtc
} from 'date-fns-tz';
import { validateDate } from './validation';

// Constants for date formatting and configuration
export const DATE_FORMATS = {
  DISPLAY: 'dd MMM yyyy',
  ISO: 'yyyy-MM-dd',
  DATETIME: 'dd MMM yyyy HH:mm',
  TIME: 'HH:mm:ss',
  FISCAL: 'yyyy-yy',
  INVOICE: 'dd/MM/yyyy'
} as const;

export const TIMEZONE_CONFIG = {
  DEFAULT: 'Asia/Kolkata',
  FALLBACK: 'UTC',
  DST_HANDLING: 'preserve'
} as const;

export const FISCAL_CONFIG = {
  START_MONTH: 3, // April (0-based)
  START_DATE: 1,
  YEAR_FORMAT: 'yyyy-yy'
} as const;

// Types for function parameters
interface DateFormatOptions {
  locale?: Locale;
  fallback?: string;
  strict?: boolean;
}

interface BillingPeriodOptions {
  includeFiscalYear?: boolean;
  strict?: boolean;
}

/**
 * Enhanced date formatting with regional considerations and error handling
 * @param date - Date to format
 * @param formatString - Format string (from DATE_FORMATS)
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date,
  formatString: string = DATE_FORMATS.DISPLAY,
  options: DateFormatOptions = {}
): string {
  try {
    // Validate input date
    const validation = validateDate(date instanceof Date ? date.toISOString() : date, {
      required: true
    });

    if (!validation.isValid) {
      return options.fallback || '';
    }

    // Parse date safely
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;

    if (!isValid(parsedDate)) {
      return options.fallback || '';
    }

    // Format date with provided options
    return format(parsedDate, formatString, {
      locale: options.locale
    });
  } catch (error) {
    console.error('Date formatting error:', error);
    return options.fallback || '';
  }
}

/**
 * Advanced timezone-aware date formatting with DST handling
 * @param date - Date to format
 * @param formatString - Format string (from DATE_FORMATS)
 * @param timezone - Target timezone
 * @param options - Formatting options
 * @returns Timezone-aware formatted date string
 */
export function formatDateWithTimezone(
  date: string | Date,
  formatString: string = DATE_FORMATS.DATETIME,
  timezone: string = TIMEZONE_CONFIG.DEFAULT,
  options: DateFormatOptions = {}
): string {
  try {
    // Validate input date
    const validation = validateDate(date instanceof Date ? date.toISOString() : date, {
      required: true
    });

    if (!validation.isValid) {
      return options.fallback || '';
    }

    // Parse date and convert to target timezone
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    const zonedDate = utcToZonedTime(parsedDate, timezone || TIMEZONE_CONFIG.FALLBACK);

    // Format with timezone consideration
    return formatTz(zonedDate, formatString, {
      timeZone: timezone || TIMEZONE_CONFIG.FALLBACK,
      locale: options.locale
    });
  } catch (error) {
    console.error('Timezone date formatting error:', error);
    return options.fallback || '';
  }
}

/**
 * Calculates fiscal year based on Indian financial calendar (April-March)
 * @param date - Date to calculate fiscal year for
 * @returns Fiscal year information
 */
export function getFiscalYear(date: Date): {
  start: Date;
  end: Date;
  fiscalYear: string;
} {
  try {
    const year = getYear(date);
    const month = date.getMonth();
    
    // Determine fiscal year based on month (April starts new fiscal year)
    const fiscalYear = month >= FISCAL_CONFIG.START_MONTH ? year : year - 1;
    
    // Calculate fiscal period boundaries
    const startDate = new Date(fiscalYear, FISCAL_CONFIG.START_MONTH, FISCAL_CONFIG.START_DATE);
    const endDate = new Date(fiscalYear + 1, FISCAL_CONFIG.START_MONTH, 0);

    return {
      start: startDate,
      end: endDate,
      fiscalYear: `${fiscalYear}-${(fiscalYear + 1).toString().slice(-2)}`
    };
  } catch (error) {
    console.error('Fiscal year calculation error:', error);
    throw error;
  }
}

/**
 * Enhanced billing period calculation with timezone and fiscal year support
 * @param frequency - Billing frequency (monthly, quarterly, annual)
 * @param startDate - Start date of the period
 * @param timezone - Target timezone
 * @param options - Additional options
 * @returns Billing period information
 */
export function getBillingPeriod(
  frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
  startDate: Date,
  timezone: string = TIMEZONE_CONFIG.DEFAULT,
  options: BillingPeriodOptions = {}
): {
  start: Date;
  end: Date;
  fiscalPeriod?: string;
} {
  try {
    // Convert to target timezone
    const zonedStartDate = utcToZonedTime(startDate, timezone);
    let periodEnd: Date;

    // Calculate period end based on frequency
    switch (frequency) {
      case 'MONTHLY':
        periodEnd = endOfMonth(zonedStartDate);
        break;
      case 'QUARTERLY':
        periodEnd = endOfMonth(addMonths(zonedStartDate, 3));
        break;
      case 'ANNUAL':
        periodEnd = endOfMonth(addMonths(zonedStartDate, 12));
        break;
      default:
        throw new Error('Invalid billing frequency');
    }

    // Convert back to UTC for storage
    const utcStart = zonedTimeToUtc(startOfMonth(zonedStartDate), timezone);
    const utcEnd = zonedTimeToUtc(periodEnd, timezone);

    const result = {
      start: utcStart,
      end: utcEnd
    };

    // Add fiscal period information if requested
    if (options.includeFiscalYear) {
      const fiscalYear = getFiscalYear(utcStart);
      return {
        ...result,
        fiscalPeriod: fiscalYear.fiscalYear
      };
    }

    return result;
  } catch (error) {
    console.error('Billing period calculation error:', error);
    throw error;
  }
}