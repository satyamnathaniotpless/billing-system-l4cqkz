// @version: react@18.0.0
// @version: @auth0/auth0-react@2.0.0
// @version: react-router-dom@6.0.0
// @version: @mui/material@5.0.0

import React, { useState, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Link,
  InputAdornment,
  IconButton,
  Paper
} from '@mui/material';
import { Visibility, VisibilityOff, Info } from '@mui/icons-material';
import { AuthService } from '../../services/auth';
import { ValidationUtils } from '../../utils/validation';

// Interface for form data with strict validation rules
interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  companyName: string;
}

// Enhanced security configuration
const SECURITY_CONFIG = {
  minPasswordLength: 12,
  maxAttempts: 5,
  lockoutDuration: 900000, // 15 minutes
  csrfTokenName: 'otpless_csrf_token'
};

/**
 * Secure Registration Component with WCAG 2.1 Level AA compliance
 */
const Register: React.FC = () => {
  // State management with strict typing
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    companyName: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof RegisterFormData, string>>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const [lastAttemptTime, setLastAttemptTime] = useState<number>(0);

  // Hooks
  const { loginWithRedirect } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize CSRF token and validate session
  useEffect(() => {
    const initializeSecurity = async () => {
      try {
        // Validate existing session
        const hasValidSession = await AuthService.validateSession();
        if (hasValidSession) {
          navigate('/dashboard');
          return;
        }

        // Generate CSRF token
        const token = await generateCSRFToken();
        setCsrfToken(token);
      } catch (error) {
        console.error('Security initialization error:', error);
        setErrors({ email: 'Security initialization failed. Please try again.' });
      }
    };

    initializeSecurity();
  }, [navigate]);

  /**
   * Generate secure CSRF token
   */
  const generateCSRFToken = async (): Promise<string> => {
    const buffer = new Uint8Array(32);
    window.crypto.getRandomValues(buffer);
    return Array.from(buffer)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  };

  /**
   * Enhanced input change handler with validation
   */
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    
    // Sanitize input
    const sanitizedValue = value.trim();

    // Update form data
    setFormData(prev => ({
      ...prev,
      [name]: sanitizedValue
    }));

    // Clear previous error
    setErrors(prev => ({
      ...prev,
      [name]: ''
    }));

    // Validate field
    let error = '';
    switch (name) {
      case 'email':
        const emailValidation = ValidationUtils.validateEmail(sanitizedValue);
        if (!emailValidation.isValid) {
          error = emailValidation.errors[0];
        }
        break;

      case 'password':
        if (sanitizedValue.length < SECURITY_CONFIG.minPasswordLength) {
          error = `Password must be at least ${SECURITY_CONFIG.minPasswordLength} characters`;
        } else if (!/[A-Z]/.test(sanitizedValue)) {
          error = 'Password must contain at least one uppercase letter';
        } else if (!/[a-z]/.test(sanitizedValue)) {
          error = 'Password must contain at least one lowercase letter';
        } else if (!/[0-9]/.test(sanitizedValue)) {
          error = 'Password must contain at least one number';
        } else if (!/[^A-Za-z0-9]/.test(sanitizedValue)) {
          error = 'Password must contain at least one special character';
        }
        break;

      case 'confirmPassword':
        if (sanitizedValue !== formData.password) {
          error = 'Passwords do not match';
        }
        break;

      case 'companyName':
        if (sanitizedValue.length < 2) {
          error = 'Company name must be at least 2 characters';
        } else if (sanitizedValue.length > 100) {
          error = 'Company name must not exceed 100 characters';
        } else if (!/^[a-zA-Z0-9\s\-&.]+$/.test(sanitizedValue)) {
          error = 'Company name contains invalid characters';
        }
        break;
    }

    if (error) {
      setErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }
  }, [formData.password]);

  /**
   * Enhanced form submission handler with security measures
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Check rate limiting
    const now = Date.now();
    if (attemptCount >= SECURITY_CONFIG.maxAttempts && 
        now - lastAttemptTime < SECURITY_CONFIG.lockoutDuration) {
      setErrors({
        email: `Too many attempts. Please try again in ${
          Math.ceil((SECURITY_CONFIG.lockoutDuration - (now - lastAttemptTime)) / 60000)
        } minutes`
      });
      return;
    }

    // Validate all fields
    const newErrors: Partial<Record<keyof RegisterFormData, string>> = {};
    let hasErrors = false;

    Object.entries(formData).forEach(([key, value]) => {
      if (!value) {
        newErrors[key as keyof RegisterFormData] = 'This field is required';
        hasErrors = true;
      }
    });

    if (hasErrors || Object.keys(errors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      // Register with Auth0
      await loginWithRedirect({
        screen_hint: 'signup',
        initialScreen: 'signUp',
        registration_hint: formData.email,
        company_name: formData.companyName
      });

      // Reset attempt counter on success
      setAttemptCount(0);
      setLastAttemptTime(0);
    } catch (error) {
      console.error('Registration error:', error);
      
      // Increment attempt counter
      setAttemptCount(prev => prev + 1);
      setLastAttemptTime(now);
      
      setErrors({
        email: 'Registration failed. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Paper 
        elevation={3}
        sx={{ 
          mt: 8, 
          p: 4,
          borderRadius: 2
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <Typography
            component="h1"
            variant="h4"
            gutterBottom
            sx={{ mb: 4 }}
            aria-label="Register for OTPless Billing"
          >
            Create Account
          </Typography>

          <form onSubmit={handleSubmit} noValidate aria-label="Registration form">
            <Stack spacing={3} sx={{ width: '100%' }}>
              <TextField
                required
                fullWidth
                id="email"
                name="email"
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                error={!!errors.email}
                helperText={errors.email}
                autoComplete="email"
                aria-describedby="email-error"
                InputProps={{
                  'aria-label': 'Email address',
                  'aria-invalid': !!errors.email
                }}
              />

              <TextField
                required
                fullWidth
                id="password"
                name="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleInputChange}
                error={!!errors.password}
                helperText={errors.password}
                autoComplete="new-password"
                aria-describedby="password-error"
                InputProps={{
                  'aria-label': 'Password',
                  'aria-invalid': !!errors.password,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              <TextField
                required
                fullWidth
                id="confirmPassword"
                name="confirmPassword"
                label="Confirm Password"
                type={showPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleInputChange}
                error={!!errors.confirmPassword}
                helperText={errors.confirmPassword}
                autoComplete="new-password"
                aria-describedby="confirm-password-error"
                InputProps={{
                  'aria-label': 'Confirm password',
                  'aria-invalid': !!errors.confirmPassword
                }}
              />

              <TextField
                required
                fullWidth
                id="companyName"
                name="companyName"
                label="Company Name"
                value={formData.companyName}
                onChange={handleInputChange}
                error={!!errors.companyName}
                helperText={errors.companyName}
                autoComplete="organization"
                aria-describedby="company-name-error"
                InputProps={{
                  'aria-label': 'Company name',
                  'aria-invalid': !!errors.companyName
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading || Object.keys(errors).length > 0}
                aria-label="Create account"
                sx={{ mt: 2 }}
              >
                {isLoading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Create Account'
                )}
              </Button>

              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Already have an account?{' '}
                  <Link
                    href="/login"
                    variant="body2"
                    underline="hover"
                    aria-label="Sign in to existing account"
                  >
                    Sign in
                  </Link>
                </Typography>
              </Box>
            </Stack>
          </form>
        </Box>
      </Paper>
    </Container>
  );
};

export default Register;