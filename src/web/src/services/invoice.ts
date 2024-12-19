// @version: axios@1.x
import axios, { AxiosProgressEvent } from 'axios';
import { 
  apiClient, 
  get, 
  post, 
  handleError 
} from './api';
import { API_ENDPOINTS } from '../config/api';
import { 
  Invoice, 
  InvoiceFilter, 
  LineItem, 
  TaxType, 
  CurrencyCode,
  CreateInvoicePayload,
  InvoiceResponse,
  InvoiceListResponse,
  isSupportedCurrency,
  isValidInvoiceDate,
  TAX_RATES
} from '../types/invoice';
import { 
  ApiResponse, 
  PaginationParams,
  ApiError,
  ApiErrorCode 
} from '../types/api';

// Constants for invoice operations
const INVOICE_DOWNLOAD_TIMEOUT = 60000; // 60 seconds
const MAX_RETRY_ATTEMPTS = 3;
const MINIMUM_LINE_ITEMS = 1;

/**
 * Validates invoice data before submission
 */
const validateInvoiceData = (data: CreateInvoicePayload): void => {
  if (!data.customerId) {
    throw new Error('Customer ID is required');
  }

  if (!isValidInvoiceDate(data.issueDate) || !isValidInvoiceDate(data.dueDate)) {
    throw new Error('Invalid invoice dates');
  }

  if (!isSupportedCurrency(data.currencyCode)) {
    throw new Error(`Unsupported currency. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`);
  }

  if (!data.lineItems || data.lineItems.length < MINIMUM_LINE_ITEMS) {
    throw new Error('At least one line item is required');
  }

  // Validate line items
  data.lineItems.forEach((item, index) => {
    if (item.quantity <= 0 || item.unitPrice < 0) {
      throw new Error(`Invalid quantity or unit price in line item ${index + 1}`);
    }
  });
};

/**
 * Calculates tax amount based on tax type and subtotal
 */
const calculateTaxAmount = (subtotal: number, taxType: TaxType): number => {
  const taxRate = TAX_RATES[taxType];
  return Number((subtotal * taxRate).toFixed(2));
};

/**
 * Service for managing invoice operations
 */
const invoiceService = {
  /**
   * Retrieves a paginated list of invoices based on filter criteria
   */
  async getInvoices(
    filter: InvoiceFilter = {},
    pagination: PaginationParams
  ): Promise<ApiResponse<Invoice[]>> {
    try {
      const response = await get<Invoice[]>(API_ENDPOINTS.INVOICES.LIST, {
        ...pagination,
        ...filter
      });

      return response;
    } catch (error) {
      throw handleError(error as ApiError);
    }
  },

  /**
   * Generates a new invoice with tax calculations
   */
  async generateInvoice(
    invoiceData: CreateInvoicePayload
  ): Promise<ApiResponse<Invoice>> {
    try {
      // Validate invoice data
      validateInvoiceData(invoiceData);

      // Calculate subtotal and tax
      const subtotal = invoiceData.lineItems.reduce(
        (sum, item) => sum + (item.quantity * item.unitPrice),
        0
      );

      const taxAmount = calculateTaxAmount(subtotal, invoiceData.taxType);

      const payload = {
        ...invoiceData,
        subtotal,
        taxAmount,
        totalAmount: subtotal + taxAmount
      };

      const response = await post<Invoice>(
        API_ENDPOINTS.INVOICES.GENERATE,
        payload
      );

      return response;
    } catch (error) {
      if ((error as ApiError).code === ApiErrorCode.VALIDATION_ERROR) {
        throw error;
      }
      throw handleError(error as ApiError);
    }
  },

  /**
   * Downloads invoice PDF with progress tracking and retry capability
   */
  async downloadInvoice(
    invoiceId: string,
    options: {
      onProgress?: (progress: number) => void;
      retryAttempts?: number;
    } = {}
  ): Promise<Blob> {
    const { onProgress, retryAttempts = MAX_RETRY_ATTEMPTS } = options;
    let attempt = 0;

    const download = async (): Promise<Blob> => {
      try {
        const response = await axios.get(
          `${API_ENDPOINTS.INVOICES.DOWNLOAD.replace(':id', invoiceId)}`,
          {
            responseType: 'blob',
            timeout: INVOICE_DOWNLOAD_TIMEOUT,
            onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
              if (onProgress && progressEvent.total) {
                const progress = Math.round(
                  (progressEvent.loaded * 100) / progressEvent.total
                );
                onProgress(progress);
              }
            }
          }
        );

        // Validate response
        if (response.data.type !== 'application/pdf') {
          throw new Error('Invalid invoice document format');
        }

        return response.data;
      } catch (error) {
        if (attempt < retryAttempts) {
          attempt++;
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return download();
        }
        throw handleError(error as ApiError);
      }
    };

    return download();
  },

  /**
   * Previews invoice before generation
   */
  async previewInvoice(
    invoiceData: CreateInvoicePayload
  ): Promise<ApiResponse<Invoice>> {
    try {
      validateInvoiceData(invoiceData);
      
      const response = await post<Invoice>(
        API_ENDPOINTS.INVOICES.PREVIEW,
        invoiceData
      );

      return response;
    } catch (error) {
      throw handleError(error as ApiError);
    }
  }
};

export default invoiceService;

export type {
  Invoice,
  InvoiceFilter,
  LineItem,
  CreateInvoicePayload,
  InvoiceResponse,
  InvoiceListResponse
};