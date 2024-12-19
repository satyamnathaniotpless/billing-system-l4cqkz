// @version: typescript@5.0.x
import { ApiResponse } from './api';

/**
 * Enumeration of possible bill/invoice statuses
 */
export enum BillStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

/**
 * Enumeration of billing frequency options
 */
export enum BillingFrequency {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL'
}

/**
 * Enumeration of supported currencies based on geographic coverage
 */
export enum SupportedCurrency {
  USD = 'USD', // United States Dollar
  IDR = 'IDR', // Indonesian Rupiah
  INR = 'INR'  // Indian Rupee
}

/**
 * Enumeration of supported tax types for India
 */
export enum TaxType {
  GST = 'GST',   // Goods and Services Tax (within state)
  IGST = 'IGST'  // Integrated GST (interstate)
}

/**
 * Interface for tiered pricing components within a price plan
 */
export interface PriceComponent {
  id: string;
  usageFrom: number;    // Starting usage count for this tier
  usageTo: number;      // Ending usage count for this tier
  unitPrice: number;    // Price per unit in this tier
  description: string;  // Human-readable description of the tier
}

/**
 * Interface for price plan configuration with flexible pricing support
 */
export interface PricePlan {
  id: string;
  name: string;
  description: string;
  currency: SupportedCurrency;
  basePrice: number;           // Base price for the plan
  includedUsage: number;       // Number of included units before additional charges
  perUnitPrice: number;        // Price per unit after included usage
  priceComponents: PriceComponent[]; // Tiered pricing components
  billingFrequency: BillingFrequency;
  active: boolean;
  validFrom: string;          // ISO 8601 date string
  validUntil: string;         // ISO 8601 date string
  customContractTerms?: string; // Optional custom contract terms
}

/**
 * Interface for bill/invoice data with comprehensive billing information
 */
export interface Bill {
  id: string;
  customerId: string;
  accountId: string;
  pricePlanId: string;
  usage: number;              // Total usage for the billing period
  amount: number;             // Base amount before tax
  taxType: TaxType;
  taxRate: number;            // Tax rate as a percentage
  taxAmount: number;          // Calculated tax amount
  totalAmount: number;        // Total amount including tax
  currency: SupportedCurrency;
  status: BillStatus;
  billingPeriodStart: string; // ISO 8601 date string
  billingPeriodEnd: string;   // ISO 8601 date string
  dueDate: string;            // ISO 8601 date string
  paidAt?: string;           // ISO 8601 date string, optional for unpaid bills
  invoiceNumber: string;      // Unique invoice number
}

/**
 * Type definition for bill creation request
 */
export interface CreateBillRequest {
  customerId: string;
  accountId: string;
  pricePlanId: string;
  usage: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string;
}

/**
 * Type definition for bill update request
 */
export interface UpdateBillRequest {
  status?: BillStatus;
  paidAt?: string;
}

/**
 * Type definition for price plan creation request
 */
export interface CreatePricePlanRequest {
  name: string;
  description: string;
  currency: SupportedCurrency;
  basePrice: number;
  includedUsage: number;
  perUnitPrice: number;
  priceComponents: Omit<PriceComponent, 'id'>[];
  billingFrequency: BillingFrequency;
  validFrom: string;
  validUntil: string;
  customContractTerms?: string;
}

/**
 * Type definition for bill list response
 */
export interface BillListResponse extends ApiResponse<Bill[]> {
  data: Bill[];
}

/**
 * Type definition for single bill response
 */
export interface BillResponse extends ApiResponse<Bill> {
  data: Bill;
}

/**
 * Type definition for price plan list response
 */
export interface PricePlanListResponse extends ApiResponse<PricePlan[]> {
  data: PricePlan[];
}

/**
 * Type definition for single price plan response
 */
export interface PricePlanResponse extends ApiResponse<PricePlan> {
  data: PricePlan;
}

/**
 * Type definition for bill calculation result
 */
export interface BillCalculation {
  baseAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: SupportedCurrency;
  breakdown: {
    includedUsage: number;
    additionalUsage: number;
    basePrice: number;
    additionalCharges: number;
    taxDetails: {
      type: TaxType;
      rate: number;
      amount: number;
    };
  };
}