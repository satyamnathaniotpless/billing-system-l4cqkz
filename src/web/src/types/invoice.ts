// @version: date-fns@2.30.0
import { format, isValid } from 'date-fns';
import { ApiResponse } from './api';

/**
 * Supported currencies for invoices
 */
export const SUPPORTED_CURRENCIES = ['USD', 'INR', 'IDR'] as const;
export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number];

/**
 * Tax rates for different tax types
 */
export const TAX_RATES = {
  GST: 0.18,
  IGST: 0.18
} as const;

/**
 * Supported payment gateways
 */
export const PAYMENT_GATEWAYS = ['stripe', 'razorpay'] as const;
export type PaymentGateway = typeof PAYMENT_GATEWAYS[number];

/**
 * Enumeration of possible invoice statuses
 */
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

/**
 * Enumeration of payment processing statuses
 */
export enum PaymentStatus {
  INITIATED = 'INITIATED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

/**
 * Enumeration of tax types for invoices
 */
export enum TaxType {
  GST = 'GST',
  IGST = 'IGST'
}

/**
 * Interface for customer address
 */
export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

/**
 * Interface for customer details in invoices
 */
export interface CustomerDetails {
  name: string;
  email: string;
  phone: string;
  address: Address;
  taxId: string; // GST/Tax registration number
}

/**
 * Interface for payment processing details
 */
export interface PaymentDetails {
  gateway: PaymentGateway;
  method: string;
  transactionId: string;
  status: PaymentStatus;
  metadata: Record<string, unknown>;
}

/**
 * Interface for invoice line items
 */
export interface LineItem {
  id: string;
  serviceName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  currencyCode: CurrencyCode;
}

/**
 * Main interface for invoice data
 */
export interface Invoice {
  id: string;
  customerId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  currencyCode: CurrencyCode;
  lineItems: LineItem[];
  subtotal: number;
  taxAmount: number;
  taxType: TaxType;
  totalAmount: number;
  customerDetails: CustomerDetails;
  paymentDetails: PaymentDetails;
  notes?: string;
  metadata: Record<string, unknown>;
}

/**
 * Interface for invoice filtering parameters
 */
export interface InvoiceFilter {
  customerId?: string;
  status?: InvoiceStatus;
  dateFrom?: string;
  dateTo?: string;
  paymentStatus?: PaymentStatus;
}

/**
 * Type for invoice API responses
 */
export type InvoiceResponse = ApiResponse<Invoice>;
export type InvoiceListResponse = ApiResponse<Invoice[]>;

/**
 * Type guard to check if a date string is valid
 */
export function isValidInvoiceDate(date: string): boolean {
  return isValid(new Date(date));
}

/**
 * Type guard to check if a currency code is supported
 */
export function isSupportedCurrency(currency: string): currency is CurrencyCode {
  return SUPPORTED_CURRENCIES.includes(currency as CurrencyCode);
}

/**
 * Type for invoice creation payload
 */
export interface CreateInvoicePayload {
  customerId: string;
  issueDate: string;
  dueDate: string;
  currencyCode: CurrencyCode;
  lineItems: Omit<LineItem, 'id'>[];
  taxType: TaxType;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Type for invoice update payload
 */
export interface UpdateInvoicePayload {
  status?: InvoiceStatus;
  dueDate?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Type for invoice payment payload
 */
export interface InvoicePaymentPayload {
  gateway: PaymentGateway;
  method: string;
  metadata?: Record<string, unknown>;
}