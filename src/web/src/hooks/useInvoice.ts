// @version: react@18.x
// @version: react-redux@8.x
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchInvoices,
  selectInvoiceState,
  selectFilteredInvoices,
  selectInvoiceById,
  generateInvoice,
  downloadInvoice,
  updateDownloadProgress,
  clearError
} from '../store/slices/invoiceSlice';
import invoiceService from '../services/invoice';
import {
  Invoice,
  InvoiceFilter,
  InvoiceStatus,
  LineItem,
  TaxType,
  Currency,
  CreateInvoicePayload,
  TAX_RATES,
  isSupportedCurrency
} from '../types/invoice';
import { ApiError, ApiErrorCode } from '../types/api';

interface InvoiceOperations {
  fetchInvoices: (filter?: InvoiceFilter) => Promise<void>;
  generateInvoice: (data: CreateInvoicePayload) => Promise<Invoice>;
  downloadInvoice: (invoiceId: string) => Promise<Blob>;
  updateStatus: (invoiceId: string, status: InvoiceStatus) => Promise<void>;
  validateTaxCalculation: (subtotal: number, taxType: TaxType) => boolean;
  validateCurrency: (currencyCode: string) => boolean;
  previewInvoice: (data: CreateInvoicePayload) => Promise<Invoice>;
  clearErrors: () => void;
}

interface UseInvoiceReturn {
  invoices: Invoice[];
  selectedInvoice: Invoice | null;
  loading: { [key: string]: boolean };
  errors: { [key: string]: ApiError };
  downloadProgress: { [key: string]: number };
  validationErrors: {
    tax: string[];
    currency: string[];
  };
  operations: InvoiceOperations;
}

/**
 * Custom hook for managing invoice operations with enhanced validation and error handling
 */
export const useInvoice = (): UseInvoiceReturn => {
  // Local state management
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [errors, setErrors] = useState<{ [key: string]: ApiError }>({});
  const [validationErrors, setValidationErrors] = useState<{
    tax: string[];
    currency: string[];
  }>({ tax: [], currency: [] });

  // Redux state management
  const dispatch = useDispatch();
  const { invoices, selectedInvoice, downloadProgress } = useSelector(selectInvoiceState);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  /**
   * Validates tax calculations for an invoice
   */
  const validateTaxCalculation = useCallback((subtotal: number, taxType: TaxType): boolean => {
    try {
      const expectedTax = subtotal * TAX_RATES[taxType];
      const calculatedTax = Number(expectedTax.toFixed(2));
      return calculatedTax >= 0;
    } catch (error) {
      setValidationErrors(prev => ({
        ...prev,
        tax: [...prev.tax, 'Invalid tax calculation']
      }));
      return false;
    }
  }, []);

  /**
   * Validates currency code against supported currencies
   */
  const validateCurrency = useCallback((currencyCode: string): boolean => {
    const isValid = isSupportedCurrency(currencyCode);
    if (!isValid) {
      setValidationErrors(prev => ({
        ...prev,
        currency: [...prev.currency, `Currency ${currencyCode} is not supported`]
      }));
    }
    return isValid;
  }, []);

  /**
   * Fetches invoices with enhanced error handling
   */
  const handleFetchInvoices = useCallback(async (filter?: InvoiceFilter) => {
    setLoading(prev => ({ ...prev, fetch: true }));
    try {
      await dispatch(fetchInvoices({ filter })).unwrap();
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        fetch: error as ApiError
      }));
    } finally {
      setLoading(prev => ({ ...prev, fetch: false }));
    }
  }, [dispatch]);

  /**
   * Generates new invoice with validation
   */
  const handleGenerateInvoice = useCallback(async (data: CreateInvoicePayload): Promise<Invoice> => {
    setLoading(prev => ({ ...prev, generate: true }));
    try {
      // Validate tax and currency
      const isTaxValid = validateTaxCalculation(
        data.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        data.taxType
      );
      const isCurrencyValid = validateCurrency(data.currencyCode);

      if (!isTaxValid || !isCurrencyValid) {
        throw new Error('Validation failed');
      }

      const response = await dispatch(generateInvoice(data)).unwrap();
      return response;
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        generate: error as ApiError
      }));
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, generate: false }));
    }
  }, [dispatch, validateTaxCalculation, validateCurrency]);

  /**
   * Downloads invoice with progress tracking
   */
  const handleDownloadInvoice = useCallback(async (invoiceId: string): Promise<Blob> => {
    setLoading(prev => ({ ...prev, download: true }));
    try {
      const response = await dispatch(downloadInvoice({
        invoiceId,
        onProgress: (progress: number) => {
          dispatch(updateDownloadProgress({ invoiceId, progress }));
        }
      })).unwrap();
      return response;
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        download: error as ApiError
      }));
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, download: false }));
    }
  }, [dispatch]);

  /**
   * Previews invoice before generation
   */
  const handlePreviewInvoice = useCallback(async (data: CreateInvoicePayload): Promise<Invoice> => {
    setLoading(prev => ({ ...prev, preview: true }));
    try {
      const response = await invoiceService.previewInvoice(data);
      return response.data;
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        preview: error as ApiError
      }));
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, preview: false }));
    }
  }, []);

  /**
   * Updates invoice status with optimistic updates
   */
  const handleUpdateStatus = useCallback(async (
    invoiceId: string,
    status: InvoiceStatus
  ): Promise<void> => {
    setLoading(prev => ({ ...prev, update: true }));
    try {
      // Optimistic update
      dispatch({ type: 'invoice/optimisticUpdateStatus', payload: { invoiceId, status } });

      await invoiceService.updateInvoiceStatus(invoiceId, status);
    } catch (error) {
      // Revert optimistic update on error
      dispatch({ type: 'invoice/revertOptimisticUpdate', payload: { invoiceId } });
      setErrors(prev => ({
        ...prev,
        update: error as ApiError
      }));
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, update: false }));
    }
  }, [dispatch]);

  /**
   * Clears all errors
   */
  const handleClearErrors = useCallback(() => {
    setErrors({});
    setValidationErrors({ tax: [], currency: [] });
    dispatch(clearError());
  }, [dispatch]);

  // Memoized operations object
  const operations = useMemo<InvoiceOperations>(() => ({
    fetchInvoices: handleFetchInvoices,
    generateInvoice: handleGenerateInvoice,
    downloadInvoice: handleDownloadInvoice,
    updateStatus: handleUpdateStatus,
    validateTaxCalculation,
    validateCurrency,
    previewInvoice: handlePreviewInvoice,
    clearErrors: handleClearErrors
  }), [
    handleFetchInvoices,
    handleGenerateInvoice,
    handleDownloadInvoice,
    handleUpdateStatus,
    validateTaxCalculation,
    validateCurrency,
    handlePreviewInvoice,
    handleClearErrors
  ]);

  return {
    invoices,
    selectedInvoice,
    loading,
    errors,
    downloadProgress,
    validationErrors,
    operations
  };
};

export type { UseInvoiceReturn, InvoiceOperations };