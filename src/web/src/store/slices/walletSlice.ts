// @version: @reduxjs/toolkit@1.9.x
import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit';
import {
  Wallet,
  Transaction,
  WalletBalance,
  TopUpRequest,
  WalletStatus,
  TransactionStatus
} from '../../types/wallet';
import { walletService } from '../../services/wallet';
import { RootState } from '../store';

// Connection status for WebSocket
export enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  ERROR = 'error'
}

// Constants
const CACHE_DURATION = 300000; // 5 minutes
const RETRY_ATTEMPTS = 3;
const LOW_BALANCE_THRESHOLD_PERCENT = 20;

// Interface for wallet slice state
interface WalletState {
  wallet: Wallet | null;
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  lowBalanceAlert: boolean;
  lastUpdated: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  websocketStatus: ConnectionStatus;
  retryCount: number;
}

// Initial state
const initialState: WalletState = {
  wallet: null,
  transactions: [],
  loading: false,
  error: null,
  lowBalanceAlert: false,
  lastUpdated: 0,
  pagination: {
    page: 1,
    limit: 10,
    total: 0
  },
  websocketStatus: ConnectionStatus.DISCONNECTED,
  retryCount: 0
};

// Async thunks
export const fetchWalletBalance = createAsyncThunk(
  'wallet/fetchBalance',
  async (customerId: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      const { lastUpdated } = state.wallet;
      
      // Check cache validity
      if (lastUpdated && Date.now() - lastUpdated < CACHE_DURATION) {
        return state.wallet.wallet;
      }

      const response = await walletService.getWalletBalance(customerId);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchTransactionHistory = createAsyncThunk(
  'wallet/fetchTransactions',
  async ({ walletId, params }: { 
    walletId: string; 
    params: { page: number; limit: number; sortBy?: string; } 
  }, { rejectWithValue }) => {
    try {
      const response = await walletService.getTransactionHistory(walletId, params);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const topUpWallet = createAsyncThunk(
  'wallet/topUp',
  async (topUpData: TopUpRequest, { rejectWithValue }) => {
    try {
      const response = await walletService.topUpWallet(topUpData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Wallet slice
const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    setWebsocketStatus(state, action: PayloadAction<ConnectionStatus>) {
      state.websocketStatus = action.payload;
    },
    updateWalletBalance(state, action: PayloadAction<WalletBalance>) {
      if (state.wallet) {
        state.wallet.balance = action.payload.balance;
        state.wallet.status = action.payload.status;
        state.lastUpdated = Date.now();
        
        // Check for low balance condition
        const threshold = state.wallet.lowBalanceThreshold;
        state.lowBalanceAlert = action.payload.balance <= threshold;
      }
    },
    resetError(state) {
      state.error = null;
      state.retryCount = 0;
    },
    updatePagination(state, action: PayloadAction<Partial<typeof initialState.pagination>>) {
      state.pagination = { ...state.pagination, ...action.payload };
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch wallet balance
      .addCase(fetchWalletBalance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWalletBalance.fulfilled, (state, action) => {
        state.wallet = action.payload;
        state.loading = false;
        state.lastUpdated = Date.now();
        state.retryCount = 0;
        
        if (state.wallet) {
          state.lowBalanceAlert = state.wallet.balance <= state.wallet.lowBalanceThreshold;
        }
      })
      .addCase(fetchWalletBalance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.retryCount += 1;
      })
      // Fetch transactions
      .addCase(fetchTransactionHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransactionHistory.fulfilled, (state, action) => {
        state.transactions = action.payload;
        state.loading = false;
        state.retryCount = 0;
      })
      .addCase(fetchTransactionHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.retryCount += 1;
      })
      // Top up wallet
      .addCase(topUpWallet.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(topUpWallet.fulfilled, (state, action) => {
        if (state.wallet) {
          state.wallet.balance += action.payload.amount;
          state.transactions = [action.payload, ...state.transactions];
        }
        state.loading = false;
        state.retryCount = 0;
      })
      .addCase(topUpWallet.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.retryCount += 1;
      });
  }
});

// Selectors
export const selectWalletState = (state: RootState) => state.wallet;

export const selectWalletBalance = createSelector(
  [selectWalletState],
  (walletState) => walletState.wallet?.balance ?? 0
);

export const selectTransactions = createSelector(
  [selectWalletState],
  (walletState) => walletState.transactions
);

export const selectLowBalanceStatus = createSelector(
  [selectWalletState],
  (walletState) => walletState.lowBalanceAlert
);

export const selectIsLoading = createSelector(
  [selectWalletState],
  (walletState) => walletState.loading
);

// Export actions and reducer
export const { 
  setWebsocketStatus, 
  updateWalletBalance, 
  resetError, 
  updatePagination 
} = walletSlice.actions;

export default walletSlice.reducer;