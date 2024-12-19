import React, { useCallback, useMemo } from 'react';
import { 
  Select as MuiSelect,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  useTheme,
  FormHelperText,
  CircularProgress
} from '@mui/material';
import styles from './Select.module.css';

// Interface for individual select options
export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

// Props interface for the Select component
export interface SelectProps {
  name: string;
  label: string;
  value: string | number;
  options: SelectOption[];
  onChange: (event: SelectChangeEvent<string | number>) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
}

const Select: React.FC<SelectProps> = React.memo(({
  name,
  label,
  value,
  options,
  onChange,
  error,
  required = false,
  disabled = false,
  fullWidth = true,
  size = 'medium',
  loading = false
}) => {
  const theme = useTheme();

  // Memoize the select ID for consistent ARIA labeling
  const selectId = useMemo(() => `select-${name}`, [name]);

  // Memoize helper text ID for ARIA description
  const helperTextId = useMemo(() => `${selectId}-helper-text`, [selectId]);

  // Handle change events with proper typing
  const handleChange = useCallback((event: SelectChangeEvent<string | number>) => {
    if (!disabled && !loading) {
      onChange(event);
    }
  }, [disabled, loading, onChange]);

  return (
    <FormControl
      className={`${styles.select} ${fullWidth ? styles.fullWidth : ''} ${
        disabled ? styles.disabled : ''
      }`}
      error={!!error}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      size={size}
    >
      <InputLabel
        id={`${selectId}-label`}
        required={required}
        className={styles.label}
      >
        {label}
      </InputLabel>

      <MuiSelect
        id={selectId}
        labelId={`${selectId}-label`}
        value={value}
        onChange={handleChange}
        label={label}
        name={name}
        aria-describedby={error ? helperTextId : undefined}
        className={`${error ? styles.error : ''} ${loading ? styles.loading : ''}`}
        // Enhanced keyboard navigation
        MenuProps={{
          anchorOrigin: {
            vertical: 'bottom',
            horizontal: 'left',
          },
          transformOrigin: {
            vertical: 'top',
            horizontal: 'left',
          },
          // Improved transition using theme variables
          transitionDuration: parseInt(getComputedStyle(document.documentElement)
            .getPropertyValue('--transition-duration-normal')),
          // ARIA enhancements
          MenuListProps: {
            'aria-label': `${label} options`,
            role: 'listbox',
          }
        }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={styles.menuItem}
          >
            {option.icon && (
              <span className={styles.icon} aria-hidden="true">
                {option.icon}
              </span>
            )}
            {option.label}
          </MenuItem>
        ))}
      </MuiSelect>

      {/* Error message with screen reader support */}
      {error && (
        <FormHelperText
          id={helperTextId}
          className={styles.errorText}
          role="alert"
        >
          {error}
        </FormHelperText>
      )}

      {/* Loading indicator */}
      {loading && (
        <CircularProgress
          size={24}
          className={styles.loadingIndicator}
          aria-label="Loading options"
        />
      )}
    </FormControl>
  );
});

// Display name for debugging
Select.displayName = 'Select';

export default Select;

// CSS Module styles
const styles = {
  select: `
    margin: var(--spacing-md) 0;
    transition: all var(--transition-duration-normal) var(--transition-timing);
  `,
  fullWidth: `
    width: 100%;
  `,
  disabled: `
    opacity: 0.7;
    cursor: not-allowed;
  `,
  error: `
    & .MuiOutlinedInput-notchedOutline {
      border-color: var(--color-error);
    }
    &:hover .MuiOutlinedInput-notchedOutline {
      border-color: var(--color-error-light);
    }
  `,
  label: `
    &.MuiInputLabel-root {
      font-family: var(--font-family-primary);
    }
  `,
  menuItem: `
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    min-height: 48px;
    padding: var(--spacing-sm) var(--spacing-md);
  `,
  icon: `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
  `,
  errorText: `
    color: var(--color-error);
    margin-top: var(--spacing-xs);
    font-size: var(--font-size-sm);
  `,
  loading: `
    pointer-events: none;
    opacity: 0.7;
  `,
  loadingIndicator: `
    position: absolute;
    right: var(--spacing-md);
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-primary);
  `
} as const;