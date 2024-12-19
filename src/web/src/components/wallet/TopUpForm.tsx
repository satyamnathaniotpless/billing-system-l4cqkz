// @version: react@18.0.0
// @version: @mui/material@5.0.0
// @version: react-i18next@12.0.0

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  CircularProgress,
  Alert,
  FormHelperText,
  Box,
  InputAdornment,
  Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import { TopUpRequest, WalletResponse, ApiError } from '../../types/wallet';
import { walletService } from '../../services/wallet';
import { validateCurrency, validateAmount } from '../../utils/validation';

/**
 * Props for the TopUpForm component
 */
interface TopUpFormProps {
  walletId: string;
  onSuccess: (response: WalletResponse) => void;
  onError: (error: ApiError) => void;
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Internal form state interface
 */
interface FormState {
  amount: number;
  currency: string;
  errors: Record<string, string>;
  isSubmitting: boolean;
}

/**
 * TopUpForm Component - Handles wallet top-up operations with validation and accessibility
 */
const TopUpForm: React.FC<TopUpFormProps> = ({
  walletId,
  onSuccess,
  onError,
  minAmount = 1,
  maxAmount = 1000000
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const formRef = useRef<HTMLFormElement>(null);

  // Form state initialization
  const [formState, setFormState] = useState<FormState>({
    amount: 0,
    currency: 'USD',
    errors: {},
    isSubmitting: false
  });

  // Supported currencies based on geographic coverage
  const SUPPORTED_CURRENCIES = ['USD', 'INR', 'IDR'];

  /**
   * Validates the entire form and returns validation errors
   */
  const validateForm = useCallback((currentState: FormState): Record<string, string> => {
    const errors: Record<string, string> = {};

    // Validate amount
    const amountValidation = validateAmount(currentState.amount, {
      min: minAmount,
      max: maxAmount,
      currency: currentState.currency
    });

    if (!amountValidation.isValid) {
      errors.amount = amountValidation.errors[0];
    }

    // Validate currency
    const currencyValidation = validateCurrency(currentState.currency);
    if (!currencyValidation.isValid) {
      errors.currency = currencyValidation.errors[0];
    }

    return errors;
  }, [minAmount, maxAmount]);

  /**
   * Handles form field changes with validation
   */
  const handleFieldChange = useCallback((
    field: keyof Pick<FormState, 'amount' | 'currency'>,
    value: string | number
  ) => {
    setFormState(prevState => {
      const newState = {
        ...prevState,
        [field]: value
      };
      
      const errors = validateForm(newState);
      
      return {
        ...newState,
        errors
      };
    });
  }, [validateForm]);

  /**
   * Handles form submission with comprehensive error handling
   */
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    setFormState(prev => ({ ...prev, isSubmitting: true }));

    try {
      // Final validation before submission
      const errors = validateForm(formState);
      if (Object.keys(errors).length > 0) {
        setFormState(prev => ({ ...prev, errors, isSubmitting: false }));
        return;
      }

      // Prepare request payload
      const topUpRequest: TopUpRequest = {
        walletId,
        amount: formState.amount,
        currency: formState.currency,
        metadata: {
          source: 'web_portal',
          timestamp: new Date().toISOString()
        }
      };

      // Submit top-up request
      const response = await walletService.topUpWallet(topUpRequest);

      // Reset form on success
      setFormState({
        amount: 0,
        currency: 'USD',
        errors: {},
        isSubmitting: false
      });

      onSuccess(response);
    } catch (error) {
      setFormState(prev => ({ ...prev, isSubmitting: false }));
      onError(error as ApiError);
    }
  }, [formState, walletId, onSuccess, onError, validateForm]);

  // Reset form when walletId changes
  useEffect(() => {
    setFormState({
      amount: 0,
      currency: 'USD',
      errors: {},
      isSubmitting: false
    });
  }, [walletId]);

  return (
    <Box
      component="form"
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      aria-label={t('wallet.topup.form.label')}
    >
      <Grid container spacing={3}>
        {/* Amount Input */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            required
            id="amount"
            name="amount"
            label={t('wallet.topup.amount.label')}
            type="number"
            value={formState.amount || ''}
            onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value))}
            error={!!formState.errors.amount}
            helperText={formState.errors.amount}
            disabled={formState.isSubmitting}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {formState.currency}
                </InputAdornment>
              ),
              inputProps: {
                min: minAmount,
                max: maxAmount,
                step: 0.01,
                'aria-label': t('wallet.topup.amount.aria'),
              }
            }}
          />
        </Grid>

        {/* Currency Selection */}
        <Grid item xs={12} md={6}>
          <FormControl
            fullWidth
            error={!!formState.errors.currency}
            disabled={formState.isSubmitting}
          >
            <InputLabel id="currency-select-label">
              {t('wallet.topup.currency.label')}
            </InputLabel>
            <Select
              labelId="currency-select-label"
              id="currency"
              value={formState.currency}
              onChange={(e) => handleFieldChange('currency', e.target.value)}
              aria-label={t('wallet.topup.currency.aria')}
            >
              {SUPPORTED_CURRENCIES.map((currency) => (
                <MenuItem key={currency} value={currency}>
                  {currency}
                </MenuItem>
              ))}
            </Select>
            {formState.errors.currency && (
              <FormHelperText>{formState.errors.currency}</FormHelperText>
            )}
          </FormControl>
        </Grid>

        {/* Submit Button */}
        <Grid item xs={12}>
          <Button
            fullWidth
            type="submit"
            variant="contained"
            color="primary"
            disabled={formState.isSubmitting || Object.keys(formState.errors).length > 0}
            aria-label={t('wallet.topup.submit.aria')}
          >
            {formState.isSubmitting ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              t('wallet.topup.submit.label')
            )}
          </Button>
        </Grid>

        {/* Amount Range Information */}
        <Grid item xs={12}>
          <Typography
            variant="caption"
            color="textSecondary"
            align="center"
            component="div"
          >
            {t('wallet.topup.range.info', {
              min: minAmount,
              max: maxAmount,
              currency: formState.currency
            })}
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TopUpForm;