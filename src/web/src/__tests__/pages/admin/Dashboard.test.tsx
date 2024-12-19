import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from '@mui/material/styles';

import Dashboard from '../../../pages/admin/Dashboard';
import { theme } from '../../../theme';
import { authReducer } from '../../../store/slices/authSlice';
import { billingReducer } from '../../../store/slices/billingSlice';

// Mock hooks
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: {
      email: 'admin@otpless.com',
      role: 'admin',
      currency: 'USD'
    },
    isAuthenticated: true,
    isLoading: false,
    error: null
  }))
}));

vi.mock('../../../hooks/useBilling', () => ({
  useBilling: vi.fn(() => ({
    bills: [
      {
        id: '1',
        totalAmount: 125000,
        status: 'PAID',
        billingPeriodEnd: '2023-12-01'
      },
      {
        id: '2',
        totalAmount: 45000,
        status: 'PENDING',
        billingPeriodEnd: '2023-12-15'
      }
    ],
    loading: false,
    error: null,
    fetchBills: vi.fn(),
    refresh: vi.fn()
  }))
}));

// Helper function to render with providers
const renderWithProviders = (
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = configureStore({
      reducer: {
        auth: authReducer,
        billing: billingReducer
      },
      preloadedState
    }),
    ...renderOptions
  } = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return (
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <MemoryRouter>
            {children}
          </MemoryRouter>
        </ThemeProvider>
      </Provider>
    );
  };
  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

describe('Dashboard Component', () => {
  describe('Authentication and Access Control', () => {
    it('should redirect to login when not authenticated', () => {
      vi.mocked(useAuth).mockImplementationOnce(() => ({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      }));

      renderWithProviders(<Dashboard />);
      expect(window.location.pathname).toBe('/login');
    });

    it('should render dashboard when authenticated', () => {
      renderWithProviders(<Dashboard />);
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    });

    it('should handle session expiration', async () => {
      const mockLogout = vi.fn();
      vi.mocked(useAuth).mockImplementationOnce(() => ({
        user: null,
        isAuthenticated: true,
        isLoading: false,
        error: 'Session expired',
        logout: mockLogout
      }));

      renderWithProviders(<Dashboard />);
      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });
  });

  describe('Dashboard Layout and Content', () => {
    beforeEach(() => {
      renderWithProviders(<Dashboard />);
    });

    it('should render all required dashboard sections', () => {
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('Pending Invoices')).toBeInTheDocument();
      expect(screen.getByText(/Recent Activity/i)).toBeInTheDocument();
    });

    it('should display correct revenue metrics', () => {
      expect(screen.getByText('$125,000')).toBeInTheDocument();
      expect(screen.getByText(/15% MTD/)).toBeInTheDocument();
    });

    it('should show pending invoices count', () => {
      const pendingSection = screen.getByText('Pending Invoices').closest('div');
      expect(within(pendingSection!).getByText('$45,000')).toBeInTheDocument();
      expect(within(pendingSection!).getByText('1 invoices pending')).toBeInTheDocument();
    });
  });

  describe('Data Loading and Error States', () => {
    it('should show loading indicators while fetching data', () => {
      vi.mocked(useBilling).mockImplementationOnce(() => ({
        bills: [],
        loading: true,
        error: null,
        fetchBills: vi.fn(),
        refresh: vi.fn()
      }));

      renderWithProviders(<Dashboard />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should handle API errors gracefully', () => {
      vi.mocked(useBilling).mockImplementationOnce(() => ({
        bills: [],
        loading: false,
        error: new Error('Failed to fetch billing data'),
        fetchBills: vi.fn(),
        refresh: vi.fn()
      }));

      renderWithProviders(<Dashboard />);
      expect(screen.getByText(/Failed to fetch billing data/i)).toBeInTheDocument();
    });

    it('should retry failed data fetches', async () => {
      const mockFetchBills = vi.fn();
      vi.mocked(useBilling).mockImplementation(() => ({
        bills: [],
        loading: false,
        error: new Error('Network error'),
        fetchBills: mockFetchBills,
        refresh: vi.fn()
      }));

      renderWithProviders(<Dashboard />);
      await waitFor(() => {
        expect(mockFetchBills).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt layout for mobile viewport', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderWithProviders(<Dashboard />);
      const mainContent = screen.getByRole('main');
      expect(mainContent).toHaveStyle({ padding: '24px 16px' });
    });

    it('should adjust grid for tablet viewport', () => {
      global.innerWidth = 768;
      global.dispatchEvent(new Event('resize'));
      
      renderWithProviders(<Dashboard />);
      const gridContainer = screen.getByRole('main').querySelector('.MuiGrid-container');
      expect(gridContainer).toHaveStyle({ gap: '24px' });
    });
  });

  describe('User Interactions', () => {
    it('should handle refresh data action', async () => {
      const mockRefresh = vi.fn();
      vi.mocked(useBilling).mockImplementation(() => ({
        bills: [],
        loading: false,
        error: null,
        fetchBills: vi.fn(),
        refresh: mockRefresh
      }));

      renderWithProviders(<Dashboard />);
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await userEvent.click(refreshButton);
      expect(mockRefresh).toHaveBeenCalled();
    });

    it('should navigate to detail views', async () => {
      renderWithProviders(<Dashboard />);
      const revenueCard = screen.getByText('Total Revenue').closest('div');
      await userEvent.click(revenueCard!);
      expect(window.location.pathname).toContain('/revenue');
    });

    it('should handle tooltip interactions', async () => {
      renderWithProviders(<Dashboard />);
      const infoIcon = screen.getByTestId('InfoIcon');
      await userEvent.hover(infoIcon);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });
});