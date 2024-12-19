import React, { useEffect, useState, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, CssBaseline, useMediaQuery } from '@mui/material';
import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import { store, useAppSelector } from './store';
import AdminLayout from './components/layout/AdminLayout';
import CustomerLayout from './components/layout/CustomerLayout';
import AuthLayout from './components/layout/AuthLayout';

// Lazy load route components for code splitting
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Login = React.lazy(() => import('./pages/auth/Login'));
const Billing = React.lazy(() => import('./pages/billing/Billing'));
const Invoices = React.lazy(() => import('./pages/billing/Invoices'));
const Wallet = React.lazy(() => import('./pages/wallet/Wallet'));
const Profile = React.lazy(() => import('./pages/profile/Profile'));

/**
 * Theme configuration following Material Design 3.0 principles
 */
const getTheme = (mode: 'light' | 'dark') => responsiveFontSizes(createTheme({
  palette: {
    mode,
    primary: {
      main: mode === 'light' ? '#1976D2' : '#90CAF9',
      light: '#42a5f5',
      dark: '#1565c0'
    },
    secondary: {
      main: '#dc004e',
      light: '#ff4081',
      dark: '#9a0036'
    },
    background: {
      default: mode === 'light' ? '#FFFFFF' : '#121212',
      paper: mode === 'light' ? '#F5F5F5' : '#1E1E1E'
    }
  },
  breakpoints: {
    values: {
      xs: 320,
      sm: 768,
      md: 1024,
      lg: 1440,
      xl: 1920
    }
  },
  typography: {
    fontFamily: 'var(--font-family-primary)',
    fontSize: 14
  }
}));

/**
 * Protected route component with role-based access control
 */
const ProtectedRoute: React.FC<{
  element: React.ReactElement;
  requiredRole?: string;
}> = ({ element, requiredRole }) => {
  const location = useLocation();
  const { isAuthenticated, user } = useAppSelector(state => state.auth);
  const hasRequiredRole = !requiredRole || user?.role === requiredRole;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasRequiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return element;
};

/**
 * Root application component with theme and routing configuration
 */
const App: React.FC = () => {
  // Theme state management
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setMode] = useState<'light' | 'dark'>(
    localStorage.getItem('theme') as 'light' | 'dark' || 
    (prefersDarkMode ? 'dark' : 'light')
  );

  // Update theme based on system preference
  useEffect(() => {
    const handleThemeChange = (e: MediaQueryListEvent) => {
      const newMode = e.matches ? 'dark' : 'light';
      setMode(newMode);
      localStorage.setItem('theme', newMode);
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleThemeChange);

    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, []);

  const theme = React.useMemo(() => getTheme(mode), [mode]);

  const handleThemeToggle = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    localStorage.setItem('theme', newMode);
  };

  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Suspense fallback={<div>Loading...</div>}>
            <Routes>
              {/* Auth routes */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<Login />} />
                <Route path="/reset-password" element={<Login />} />
              </Route>

              {/* Admin routes */}
              <Route element={
                <ProtectedRoute 
                  element={
                    <AdminLayout onThemeToggle={handleThemeToggle} />
                  } 
                  requiredRole="admin" 
                />
              }>
                <Route path="/admin/dashboard" element={<Dashboard />} />
                <Route path="/admin/billing" element={<Billing />} />
                <Route path="/admin/invoices" element={<Invoices />} />
              </Route>

              {/* Customer routes */}
              <Route element={
                <ProtectedRoute 
                  element={
                    <CustomerLayout onThemeToggle={handleThemeToggle} />
                  }
                />
              }>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/profile" element={<Profile />} />
              </Route>

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  );
};

export default App;