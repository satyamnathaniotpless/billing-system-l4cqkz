// @version: react@18.0.0
// @version: @mui/material@5.0.0
// @version: react-router-dom@6.0.0

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Grid,
  Typography,
  Divider,
  Button,
  Chip,
  Skeleton,
  Alert,
  Box,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  AccountCircle as AccountIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Warning as WarningIcon,
  Edit as EditIcon
} from '@mui/icons-material';

import Card from '../common/Card';
import { useCustomer } from '../../hooks/useCustomer';
import { CustomerStatus, CustomerType } from '../../types/customer';

// Interface definitions
interface CustomerDetailsProps {
  customerId?: string;
  onError?: (error: Error) => void;
  className?: string;
}

/**
 * CustomerDetails component displays detailed customer information with real-time updates
 * and optimistic UI changes.
 */
const CustomerDetails: React.FC<CustomerDetailsProps> = React.memo(({
  customerId: propCustomerId,
  onError,
  className
}) => {
  // Hooks
  const theme = useTheme();
  const navigate = useNavigate();
  const { id: urlCustomerId } = useParams<{ id: string }>();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Get the customer ID from props or URL
  const customerId = propCustomerId || urlCustomerId;

  // Customer management hook with real-time updates
  const {
    selectedCustomer,
    customerAccount,
    loading,
    error,
    fetchCustomerById,
    updateCustomer,
    fetchCustomerAccount
  } = useCustomer();

  // Local state for optimistic updates
  const [localStatus, setLocalStatus] = useState<CustomerStatus | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Fetch customer data on mount or ID change
  useEffect(() => {
    if (customerId) {
      fetchCustomerById(customerId).catch(error => {
        onError?.(error);
        setUpdateError('Failed to fetch customer details');
      });
      fetchCustomerAccount(customerId).catch(error => {
        console.error('Failed to fetch account details:', error);
      });
    }
  }, [customerId, fetchCustomerById, fetchCustomerAccount, onError]);

  // Status color mapping
  const statusColors = useMemo(() => ({
    [CustomerStatus.ACTIVE]: 'success',
    [CustomerStatus.INACTIVE]: 'warning',
    [CustomerStatus.SUSPENDED]: 'error'
  }), []);

  // Handle status update with optimistic UI
  const handleStatusUpdate = useCallback(async (newStatus: CustomerStatus) => {
    if (!customerId || !selectedCustomer) return;

    setLocalStatus(newStatus);
    setUpdateError(null);

    try {
      await updateCustomer(customerId, { status: newStatus });
    } catch (error) {
      setLocalStatus(selectedCustomer.status);
      setUpdateError('Failed to update customer status');
      onError?.(error as Error);
    }
  }, [customerId, selectedCustomer, updateCustomer, onError]);

  // Loading skeleton
  if (loading.customers && !selectedCustomer) {
    return (
      <Box className={className} role="alert" aria-busy="true">
        <Card>
          <Grid container spacing={3}>
            {[1, 2, 3].map((item) => (
              <Grid item xs={12} key={item}>
                <Skeleton variant="rectangular" height={60} />
              </Grid>
            ))}
          </Grid>
        </Card>
      </Box>
    );
  }

  // Error state
  if (error.customers || !selectedCustomer) {
    return (
      <Alert 
        severity="error"
        action={
          <Button color="inherit" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        }
      >
        {error.customers || 'Customer not found'}
      </Alert>
    );
  }

  const displayStatus = localStatus || selectedCustomer.status;

  return (
    <Box className={className}>
      {updateError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {updateError}
        </Alert>
      )}

      {/* Customer Profile Section */}
      <Card elevation={2}>
        <Grid container spacing={3}>
          <Grid item xs={12} display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h5" component="h1">
              Customer Details
            </Typography>
            <Chip
              label={displayStatus}
              color={statusColors[displayStatus] as any}
              sx={{ fontWeight: 'medium' }}
            />
          </Grid>

          <Grid item xs={12}>
            <Divider />
          </Grid>

          {/* Basic Information */}
          <Grid item xs={12} md={6}>
            <Grid container spacing={2}>
              <Grid item xs={12} display="flex" alignItems="center" gap={1}>
                <AccountIcon color="primary" />
                <Typography variant="body1">
                  <strong>Name:</strong> {selectedCustomer.name}
                </Typography>
              </Grid>

              <Grid item xs={12} display="flex" alignItems="center" gap={1}>
                <EmailIcon color="primary" />
                <Typography variant="body1">
                  <strong>Email:</strong> {selectedCustomer.email}
                </Typography>
              </Grid>

              <Grid item xs={12} display="flex" alignItems="center" gap={1}>
                <PhoneIcon color="primary" />
                <Typography variant="body1">
                  <strong>Phone:</strong> {selectedCustomer.phone}
                </Typography>
              </Grid>

              <Grid item xs={12} display="flex" alignItems="center" gap={1}>
                <BusinessIcon color="primary" />
                <Typography variant="body1">
                  <strong>Type:</strong> {selectedCustomer.type}
                </Typography>
              </Grid>
            </Grid>
          </Grid>

          {/* Account Information */}
          <Grid item xs={12} md={6}>
            <Grid container spacing={2}>
              {customerAccount && (
                <>
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" color="primary">
                      Wallet Balance
                    </Typography>
                    <Typography variant="h6">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: customerAccount.currency
                      }).format(customerAccount.walletBalance)}
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle1" color="primary">
                      Price Plan
                    </Typography>
                    <Typography variant="body1">
                      {customerAccount.pricePlanId}
                    </Typography>
                  </Grid>
                </>
              )}
            </Grid>
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2} justifyContent="flex-end">
              <Grid item>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => navigate(`/customers/${customerId}/edit`)}
                >
                  Edit Details
                </Button>
              </Grid>
              <Grid item>
                <Button
                  variant="contained"
                  color={displayStatus === CustomerStatus.ACTIVE ? 'warning' : 'success'}
                  onClick={() => handleStatusUpdate(
                    displayStatus === CustomerStatus.ACTIVE 
                      ? CustomerStatus.INACTIVE 
                      : CustomerStatus.ACTIVE
                  )}
                  disabled={loading.customers}
                >
                  {displayStatus === CustomerStatus.ACTIVE ? 'Deactivate' : 'Activate'}
                </Button>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Card>
    </Box>
  );
});

CustomerDetails.displayName = 'CustomerDetails';

export default CustomerDetails;