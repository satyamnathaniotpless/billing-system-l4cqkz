// @version: @reduxjs/toolkit@1.9.x
// @version: lodash@4.17.x
import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { debounce } from 'lodash';
import {
  Invoice,
  InvoiceStatus,
  InvoiceFilter,
  Currency,
  TaxType,
  CreateInvoicePayload
} from '../../types/invoice';
import invoiceService from '../../services/invoice';
import { RootState } from '../store';

// Constants
const DEBOUNCE_DELAY = 300; // ms
const INITIAL_PAGE_SIZE = 10;

// Interface for invoice slice state
interface InvoiceState {
  invoices: Invoice[];
  selectedInvoice: Invoice | null;
  filter: InvoiceFilter;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  sort: {
    field: string;
    direction: 'asc' | 'desc';
  };
  loading: boolean;
  downloadProgress: { [key: string]: number };
  error: { message: string; code: string } | null;
  lastUpdated: number;
}

// Initial state
const initialState: InvoiceState = {
  invoices: [],
  selectedInvoice: null,
  filter: {
    customerId: '',
    status: undefined,
    dateFrom: '',
    dateTo: '',
  },
  pagination: {
    page: 1,
    limit: INITIAL_PAGE_SIZE,
    total: 0,
  },
  sort: {
    field: 'createdAt',
    direction: 'desc',
  },
  loading: false,
  downloadProgress: {},
  error: null,
  lastUpdated: 0,
};

// Async thunks
export const fetchInvoices = createAsyncThunk(
  'invoice/fetchInvoices',
  async (params: {
    filter?: InvoiceFilter;
    page?: number;
    limit?: number;
    sort?: { field: string; direction: 'asc' | 'desc' };
  }) => {
    const response = await invoiceService.getInvoices(
      params.filter || {},
      {
        page: params.page || 1,
        limit: params.limit || INITIAL_PAGE_SIZE,
        sortBy: params.sort?.field || 'createdAt',
        sortOrder: params.sort?.direction || 'desc'
      }
    );
    return response.data;
  }
);

export const generateInvoice = createAsyncThunk(
  'invoice/generateInvoice',
  async (invoiceData: CreateInvoicePayload) => {
    const response = await invoiceService.generateInvoice(invoiceData);
    return response.data;
  }
);

export const downloadInvoice = createAsyncThunk(
  'invoice/downloadInvoice',
  async ({ invoiceId, onProgress }: { invoiceId: string; onProgress?: (progress: number) => void }, 
  { dispatch }) => {
    const blob = await invoiceService.downloadInvoice(invoiceId, {
      onProgress: (progress) => {
        dispatch(updateDownloadProgress({ invoiceId, progress }));
        onProgress?.(progress);
      }
    });
    return { invoiceId, blob };
  }
);

// Create the slice
const invoiceSlice = createSlice({
  name: 'invoice',
  initialState,
  reducers: {
    setFilter: (state, action: PayloadAction<Partial<InvoiceFilter>>) => {
      state.filter = { ...state.filter, ...action.payload };
      state.pagination.page = 1; // Reset to first page on filter change
    },
    setSorting: (state, action: PayloadAction<{ field: string; direction: 'asc' | 'desc' }>) => {
      state.sort = action.payload;
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.pagination.page = action.payload;
    },
    setPageSize: (state, action: PayloadAction<number>) => {
      state.pagination.limit = action.payload;
      state.pagination.page = 1; // Reset to first page on page size change
    },
    selectInvoice: (state, action: PayloadAction<Invoice | null>) => {
      state.selectedInvoice = action.payload;
    },
    updateDownloadProgress: (
      state,
      action: PayloadAction<{ invoiceId: string; progress: number }>
    ) => {
      state.downloadProgress[action.payload.invoiceId] = action.payload.progress;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch invoices
      .addCase(fetchInvoices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInvoices.fulfilled, (state, action) => {
        state.loading = false;
        state.invoices = action.payload;
        state.lastUpdated = Date.now();
      })
      .addCase(fetchInvoices.rejected, (state, action) => {
        state.loading = false;
        state.error = {
          message: action.error.message || 'Failed to fetch invoices',
          code: action.error.code || 'UNKNOWN_ERROR'
        };
      })
      // Generate invoice
      .addCase(generateInvoice.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(generateInvoice.fulfilled, (state, action) => {
        state.loading = false;
        state.invoices = [action.payload, ...state.invoices];
        state.lastUpdated = Date.now();
      })
      .addCase(generateInvoice.rejected, (state, action) => {
        state.loading = false;
        state.error = {
          message: action.error.message || 'Failed to generate invoice',
          code: action.error.code || 'UNKNOWN_ERROR'
        };
      })
      // Download invoice
      .addCase(downloadInvoice.pending, (state, action) => {
        state.downloadProgress[action.meta.arg.invoiceId] = 0;
      })
      .addCase(downloadInvoice.fulfilled, (state, action) => {
        state.downloadProgress[action.payload.invoiceId] = 100;
      })
      .addCase(downloadInvoice.rejected, (state, action) => {
        state.error = {
          message: action.error.message || 'Failed to download invoice',
          code: action.error.code || 'UNKNOWN_ERROR'
        };
        delete state.downloadProgress[action.meta.arg.invoiceId];
      });
  },
});

// Export actions
export const {
  setFilter,
  setSorting,
  setPage,
  setPageSize,
  selectInvoice,
  updateDownloadProgress,
  clearError,
} = invoiceSlice.actions;

// Selectors
export const selectInvoiceState = (state: RootState) => state.invoice;

export const selectFilteredInvoices = createSelector(
  [selectInvoiceState],
  (invoiceState) => {
    const { invoices, filter } = invoiceState;
    return invoices.filter((invoice) => {
      if (filter.customerId && invoice.customerId !== filter.customerId) return false;
      if (filter.status && invoice.status !== filter.status) return false;
      if (filter.dateFrom && new Date(invoice.issueDate) < new Date(filter.dateFrom)) return false;
      if (filter.dateTo && new Date(invoice.issueDate) > new Date(filter.dateTo)) return false;
      return true;
    });
  }
);

export const selectInvoiceById = createSelector(
  [selectInvoiceState, (state: RootState, invoiceId: string) => invoiceId],
  (invoiceState, invoiceId) => 
    invoiceState.invoices.find((invoice) => invoice.id === invoiceId)
);

// Debounced fetch function for filtering
export const debouncedFetchInvoices = debounce(
  (dispatch: any, params: Parameters<typeof fetchInvoices>[0]) => {
    dispatch(fetchInvoices(params));
  },
  DEBOUNCE_DELAY
);

// Export reducer
export default invoiceSlice.reducer;