import React from 'react';
import { Button as MuiButton } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import type { ButtonProps } from '@mui/material';
import Loader from './Loader';

/**
 * Extended interface for button props with additional features
 * @extends ButtonProps from @mui/material
 */
export interface CustomButtonProps extends ButtonProps {
  /** Button variant following Material Design 3.0 */
  variant?: 'text' | 'contained' | 'outlined';
  /** Semantic color options */
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'success';
  /** Size following 8px grid system */
  size?: 'small' | 'medium' | 'large';
  /** Loading state indicator */
  loading?: boolean;
  /** Icon element to display before button text */
  startIcon?: React.ReactNode;
  /** Icon element to display after button text */
  endIcon?: React.ReactNode;
  /** Button content */
  children: React.ReactNode;
  /** Click handler function */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Full width option */
  fullWidth?: boolean;
}

/**
 * Styled button component following Material Design 3.0 principles
 */
const StyledButton = styled(MuiButton)(({ theme }) => ({
  // Base styles following 8px grid system
  padding: theme.spacing(1, 2),
  borderRadius: theme.shape.borderRadius,
  fontFamily: 'var(--font-family-primary)',
  fontWeight: 500,
  letterSpacing: 'var(--letter-spacing-normal)',
  textTransform: 'none',
  minWidth: theme.spacing(10),

  // Size variants
  '&.MuiButton-sizeLarge': {
    padding: theme.spacing(2, 3),
    fontSize: 'var(--font-size-lg)',
  },
  '&.MuiButton-sizeSmall': {
    padding: theme.spacing(0.5, 1.5),
    fontSize: 'var(--font-size-sm)',
  },

  // Elevation and hover effects
  '&.MuiButton-contained': {
    boxShadow: 'var(--elevation-1)',
    '&:hover': {
      boxShadow: 'var(--elevation-2)',
    },
  },

  // Transition effects
  transition: `all var(--transition-duration-normal) var(--transition-timing)`,

  // Focus visible styles for accessibility
  '&.Mui-focusVisible': {
    outline: '2px solid var(--color-primary)',
    outlineOffset: '2px',
  },

  // Disabled state
  '&.Mui-disabled': {
    backgroundColor: theme.palette.action.disabledBackground,
    color: theme.palette.action.disabled,
    cursor: 'not-allowed',
  },

  // Loading state styles
  '&.loading': {
    pointerEvents: 'none',
    position: 'relative',
    '& .MuiButton-startIcon, & .MuiButton-endIcon': {
      visibility: 'hidden',
    },
  },
}));

/**
 * Button component with accessibility and loading state support
 * 
 * @component
 * @example
 * // Basic usage
 * <Button onClick={handleClick}>Click Me</Button>
 * 
 * // With loading state
 * <Button loading color="primary" variant="contained">
 *   Submit
 * </Button>
 */
const Button = React.memo<CustomButtonProps>(({
  variant = 'contained',
  color = 'primary',
  size = 'medium',
  loading = false,
  startIcon,
  endIcon,
  children,
  onClick,
  disabled = false,
  fullWidth = false,
  ...props
}) => {
  const theme = useTheme();

  // Handle click with loading state check
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!loading && onClick) {
      onClick(event);
    }
  };

  // Loader size mapping
  const loaderSize = size === 'small' ? 'small' : size === 'large' ? 'large' : 'medium';

  return (
    <StyledButton
      variant={variant}
      color={color}
      size={size}
      onClick={handleClick}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      className={loading ? 'loading' : ''}
      // Accessibility attributes
      role="button"
      aria-busy={loading}
      aria-disabled={disabled || loading}
      {...props}
    >
      {startIcon && <span className="MuiButton-startIcon">{startIcon}</span>}
      
      {/* Content wrapper for loading state */}
      <span style={{ visibility: loading ? 'hidden' : 'visible' }}>
        {children}
      </span>

      {endIcon && <span className="MuiButton-endIcon">{endIcon}</span>}

      {/* Loading indicator */}
      {loading && (
        <span
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          <Loader
            size={loaderSize}
            color={theme.palette[color].main}
            ariaLabel="Loading"
          />
        </span>
      )}
    </StyledButton>
  );
});

// Display name for debugging
Button.displayName = 'Button';

export default Button;