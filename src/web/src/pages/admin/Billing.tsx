import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Box, 
  Container, 
  Grid, 
  Typography, 
  CircularProgress, 
  Tab, 
  Tabs, 
  Alert, 
  Snackbar 
} from '@mui/material';
import { useDebounce } from 'use-debounce';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import AdminLayout from '../../components/layout/AdminLayout';
import BillingOverview from '../../components/billing/BillingOverview';
import InvoiceGenerator from '../../components/billing/InvoiceGenerator';
import { useBilling } from '../../hooks/useBilling';

// Version comments for external dependencies
// @mui/material: ^5.0.0
// react: ^18.0.0
// use-debounce: ^9.0.0
// react-error-boundary: ^4.0.0

interface BillingPageProps {
  defaultCurrency?: string;
  refreshInterval?: number;
}

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
  role?: string;
  'aria-labelledby'?: string;
}

const TabPanel: React.FC<TabPanelProps> = ({
  children,
  value,
  index,
  ...props
}) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`billing-tabpanel-${index}`}
      aria-labelledby={`billing-tab-${index}`}
      {...props}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const BillingPage: React.FC<BillingPageProps> = React.memo(({
  defaultCurrency = 'USD',
  refreshInterval = 300000 // 5 minutes
}) => {
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Custom hooks
  const {
    bills,
    pricePlans,
    loading,
    error,
    fetchBills,
    fetchPricePlans,
    startPolling,
    stopPolling
  } = useBilling();

  // Debounced data fetching
  const [debouncedFetch] = useDebounce(fetchBills, 500);

  // Initialize data and polling
  useEffect(() => {
    fetchPricePlans();
    debouncedFetch();
    startPolling(refreshInterval);

    return () => {
      stopPolling();
    };
  }, [fetchPricePlans, debouncedFetch, startPolling, stopPolling, refreshInterval]);

  // Tab change handler
  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  }, []);

  // Invoice generation success handler
  const handleInvoiceGenerated = useCallback((invoice: any) => {
    setSnackbar({
      open: true,
      message: `Invoice #${invoice.invoiceNumber} generated successfully`,
      severity: 'success'
    });
    debouncedFetch(); // Refresh bills list
  }, [debouncedFetch]);

  // Error handler
  const handleError = useCallback((error: Error) => {
    setSnackbar({
      open: true,
      message: error.message || 'An error occurred',
      severity: 'error'
    });
  }, []);

  // Snackbar close handler
  const handleSnackbarClose = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  // Error fallback component
  const ErrorFallback = useCallback(({ error, resetErrorBoundary }: any) => (
    <Alert
      severity="error"
      onClose={resetErrorBoundary}
      sx={{ mb: 2 }}
    >
      {error.message}
    </Alert>
  ), []);

  // Memoized tab labels for accessibility
  const tabLabels = useMemo(() => [
    { id: 'overview', label: 'Billing Overview', ariaLabel: 'Show billing overview' },
    { id: 'generate', label: 'Generate Invoice', ariaLabel: 'Generate new invoice' }
  ], []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AdminLayout>
        <Container maxWidth="lg">
          {/* Page Header */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Billing Management
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Manage invoices, view billing metrics, and generate new bills
            </Typography>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error.message}
            </Alert>
          )}

          {/* Main Content */}
          <Box sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                aria-label="Billing management tabs"
              >
                {tabLabels.map((tab, index) => (
                  <Tab
                    key={tab.id}
                    label={tab.label}
                    id={`billing-tab-${index}`}
                    aria-controls={`billing-tabpanel-${index}`}
                    aria-label={tab.ariaLabel}
                  />
                ))}
              </Tabs>
            </Box>

            {/* Loading Indicator */}
            {loading && (
              <Box display="flex" justifyContent="center" my={4}>
                <CircularProgress aria-label="Loading billing data" />
              </Box>
            )}

            {/* Tab Panels */}
            <TabPanel value={activeTab} index={0}>
              <BillingOverview
                currency={defaultCurrency}
                refreshInterval={refreshInterval}
              />
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <InvoiceGenerator
                currency={defaultCurrency}
                onSuccess={handleInvoiceGenerated}
                onError={handleError}
              />
            </TabPanel>
          </Box>

          {/* Notification Snackbar */}
          <Snackbar
            open={snackbar.open}
            autoHideDuration={6000}
            onClose={handleSnackbarClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <Alert
              onClose={handleSnackbarClose}
              severity={snackbar.severity}
              variant="filled"
              sx={{ width: '100%' }}
            >
              {snackbar.message}
            </Alert>
          </Snackbar>
        </Container>
      </AdminLayout>
    </ErrorBoundary>
  );
});

// Display name for debugging
BillingPage.displayName = 'BillingPage';

export default BillingPage;