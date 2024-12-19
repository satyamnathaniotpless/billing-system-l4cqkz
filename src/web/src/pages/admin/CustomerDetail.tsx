import React, { useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Alert, Container, Skeleton } from '@mui/material';
import { useAnalytics } from '@segment/analytics-react';
import { withErrorBoundary } from 'react-error-boundary';

import AdminLayout from '../../components/layout/AdminLayout';
import CustomerDetails from '../../components/customer/CustomerDetails';
import { useCustomer } from '../../hooks/useCustomer';

// Version comments for external dependencies
// @mui/material: ^5.0.0
// react: ^18.0.0
// react-router-dom: ^6.0.0
// @segment/analytics-react: ^1.0.0
// react-error-boundary: ^4.0.0

/**
 * Enhanced CustomerDetailPage component with real-time updates and security features
 * Implements Material Design 3.0 principles and WCAG 2.1 Level AA compliance
 */
const CustomerDetailPage: React.FC = React.memo(() => {
  // Hooks
  const { id: customerId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const analytics = useAnalytics();
  
  // Customer management hook with real-time updates
  const {
    selectedCustomer,
    loading,
    error,
    fetchCustomerById,
    updateCustomer,
    subscribeToUpdates,
    refreshCache
  } = useCustomer();

  // Refs for cleanup
  const updateSubscription = useRef<() => void>();

  // Handle real-time updates subscription
  useEffect(() => {
    if (customerId) {
      // Initial data fetch
      fetchCustomerById(customerId).catch(error => {
        console.error('Failed to fetch customer:', error);
      });

      // Subscribe to real-time updates
      updateSubscription.current = subscribeToUpdates(customerId, (updatedData) => {
        refreshCache();
      });

      // Track page view
      analytics.track('Customer Detail View', {
        customerId,
        path: location.pathname
      });
    }

    // Cleanup subscription on unmount
    return () => {
      if (updateSubscription.current) {
        updateSubscription.current();
      }
    };
  }, [customerId, fetchCustomerById, subscribeToUpdates, analytics, location.pathname]);

  // Handle customer update with optimistic UI
  const handleCustomerUpdate = useCallback(async (data: any) => {
    if (!customerId) return;

    try {
      await updateCustomer(customerId, data);
      
      // Track successful update
      analytics.track('Customer Update', {
        customerId,
        updateType: Object.keys(data).join(',')
      });
    } catch (error) {
      console.error('Failed to update customer:', error);
      throw error;
    }
  }, [customerId, updateCustomer, analytics]);

  // Handle error state
  if (error.customers) {
    return (
      <AdminLayout>
        <Container maxWidth="lg">
          <Alert 
            severity="error"
            action={
              <Box sx={{ display: 'flex', gap: 2 }}>
                <button onClick={() => navigate(-1)}>Go Back</button>
                <button onClick={() => refreshCache()}>Retry</button>
              </Box>
            }
          >
            {error.customers}
          </Alert>
        </Container>
      </AdminLayout>
    );
  }

  // Handle loading state with skeleton
  if (loading.customers && !selectedCustomer) {
    return (
      <AdminLayout>
        <Container maxWidth="lg">
          <Box role="alert" aria-busy="true">
            <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" height={400} />
          </Box>
        </Container>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Container 
        maxWidth="lg"
        sx={{
          py: { xs: 2, sm: 3 },
          px: { xs: 2, sm: 3 }
        }}
      >
        {/* Enhanced CustomerDetails component with real-time updates */}
        <CustomerDetails
          customerId={customerId}
          onError={(error) => {
            console.error('Customer details error:', error);
            analytics.track('Customer Detail Error', {
              customerId,
              error: error.message
            });
          }}
        />
      </Container>
    </AdminLayout>
  );
});

// Display name for debugging
CustomerDetailPage.displayName = 'CustomerDetailPage';

// Error boundary wrapper
const CustomerDetailPageWithErrorBoundary = withErrorBoundary(CustomerDetailPage, {
  FallbackComponent: ({ error, resetErrorBoundary }) => (
    <AdminLayout>
      <Container maxWidth="lg">
        <Alert
          severity="error"
          action={
            <button onClick={resetErrorBoundary}>Try Again</button>
          }
        >
          {error.message || 'An unexpected error occurred'}
        </Alert>
      </Container>
    </AdminLayout>
  ),
  onError: (error, info) => {
    // Log error to monitoring service
    console.error('Customer detail page error:', error, info);
  }
});

export default CustomerDetailPageWithErrorBoundary;