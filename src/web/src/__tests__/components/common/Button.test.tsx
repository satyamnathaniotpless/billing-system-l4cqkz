import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, describe, it, beforeEach, jest } from '@jest/globals';
import { ThemeProvider, createTheme } from '@mui/material';
import Button from '../../components/common/Button';

// Version comments for external dependencies
// @testing-library/react ^14.0.0
// @testing-library/user-event ^14.0.0
// @mui/material ^5.0.0
// jest ^29.6.0

/**
 * Helper function to render components with theme provider
 */
const renderWithTheme = (children: React.ReactNode) => {
  const theme = createTheme({
    palette: {
      primary: {
        main: '#1976D2',
      },
      secondary: {
        main: '#90CAF9',
      },
      error: {
        main: '#F44336',
      },
    },
  });

  return render(
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  );
};

describe('Button Component', () => {
  // Common test setup
  const mockOnClick = jest.fn();
  const defaultProps = {
    onClick: mockOnClick,
    children: 'Test Button',
  };

  beforeEach(() => {
    mockOnClick.mockClear();
  });

  describe('Rendering', () => {
    it('renders button with correct content', () => {
      renderWithTheme(<Button {...defaultProps} />);
      expect(screen.getByRole('button', { name: /test button/i })).toBeInTheDocument();
    });

    it('applies correct base styles', () => {
      renderWithTheme(<Button {...defaultProps} />);
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({
        textTransform: 'none',
        fontFamily: 'var(--font-family-primary)',
      });
    });

    it('renders with start icon when provided', () => {
      const startIcon = <span data-testid="start-icon">→</span>;
      renderWithTheme(<Button {...defaultProps} startIcon={startIcon} />);
      expect(screen.getByTestId('start-icon')).toBeInTheDocument();
    });

    it('renders with end icon when provided', () => {
      const endIcon = <span data-testid="end-icon">←</span>;
      renderWithTheme(<Button {...defaultProps} endIcon={endIcon} />);
      expect(screen.getByTestId('end-icon')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('handles click events properly', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Button {...defaultProps} />);
      
      await user.click(screen.getByRole('button'));
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Button {...defaultProps} />);
      
      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();
      
      await user.keyboard('{enter}');
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('prevents interactions when disabled', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Button {...defaultProps} disabled />);
      
      await user.click(screen.getByRole('button'));
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('displays loader component when loading', () => {
      renderWithTheme(<Button {...defaultProps} loading />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('disables button interactions while loading', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Button {...defaultProps} loading />);
      
      await user.click(screen.getByRole('button'));
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('maintains button dimensions during loading state', () => {
      const { rerender } = renderWithTheme(<Button {...defaultProps} />);
      const initialButton = screen.getByRole('button');
      const initialDimensions = {
        width: initialButton.offsetWidth,
        height: initialButton.offsetHeight,
      };

      rerender(<Button {...defaultProps} loading />);
      const loadingButton = screen.getByRole('button');
      
      expect(loadingButton.offsetWidth).toBe(initialDimensions.width);
      expect(loadingButton.offsetHeight).toBe(initialDimensions.height);
    });
  });

  describe('Variants', () => {
    it('applies contained variant styles correctly', () => {
      renderWithTheme(<Button {...defaultProps} variant="contained" />);
      expect(screen.getByRole('button')).toHaveClass('MuiButton-contained');
    });

    it('applies outlined variant styles correctly', () => {
      renderWithTheme(<Button {...defaultProps} variant="outlined" />);
      expect(screen.getByRole('button')).toHaveClass('MuiButton-outlined');
    });

    it('applies text variant styles correctly', () => {
      renderWithTheme(<Button {...defaultProps} variant="text" />);
      expect(screen.getByRole('button')).toHaveClass('MuiButton-text');
    });

    it('applies size variants correctly', () => {
      const { rerender } = renderWithTheme(<Button {...defaultProps} size="small" />);
      expect(screen.getByRole('button')).toHaveClass('MuiButton-sizeSmall');

      rerender(<Button {...defaultProps} size="large" />);
      expect(screen.getByRole('button')).toHaveClass('MuiButton-sizeLarge');
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA attributes', () => {
      renderWithTheme(<Button {...defaultProps} loading />);
      const button = screen.getByRole('button');
      
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('maintains focus visibility', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Button {...defaultProps} />);
      
      const button = screen.getByRole('button');
      await user.tab();
      
      expect(button).toHaveFocus();
      expect(button).toHaveClass('Mui-focusVisible');
    });

    it('announces loading state to screen readers', () => {
      renderWithTheme(<Button {...defaultProps} loading />);
      const loader = screen.getByRole('progressbar');
      
      expect(loader).toHaveAttribute('aria-label', 'Loading');
      expect(loader).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Theme Integration', () => {
    it('applies theme colors correctly', () => {
      renderWithTheme(<Button {...defaultProps} color="primary" />);
      const button = screen.getByRole('button');
      
      expect(button).toHaveClass('MuiButton-containedPrimary');
    });

    it('supports fullWidth prop', () => {
      renderWithTheme(<Button {...defaultProps} fullWidth />);
      expect(screen.getByRole('button')).toHaveClass('MuiButton-fullWidth');
    });

    it('applies custom theme styles', () => {
      const customTheme = createTheme({
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: '8px',
              },
            },
          },
        },
      });

      render(
        <ThemeProvider theme={customTheme}>
          <Button {...defaultProps} />
        </ThemeProvider>
      );

      expect(screen.getByRole('button')).toHaveStyle({
        borderRadius: '8px',
      });
    });
  });
});