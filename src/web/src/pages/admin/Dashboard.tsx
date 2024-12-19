import React, { useEffect, useCallback, useMemo } from 'react';
import { Container, Grid, Box, CircularProgress, Alert } from '@mui/material';
import { Navigate, useLocation } from 'react-router-dom';

// Internal imports
import PageHeader from '../../components/common/PageHeader';
import BillingOverview from '../../components/billing/BillingOverview';
import { useAuth } from '../../hooks/useAuth';

// Constants for grid spacing and container width
const GRID_SPACING = 3;
const CONTAINER_MAX_WIDTH = 'xl';
const ERROR_RETRY_COUNT = 3;
const ERROR_RETRY_DELAY = 5000;

/**
 * Props interface for Dashboard component
 */
interface DashboardProps {
  className?: string;
}

/**
 * Admin Dashboard component that displays comprehensive billing metrics and real-time updates
 * Implements the dashboard layout specified in the technical requirements
 * 
 * @component
 */
const Dashboard: React.FC<DashboardProps> = React.memo(({ className }) => {
  const location = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();

  // Redirect to login if not authenticated
  if (!isAuthenticated && !isLoading) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Memoized breadcrumb configuration
  const breadcrumbs = useMemo(() => [
    { label: 'Home', href: '/' },
    { label: 'Dashboard' }
  ], []);

  // Memoized action buttons
  const actions = useMemo(() => [
    <Box key="actions" sx={{ display: 'flex', gap: 1 }}>
      {/* Action buttons can be added here based on user permissions */}
    </Box>
  ], []);

  // Handle error retry logic
  const handleRetry = useCallback(async (error: Error) => {
    console.error('Dashboard error:', error);
    let retryCount = 0;
    
    while (retryCount < ERROR_RETRY_COUNT) {
      try {
        // Retry loading dashboard data
        await new Promise(resolve => setTimeout(resolve, ERROR_RETRY_DELAY));
        break;
      } catch (retryError) {
        retryCount++;
        if (retryCount === ERROR_RETRY_COUNT) {
          throw new Error('Failed to load dashboard after multiple attempts');
        }
      }
    }
  }, []);

  // Effect for real-time updates and data polling
  useEffect(() => {
    if (!isAuthenticated) return;

    // Set up real-time event listeners
    const handleRealtimeUpdate = (event: CustomEvent) => {
      // Handle real-time metric updates
      console.log('Realtime update received:', event.detail);
    };

    window.addEventListener('billingUpdate', handleRealtimeUpdate as EventListener);

    return () => {
      window.removeEventListener('billingUpdate', handleRealtimeUpdate as EventListener);
    };
  }, [isAuthenticated]);

  // Loading state
  if (isLoading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  // Error boundary fallback
  if (!user) {
    return (
      <Container maxWidth={CONTAINER_MAX_WIDTH}>
        <Alert 
          severity="error" 
          sx={{ mt: 2 }}
        >
          Error loading dashboard. Please try again later.
        </Alert>
      </Container>
    );
  }

  return (
    <Box 
      component="main" 
      className={className}
      sx={{
        flexGrow: 1,
        py: 3,
        overflow: 'auto'
      }}
    >
      <Container maxWidth={CONTAINER_MAX_WIDTH}>
        {/* Page Header */}
        <PageHeader
          title="Dashboard"
          subtitle={`Welcome back, ${user.email}`}
          breadcrumbs={breadcrumbs}
          actions={actions}
        />

        {/* Main Content Grid */}
        <Grid 
          container 
          spacing={GRID_SPACING}
          sx={{ mt: 2 }}
        >
          {/* Billing Overview Section */}
          <Grid item xs={12}>
            <BillingOverview 
              refreshInterval={300000} // 5 minutes
              timeRange="month"
              currency={user.currency}
            />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
});

// Display name for debugging
Dashboard.displayName = 'Dashboard';

export default Dashboard;