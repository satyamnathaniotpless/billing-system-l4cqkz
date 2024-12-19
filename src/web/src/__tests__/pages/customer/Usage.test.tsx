import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { Provider } from 'react-redux';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subDays } from 'date-fns';

import Usage from '../../../pages/customer/Usage';
import { useCustomer } from '../../../hooks/useCustomer';
import { useBilling } from '../../../hooks/useBilling';
import { createTheme } from '../../../theme';
import { configureStore } from '@reduxjs/toolkit';
import { BREAKPOINTS } from '../../../config/constants';

// Mock the hooks
vi.mock('../../../hooks/useCustomer');
vi.mock('../../../hooks/useBilling');

// Extend expect for accessibility testing
expect.extend(toHaveNoViolations);

// Test data
const mockCustomer = {
  id: 'test-customer-id',
  name: 'Test Customer',
  email: 'test@example.com'
};

const mockUsageData = {
  daily: {
    '2023-11-01': {
      SMS: 1000,
      WhatsApp: 500,
      Email: 250,
      total: 1750
    },
    '2023-11-02': {
      SMS: 1200,
      WhatsApp: 600,
      Email: 300,
      total: 2100
    }
  },
  trends: {
    usage: 3850,
    change: 20,
    trend: 'up'
  }
};

// Helper function to setup the component with providers
const renderWithProviders = (ui: React.ReactNode) => {
  const theme = createTheme('light');
  const store = configureStore({
    reducer: {
      customer: () => ({ selectedCustomer: mockCustomer }),
      billing: () => ({ usageData: mockUsageData })
    }
  });

  return render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          {ui}
        </LocalizationProvider>
      </ThemeProvider>
    </Provider>
  );
};

describe('Usage Analytics Page', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock hook implementations
    (useCustomer as jest.Mock).mockReturnValue({
      selectedCustomer: mockCustomer,
      loading: false,
      error: null
    });

    (useBilling as jest.Mock).mockReturnValue({
      usageData: mockUsageData,
      loading: false,
      error: null
    });

    // Mock window resize
    window.resizeTo = vi.fn();
  });

  it('renders loading state correctly', () => {
    (useBilling as jest.Mock).mockReturnValue({
      loading: true,
      error: null
    });

    renderWithProviders(<Usage />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    const errorMessage = 'Failed to load usage data';
    (useBilling as jest.Mock).mockReturnValue({
      loading: false,
      error: new Error(errorMessage)
    });

    renderWithProviders(<Usage />);
    
    expect(screen.getByText(new RegExp(errorMessage, 'i'))).toBeInTheDocument();
  });

  it('renders usage chart with correct data', async () => {
    renderWithProviders(<Usage />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /area chart visualization/i })).toBeInTheDocument();
    });

    // Verify chart elements
    const chart = screen.getByRole('img', { name: /area chart visualization/i });
    expect(chart).toBeInTheDocument();
    
    // Verify legend items
    expect(screen.getByText('SMS Authentication')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp Authentication')).toBeInTheDocument();
    expect(screen.getByText('Email Authentication')).toBeInTheDocument();
  });

  it('handles period selection correctly', async () => {
    renderWithProviders(<Usage />);
    const user = userEvent.setup();

    // Open period select
    const periodSelect = screen.getByLabelText(/Time Period/i);
    await user.click(periodSelect);

    // Select weekly period
    const weeklyOption = screen.getByRole('option', { name: /Weekly/i });
    await user.click(weeklyOption);

    // Verify period change
    expect(periodSelect).toHaveValue('weekly');
  });

  it('validates date range selection', async () => {
    renderWithProviders(<Usage />);
    const user = userEvent.setup();

    // Try to set end date before start date
    const startDatePicker = screen.getByLabelText(/Start Date/i);
    const endDatePicker = screen.getByLabelText(/End Date/i);

    await user.click(startDatePicker);
    await user.type(startDatePicker, format(new Date(), 'MM/dd/yyyy'));
    
    await user.click(endDatePicker);
    await user.type(endDatePicker, format(subDays(new Date(), 5), 'MM/dd/yyyy'));

    // Verify validation message
    expect(screen.getByText(/Start date must be before end date/i)).toBeInTheDocument();
  });

  describe('Responsive Design', () => {
    it('adapts layout for mobile viewport', async () => {
      window.resizeTo(BREAKPOINTS.MOBILE - 1, 800);
      renderWithProviders(<Usage />);

      await waitFor(() => {
        const chart = screen.getByRole('img', { name: /area chart visualization/i });
        expect(chart).toHaveStyle({ height: '300px' });
      });

      // Verify stacked layout
      const controls = screen.getByRole('group', { name: /chart controls/i });
      expect(controls).toHaveStyle({ flexDirection: 'column' });
    });

    it('adapts layout for desktop viewport', async () => {
      window.resizeTo(BREAKPOINTS.DESKTOP, 800);
      renderWithProviders(<Usage />);

      await waitFor(() => {
        const chart = screen.getByRole('img', { name: /area chart visualization/i });
        expect(chart).toHaveStyle({ height: '400px' });
      });

      // Verify horizontal layout
      const controls = screen.getByRole('group', { name: /chart controls/i });
      expect(controls).toHaveStyle({ flexDirection: 'row' });
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderWithProviders(<Usage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      renderWithProviders(<Usage />);
      const user = userEvent.setup();

      // Tab through interactive elements
      await user.tab();
      expect(screen.getByLabelText(/Time Period/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/Start Date/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/End Date/i)).toHaveFocus();
    });

    it('provides proper ARIA labels', () => {
      renderWithProviders(<Usage />);

      expect(screen.getByRole('banner')).toHaveAccessibleName(/Usage Analytics/i);
      expect(screen.getByRole('img', { name: /area chart visualization/i })).toHaveAccessibleName();
      expect(screen.getByRole('group', { name: /chart controls/i })).toHaveAccessibleName();
    });
  });
});