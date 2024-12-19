import React, { useCallback, useState, useEffect, useMemo, Suspense } from 'react';
import { Box, Container, useTheme, useMediaQuery, Drawer, AppBar, Toolbar, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import Header from './Header';
import Footer from './Footer';
import { useAuth } from '@/hooks/useAuth';

// Version comments for external dependencies
// @mui/material: ^5.0.0
// react: ^18.0.0

/**
 * Props interface for AdminLayout component
 */
interface AdminLayoutProps {
  children: React.ReactNode;
  navigationItems: NavigationItem[];
  pageTitle: string;
  initialDrawerOpen?: boolean;
}

/**
 * Interface for navigation menu items
 */
interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon?: string;
  requiredPermissions: string[];
}

/**
 * Styled components following Material Design 3.0 principles
 */
const LayoutRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  backgroundColor: 'var(--color-background)',
  transition: 'background-color var(--transition-duration-normal) var(--transition-timing)'
}));

const MainContent = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  paddingTop: theme.spacing(8),
  [theme.breakpoints.up('sm')]: {
    paddingTop: theme.spacing(9)
  }
}));

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: 240,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: 240,
    boxSizing: 'border-box',
    backgroundColor: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
    transition: 'background-color var(--transition-duration-normal) var(--transition-timing)'
  }
}));

/**
 * AdminLayout component with security integration and performance optimizations
 */
const AdminLayout: React.FC<AdminLayoutProps> = React.memo(({
  children,
  navigationItems,
  pageTitle,
  initialDrawerOpen = true
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(initialDrawerOpen && !isMobile);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  // Auth hooks for security
  const { user, isAuthenticated, sessionValidity, logout } = useAuth();

  // Handle drawer toggle
  const handleDrawerToggle = useCallback(() => {
    setDrawerOpen(prev => !prev);
  }, []);

  // Handle theme toggle with system preference detection
  const handleThemeToggle = useCallback(() => {
    setThemeMode(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  // Filter navigation items based on user permissions
  const authorizedNavItems = useMemo(() => {
    if (!user) return [];
    return navigationItems.filter(item =>
      item.requiredPermissions.every(permission =>
        user.permissions?.includes(permission)
      )
    );
  }, [navigationItems, user]);

  // Monitor session status
  useEffect(() => {
    if (!sessionValidity.isValid) {
      logout();
    }
  }, [sessionValidity.isValid, logout]);

  // Update document title
  useEffect(() => {
    document.title = `${pageTitle} | OTPless Billing`;
  }, [pageTitle]);

  // Handle system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setThemeMode(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <LayoutRoot>
      {/* Accessible skip link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Header with security features */}
      <Header
        onThemeToggle={handleThemeToggle}
        onLanguageChange={() => {}} // Language change handler
      />

      {/* Main layout structure */}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          pt: { xs: 7, sm: 8, md: 9 }
        }}
      >
        {/* Navigation drawer with accessibility support */}
        <StyledDrawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={drawerOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          aria-label="Main navigation"
        >
          <Suspense fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          }>
            {/* Navigation content */}
          </Suspense>
        </StyledDrawer>

        {/* Main content area */}
        <MainContent
          id="main-content"
          component="main"
          role="main"
          tabIndex={-1}
        >
          <Container
            maxWidth="lg"
            sx={{
              px: { xs: 2, sm: 3 },
              py: { xs: 2, sm: 3, md: 4 }
            }}
          >
            {children}
          </Container>
        </MainContent>
      </Box>

      {/* Footer */}
      <Footer />
    </LayoutRoot>
  );
});

// Display name for debugging
AdminLayout.displayName = 'AdminLayout';

export default AdminLayout;