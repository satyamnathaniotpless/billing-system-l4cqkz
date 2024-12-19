import React, { useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  useTheme,
  useMediaQuery,
  Skeleton,
  CircularProgress
} from '@mui/material';
import {
  DashboardOutlined as DashboardIcon,
  PeopleOutlined as PeopleIcon,
  ReceiptOutlined as ReceiptIcon,
  BarChartOutlined as BarChartIcon,
  AccountBalanceWalletOutlined as WalletIcon,
  SettingsOutlined as SettingsIcon
} from '@mui/icons-material';

import { useAuth } from '../../hooks/useAuth';
import { ADMIN_ROUTES, CUSTOMER_ROUTES } from '../../config/routes';

// Interface for navigation items with security roles
interface NavigationItem {
  id: string;
  title: string;
  path: string;
  icon: React.ElementType;
  roles: string[];
  ariaLabel: string;
  testId: string;
}

// Props interface for Sidebar component
interface SidebarProps {
  open: boolean;
  onClose: () => void;
  variant: 'temporary' | 'permanent';
  ariaLabel?: string;
}

// Admin navigation items with role-based access
const adminNavItems: NavigationItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    path: ADMIN_ROUTES.DASHBOARD,
    icon: DashboardIcon,
    roles: ['admin', 'super_admin'],
    ariaLabel: 'Navigate to admin dashboard',
    testId: 'nav-admin-dashboard'
  },
  {
    id: 'customers',
    title: 'Customers',
    path: ADMIN_ROUTES.CUSTOMERS,
    icon: PeopleIcon,
    roles: ['admin', 'super_admin'],
    ariaLabel: 'Manage customers',
    testId: 'nav-admin-customers'
  },
  {
    id: 'billing',
    title: 'Billing',
    path: ADMIN_ROUTES.BILLING,
    icon: ReceiptIcon,
    roles: ['admin', 'super_admin'],
    ariaLabel: 'Manage billing',
    testId: 'nav-admin-billing'
  },
  {
    id: 'reports',
    title: 'Reports',
    path: ADMIN_ROUTES.REPORTS,
    icon: BarChartIcon,
    roles: ['admin', 'super_admin'],
    ariaLabel: 'View reports',
    testId: 'nav-admin-reports'
  }
];

// Customer navigation items with role-based access
const customerNavItems: NavigationItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    path: CUSTOMER_ROUTES.DASHBOARD,
    icon: DashboardIcon,
    roles: ['customer'],
    ariaLabel: 'Navigate to customer dashboard',
    testId: 'nav-customer-dashboard'
  },
  {
    id: 'wallet',
    title: 'Wallet',
    path: CUSTOMER_ROUTES.WALLET,
    icon: WalletIcon,
    roles: ['customer'],
    ariaLabel: 'Manage wallet',
    testId: 'nav-customer-wallet'
  },
  {
    id: 'settings',
    title: 'Settings',
    path: CUSTOMER_ROUTES.PROFILE,
    icon: SettingsIcon,
    roles: ['customer'],
    ariaLabel: 'Manage settings',
    testId: 'nav-customer-settings'
  }
];

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <Box p={2} role="alert">
    <h6>Navigation Error</h6>
    <pre>{error.message}</pre>
  </Box>
);

const Sidebar: React.FC<SidebarProps> = React.memo(({
  open,
  onClose,
  variant,
  ariaLabel = 'Main navigation'
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();

  // Filter navigation items based on user role
  const navigationItems = useMemo(() => {
    if (!user?.role) return [];
    return user.role.includes('admin') ? adminNavItems : customerNavItems;
  }, [user?.role]);

  // Secure navigation handler with role verification
  const handleNavigation = useCallback((path: string, requiredRoles: string[]) => {
    if (!user || !requiredRoles.includes(user.role)) {
      console.warn('Unauthorized navigation attempt');
      return;
    }

    navigate(path);
    if (isMobile) {
      onClose();
    }
  }, [user, navigate, isMobile, onClose]);

  // Render loading skeleton
  if (isLoading) {
    return (
      <Drawer
        variant={variant}
        open={open}
        onClose={onClose}
        sx={{
          width: 240,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 240,
            boxSizing: 'border-box',
            backgroundColor: 'var(--color-surface)',
            borderRight: '1px solid var(--color-border)'
          }
        }}
      >
        <Box p={2}>
          {[1, 2, 3, 4].map((item) => (
            <Skeleton
              key={item}
              height={48}
              sx={{ my: 1 }}
              animation="wave"
            />
          ))}
        </Box>
      </Drawer>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Drawer
        variant={variant}
        open={open}
        onClose={onClose}
        sx={{
          width: 240,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 240,
            boxSizing: 'border-box',
            backgroundColor: 'var(--color-surface)',
            borderRight: '1px solid var(--color-border)',
            transition: theme.transitions.create(['background-color', 'border-color'], {
              duration: theme.transitions.duration.standard
            })
          }
        }}
      >
        <nav aria-label={ariaLabel}>
          <List>
            {navigationItems.map((item) => (
              <ListItem
                button
                key={item.id}
                onClick={() => handleNavigation(item.path, item.roles)}
                selected={location.pathname === item.path}
                aria-label={item.ariaLabel}
                data-testid={item.testId}
                sx={{
                  my: 0.5,
                  px: 2,
                  '&.Mui-selected': {
                    backgroundColor: 'var(--color-primary-light)',
                    '&:hover': {
                      backgroundColor: 'var(--color-primary-light)'
                    }
                  },
                  '&:hover': {
                    backgroundColor: 'var(--color-surface-variant)'
                  }
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: location.pathname === item.path ?
                      'var(--color-primary)' :
                      'var(--color-text-secondary)'
                  }}
                >
                  <item.icon />
                </ListItemIcon>
                <ListItemText
                  primary={item.title}
                  sx={{
                    '& .MuiTypography-root': {
                      fontWeight: location.pathname === item.path ? 500 : 400,
                      color: location.pathname === item.path ?
                        'var(--color-primary)' :
                        'var(--color-text-primary)'
                    }
                  }}
                />
              </ListItem>
            ))}
          </List>
        </nav>
      </Drawer>
    </ErrorBoundary>
  );
});

// Display name for debugging
Sidebar.displayName = 'Sidebar';

export default Sidebar;