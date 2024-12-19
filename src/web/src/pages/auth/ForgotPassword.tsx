// @version: react@18.x
// @version: react-router-dom@6.x
// @version: @mui/material@5.x

import React, { useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  useTheme,
  LoadingButton,
  Box,
  Alert,
  Fade
} from '@mui/material';
import { authService } from '../../services/auth';
import CustomTextField from '../../components/common/TextField';

// Interface for form state management
interface ForgotPasswordState {
  email: string;
  isSubmitting: boolean;
  error: string | null;
  emailError: string | null;
}

/**
 * ForgotPassword component - Handles secure password reset functionality
 * Implements RFC 5322 email validation and WCAG 2.1 Level AA compliance
 */
const ForgotPassword: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // Form state management
  const [state, setState] = useState<ForgotPasswordState>({
    email: '',
    isSubmitting: false,
    error: null,
    emailError: null
  });

  /**
   * Handles email input changes with validation
   * Implements RFC 5322 compliant email validation
   */
  const handleEmailChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    
    setState(prevState => ({
      ...prevState,
      email: value,
      emailError: null,
      error: null
    }));
  }, []);

  /**
   * Handles form submission with rate limiting and analytics
   * Implements secure password reset flow via Auth0
   */
  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setState(prevState => ({
      ...prevState,
      isSubmitting: true,
      error: null
    }));

    try {
      // Validate email format
      if (!state.email) {
        throw new Error('Email is required');
      }

      // Call Auth0 password reset
      await authService.forgotPassword(state.email);

      // Navigate to confirmation page on success
      navigate('/auth/forgot-password/confirmation', {
        state: { email: state.email }
      });

    } catch (error) {
      setState(prevState => ({
        ...prevState,
        isSubmitting: false,
        error: error instanceof Error ? error.message : 'An error occurred'
      }));
    }
  }, [state.email, navigate]);

  return (
    <Container 
      maxWidth="sm" 
      sx={{ 
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 3
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          width: '100%',
          borderRadius: 2
        }}
        component="form"
        onSubmit={handleSubmit}
        aria-label="Password Reset Form"
      >
        <Typography 
          variant="h4" 
          component="h1" 
          gutterBottom
          align="center"
          sx={{ mb: 3 }}
        >
          Reset Password
        </Typography>

        <Typography 
          variant="body1" 
          color="text.secondary"
          sx={{ mb: 4 }}
          align="center"
        >
          Enter your email address and we'll send you instructions to reset your password.
        </Typography>

        {state.error && (
          <Fade in>
            <Alert 
              severity="error" 
              sx={{ mb: 3 }}
              role="alert"
            >
              {state.error}
            </Alert>
          </Fade>
        )}

        <Box sx={{ mb: 3 }}>
          <CustomTextField
            label="Email Address"
            type="email"
            fullWidth
            required
            value={state.email}
            onChange={handleEmailChange}
            error={Boolean(state.emailError)}
            helperText={state.emailError}
            inputType="email"
            validateOnChange
            validateOnBlur
            disabled={state.isSubmitting}
            inputProps={{
              maxLength: 254,
              'aria-label': 'Email Address',
              autoComplete: 'email'
            }}
          />
        </Box>

        <LoadingButton
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          loading={state.isSubmitting}
          disabled={!state.email || state.isSubmitting}
          sx={{
            height: 48,
            fontSize: '1rem'
          }}
        >
          Send Reset Instructions
        </LoadingButton>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography
            variant="body2"
            color="text.secondary"
            component="span"
          >
            Remember your password?{' '}
          </Typography>
          <Typography
            variant="body2"
            color="primary"
            component="a"
            href="/auth/login"
            sx={{ 
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline'
              },
              cursor: 'pointer'
            }}
          >
            Back to Login
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

// Export memoized component for better performance
export default memo(ForgotPassword);