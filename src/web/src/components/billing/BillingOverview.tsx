import React, { useEffect, useMemo, useCallback } from 'react';
import { 
  Grid, 
  Typography, 
  Box, 
  CircularProgress, 
  Tooltip, 
  IconButton,
  useTheme 
} from '@mui/material';
import { useInView } from 'react-intersection-observer';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

import Card from '../common/Card';
import Chart from '../common/Chart';
import { useBilling } from '../../hooks/useBilling';
import { formatCurrency } from '../../utils/currency';
import { BillStatus, SupportedCurrency } from '../../types/billing';
import { THEME_CONFIG, VALIDATION_RULES } from '../../config/constants';

// Constants for the component
const METRIC_CARD_HEIGHT = 160;
const CHART_HEIGHT = 400;
const UPDATE_INTERVAL = 300000; // 5 minutes
const ALERT_THRESHOLDS = {
  WALLET_LOW_BALANCE: 1000,
  INVOICE_DUE_SOON: 72 // hours
};

// Props interface
interface BillingOverviewProps {
  customerId?: string;
  timeRange?: 'day' | 'week' | 'month' | 'year';
  currency?: SupportedCurrency;
  refreshInterval?: number;
}

/**
 * Calculates revenue metrics with trending data
 */
const calculateRevenueMetrics = (bills: any[], currency: SupportedCurrency) => {
  const totalRevenue = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
  const paidRevenue = bills
    .filter(bill => bill.status === BillStatus.PAID)
    .reduce((sum, bill) => sum + bill.totalAmount, 0);
  const pendingRevenue = bills
    .filter(bill => bill.status === BillStatus.PENDING)
    .reduce((sum, bill) => sum + bill.totalAmount, 0);

  // Calculate month-to-date change
  const previousMonthRevenue = bills
    .filter(bill => {
      const billDate = new Date(bill.billingPeriodEnd);
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return billDate >= lastMonth && billDate < new Date();
    })
    .reduce((sum, bill) => sum + bill.totalAmount, 0);

  const revenueChange = ((totalRevenue - previousMonthRevenue) / previousMonthRevenue) * 100;

  return {
    total: formatCurrency(totalRevenue, currency),
    paid: formatCurrency(paidRevenue, currency),
    pending: formatCurrency(pendingRevenue, currency),
    change: revenueChange.toFixed(1),
    trend: revenueChange >= 0 ? 'up' : 'down'
  };
};

/**
 * BillingOverview Component
 * Displays comprehensive billing metrics and trends with real-time updates
 */
const BillingOverview: React.FC<BillingOverviewProps> = React.memo(({
  customerId,
  timeRange = 'month',
  currency = SupportedCurrency.USD,
  refreshInterval = UPDATE_INTERVAL
}) => {
  const theme = useTheme();
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false
  });

  const {
    bills,
    pricePlans,
    loading,
    error,
    fetchBills
  } = useBilling();

  // Memoized revenue metrics
  const revenueMetrics = useMemo(() => 
    calculateRevenueMetrics(bills, currency),
    [bills, currency]
  );

  // Setup polling for real-time updates
  useEffect(() => {
    if (!inView) return;

    const fetchData = () => {
      fetchBills({
        customerId,
        dateRange: {
          start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(),
          end: new Date().toISOString()
        }
      });
    };

    fetchData();
    const interval = setInterval(fetchData, refreshInterval);

    return () => clearInterval(interval);
  }, [inView, customerId, fetchBills, refreshInterval]);

  // Chart data preparation
  const chartData = useMemo(() => {
    return bills.map(bill => ({
      date: new Date(bill.billingPeriodEnd).toLocaleDateString(),
      amount: bill.totalAmount,
      usage: bill.usage
    }));
  }, [bills]);

  // Error handling
  if (error) {
    return (
      <Card variant="outlined" padding="large">
        <Typography color="error" align="center">
          Error loading billing data: {error.message}
        </Typography>
      </Card>
    );
  }

  return (
    <Box ref={ref} role="region" aria-label="Billing Overview Dashboard">
      <Grid container spacing={3}>
        {/* Revenue Overview */}
        <Grid item xs={12} md={6} lg={3}>
          <Card elevation={2} padding="large">
            <Typography variant="h6" gutterBottom>
              Total Revenue
              <Tooltip title="Total revenue across all billing periods">
                <IconButton size="small" sx={{ ml: 1 }}>
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Typography>
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              <>
                <Typography variant="h4" component="div">
                  {revenueMetrics.total}
                </Typography>
                <Box display="flex" alignItems="center" mt={1}>
                  {revenueMetrics.trend === 'up' ? (
                    <TrendingUpIcon color="success" />
                  ) : (
                    <TrendingDownIcon color="error" />
                  )}
                  <Typography
                    variant="body2"
                    color={revenueMetrics.trend === 'up' ? 'success.main' : 'error.main'}
                    ml={1}
                  >
                    {revenueMetrics.change}% MTD
                  </Typography>
                </Box>
              </>
            )}
          </Card>
        </Grid>

        {/* Pending Invoices */}
        <Grid item xs={12} md={6} lg={3}>
          <Card elevation={2} padding="large">
            <Typography variant="h6" gutterBottom>
              Pending Invoices
            </Typography>
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              <>
                <Typography variant="h4" component="div">
                  {revenueMetrics.pending}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {bills.filter(b => b.status === BillStatus.PENDING).length} invoices pending
                </Typography>
              </>
            )}
          </Card>
        </Grid>

        {/* Usage Trends */}
        <Grid item xs={12}>
          <Card elevation={1} padding="normal">
            <Typography variant="h6" gutterBottom>
              Revenue & Usage Trends
            </Typography>
            <Box height={CHART_HEIGHT}>
              {loading ? (
                <CircularProgress />
              ) : (
                <Chart
                  type="line"
                  data={chartData}
                  height={CHART_HEIGHT}
                  series={[
                    { dataKey: 'amount', name: 'Revenue' },
                    { dataKey: 'usage', name: 'Usage' }
                  ]}
                  xAxis={{ dataKey: 'date', label: 'Date' }}
                  yAxis={{ label: 'Amount' }}
                  tooltipFormatter={(value) => formatCurrency(value, currency)}
                />
              )}
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
});

BillingOverview.displayName = 'BillingOverview';

export default BillingOverview;