import React from 'react';
import { CircularProgress } from '@mui/material';
import '../../assets/styles/global.css';
import '../../assets/styles/theme.css';

/**
 * Props interface for the Loader component
 * @interface LoaderProps
 */
interface LoaderProps {
  /** Size variant of the loader following 8px grid system */
  size?: 'small' | 'medium' | 'large';
  /** Theme-aware color using CSS variables */
  color?: string;
  /** Additional CSS classes for custom styling */
  className?: string;
  /** Accessibility label for screen readers */
  ariaLabel?: string;
}

/**
 * Size mapping following Material Design 3.0 8px grid system
 */
const SIZE_MAP = {
  small: 24, // 3 * 8px
  medium: 40, // 5 * 8px
  large: 56, // 7 * 8px
};

/**
 * Loader component that provides visual feedback during async operations
 * 
 * @component
 * @example
 * // Basic usage
 * <Loader />
 * 
 * // Custom size and color
 * <Loader size="large" color="var(--color-primary)" />
 * 
 * // With custom accessibility label
 * <Loader ariaLabel="Processing payment..." />
 */
const Loader: React.FC<LoaderProps> = React.memo(({
  size = 'medium',
  color = 'var(--color-primary)',
  className = '',
  ariaLabel = 'Loading...'
}) => {
  // Validate size prop
  if (size && !SIZE_MAP[size as keyof typeof SIZE_MAP]) {
    console.warn(`Invalid size prop: ${size}. Using default 'medium' size.`);
    size = 'medium';
  }

  // Compute size in pixels based on 8px grid
  const sizeInPixels = SIZE_MAP[size as keyof typeof SIZE_MAP];

  // Combine classes for theme transitions
  const combinedClassName = `theme-transition-colors ${className}`.trim();

  return (
    <div
      className={combinedClassName}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <CircularProgress
        size={sizeInPixels}
        style={{
          color: color,
          transition: 'color var(--transition-duration-normal) var(--transition-timing)'
        }}
        role="progressbar"
        aria-label={ariaLabel}
        // Additional ARIA attributes for better screen reader support
        aria-busy="true"
        aria-live="polite"
      />
      {/* Visually hidden text for screen readers */}
      <span className="visually-hidden">
        {ariaLabel}
      </span>
    </div>
  );
});

// Display name for debugging
Loader.displayName = 'Loader';

// Default props type checking
Loader.defaultProps = {
  size: 'medium',
  color: 'var(--color-primary)',
  ariaLabel: 'Loading...'
};

export default Loader;

// Named exports for specific use cases
export type { LoaderProps };