import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Skeleton,
  Alert,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { format, subDays, isValid, isBefore, isAfter } from 'date-fns';
import { debounce } from 'lodash';
import { ErrorBoundary } from 'react-error-boundary';

import PageHeader from '../../components/common/PageHeader';
import UsageChart from '../../components/billing/UsageChart';
import { useCustomer } from '../../hooks/useCustomer';
import { BREAKPOINTS, THEME_CONFIG } from '../../config/constants';

// Constants for the component
const PERIOD_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
] as const;

const DEFAULT_PERIOD = 'daily';
const DEBOUNCE_DELAY = 300;
const MAX_DATE_RANGE = {
  daily: 30,
  weekly: 90,
  monthly: 365
};

// Interface for component state
interface UsagePageState {
  period: typeof PERIOD_OPTIONS[number]['value'];
  startDate: Date;
  endDate: Date;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Usage Analytics Page Component
 * Displays detailed usage statistics and trends for OTPless authentication services
 */
const Usage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(`(max-width:${BREAKPOINTS.MOBILE}px)`);
  const { selectedCustomer } = useCustomer();

  // Initialize state
  const [state, setState] = useState<UsagePageState>(() => ({
    period: DEFAULT_PERIOD,
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
    isLoading: false,
    error: null
  }));

  // Memoized date validation
  const dateValidation = useMemo(() => {
    const maxRange = MAX_DATE_RANGE[state.period];
    const diffInDays = Math.ceil((state.endDate.getTime() - state.startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      isValid: diffInDays <= maxRange && isBefore(state.startDate, state.endDate),
      message: diffInDays > maxRange 
        ? `Date range cannot exceed ${maxRange} days for ${state.period} view`
        : !isBefore(state.startDate, state.endDate)
        ? 'Start date must be before end date'
        : ''
    };
  }, [state.period, state.startDate, state.endDate]);

  // Handle period change
  const handlePeriodChange = useCallback((event: React.ChangeEvent<{ value: unknown }>) => {
    const newPeriod = event.target.value as typeof PERIOD_OPTIONS[number]['value'];
    const maxRange = MAX_DATE_RANGE[newPeriod];
    const newStartDate = subDays(state.endDate, maxRange);

    setState(prev => ({
      ...prev,
      period: newPeriod,
      startDate: newStartDate
    }));
  }, [state.endDate]);

  // Debounced date change handler
  const handleDateChange = useMemo(() => 
    debounce((type: 'start' | 'end', date: Date | null) => {
      if (!date || !isValid(date)) return;

      setState(prev => ({
        ...prev,
        [`${type}Date`]: date,
        error: null
      }));
    }, DEBOUNCE_DELAY),
    []
  );

  // Error fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <Alert 
      severity="error"
      sx={{ mt: 2 }}
    >
      Failed to load usage data: {error.message}
    </Alert>
  );

  // Loading skeleton
  const LoadingSkeleton = () => (
    <Box sx={{ mt: 2 }}>
      <Skeleton variant="rectangular" height={400} />
      <Grid container spacing={2} sx={{ mt: 2 }}>
        {[1, 2, 3].map(i => (
          <Grid item xs={12} md={4} key={i}>
            <Skeleton variant="rectangular" height={100} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  return (
    <Box>
      <PageHeader
        title="Usage Analytics"
        subtitle="Monitor your authentication service usage across different channels"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Usage Analytics' }
        ]}
      />

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="period-select-label">Time Period</InputLabel>
                <Select
                  labelId="period-select-label"
                  value={state.period}
                  onChange={handlePeriodChange}
                  label="Time Period"
                >
                  {PERIOD_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <DatePicker
                label="Start Date"
                value={state.startDate}
                onChange={(date) => handleDateChange('start', date)}
                maxDate={state.endDate}
                slotProps={{
                  textField: { fullWidth: true }
                }}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <DatePicker
                label="End Date"
                value={state.endDate}
                onChange={(date) => handleDateChange('end', date)}
                maxDate={new Date()}
                minDate={state.startDate}
                slotProps={{
                  textField: { fullWidth: true }
                }}
              />
            </Grid>
          </Grid>

          {!dateValidation.isValid && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {dateValidation.message}
            </Alert>
          )}

          <ErrorBoundary FallbackComponent={ErrorFallback}>
            {state.isLoading ? (
              <LoadingSkeleton />
            ) : (
              <Box sx={{ mt: 4 }}>
                <UsageChart
                  customerId={selectedCustomer?.id || ''}
                  period={state.period}
                  startDate={format(state.startDate, 'yyyy-MM-dd')}
                  endDate={format(state.endDate, 'yyyy-MM-dd')}
                  height={isMobile ? 300 : 400}
                />
              </Box>
            )}
          </ErrorBoundary>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Usage;