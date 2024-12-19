import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Grid, Box, Alert, Snackbar, Skeleton, CircularProgress } from '@mui/material';
import { AccountBalanceWallet, Refresh } from '@mui/icons-material';
import WalletBalance from '../../components/wallet/WalletBalance';
import TopUpForm from '../../components/wallet/TopUpForm';
import TransactionHistory from '../../components/wallet/TransactionHistory';
import { useWallet } from '../../hooks/useWallet';
import PageHeader from '../../components/common/PageHeader';
import { WalletResponse, ApiError } from '../../types/wallet';

// Maximum retry attempts for failed operations
const MAX_RETRY_ATTEMPTS = 3;

// Interface for component state
interface WalletPageState {
  snackbar: {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
    autoHideDuration: number;
  };
  retryCount: number;
  wsConnected: boolean;
}

/**
 * Enhanced Wallet page component providing comprehensive wallet management interface
 * with real-time updates and accessibility features
 */
const WalletPage: React.FC<{ customerId: string }> = React.memo(({ customerId }) => {
  // Local state management
  const [state, setState] = useState<WalletPageState>({
    snackbar: {
      open: false,
      message: '',
      severity: 'info',
      autoHideDuration: 6000,
    },
    retryCount: 0,
    wsConnected: false,
  });

  // Wallet hook with real-time updates
  const {
    balance,
    loading,
    error,
    handleTopUp,
    retryCount,
    wsStatus,
    resetError,
    connectionStatus
  } = useWallet(customerId, {
    enableRealTimeUpdates: true,
    lowBalanceThreshold: 1000,
    retryAttempts: MAX_RETRY_ATTEMPTS
  });

  // Memoized page actions
  const pageActions = useMemo(() => [
    <Alert
      key="connection-status"
      icon={<CircularProgress size={16} />}
      severity={connectionStatus === 'connected' ? 'success' : 'warning'}
      sx={{ py: 0.5 }}
    >
      {connectionStatus === 'connected' ? 'Real-time updates active' : 'Connecting...'}
    </Alert>
  ], [connectionStatus]);

  // Handle successful top-up
  const handleTopUpSuccess = useCallback((response: WalletResponse) => {
    setState(prev => ({
      ...prev,
      snackbar: {
        open: true,
        message: `Successfully added ${response.data.amount} to your wallet`,
        severity: 'success',
        autoHideDuration: 6000,
      },
      retryCount: 0,
    }));

    // Announce success to screen readers
    const announcement = `Successfully added ${response.data.amount} to your wallet. New balance: ${response.data.balance}`;
    const ariaLive = document.createElement('div');
    ariaLive.setAttribute('aria-live', 'polite');
    ariaLive.textContent = announcement;
    document.body.appendChild(ariaLive);
    setTimeout(() => document.body.removeChild(ariaLive), 1000);
  }, []);

  // Handle top-up error with retry mechanism
  const handleTopUpError = useCallback((error: ApiError) => {
    const canRetry = state.retryCount < MAX_RETRY_ATTEMPTS;
    
    setState(prev => ({
      ...prev,
      snackbar: {
        open: true,
        message: canRetry ? 
          `Top-up failed. Retrying... (${prev.retryCount + 1}/${MAX_RETRY_ATTEMPTS})` :
          'Top-up failed. Please try again later.',
        severity: 'error',
        autoHideDuration: 6000,
      },
      retryCount: prev.retryCount + 1,
    }));

    // Log error for monitoring
    console.error('Top-up error:', error);
  }, [state.retryCount]);

  // Handle retry attempts
  const handleRetry = useCallback(async () => {
    if (state.retryCount >= MAX_RETRY_ATTEMPTS) {
      setState(prev => ({
        ...prev,
        snackbar: {
          open: true,
          message: 'Maximum retry attempts reached. Please try again later.',
          severity: 'error',
          autoHideDuration: 6000,
        },
      }));
      return;
    }

    // Exponential backoff delay
    const delay = Math.pow(2, state.retryCount) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    resetError();
  }, [state.retryCount, resetError]);

  // Close snackbar handler
  const handleSnackbarClose = useCallback(() => {
    setState(prev => ({
      ...prev,
      snackbar: { ...prev.snackbar, open: false },
    }));
  }, []);

  // Effect for WebSocket connection status
  useEffect(() => {
    setState(prev => ({
      ...prev,
      wsConnected: connectionStatus === 'connected',
    }));
  }, [connectionStatus]);

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <PageHeader
        title="Wallet Management"
        subtitle="Manage your wallet balance and view transaction history"
        actions={pageActions}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Wallet' }
        ]}
      />

      <Grid container spacing={3} sx={{ p: 3 }}>
        {/* Wallet Balance Section */}
        <Grid item xs={12} md={6}>
          <WalletBalance
            customerId={customerId}
            showAlert
            refreshInterval={30000}
            alertThreshold={1000}
          />
        </Grid>

        {/* Top-up Form Section */}
        <Grid item xs={12} md={6}>
          <TopUpForm
            walletId={customerId}
            onSuccess={handleTopUpSuccess}
            onError={handleTopUpError}
            minAmount={10}
            maxAmount={10000}
          />
        </Grid>

        {/* Transaction History Section */}
        <Grid item xs={12}>
          <TransactionHistory
            customerId={customerId}
            pageSize={10}
            refreshInterval={30000}
            locale="en-US"
            timezone="UTC"
          />
        </Grid>
      </Grid>

      {/* Status Notifications */}
      <Snackbar
        open={state.snackbar.open}
        autoHideDuration={state.snackbar.autoHideDuration}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={state.snackbar.severity}
          sx={{ width: '100%' }}
          variant="filled"
        >
          {state.snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
});

// Display name for debugging
WalletPage.displayName = 'WalletPage';

export default WalletPage;