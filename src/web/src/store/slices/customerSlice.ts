// @version: @reduxjs/toolkit@1.9.5
// @version: reselect@4.1.8

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from 'reselect';
import {
  Customer,
  CustomerAccount,
  CustomerFilters,
  CustomerListResponse,
  CustomerValidation,
  CustomerUsage,
  CustomerStatus
} from '../../types/customer';
import customerService from '../../services/customer';

// State interface definition
interface CustomerState {
  customers: Customer[];
  selectedCustomer: Customer | null;
  customerAccount: CustomerAccount | null;
  customerUsage: CustomerUsage | null;
  loading: {
    customers: boolean;
    account: boolean;
    usage: boolean;
  };
  error: {
    customers: string | null;
    account: string | null;
    usage: string | null;
  };
  cache: {
    timestamp: number | null;
    data: CustomerListResponse | null;
  };
  validation: {
    status: 'valid' | 'invalid' | null;
    messages: string[];
  };
  filters: CustomerFilters;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

// Initial state
const initialState: CustomerState = {
  customers: [],
  selectedCustomer: null,
  customerAccount: null,
  customerUsage: null,
  loading: {
    customers: false,
    account: false,
    usage: false
  },
  error: {
    customers: null,
    account: null,
    usage: null
  },
  cache: {
    timestamp: null,
    data: null
  },
  validation: {
    status: null,
    messages: []
  },
  filters: {},
  pagination: {
    page: 1,
    limit: 20,
    total: 0
  }
};

// Async thunks
export const fetchCustomers = createAsyncThunk(
  'customer/fetchCustomers',
  async ({ 
    filters, 
    pagination, 
    forceRefresh = false 
  }: { 
    filters: CustomerFilters; 
    pagination: { page: number; limit: number }; 
    forceRefresh?: boolean;
  }) => {
    return await customerService.getCustomers(filters, pagination);
  }
);

export const fetchCustomerById = createAsyncThunk(
  'customer/fetchCustomerById',
  async (customerId: string) => {
    return await customerService.getCustomerById(customerId);
  }
);

export const fetchCustomerAccount = createAsyncThunk(
  'customer/fetchCustomerAccount',
  async (customerId: string) => {
    return await customerService.getCustomerAccount(customerId);
  }
);

export const updateCustomerStatus = createAsyncThunk(
  'customer/updateCustomerStatus',
  async ({ customerId, status }: { customerId: string; status: CustomerStatus }) => {
    return await customerService.updateCustomerStatus(customerId, status);
  }
);

// Slice definition
const customerSlice = createSlice({
  name: 'customer',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<CustomerFilters>) => {
      state.filters = action.payload;
      state.pagination.page = 1; // Reset pagination when filters change
    },
    clearErrors: (state) => {
      state.error = {
        customers: null,
        account: null,
        usage: null
      };
    },
    clearCache: (state) => {
      state.cache = {
        timestamp: null,
        data: null
      };
    },
    setValidation: (state, action: PayloadAction<CustomerValidation>) => {
      state.validation = {
        status: action.payload.isValid ? 'valid' : 'invalid',
        messages: action.payload.messages || []
      };
    }
  },
  extraReducers: (builder) => {
    // Fetch Customers
    builder
      .addCase(fetchCustomers.pending, (state) => {
        state.loading.customers = true;
        state.error.customers = null;
      })
      .addCase(fetchCustomers.fulfilled, (state, action) => {
        state.loading.customers = false;
        state.customers = action.payload.customers;
        state.pagination.total = action.payload.pagination.totalItems;
        state.cache = {
          timestamp: Date.now(),
          data: action.payload
        };
      })
      .addCase(fetchCustomers.rejected, (state, action) => {
        state.loading.customers = false;
        state.error.customers = action.error.message || 'Failed to fetch customers';
      })

    // Fetch Customer By ID
    builder
      .addCase(fetchCustomerById.pending, (state) => {
        state.loading.customers = true;
        state.error.customers = null;
      })
      .addCase(fetchCustomerById.fulfilled, (state, action) => {
        state.loading.customers = false;
        state.selectedCustomer = action.payload;
      })
      .addCase(fetchCustomerById.rejected, (state, action) => {
        state.loading.customers = false;
        state.error.customers = action.error.message || 'Failed to fetch customer';
      })

    // Fetch Customer Account
    builder
      .addCase(fetchCustomerAccount.pending, (state) => {
        state.loading.account = true;
        state.error.account = null;
      })
      .addCase(fetchCustomerAccount.fulfilled, (state, action) => {
        state.loading.account = false;
        state.customerAccount = action.payload;
      })
      .addCase(fetchCustomerAccount.rejected, (state, action) => {
        state.loading.account = false;
        state.error.account = action.error.message || 'Failed to fetch customer account';
      })

    // Update Customer Status
    builder
      .addCase(updateCustomerStatus.pending, (state) => {
        state.loading.customers = true;
        state.error.customers = null;
      })
      .addCase(updateCustomerStatus.fulfilled, (state, action) => {
        state.loading.customers = false;
        if (state.selectedCustomer?.id === action.payload.id) {
          state.selectedCustomer = action.payload;
        }
        state.customers = state.customers.map(customer =>
          customer.id === action.payload.id ? action.payload : customer
        );
      })
      .addCase(updateCustomerStatus.rejected, (state, action) => {
        state.loading.customers = false;
        state.error.customers = action.error.message || 'Failed to update customer status';
      });
  }
});

// Selectors
export const selectCustomers = (state: { customer: CustomerState }) => state.customer.customers;
export const selectSelectedCustomer = (state: { customer: CustomerState }) => state.customer.selectedCustomer;
export const selectCustomerAccount = (state: { customer: CustomerState }) => state.customer.customerAccount;
export const selectCustomerLoading = (state: { customer: CustomerState }) => state.customer.loading;
export const selectCustomerErrors = (state: { customer: CustomerState }) => state.customer.error;

// Memoized selectors
export const selectActiveCustomers = createSelector(
  [selectCustomers],
  (customers) => customers.filter(customer => customer.status === CustomerStatus.ACTIVE)
);

export const selectCustomerMetrics = createSelector(
  [selectCustomers],
  (customers) => ({
    total: customers.length,
    active: customers.filter(c => c.status === CustomerStatus.ACTIVE).length,
    inactive: customers.filter(c => c.status === CustomerStatus.INACTIVE).length,
    suspended: customers.filter(c => c.status === CustomerStatus.SUSPENDED).length
  })
);

// Export actions and reducer
export const { setFilters, clearErrors, clearCache, setValidation } = customerSlice.actions;
export default customerSlice.reducer;