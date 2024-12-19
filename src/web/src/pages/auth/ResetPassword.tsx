// @version: react@18.x
// @version: react-router-dom@6.x
// @version: @mui/material@5.x

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Box,
  LinearProgress
} from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import TextField from '../../components/common/TextField';

// Password strength levels
const STRENGTH_LEVELS = ['Very Weak', 'Weak', 'Moderate', 'Strong', 'Very Strong'];
const STRENGTH_COLORS = ['error', 'error', 'warning', 'success', 'success'];

// Rate limiting constants
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 900000; // 15 minutes

interface ResetPasswordFormState {
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  password: string[];
  confirmPassword: string[];
  token: string[];
}

interface PasswordStrength {
  score: number;
  feedback: string[];
}

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetPassword, validateResetToken } = useAuth();

  // Form state
  const [formData, setFormData] = useState<ResetPasswordFormState>({
    password: '',
    confirmPassword: ''
  });

  // UI state
  const [errors, setErrors] = useState<FormErrors>({
    password: [],
    confirmPassword: [],
    token: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    score: 0,
    feedback: []
  });
  const [tokenValid, setTokenValid] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState<number | null>(null);

  // Get token from URL
  const token = searchParams.get('token');

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setErrors(prev => ({
          ...prev,
          token: ['Invalid or missing reset token']
        }));
        return;
      }

      try {
        const isValid = await validateResetToken(token);
        setTokenValid(isValid);
        if (!isValid) {
          setErrors(prev => ({
            ...prev,
            token: ['Reset token is invalid or expired']
          }));
        }
      } catch (error) {
        setErrors(prev => ({
          ...prev,
          token: ['Error validating reset token']
        }));
      }
    };

    validateToken();
  }, [token, validateResetToken]);

  // Password validation
  const validatePassword = useCallback((password: string): PasswordStrength => {
    const errors: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 12) score++;
    else errors.push('Password must be at least 12 characters long');

    // Complexity checks
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    // Common patterns check
    if (/(.)\1{2,}/.test(password)) {
      errors.push('Password contains repeated characters');
      score = Math.max(0, score - 1);
    }

    if (/^(password|admin|user)/i.test(password)) {
      errors.push('Password contains common words');
      score = Math.max(0, score - 1);
    }

    return {
      score: Math.min(score, 4),
      feedback: errors
    };
  }, []);

  // Handle form input changes
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'password') {
      const strength = validatePassword(value);
      setPasswordStrength(strength);
    }

    // Clear related errors
    setErrors(prev => ({ ...prev, [name]: [] }));
  }, [validatePassword]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check rate limiting
    if (lockoutEnd && Date.now() < lockoutEnd) {
      const remainingTime = Math.ceil((lockoutEnd - Date.now()) / 1000 / 60);
      setErrors(prev => ({
        ...prev,
        password: [`Too many attempts. Please try again in ${remainingTime} minutes`]
      }));
      return;
    }

    // Validate inputs
    const newErrors: FormErrors = {
      password: [],
      confirmPassword: [],
      token: []
    };

    if (!tokenValid) {
      newErrors.token.push('Invalid or expired reset token');
    }

    if (passwordStrength.score < 3) {
      newErrors.password.push('Password is not strong enough');
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword.push('Passwords do not match');
    }

    if (Object.values(newErrors).some(errors => errors.length > 0)) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      await resetPassword(token!, formData.password);
      navigate('/login', { 
        state: { message: 'Password reset successful. Please log in with your new password.' }
      });
    } catch (error) {
      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);

      if (newAttemptCount >= MAX_ATTEMPTS) {
        const lockoutEndTime = Date.now() + LOCKOUT_DURATION;
        setLockoutEnd(lockoutEndTime);
        setErrors(prev => ({
          ...prev,
          password: ['Too many failed attempts. Please try again later.']
        }));
      } else {
        setErrors(prev => ({
          ...prev,
          password: ['Failed to reset password. Please try again.']
        }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render password strength indicator
  const renderStrengthIndicator = () => (
    <Box sx={{ mt: 1 }}>
      <LinearProgress
        variant="determinate"
        value={(passwordStrength.score / 4) * 100}
        color={STRENGTH_COLORS[passwordStrength.score] as any}
        sx={{ height: 8, borderRadius: 4 }}
      />
      <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
        Strength: {STRENGTH_LEVELS[passwordStrength.score]}
      </Typography>
    </Box>
  );

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" component="h1" gutterBottom align="center">
          Reset Password
        </Typography>

        {errors.token.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.token[0]}
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <TextField
            label="New Password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password.length > 0}
            helperText={errors.password[0] || passwordStrength.feedback[0]}
            fullWidth
            required
            margin="normal"
            autoComplete="new-password"
            inputProps={{
              'aria-label': 'New password',
              'aria-describedby': 'password-strength'
            }}
          />
          {formData.password && renderStrengthIndicator()}

          <TextField
            label="Confirm Password"
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword.length > 0}
            helperText={errors.confirmPassword[0]}
            fullWidth
            required
            margin="normal"
            autoComplete="new-password"
            inputProps={{
              'aria-label': 'Confirm new password'
            }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={isSubmitting || !tokenValid || !!lockoutEnd}
            sx={{ mt: 3 }}
          >
            {isSubmitting ? <CircularProgress size={24} /> : 'Reset Password'}
          </Button>
        </form>
      </Paper>
    </Container>
  );
};

export default ResetPassword;