import React, { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  Alert
} from '@mui/material';
import {
  DashboardOutlined as DashboardIcon,
  AccountBalanceWalletOutlined as WalletIcon,
  ReceiptOutlined as InvoiceIcon,
  BarChartOutlined as UsageIcon,
  AccountCircleOutlined as ProfileIcon,
  SecurityOutlined as SecurityIcon
} from '@mui/icons-material';

import Header from './Header';
import Footer from './Footer';
import { useAuth } from '../../hooks/useAuth';

// Version comments for external dependencies
// @mui/material: ^5.0.0
// @mui/icons-material: ^5.0.0
// react: ^18.0.0
// react-router-dom: ^6.0.0

/**
 * Props interface for CustomerLayout component
 */
interface CustomerLayoutProps {
  children: React.ReactNode;
}

/**
 * Interface for navigation menu items
 */
interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: React.ElementType;
  requiredAuth: boolean;
}

/**
 * Enhanced CustomerLayout component with security features and responsive design
 */
const CustomerLayout: React.FC<CustomerLayoutProps> = React.memo(({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  const location = useLocation();
  const navigate = useNavigate();

  // Auth hooks for security features
  const { 
    isAuthenticated, 
    user, 
    logout, 
    mfaStatus, 
    deviceInfo,
    sessionValidity,
    lastActivity 
  } = useAuth();

  // Navigation items with security requirements
  const navigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/dashboard',
      icon: DashboardIcon,
      requiredAuth: true
    },
    {
      id: 'wallet',
      label: 'Wallet',
      path: '/wallet',
      icon: WalletIcon,
      requiredAuth: true
    },
    {
      id: 'invoices',
      label: 'Invoices',
      path: '/invoices',
      icon: InvoiceIcon,
      requiredAuth: true
    },
    {
      id: 'usage',
      label: 'Usage Analytics',
      path: '/usage',
      icon: UsageIcon,
      requiredAuth: true
    },
    {
      id: 'profile',
      label: 'Profile',
      path: '/profile',
      icon: ProfileIcon,
      requiredAuth: true
    },
    {
      id: 'security',
      label: 'Security Settings',
      path: '/security',
      icon: SecurityIcon,
      requiredAuth: true
    }
  ];

  // Handle drawer toggle for mobile view
  const handleDrawerToggle = useCallback(() => {
    setDrawerOpen(prev => !prev);
  }, []);

  // Handle navigation with auth check
  const handleNavigation = useCallback((path: string, requiresAuth: boolean) => {
    if (requiresAuth && !isAuthenticated) {
      navigate('/login');
      return;
    }
    navigate(path);
  }, [isAuthenticated, navigate]);

  // Handle session timeout
  const handleSessionTimeout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  // Monitor session status
  useEffect(() => {
    if (!sessionValidity.isValid && isAuthenticated) {
      handleSessionTimeout();
    }
  }, [sessionValidity.isValid, isAuthenticated, handleSessionTimeout]);

  // Close drawer on mobile after navigation
  useEffect(() => {
    if (isMobile) {
      setDrawerOpen(false);
    }
  }, [location.pathname, isMobile]);

  // Security alerts based on system status
  const securityAlerts = [
    !mfaStatus.verified && {
      severity: 'warning',
      message: 'Please enable two-factor authentication for enhanced security.'
    },
    !deviceInfo?.verified && {
      severity: 'warning',
      message: 'Unrecognized device detected. Please verify your device.'
    },
    sessionValidity.warningThreshold && {
      severity: 'info',
      message: 'Your session will expire soon. Please save your work.'
    }
  ].filter(Boolean);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'var(--color-background)',
        transition: 'background-color var(--transition-duration-normal) var(--transition-timing)'
      }}
    >
      {/* Enhanced Header with security status */}
      <Header 
        onDrawerToggle={handleDrawerToggle}
        onThemeToggle={() => {}} // Implement theme toggle
        onLanguageChange={() => {}} // Implement language change
      />

      {/* Security Alerts */}
      {securityAlerts.map((alert, index) => (
        <Alert
          key={index}
          severity={alert.severity as 'warning' | 'info'}
          sx={{ 
            borderRadius: 0,
            marginTop: index > 0 ? 0 : '64px' // Account for header height
          }}
        >
          {alert.message}
        </Alert>
      ))}

      {/* Navigation Drawer */}
      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        open={drawerOpen}
        onClose={handleDrawerToggle}
        sx={{
          width: 240,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 240,
            boxSizing: 'border-box',
            marginTop: '64px', // Account for header height
            height: 'calc(100% - 64px)',
            backgroundColor: 'var(--color-surface)',
            borderRight: '1px solid var(--color-border)',
            transition: 'background-color var(--transition-duration-normal) var(--transition-timing)'
          }
        }}
      >
        <List>
          {navigationItems.map((item) => (
            <ListItem
              button
              key={item.id}
              onClick={() => handleNavigation(item.path, item.requiredAuth)}
              selected={location.pathname === item.path}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'var(--color-primary-light)',
                  '&:hover': {
                    backgroundColor: 'var(--color-primary-light)'
                  }
                }
              }}
            >
              <ListItemIcon>
                <item.icon 
                  sx={{ 
                    color: location.pathname === item.path ? 
                      'var(--color-primary)' : 
                      'var(--color-text-secondary)' 
                  }} 
                />
              </ListItemIcon>
              <ListItemText 
                primary={item.label}
                sx={{
                  '& .MuiTypography-root': {
                    color: location.pathname === item.path ?
                      'var(--color-primary)' :
                      'var(--color-text-primary)'
                  }
                }}
              />
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* Main Content */}
      <Container
        component="main"
        maxWidth="lg"
        sx={{
          flexGrow: 1,
          padding: theme.spacing(3),
          marginLeft: !isMobile && drawerOpen ? '240px' : 0,
          marginTop: '64px', // Account for header height
          transition: 'margin var(--transition-duration-normal) var(--transition-timing)'
        }}
      >
        {children}
      </Container>

      {/* Footer */}
      <Footer />
    </Box>
  );
});

// Display name for debugging
CustomerLayout.displayName = 'CustomerLayout';

export default CustomerLayout;