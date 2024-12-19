import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { Box, CircularProgress, useTheme, useMediaQuery } from '@mui/material';
import { debounce } from 'lodash';
// @version @mui/material@5.0.0
// @version react@18.0.0
// @version lodash@4.17.21

import Chart from '../common/Chart';
import { useBilling } from '../../hooks/useBilling';
import { BREAKPOINTS, THEME_CONFIG } from '../../config/constants';

// Constants for chart configuration
const CHANNEL_COLORS = {
  SMS: THEME_CONFIG.COLORS.PRIMARY,
  WhatsApp: THEME_CONFIG.COLORS.SUCCESS,
  Email: THEME_CONFIG.COLORS.WARNING
} as const;

const DEFAULT_HEIGHT = 400;
const RESIZE_DEBOUNCE_MS = 250;

// Interface for component props
interface UsageChartProps {
  customerId: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  height?: number | string;
}

// Interface for aggregated usage data
interface AggregatedData {
  date: string;
  SMS: number;
  WhatsApp: number;
  Email: number;
  total: number;
}

/**
 * UsageChart Component - Visualizes usage analytics across different channels
 */
const UsageChart: React.FC<UsageChartProps> = ({
  customerId,
  period,
  startDate,
  endDate,
  height = DEFAULT_HEIGHT
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(`(max-width:${BREAKPOINTS.MOBILE}px)`);
  const [chartHeight, setChartHeight] = useState<number | string>(height);

  // Fetch billing data using the custom hook
  const { bills, loading, error } = useBilling({
    pollInterval: 300000 // 5 minutes
  });

  // Process and aggregate usage data
  const aggregateUsageData = useCallback((data: typeof bills): AggregatedData[] => {
    if (!data?.length) return [];

    const aggregated = data.reduce((acc: Record<string, AggregatedData>, bill) => {
      const date = new Date(bill.billingPeriodStart).toISOString().split('T')[0];
      
      if (!acc[date]) {
        acc[date] = {
          date,
          SMS: 0,
          WhatsApp: 0,
          Email: 0,
          total: 0
        };
      }

      // Aggregate usage by channel
      const usage = bill.usage;
      acc[date].SMS += usage;
      acc[date].WhatsApp += usage;
      acc[date].Email += usage;
      acc[date].total += usage;

      return acc;
    }, {});

    return Object.values(aggregated).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, []);

  // Memoized chart data
  const chartData = useMemo(() => {
    const filteredBills = bills.filter(bill => 
      bill.customerId === customerId &&
      new Date(bill.billingPeriodStart) >= new Date(startDate) &&
      new Date(bill.billingPeriodEnd) <= new Date(endDate)
    );
    return aggregateUsageData(filteredBills);
  }, [bills, customerId, startDate, endDate, aggregateUsageData]);

  // Chart series configuration
  const chartSeries = useMemo(() => [
    {
      dataKey: 'SMS',
      name: 'SMS Authentication',
      color: CHANNEL_COLORS.SMS
    },
    {
      dataKey: 'WhatsApp',
      name: 'WhatsApp Authentication',
      color: CHANNEL_COLORS.WhatsApp
    },
    {
      dataKey: 'Email',
      name: 'Email Authentication',
      color: CHANNEL_COLORS.Email
    }
  ], []);

  // Handle responsive height adjustments
  useEffect(() => {
    const handleResize = debounce(() => {
      const newHeight = isMobile ? 300 : DEFAULT_HEIGHT;
      setChartHeight(newHeight);
    }, RESIZE_DEBOUNCE_MS);

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      handleResize.cancel();
    };
  }, [isMobile]);

  // Format date for x-axis based on period
  const formatDate = useCallback((date: string) => {
    const d = new Date(date);
    switch (period) {
      case 'monthly':
        return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      case 'weekly':
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      default:
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }, [period]);

  // Format number for y-axis
  const formatNumber = useCallback((value: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value);
  }, []);

  if (error) {
    return (
      <Box
        height={chartHeight}
        display="flex"
        alignItems="center"
        justifyContent="center"
        color="error.main"
      >
        Error loading usage data: {error.message}
      </Box>
    );
  }

  if (loading) {
    return (
      <Box
        height={chartHeight}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Chart
      data={chartData}
      type="area"
      height={chartHeight}
      series={chartSeries}
      xAxis={{
        dataKey: 'date',
        label: 'Time Period',
        tickFormatter: formatDate
      }}
      yAxis={{
        label: 'Usage Count',
        tickFormatter: formatNumber
      }}
      tooltipFormatter={(value: number) => formatNumber(value)}
      legendPosition={isMobile ? 'bottom' : 'right'}
      animate={!isMobile}
    />
  );
};

export default UsageChart;