import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Box, 
  Grid, 
  Card, 
  CardContent, 
  Typography, 
  Select, 
  MenuItem, 
  CircularProgress,
  useTheme 
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import Chart from '../../components/common/Chart';
import DataGrid from '../../components/common/DataGrid';
import PageHeader from '../../components/common/PageHeader';
import { formatDate, validateDate } from '../../utils/date';
import { formatCurrency } from '../../utils/currency';

// Constants for report configuration
const REPORT_TYPES = {
  USAGE: 'usage',
  REVENUE: 'revenue',
  CUSTOMERS: 'customers',
  GEOGRAPHIC: 'geographic'
} as const;

const INTERVALS = {
  HOURLY: 'hourly',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly'
} as const;

const GROUP_BY = {
  CHANNEL: 'channel',
  REGION: 'region',
  CUSTOMER: 'customer',
  PLAN: 'plan'
} as const;

// Interfaces
interface ReportFilters {
  dateRange: {
    start: Date;
    end: Date;
    timezone: string;
  };
  reportType: keyof typeof REPORT_TYPES;
  interval: keyof typeof INTERVALS;
  groupBy: keyof typeof GROUP_BY;
  exportFormat?: 'csv' | 'xlsx' | 'pdf';
}

interface ReportData {
  labels: string[];
  series: Array<{
    name: string;
    data: number[];
    color?: string;
  }>;
  summary: {
    total: number;
    growth: number;
    previousPeriod: number;
  };
  metadata: {
    processedAt: Date;
    dataPoints: number;
    status: string;
  };
}

const Reports: React.FC = () => {
  const theme = useTheme();
  const queryClient = useQueryClient();

  // State management
  const [filters, setFilters] = useState<ReportFilters>({
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    reportType: 'usage',
    interval: 'daily',
    groupBy: 'channel'
  });

  // Data fetching with React Query
  const { data, isLoading, error } = useQuery<ReportData>(
    ['reports', filters],
    () => fetchReportData(filters),
    {
      keepPreviousData: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 30 * 60 * 1000 // 30 minutes
    }
  );

  // Memoized chart data processing
  const chartData = useMemo(() => {
    if (!data) return null;

    return {
      labels: data.labels,
      series: data.series.map(series => ({
        ...series,
        color: series.color || theme.palette.primary.main
      }))
    };
  }, [data, theme]);

  // Filter change handler
  const handleFilterChange = useCallback((
    key: keyof ReportFilters,
    value: any
  ) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  // Export handler
  const handleExport = useCallback(async (format: 'csv' | 'xlsx' | 'pdf') => {
    try {
      setFilters(prev => ({
        ...prev,
        exportFormat: format
      }));
      // Export logic implementation
    } catch (error) {
      console.error('Export error:', error);
    }
  }, []);

  // Actions for PageHeader
  const headerActions = useMemo(() => [
    {
      label: 'Export CSV',
      onClick: () => handleExport('csv')
    },
    {
      label: 'Export Excel',
      onClick: () => handleExport('xlsx')
    },
    {
      label: 'Export PDF',
      onClick: () => handleExport('pdf')
    }
  ], [handleExport]);

  return (
    <ErrorBoundary
      fallback={<Box p={3}>Error loading reports. Please try again.</Box>}
    >
      <Box>
        <PageHeader
          title="Analytics & Reports"
          subtitle="Comprehensive analytics and reporting for billing operations"
          actions={headerActions.map((action, index) => (
            <Button
              key={index}
              onClick={action.onClick}
              variant="outlined"
              size="small"
            >
              {action.label}
            </Button>
          ))}
        />

        <Box p={3}>
          {/* Filters Section */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={3}>
                  <DatePicker
                    label="Start Date"
                    value={filters.dateRange.start}
                    onChange={(date) => handleFilterChange('dateRange', {
                      ...filters.dateRange,
                      start: date || new Date()
                    })}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <DatePicker
                    label="End Date"
                    value={filters.dateRange.end}
                    onChange={(date) => handleFilterChange('dateRange', {
                      ...filters.dateRange,
                      end: date || new Date()
                    })}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <Select
                    fullWidth
                    value={filters.reportType}
                    onChange={(e) => handleFilterChange('reportType', e.target.value)}
                    label="Report Type"
                  >
                    {Object.entries(REPORT_TYPES).map(([key, value]) => (
                      <MenuItem key={key} value={value}>
                        {key.charAt(0) + key.slice(1).toLowerCase()}
                      </MenuItem>
                    ))}
                  </Select>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Select
                    fullWidth
                    value={filters.interval}
                    onChange={(e) => handleFilterChange('interval', e.target.value)}
                    label="Interval"
                  >
                    {Object.entries(INTERVALS).map(([key, value]) => (
                      <MenuItem key={key} value={value}>
                        {key.charAt(0) + key.slice(1).toLowerCase()}
                      </MenuItem>
                    ))}
                  </Select>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Select
                    fullWidth
                    value={filters.groupBy}
                    onChange={(e) => handleFilterChange('groupBy', e.target.value)}
                    label="Group By"
                  >
                    {Object.entries(GROUP_BY).map(([key, value]) => (
                      <MenuItem key={key} value={value}>
                        {key.charAt(0) + key.slice(1).toLowerCase()}
                      </MenuItem>
                    ))}
                  </Select>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          {data?.summary && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Total {filters.reportType}
                    </Typography>
                    <Typography variant="h4">
                      {filters.reportType === 'revenue' 
                        ? formatCurrency(data.summary.total, 'USD')
                        : data.summary.total.toLocaleString()}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color={data.summary.growth >= 0 ? 'success.main' : 'error.main'}
                    >
                      {data.summary.growth >= 0 ? '+' : ''}{data.summary.growth}% vs previous period
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Chart Section */}
          {isLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Box p={4} textAlign="center" color="error.main">
              Error loading report data
            </Box>
          ) : chartData && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Chart
                  type="line"
                  height={400}
                  data={chartData.labels.map((label, index) => ({
                    label,
                    ...chartData.series.reduce((acc, series) => ({
                      ...acc,
                      [series.name]: series.data[index]
                    }), {})
                  }))}
                  series={chartData.series}
                  xAxis={{
                    dataKey: 'label',
                    label: 'Time Period'
                  }}
                  yAxis={{
                    label: filters.reportType === 'revenue' ? 'Amount (USD)' : 'Count'
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Detailed Data Grid */}
          {data && (
            <DataGrid
              rows={data.labels.map((label, index) => ({
                id: index,
                period: label,
                ...data.series.reduce((acc, series) => ({
                  ...acc,
                  [series.name]: series.data[index]
                }), {})
              }))}
              columns={[
                { field: 'period', headerName: 'Period', flex: 1 },
                ...data.series.map(series => ({
                  field: series.name,
                  headerName: series.name,
                  flex: 1,
                  valueFormatter: (params: any) => 
                    filters.reportType === 'revenue'
                      ? formatCurrency(params.value, 'USD')
                      : params.value.toLocaleString()
                }))
              ]}
              title="Detailed Data"
              pagination
            />
          )}
        </Box>
      </Box>
    </ErrorBoundary>
  );
};

// Async function to fetch report data
async function fetchReportData(filters: ReportFilters): Promise<ReportData> {
  // Implementation would typically make an API call here
  // For now, returning mock data
  return {
    labels: ['2023-01', '2023-02', '2023-03'],
    series: [
      {
        name: 'SMS',
        data: [1000, 1200, 1500]
      },
      {
        name: 'WhatsApp',
        data: [800, 1000, 1300]
      }
    ],
    summary: {
      total: 6800,
      growth: 15.5,
      previousPeriod: 5800
    },
    metadata: {
      processedAt: new Date(),
      dataPoints: 6,
      status: 'success'
    }
  };
}

export default React.memo(Reports);