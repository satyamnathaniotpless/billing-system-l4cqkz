// @version: react@18.0.0
// @version: @mui/material@5.0.0
// @version: @mui/icons-material@5.0.0
// @version: use-debounce@9.0.0
import React, { useCallback, useMemo } from 'react';
import { Typography, CircularProgress, Alert, Tooltip, Skeleton, IconButton } from '@mui/material';
import { AccountBalanceWallet, Refresh } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useDebounce } from 'use-debounce';
import { useWallet } from '../../hooks/useWallet';
import Card from '../common/Card';

// Styled components
const WalletContainer = styled(Card)(({ theme }) => ({
  position: 'relative',
  minHeight: '120px',
  transition: theme.transitions.create(['background-color', 'box-shadow'], {
    duration: theme.transitions.duration.standard,
  }),
  '&:hover': {
    cursor: 'default',
  },
}));

const BalanceWrapper = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
}));

const WalletIcon = styled(AccountBalanceWallet)(({ theme }) => ({
  fontSize: '2rem',
  color: theme.palette.primary.main,
}));

const RefreshButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  right: theme.spacing(1),
}));

// Props interface
export interface WalletBalanceProps {
  customerId: string;
  showAlert?: boolean;
  refreshInterval?: number;
  alertThreshold?: number;
  className?: string;
}

/**
 * Formats currency amount with proper locale and symbol support
 */
const formatCurrency = (amount: number, currency = 'USD', locale = 'en-US'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * WalletBalance Component
 * Displays real-time wallet balance with alerts and accessibility support
 */
export const WalletBalance = React.memo<WalletBalanceProps>(({
  customerId,
  showAlert = true,
  refreshInterval = 30000,
  alertThreshold = 1000,
  className,
}) => {
  // Hooks
  const {
    balance,
    loading,
    error,
    fetchBalance,
    isLowBalance,
    connectionStatus
  } = useWallet(customerId, {
    enableRealTimeUpdates: true,
    lowBalanceThreshold: alertThreshold,
  });

  // Debounce balance updates to prevent UI flicker
  const [debouncedBalance] = useDebounce(balance, 300);

  // Memoized formatted balance
  const formattedBalance = useMemo(() => {
    return formatCurrency(debouncedBalance);
  }, [debouncedBalance]);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    try {
      await fetchBalance();
    } catch (err) {
      console.error('Failed to refresh balance:', err);
    }
  }, [fetchBalance]);

  // Render loading state
  if (loading && !debouncedBalance) {
    return (
      <WalletContainer className={className} elevation={1}>
        <Skeleton
          variant="rectangular"
          height={120}
          animation="wave"
          aria-label="Loading wallet balance"
        />
      </WalletContainer>
    );
  }

  // Render error state
  if (error) {
    return (
      <WalletContainer className={className} elevation={1}>
        <Alert
          severity="error"
          action={
            <IconButton
              aria-label="Retry loading balance"
              onClick={handleRefresh}
              size="small"
            >
              <Refresh />
            </IconButton>
          }
        >
          Failed to load wallet balance. Please try again.
        </Alert>
      </WalletContainer>
    );
  }

  return (
    <WalletContainer
      className={className}
      elevation={2}
      aria-live="polite"
      aria-atomic="true"
    >
      <BalanceWrapper>
        <Tooltip title="Current wallet balance" arrow>
          <WalletIcon aria-hidden="true" />
        </Tooltip>
        <div>
          <Typography
            variant="subtitle2"
            color="textSecondary"
            gutterBottom
          >
            Wallet Balance
          </Typography>
          <Typography
            variant="h4"
            component="p"
            color={isLowBalance ? 'error' : 'textPrimary'}
            aria-label={`Current balance: ${formattedBalance}`}
          >
            {formattedBalance}
          </Typography>
        </div>
      </BalanceWrapper>

      {/* Real-time connection indicator */}
      <Tooltip
        title={`Connection status: ${connectionStatus}`}
        placement="bottom-start"
      >
        <CircularProgress
          size={16}
          thickness={4}
          sx={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            opacity: connectionStatus === 'connected' ? 1 : 0.5,
          }}
        />
      </Tooltip>

      {/* Manual refresh button */}
      <RefreshButton
        onClick={handleRefresh}
        aria-label="Refresh balance"
        size="small"
        disabled={loading}
      >
        <Refresh />
      </RefreshButton>

      {/* Low balance alert */}
      {showAlert && isLowBalance && (
        <Alert
          severity="warning"
          sx={{ mt: 2 }}
          role="alert"
        >
          Low balance alert: Balance is below {formatCurrency(alertThreshold)}
        </Alert>
      )}
    </WalletContainer>
  );
});

// Display name for debugging
WalletBalance.displayName = 'WalletBalance';

export default WalletBalance;