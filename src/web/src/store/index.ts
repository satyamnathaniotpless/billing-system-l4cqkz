// @version: @reduxjs/toolkit@1.9.x
// @version: @sentry/react@7.x
// @version: redux-thunk@2.4.x

import { configureStore, createSerializableStateInvariantMiddleware } from '@reduxjs/toolkit';
import { createReduxEnhancer } from '@sentry/react';
import thunk from 'redux-thunk';

// Import feature slice reducers
import { authReducer } from './slices/authSlice';
import { billingReducer } from './slices/billingSlice';
import { customerReducer } from './slices/customerSlice';
import { invoiceReducer } from './slices/invoiceSlice';
import { walletReducer } from './slices/walletSlice';

// Constants
const isDevelopment = process.env.NODE_ENV === 'development';
const REDUX_PERSIST_KEY = 'otpless_billing_state';
const PERFORMANCE_MONITOR_SAMPLE_RATE = 0.1; // 10% sampling rate

/**
 * Configure performance monitoring middleware
 */
const performanceMiddleware = () => (next: any) => (action: any) => {
  const start = performance.now();
  const result = next(action);
  const duration = performance.now() - start;

  // Sample performance metrics
  if (Math.random() < PERFORMANCE_MONITOR_SAMPLE_RATE) {
    console.debug(`Action ${action.type} took ${duration.toFixed(2)}ms`);
  }

  return result;
};

/**
 * Configure serialization validation middleware
 */
const serializableMiddleware = createSerializableStateInvariantMiddleware({
  ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
  ignoredPaths: ['error.details', 'metadata.custom'],
  warnAfter: 100 // Warn if serialization takes longer than 100ms
});

/**
 * Configure Sentry Redux integration
 */
const sentryReduxEnhancer = createReduxEnhancer({
  actionTransformer: (action) => ({
    ...action,
    timestamp: new Date().toISOString()
  }),
  stateTransformer: (state) => ({
    ...state,
    sensitiveData: '[FILTERED]' // Remove sensitive data from Sentry reports
  })
});

/**
 * Root state type definition combining all feature states
 */
export interface RootState {
  auth: ReturnType<typeof authReducer>;
  billing: ReturnType<typeof billingReducer>;
  customer: ReturnType<typeof customerReducer>;
  invoice: ReturnType<typeof invoiceReducer>;
  wallet: ReturnType<typeof walletReducer>;
}

/**
 * Configure and create the Redux store with all middleware and enhancements
 */
const configureAppStore = () => {
  const middlewares = [
    thunk,
    performanceMiddleware,
    serializableMiddleware
  ];

  // Add development-only middleware
  if (isDevelopment) {
    const { createLogger } = require('redux-logger');
    middlewares.push(createLogger({
      collapsed: true,
      duration: true,
      timestamp: true
    }));
  }

  const store = configureStore({
    reducer: {
      auth: authReducer,
      billing: billingReducer,
      customer: customerReducer,
      invoice: invoiceReducer,
      wallet: walletReducer
    },
    middleware: (getDefaultMiddleware) => 
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
          warnAfter: 100
        },
        thunk: {
          extraArgument: {
            api: {
              baseURL: process.env.REACT_APP_API_URL
            }
          }
        }
      }).concat(middlewares),
    devTools: isDevelopment,
    enhancers: [sentryReduxEnhancer],
    preloadedState: loadState()
  });

  // Enable hot module replacement for reducers in development
  if (isDevelopment && module.hot) {
    module.hot.accept('./slices', () => {
      store.replaceReducer(store.getState());
    });
  }

  // Subscribe to store changes for state persistence
  store.subscribe(() => {
    saveState(store.getState());
  });

  return store;
};

/**
 * Load persisted state from localStorage
 */
const loadState = (): Partial<RootState> | undefined => {
  try {
    const serializedState = localStorage.getItem(REDUX_PERSIST_KEY);
    if (!serializedState) return undefined;
    return JSON.parse(serializedState);
  } catch (error) {
    console.error('Failed to load state:', error);
    return undefined;
  }
};

/**
 * Save state to localStorage
 */
const saveState = (state: RootState): void => {
  try {
    const serializedState = JSON.stringify(state);
    localStorage.setItem(REDUX_PERSIST_KEY, serializedState);
  } catch (error) {
    console.error('Failed to save state:', error);
  }
};

// Create the store instance
export const store = configureAppStore();

// Export type-safe hooks and selectors
export type AppDispatch = typeof store.dispatch;
export type AppStore = ReturnType<typeof configureAppStore>;

// Export store instance as default
export default store;