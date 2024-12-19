// @version: typescript@5.0.x
import { ApiResponse, PaginationParams } from './api';

/**
 * Enum representing possible customer account statuses
 * Used for strict type checking of customer state
 */
export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED'
}

/**
 * Enum representing customer account types
 * Supports different business models including enterprise customers
 */
export enum CustomerType {
  INDIVIDUAL = 'INDIVIDUAL',
  BUSINESS = 'BUSINESS',
  ENTERPRISE = 'ENTERPRISE'
}

/**
 * Interface representing core customer information
 * Contains essential customer profile data with strict typing
 */
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: CustomerType;
  status: CustomerStatus;
  createdAt: string; // ISO 8601 format
  updatedAt: string; // ISO 8601 format
  metadata?: Record<string, unknown>; // Additional flexible customer metadata
}

/**
 * Interface representing detailed customer account information
 * Includes billing and configuration details
 */
export interface CustomerAccount {
  id: string;
  customerId: string;
  pricePlanId: string;
  walletBalance: number;
  currency: string;
  settings: {
    notificationPreferences?: {
      email: boolean;
      sms: boolean;
      webhook?: string;
    };
    billingThresholds?: {
      lowBalanceAlert: number;
      autoRecharge?: {
        enabled: boolean;
        threshold: number;
        amount: number;
      };
    };
    features?: Record<string, boolean>;
    customFields?: Record<string, unknown>;
  };
  lastActivityAt?: string; // ISO 8601 format
}

/**
 * Interface for customer filtering options
 * Supports advanced search and filtering capabilities
 */
export interface CustomerFilters {
  status?: CustomerStatus;
  type?: CustomerType;
  search?: string; // Searches across name, email, and phone
  dateRange?: {
    start: string; // ISO 8601 format
    end: string; // ISO 8601 format
  };
  walletBalance?: {
    min?: number;
    max?: number;
  };
  sortBy?: 'name' | 'createdAt' | 'walletBalance' | 'status';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Interface for paginated customer list response
 * Extends ApiResponse for consistent API response handling
 */
export interface CustomerListResponse {
  customers: Customer[];
  pagination: PaginationParams;
  totalBalance?: number; // Optional aggregate of all customer balances
  metrics?: {
    activeCount: number;
    inactiveCount: number;
    suspendedCount: number;
    averageBalance: number;
  };
}

/**
 * Type for customer creation request payload
 * Omits system-generated fields
 */
export type CreateCustomerRequest = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> & {
  initialSettings?: CustomerAccount['settings'];
};

/**
 * Type for customer update request payload
 * Makes all fields optional except id
 */
export type UpdateCustomerRequest = Partial<Omit<Customer, 'id'>> & {
  id: string;
};

/**
 * Type guard to check if a value is a valid CustomerStatus
 */
export function isCustomerStatus(value: any): value is CustomerStatus {
  return Object.values(CustomerStatus).includes(value);
}

/**
 * Type guard to check if a value is a valid CustomerType
 */
export function isCustomerType(value: any): value is CustomerType {
  return Object.values(CustomerType).includes(value);
}

/**
 * Type for customer API response
 * Ensures type safety for API responses containing customer data
 */
export type CustomerApiResponse = ApiResponse<Customer>;

/**
 * Type for customer list API response
 * Ensures type safety for API responses containing customer lists
 */
export type CustomerListApiResponse = ApiResponse<CustomerListResponse>;