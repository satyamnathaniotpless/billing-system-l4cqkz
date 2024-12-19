import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Grid, Box, Typography, Alert, Card, CardContent, List, ListItem, ListItemIcon, ListItemText, Divider, Skeleton } from '@mui/material';
import { NotificationsOutlined as NotificationsIcon, PaymentOutlined as PaymentIcon, ErrorOutline as ErrorOutlineIcon, InfoOutlined as InfoIcon } from '@mui/icons-material';
import { debounce } from 'lodash';

// Internal imports
import CustomerLayout from '../../components/layout/CustomerLayout';
import WalletBalance from '../../components/wallet/WalletBalance';
import UsageChart from '../../components/billing/UsageChart';
import { useAuth } from '../../hooks/useAuth';

// Interface for dashboard notifications
interface DashboardNotification {
  id: string;
  type: 'alert' | 'info' | 'payment' | 'warning';
  message: string;
  timestamp: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * CustomerDashboard component with real-time updates and accessibility features
 */
const CustomerDashboard: React.FC = React.memo(() => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate date range for usage chart
  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    return { start, end };
  }, []);

  // Get notification icon based on type and priority
  const getNotificationIcon = useCallback((type: 'alert' | 'info' | 'payment' | 'warning', priority: 'high' | 'medium' | 'low') => {
    const color = priority === 'high' ? 'error' : priority === 'medium' ? 'warning' : 'info';
    switch (type) {
      case 'alert':
        return <ErrorOutlineIcon color={color} />;
      case 'payment':
        return <PaymentIcon color={color} />;
      case 'warning':
        return <ErrorOutlineIcon color={color} />;
      default:
        return <InfoIcon color={color} />;
    }
  }, []);

  // Handle real-time notification updates
  useEffect(() => {
    if (!user?.id) return;

    const handleNotification = debounce((event: CustomEvent) => {
      const newNotification = event.detail as DashboardNotification;
      setNotifications(prev => [newNotification, ...prev].slice(0, 5));
    }, 300);

    window.addEventListener('walletNotification', handleNotification as EventListener);
    window.addEventListener('usageAlert', handleNotification as EventListener);

    // Simulate loading state
    const timer = setTimeout(() => setIsLoading(false), 1000);

    return () => {
      window.removeEventListener('walletNotification', handleNotification as EventListener);
      window.removeEventListener('usageAlert', handleNotification as EventListener);
      clearTimeout(timer);
    };
  }, [user?.id]);

  return (
    <CustomerLayout>
      <Box
        component="main"
        role="main"
        aria-label="Customer Dashboard"
        sx={{ p: { xs: 2, sm: 3 } }}
      >
        <Grid container spacing={3}>
          {/* Wallet Balance Section */}
          <Grid item xs={12} md={6}>
            {isLoading ? (
              <Skeleton variant="rectangular" height={200} />
            ) : (
              <WalletBalance
                customerId={user?.id || ''}
                showAlert
                refreshInterval={30000}
                alertThreshold={1000}
              />
            )}
          </Grid>

          {/* Quick Actions Section */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Quick Actions
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => {/* Handle top up */}}
                    >
                      Top Up
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<ReceiptIcon />}
                      onClick={() => {/* Handle pay invoice */}}
                    >
                      Pay Invoice
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Usage Overview Section */}
          <Grid item xs={12}>
            {isLoading ? (
              <Skeleton variant="rectangular" height={400} />
            ) : (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Usage Overview
                  </Typography>
                  <UsageChart
                    customerId={user?.id || ''}
                    period="daily"
                    startDate={dateRange.start.toISOString()}
                    endDate={dateRange.end.toISOString()}
                  />
                </CardContent>
              </Card>
            )}
          </Grid>

          {/* Notifications Section */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Alerts & Notifications
                </Typography>
                {isLoading ? (
                  <Skeleton variant="rectangular" height={200} />
                ) : notifications.length > 0 ? (
                  <List>
                    {notifications.map((notification, index) => (
                      <React.Fragment key={notification.id}>
                        <ListItem alignItems="flex-start">
                          <ListItemIcon>
                            {getNotificationIcon(notification.type, notification.priority)}
                          </ListItemIcon>
                          <ListItemText
                            primary={notification.message}
                            secondary={new Date(notification.timestamp).toLocaleString()}
                          />
                        </ListItem>
                        {index < notifications.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                ) : (
                  <Alert severity="info">No new notifications</Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </CustomerLayout>
  );
});

// Display name for debugging
CustomerDashboard.displayName = 'CustomerDashboard';

export default CustomerDashboard;