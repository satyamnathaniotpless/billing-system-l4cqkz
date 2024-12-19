// @version: react@18.0.0
// @version: @mui/material@5.0.0
// @version: react-router-dom@6.0.0
// @version: @fingerprintjs/fingerprintjs-pro@3.0.0

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Stack, 
  Typography, 
  TextField, 
  Button, 
  Alert, 
  CircularProgress,
  Link,
  Paper,
  Box,
  InputAdornment,
  IconButton
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import FingerprintJS from '@fingerprintjs/fingerprintjs-pro';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { validateEmail } from '../../utils/validation';

// Interface definitions
interface LoginFormData {
  email: string;
  password: string;
}

interface SecurityContext {
  deviceFingerprint: string;
  mfaRequired: boolean;
  mfaCode: string;
}

// Constants
const INITIAL_FORM_DATA: LoginFormData = {
  email: '',
  password: ''
};

const INITIAL_SECURITY_CONTEXT: SecurityContext = {
  deviceFingerprint: '',
  mfaRequired: false,
  mfaCode: ''
};

/**
 * Enhanced Login component with security features and accessibility
 */
const Login: React.FC = () => {
  // State management
  const [formData, setFormData] = useState<LoginFormData>(INITIAL_FORM_DATA);
  const [securityContext, setSecurityContext] = useState<SecurityContext>(INITIAL_SECURITY_CONTEXT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hooks
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  // Initialize device fingerprinting
  useEffect(() => {
    const initializeFingerprint = async () => {
      try {
        const fp = await FingerprintJS.load({
          apiKey: process.env.REACT_APP_FP_API_KEY || ''
        });
        const result = await fp.get();
        setSecurityContext(prev => ({
          ...prev,
          deviceFingerprint: result.visitorId
        }));
      } catch (error) {
        console.error('Fingerprint initialization error:', error);
        setErrors(prev => ({
          ...prev,
          security: 'Device verification failed. Please try again.'
        }));
      }
    };

    initializeFingerprint();
  }, []);

  /**
   * Handle form field changes with validation
   */
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear field-specific error
    setErrors(prev => ({ ...prev, [name]: '' }));
  }, []);

  /**
   * Toggle password visibility
   */
  const handleTogglePassword = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  /**
   * Handle MFA code verification
   */
  const handleMfaSubmit = useCallback(async () => {
    if (!securityContext.mfaCode) {
      setErrors(prev => ({ ...prev, mfa: 'MFA code is required' }));
      return;
    }

    setIsSubmitting(true);
    try {
      await login(
        formData.email,
        formData.password,
        securityContext.deviceFingerprint,
        securityContext.mfaCode
      );
      navigate('/dashboard');
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        mfa: 'Invalid MFA code. Please try again.'
      }));
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, securityContext, login, navigate]);

  /**
   * Handle form submission with enhanced security
   */
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Reset errors
    setErrors({});

    // Validate email
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      setErrors(prev => ({
        ...prev,
        email: emailValidation.errors[0]
      }));
      return;
    }

    // Validate password
    if (!formData.password) {
      setErrors(prev => ({
        ...prev,
        password: 'Password is required'
      }));
      return;
    }

    // Validate device fingerprint
    if (!securityContext.deviceFingerprint) {
      setErrors(prev => ({
        ...prev,
        security: 'Device verification required'
      }));
      return;
    }

    setIsSubmitting(true);
    try {
      await login(
        formData.email,
        formData.password,
        securityContext.deviceFingerprint
      );
      navigate('/dashboard');
    } catch (error: any) {
      if (error.code === 'MFA_REQUIRED') {
        setSecurityContext(prev => ({
          ...prev,
          mfaRequired: true
        }));
      } else {
        setErrors(prev => ({
          ...prev,
          submit: error.message || 'Login failed. Please try again.'
        }));
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, securityContext, login, navigate]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 400,
          width: '100%'
        }}
      >
        <Stack spacing={3}>
          {/* Header */}
          <Typography variant="h4" component="h1" align="center" gutterBottom>
            Sign In
          </Typography>

          {/* Error Alert */}
          {errors.submit && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.submit}
            </Alert>
          )}

          {/* Security Alert */}
          {errors.security && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {errors.security}
            </Alert>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate>
            <Stack spacing={3}>
              {/* Email Field */}
              <TextField
                fullWidth
                type="email"
                name="email"
                label="Email Address"
                value={formData.email}
                onChange={handleChange}
                error={!!errors.email}
                helperText={errors.email}
                disabled={isLoading || isSubmitting}
                required
                inputProps={{
                  'aria-label': 'Email Address',
                  autoComplete: 'email'
                }}
              />

              {/* Password Field */}
              <TextField
                fullWidth
                type={showPassword ? 'text' : 'password'}
                name="password"
                label="Password"
                value={formData.password}
                onChange={handleChange}
                error={!!errors.password}
                helperText={errors.password}
                disabled={isLoading || isSubmitting}
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleTogglePassword}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                inputProps={{
                  'aria-label': 'Password',
                  autoComplete: 'current-password'
                }}
              />

              {/* MFA Field */}
              {securityContext.mfaRequired && (
                <TextField
                  fullWidth
                  type="text"
                  name="mfaCode"
                  label="MFA Code"
                  value={securityContext.mfaCode}
                  onChange={(e) => setSecurityContext(prev => ({
                    ...prev,
                    mfaCode: e.target.value
                  }))}
                  error={!!errors.mfa}
                  helperText={errors.mfa}
                  disabled={isLoading || isSubmitting}
                  required
                  inputProps={{
                    'aria-label': 'MFA Code',
                    autoComplete: 'one-time-code',
                    maxLength: 6
                  }}
                />
              )}

              {/* Submit Button */}
              <Button
                fullWidth
                type="submit"
                variant="contained"
                color="primary"
                disabled={isLoading || isSubmitting}
                sx={{ mt: 2 }}
              >
                {isLoading || isSubmitting ? (
                  <CircularProgress size={24} color="inherit" />
                ) : securityContext.mfaRequired ? (
                  'Verify MFA'
                ) : (
                  'Sign In'
                )}
              </Button>
            </Stack>
          </form>

          {/* Footer Links */}
          <Stack direction="row" spacing={2} justifyContent="center">
            <Link
              href="/forgot-password"
              variant="body2"
              underline="hover"
              sx={{ cursor: 'pointer' }}
            >
              Forgot Password?
            </Link>
            <Link
              href="/support"
              variant="body2"
              underline="hover"
              sx={{ cursor: 'pointer' }}
            >
              Need Help?
            </Link>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default Login;