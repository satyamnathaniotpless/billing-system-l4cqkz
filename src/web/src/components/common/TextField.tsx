// @version: react@18.x
// @version: @mui/material@5.x
// @version: react-i18next@12.x

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { TextField as MuiTextField } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { 
  validateEmail, 
  validatePhone, 
  validateCurrency, 
  validateDate,
  type ValidationResult 
} from '../../utils/validation';

// Enhanced styled TextField with focus state improvements for accessibility
const StyledTextField = styled(MuiTextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.primary.main,
      borderWidth: 2,
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.mode === 'light' 
        ? theme.palette.primary.light 
        : theme.palette.primary.dark,
    }
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: theme.palette.primary.main,
  },
  // Enhanced focus visible state for keyboard navigation
  '& .MuiOutlinedInput-root.Mui-focusVisible': {
    outline: `3px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  }
}));

// Interface for component props extending MUI TextField props
export interface TextFieldProps extends React.ComponentProps<typeof MuiTextField> {
  inputType?: 'email' | 'phone' | 'currency' | 'date' | 'text';
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  onValidationChange?: (isValid: boolean, value: string) => void;
  countryCode?: string;
  maxLength?: number;
}

export const CustomTextField: React.FC<TextFieldProps> = ({
  inputType = 'text',
  validateOnChange = true,
  validateOnBlur = true,
  onValidationChange,
  countryCode = 'IN',
  maxLength,
  value = '',
  onChange,
  onBlur,
  error: errorProp,
  helperText: helperTextProp,
  required = false,
  disabled = false,
  fullWidth = true,
  ...props
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  
  // State for internal validation
  const [internalError, setInternalError] = useState<boolean>(false);
  const [helperText, setHelperText] = useState<string>('');
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Debounce timer for validation
  const [validationTimer, setValidationTimer] = useState<NodeJS.Timeout | null>(null);

  // Memoized validation function based on input type
  const validateInput = useCallback((inputValue: string): ValidationResult => {
    if (!inputValue && !required) {
      return { isValid: true, value: inputValue, errors: [] };
    }

    switch (inputType) {
      case 'email':
        return validateEmail(inputValue, { required, maxLength });
      case 'phone':
        return validatePhone(inputValue, countryCode, { required });
      case 'currency':
        return validateCurrency(Number(inputValue), 'INR', { required });
      case 'date':
        return validateDate(inputValue, { required });
      default:
        return {
          isValid: true,
          value: inputValue,
          errors: []
        };
    }
  }, [inputType, required, maxLength, countryCode]);

  // Handle input change with validation
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;

    // Clear previous validation timer
    if (validationTimer) {
      clearTimeout(validationTimer);
    }

    // Set dirty state on first change
    if (!isDirty) {
      setIsDirty(true);
    }

    // Call parent onChange handler
    if (onChange) {
      onChange(event);
    }

    // Debounced validation
    if (validateOnChange) {
      const timer = setTimeout(() => {
        const validationResult = validateInput(newValue);
        setInternalError(!validationResult.isValid);
        setHelperText(validationResult.errors[0] || '');
        
        if (onValidationChange) {
          onValidationChange(validationResult.isValid, validationResult.sanitizedValue || newValue);
        }
      }, 300);

      setValidationTimer(timer);
    }
  }, [onChange, validateOnChange, validateInput, onValidationChange, isDirty, validationTimer]);

  // Handle blur event with validation
  const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    if (validateOnBlur) {
      const validationResult = validateInput(event.target.value);
      setInternalError(!validationResult.isValid);
      setHelperText(validationResult.errors[0] || '');

      if (onValidationChange) {
        onValidationChange(validationResult.isValid, validationResult.sanitizedValue || event.target.value);
      }
    }

    if (onBlur) {
      onBlur(event);
    }
  }, [validateOnBlur, validateInput, onValidationChange, onBlur]);

  // Input type specific props
  const inputProps = useMemo(() => {
    const baseProps = {
      maxLength,
      'aria-required': required,
      'aria-invalid': internalError || errorProp,
    };

    switch (inputType) {
      case 'email':
        return {
          ...baseProps,
          type: 'email',
          autoComplete: 'email',
          inputMode: 'email' as const,
        };
      case 'phone':
        return {
          ...baseProps,
          type: 'tel',
          autoComplete: 'tel',
          inputMode: 'tel' as const,
        };
      case 'currency':
        return {
          ...baseProps,
          type: 'number',
          inputMode: 'decimal' as const,
          step: '0.01',
        };
      case 'date':
        return {
          ...baseProps,
          type: 'date',
          inputMode: 'numeric' as const,
        };
      default:
        return baseProps;
    }
  }, [inputType, maxLength, required, internalError, errorProp]);

  // Cleanup validation timer on unmount
  useEffect(() => {
    return () => {
      if (validationTimer) {
        clearTimeout(validationTimer);
      }
    };
  }, [validationTimer]);

  return (
    <StyledTextField
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      error={internalError || errorProp}
      helperText={helperText || helperTextProp}
      required={required}
      disabled={disabled}
      fullWidth={fullWidth}
      inputProps={inputProps}
      FormHelperTextProps={{
        'aria-live': 'polite',
      }}
      {...props}
    />
  );
};

export default CustomTextField;