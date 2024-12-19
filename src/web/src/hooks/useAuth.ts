// @version: react@18.x
// @version: react-redux@8.x
// @version: react-router-dom@6.x

import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AuthService } from '../services/auth';
import { 
  loginAsync, 
  logoutAsync, 
  validateSessionAsync,
  updateLastActivity,
  updateMfaStatus,
  updateDeviceInfo,
  selectAuth
} from '../store/slices/authSlice';

// Constants for session management
const ACTIVITY_CHECK_INTERVAL = 60000; // 1 minute
const SESSION_WARNING_THRESHOLD = 300000; // 5 minutes before expiry

/**
 * Interface for MFA validation status
 */
interface MfaStatus {
  required: boolean;
  verified: boolean;
  method: 'totp' | 'sms' | 'none';
}

/**
 * Interface for device information
 */
interface DeviceInfo {
  fingerprint: string;
  userAgent: string;
  platform: string;
  timezone: string;
}

/**
 * Interface for session validity information
 */
interface SessionValidity {
  isValid: boolean;
  expiresIn: number;
  warningThreshold: boolean;
}

/**
 * Interface for the useAuth hook return value
 */
interface UseAuthReturn {
  user: ReturnType<typeof selectAuth.selectUser>;
  isLoading: boolean;
  isAuthenticated: boolean;
  mfaStatus: MfaStatus;
  deviceInfo: DeviceInfo | null;
  sessionValidity: SessionValidity;
  lastActivity: number;
  error: string | null;
  login: (email: string, password: string, mfaToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  validateMfa: (mfaToken: string) => Promise<boolean>;
  refreshSession: () => Promise<void>;
}

/**
 * Enhanced authentication hook with security features
 * Implements OAuth 2.0 + OIDC with MFA and device tracking
 */
export const useAuth = (): UseAuthReturn => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Redux selectors
  const user = useSelector(selectAuth.selectUser);
  const isLoading = useSelector(selectAuth.selectIsLoading);
  const isAuthenticated = useSelector(selectAuth.selectIsAuthenticated);
  const error = useSelector(selectAuth.selectError);
  const deviceInfo = useSelector(selectAuth.selectDeviceInfo);
  const mfaStatus = useSelector(selectAuth.selectMfaStatus);
  const sessionValid = useSelector(selectAuth.selectSessionValidity);

  // Refs for intervals
  const activityCheckInterval = useRef<NodeJS.Timeout>();
  const sessionCheckInterval = useRef<NodeJS.Timeout>();

  /**
   * Enhanced login function with MFA and device validation
   */
  const login = useCallback(async (
    email: string, 
    password: string, 
    mfaToken?: string
  ) => {
    try {
      // Generate device fingerprint
      const deviceFingerprint = await AuthService.generateDeviceFingerprint();
      
      // Dispatch login action with enhanced security
      await dispatch(loginAsync({ 
        email, 
        password, 
        mfaToken, 
        deviceFingerprint 
      })).unwrap();

      // Update device info in store
      dispatch(updateDeviceInfo({
        fingerprint: deviceFingerprint,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }));

      // Navigate to dashboard on success
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, [dispatch, navigate]);

  /**
   * Enhanced logout with session cleanup
   */
  const logout = useCallback(async () => {
    try {
      await dispatch(logoutAsync()).unwrap();
      
      // Clear all intervals
      if (activityCheckInterval.current) {
        clearInterval(activityCheckInterval.current);
      }
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
      }

      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }, [dispatch, navigate]);

  /**
   * MFA validation function
   */
  const validateMfa = useCallback(async (mfaToken: string): Promise<boolean> => {
    try {
      const isValid = await AuthService.handleMfaChallenge(mfaToken);
      if (isValid) {
        dispatch(updateMfaStatus({ required: true, verified: true, method: 'totp' }));
      }
      return isValid;
    } catch (error) {
      console.error('MFA validation error:', error);
      return false;
    }
  }, [dispatch]);

  /**
   * Session refresh function
   */
  const refreshSession = useCallback(async () => {
    try {
      const isValid = await dispatch(validateSessionAsync()).unwrap();
      if (isValid) {
        dispatch(updateLastActivity());
      } else {
        await logout();
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      await logout();
    }
  }, [dispatch, logout]);

  /**
   * Activity monitoring effect
   */
  useEffect(() => {
    if (isAuthenticated) {
      // Update activity on user interactions
      const updateActivity = () => {
        dispatch(updateLastActivity());
      };

      // Set up activity listeners
      window.addEventListener('mousemove', updateActivity);
      window.addEventListener('keypress', updateActivity);
      window.addEventListener('click', updateActivity);

      // Set up activity check interval
      activityCheckInterval.current = setInterval(updateActivity, ACTIVITY_CHECK_INTERVAL);

      return () => {
        window.removeEventListener('mousemove', updateActivity);
        window.removeEventListener('keypress', updateActivity);
        window.removeEventListener('click', updateActivity);
        if (activityCheckInterval.current) {
          clearInterval(activityCheckInterval.current);
        }
      };
    }
  }, [isAuthenticated, dispatch]);

  /**
   * Session validation effect
   */
  useEffect(() => {
    if (isAuthenticated) {
      // Set up session check interval
      sessionCheckInterval.current = setInterval(async () => {
        await refreshSession();
      }, SESSION_WARNING_THRESHOLD);

      return () => {
        if (sessionCheckInterval.current) {
          clearInterval(sessionCheckInterval.current);
        }
      };
    }
  }, [isAuthenticated, refreshSession]);

  // Calculate session validity information
  const sessionValidity: SessionValidity = {
    isValid: sessionValid,
    expiresIn: user?.sessionTimeout || 0,
    warningThreshold: (user?.sessionTimeout || 0) - Date.now() < SESSION_WARNING_THRESHOLD
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    mfaStatus,
    deviceInfo,
    sessionValidity,
    lastActivity: useSelector((state: any) => state.auth.lastActivity),
    error,
    login,
    logout,
    validateMfa,
    refreshSession
  };
};