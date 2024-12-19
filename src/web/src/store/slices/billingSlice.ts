// @version: @reduxjs/toolkit@1.9.x
import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { 
  PricePlan, 
  Bill, 
  BillStatus, 
  BillingFrequency,
  TaxConfig,
  CurrencyConfig
} from '../../types/billing';
import { billingService } from '../../services/billing';

// Interface for the billing slice state
interface BillingState {
  pricePlans: PricePlan[];
  currentPlan: PricePlan | null;
  bills: Bill[];
  usageMetrics: {
    daily: Record<string, number>;
    monthly: Record<string, number>;
    trends: {
      usage: number;
      change: number;
      trend: 'up' | 'down' | 'stable';
    };
  };
  taxConfig: TaxConfig;
  currencyConfig: CurrencyConfig;
  loading: boolean;
  error: {
    code: string;
    message: string;
    details?: object;
  } | null;
  filters: {
    dateRange: { start: string; end: string };
    status: BillStatus[];
    frequency: BillingFrequency[];
  };
}

// Initial state
const initialState: BillingState = {
  pricePlans: [],
  currentPlan: null,
  bills: [],
  usageMetrics: {
    daily: {},
    monthly: {},
    trends: {
      usage: 0,
      change: 0,
      trend: 'stable'
    }
  },
  taxConfig: {
    rates: {},
    rules: {}
  },
  currencyConfig: {
    rates: {},
    defaultCurrency: 'USD'
  },
  loading: false,
  error: null,
  filters: {
    dateRange: {
      start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(),
      end: new Date().toISOString()
    },
    status: [],
    frequency: []
  }
};

// Async thunks for API operations
export const fetchPricePlans = createAsyncThunk(
  'billing/fetchPricePlans',
  async (filters: { status?: string; frequency?: BillingFrequency }, { rejectWithValue }) => {
    try {
      const plans = await billingService.getPricePlans(filters);
      return plans;
    } catch (error) {
      return rejectWithValue({
        code: error.code || 'FETCH_PLANS_ERROR',
        message: error.message || 'Failed to fetch price plans',
        details: error.details
      });
    }
  }
);

export const calculateBill = createAsyncThunk(
  'billing/calculateBill',
  async (params: {
    accountId: string;
    pricePlanId: string;
    billingPeriod: { startDate: Date; endDate: Date };
  }, { rejectWithValue }) => {
    try {
      const bill = await billingService.calculateBill(
        params.accountId,
        params.pricePlanId,
        params.billingPeriod
      );
      return bill;
    } catch (error) {
      return rejectWithValue({
        code: error.code || 'CALCULATE_BILL_ERROR',
        message: error.message || 'Failed to calculate bill',
        details: error.details
      });
    }
  }
);

export const fetchUsageMetrics = createAsyncThunk(
  'billing/fetchUsageMetrics',
  async (params: {
    accountId: string;
    timeRange: { startDate: Date; endDate: Date };
    granularity?: string;
  }, { rejectWithValue }) => {
    try {
      const metrics = await billingService.getUsageMetrics(
        params.accountId,
        params.timeRange
      );
      return metrics;
    } catch (error) {
      return rejectWithValue({
        code: error.code || 'FETCH_METRICS_ERROR',
        message: error.message || 'Failed to fetch usage metrics',
        details: error.details
      });
    }
  }
);

// Create the billing slice
const billingSlice = createSlice({
  name: 'billing',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearError: (state) => {
      state.error = null;
    },
    updateTaxConfig: (state, action) => {
      state.taxConfig = { ...state.taxConfig, ...action.payload };
    },
    updateCurrencyConfig: (state, action) => {
      state.currencyConfig = { ...state.currencyConfig, ...action.payload };
    }
  },
  extraReducers: (builder) => {
    // Price Plans
    builder.addCase(fetchPricePlans.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchPricePlans.fulfilled, (state, action) => {
      state.loading = false;
      state.pricePlans = action.payload;
    });
    builder.addCase(fetchPricePlans.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as BillingState['error'];
    });

    // Bill Calculation
    builder.addCase(calculateBill.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(calculateBill.fulfilled, (state, action) => {
      state.loading = false;
      state.bills = [...state.bills, action.payload];
    });
    builder.addCase(calculateBill.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as BillingState['error'];
    });

    // Usage Metrics
    builder.addCase(fetchUsageMetrics.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchUsageMetrics.fulfilled, (state, action) => {
      state.loading = false;
      state.usageMetrics = action.payload;
    });
    builder.addCase(fetchUsageMetrics.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as BillingState['error'];
    });
  }
});

// Selectors
export const selectPricePlansByStatus = createSelector(
  [(state: { billing: BillingState }) => state.billing.pricePlans],
  (pricePlans) => (status: boolean) => pricePlans.filter(plan => plan.active === status)
);

export const selectBillsByDateRange = createSelector(
  [(state: { billing: BillingState }) => state.billing.bills],
  (bills) => (startDate: string, endDate: string) => 
    bills.filter(bill => 
      bill.billingPeriodStart >= startDate && 
      bill.billingPeriodEnd <= endDate
    )
);

export const selectUsageMetricsTrends = createSelector(
  [(state: { billing: BillingState }) => state.billing.usageMetrics],
  (metrics) => metrics.trends
);

// Export actions and reducer
export const { 
  setFilters, 
  clearError, 
  updateTaxConfig, 
  updateCurrencyConfig 
} = billingSlice.actions;

export default billingSlice.reducer;