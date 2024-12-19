// @version: @reduxjs/toolkit@1.9.x

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AuthService } from '../../services/auth';
import { 
  AuthUser, 
  ApiResponse, 
  ApiError, 
  DeviceInfo, 
  MfaStatus 
} from '../../types/api';

// Constants
const SESSION_TIMEOUT = 3600000; // 1 hour in milliseconds
const MAX_LOGIN_ATTEMPTS = 5;

// Enhanced AuthState interface with security features
interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  deviceInfo: DeviceInfo | null;
  mfaStatus: MfaStatus;
  lastActivity: number;
  sessionTimeout: number;
  loginAttempts: number;
}

// Initial state with security defaults
const INITIAL_STATE: AuthState = {
  user: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,
  deviceInfo: null,
  mfaStatus: 'none',
  lastActivity: 0,
  sessionTimeout: SESSION_TIMEOUT,
  loginAttempts: 0
};

// Enhanced async thunks with security features
export const loginAsync = createAsyncThunk<
  AuthUser,
  { email: string; password: string; mfaToken?: string; deviceFingerprint: string },
  { rejectValue: ApiError }
>(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      // Validate device info before proceeding
      const deviceInfo = {
        fingerprint: credentials.deviceFingerprint,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      const response = await AuthService.login(
        { email: credentials.email, password: credentials.password },
        credentials.mfaToken,
        deviceInfo
      );

      if (response.status === 'error') {
        return rejectWithValue(response as unknown as ApiError);
      }

      // Validate MFA if required
      if (response.data.mfaRequired && !credentials.mfaToken) {
        return rejectWithValue({
          status: 'error',
          code: 'MFA_REQUIRED',
          message: 'MFA verification required',
          details: {}
        });
      }

      const user = await AuthService.getCurrentUser();
      if (!user) {
        throw new Error('Failed to get user details');
      }

      return user;
    } catch (error) {
      return rejectWithValue({
        status: 'error',
        code: 'AUTH_ERROR',
        message: error instanceof Error ? error.message : 'Authentication failed',
        details: {}
      });
    }
  }
);

export const logoutAsync = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await AuthService.logout();
    } catch (error) {
      return rejectWithValue({
        status: 'error',
        code: 'LOGOUT_ERROR',
        message: error instanceof Error ? error.message : 'Logout failed',
        details: {}
      });
    }
  }
);

export const validateSessionAsync = createAsyncThunk(
  'auth/validateSession',
  async (_, { getState, dispatch }) => {
    try {
      const isValid = await AuthService.validateSession();
      if (!isValid) {
        dispatch(logoutAsync());
        return false;
      }
      return true;
    } catch (error) {
      dispatch(logoutAsync());
      return false;
    }
  }
);

// Create the auth slice with enhanced security features
const authSlice = createSlice({
  name: 'auth',
  initialState: INITIAL_STATE,
  reducers: {
    updateLastActivity: (state) => {
      state.lastActivity = Date.now();
    },
    resetLoginAttempts: (state) => {
      state.loginAttempts = 0;
    },
    incrementLoginAttempts: (state) => {
      state.loginAttempts += 1;
    },
    updateMfaStatus: (state, action: PayloadAction<MfaStatus>) => {
      state.mfaStatus = action.payload;
    },
    updateDeviceInfo: (state, action: PayloadAction<DeviceInfo>) => {
      state.deviceInfo = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login cases
      .addCase(loginAsync.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.lastActivity = Date.now();
        state.loginAttempts = 0;
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Authentication failed';
        state.loginAttempts += 1;
        
        // Auto-logout on max attempts
        if (state.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
          state.isAuthenticated = false;
          state.user = null;
        }
      })
      // Logout cases
      .addCase(logoutAsync.fulfilled, (state) => {
        return { ...INITIAL_STATE };
      })
      // Session validation cases
      .addCase(validateSessionAsync.fulfilled, (state, action) => {
        if (!action.payload) {
          return { ...INITIAL_STATE };
        }
        state.lastActivity = Date.now();
      });
  }
});

// Export actions and reducer
export const { 
  updateLastActivity, 
  resetLoginAttempts, 
  incrementLoginAttempts,
  updateMfaStatus,
  updateDeviceInfo
} = authSlice.actions;

export const authReducer = authSlice.reducer;

// Selectors with memoization
export const selectAuth = {
  selectUser: (state: { auth: AuthState }) => state.auth.user,
  selectIsAuthenticated: (state: { auth: AuthState }) => state.auth.isAuthenticated,
  selectIsLoading: (state: { auth: AuthState }) => state.auth.isLoading,
  selectError: (state: { auth: AuthState }) => state.auth.error,
  selectDeviceInfo: (state: { auth: AuthState }) => state.auth.deviceInfo,
  selectMfaStatus: (state: { auth: AuthState }) => state.auth.mfaStatus,
  selectLoginAttempts: (state: { auth: AuthState }) => state.auth.loginAttempts,
  selectSessionValidity: (state: { auth: AuthState }) => {
    const { lastActivity, sessionTimeout } = state.auth;
    return Date.now() - lastActivity < sessionTimeout;
  }
};

export default authSlice.reducer;