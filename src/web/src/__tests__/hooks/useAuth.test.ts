// @version: @testing-library/react@14.x
// @version: @reduxjs/toolkit@1.9.x
// @version: jest@29.x
// @version: react-redux@8.x

import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from '../../store/slices/authSlice';
import { useAuth } from '../../hooks/useAuth';
import { AuthService } from '../../services/auth';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
jest.mock('../../services/auth');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

// Test constants
const TEST_TIMEOUT = 5000;
const MFA_TOKEN = '123456';
const DEVICE_FINGERPRINT = 'test-device-fingerprint';
const SESSION_WARNING_THRESHOLD = 300000; // 5 minutes

// Mock user data
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'admin',
  permissions: ['read', 'write'],
  mfaEnabled: true,
  lastLogin: new Date(),
  deviceId: DEVICE_FINGERPRINT,
  sessionTimeout: 3600000 // 1 hour
};

// Test utilities
const createTestStore = () => {
  return configureStore({
    reducer: {
      auth: authReducer
    },
    preloadedState: {
      auth: {
        user: null,
        isLoading: false,
        error: null,
        isAuthenticated: false,
        deviceInfo: null,
        mfaStatus: { required: false, verified: false, method: 'none' },
        lastActivity: Date.now(),
        sessionTimeout: 3600000,
        loginAttempts: 0
      }
    }
  });
};

const wrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      <Provider store={createTestStore()}>{children}</Provider>
    </BrowserRouter>
  );
};

describe('useAuth Hook - Security Features', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Authentication Flow', () => {
    it('should handle login with MFA validation', async () => {
      // Mock AuthService responses
      (AuthService.generateDeviceFingerprint as jest.Mock).mockResolvedValue(DEVICE_FINGERPRINT);
      (AuthService.handleMfaChallenge as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password', MFA_TOKEN);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.mfaStatus.verified).toBe(true);
    });

    it('should enforce MFA requirements', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        try {
          await result.current.login('test@example.com', 'password');
        } catch (error) {
          expect(error).toEqual(expect.objectContaining({
            code: 'MFA_REQUIRED'
          }));
        }
      });

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should validate device fingerprint during login', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password', MFA_TOKEN);
      });

      expect(result.current.deviceInfo).toEqual(expect.objectContaining({
        fingerprint: DEVICE_FINGERPRINT
      }));
    });
  });

  describe('Session Management', () => {
    it('should monitor user activity and update last activity timestamp', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Simulate user authentication
      await act(async () => {
        await result.current.login('test@example.com', 'password', MFA_TOKEN);
      });

      const initialActivity = result.current.lastActivity;

      // Simulate user activity
      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove'));
      });

      await waitFor(() => {
        expect(result.current.lastActivity).toBeGreaterThan(initialActivity);
      });
    });

    it('should handle session timeout and force logout', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Simulate authenticated session
      await act(async () => {
        await result.current.login('test@example.com', 'password', MFA_TOKEN);
      });

      // Fast-forward past session timeout
      act(() => {
        jest.advanceTimersByTime(3600000 + 1000); // Session timeout + 1 second
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
      });
    });

    it('should refresh session before expiration', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password', MFA_TOKEN);
      });

      // Fast-forward to near session expiration
      act(() => {
        jest.advanceTimersByTime(SESSION_WARNING_THRESHOLD - 1000);
      });

      await waitFor(() => {
        expect(result.current.sessionValidity.warningThreshold).toBe(true);
      });
    });
  });

  describe('Security Features', () => {
    it('should handle device validation', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password', MFA_TOKEN);
      });

      expect(AuthService.generateDeviceFingerprint).toHaveBeenCalled();
      expect(result.current.deviceInfo?.fingerprint).toBe(DEVICE_FINGERPRINT);
    });

    it('should enforce security event logging', async () => {
      const mockSecurityLogger = jest.spyOn(console, 'error');
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        try {
          await result.current.login('test@example.com', 'invalid-password');
        } catch (error) {
          expect(mockSecurityLogger).toHaveBeenCalled();
        }
      });
    });

    it('should handle secure logout', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Login first
      await act(async () => {
        await result.current.login('test@example.com', 'password', MFA_TOKEN);
      });

      // Perform logout
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.deviceInfo).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication failures', async () => {
      (AuthService.login as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        try {
          await result.current.login('test@example.com', 'wrong-password');
        } catch (error) {
          expect(error).toEqual(expect.objectContaining({
            message: 'Invalid credentials'
          }));
        }
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle MFA validation failures', async () => {
      (AuthService.handleMfaChallenge as jest.Mock).mockResolvedValue(false);
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        const isValid = await result.current.validateMfa('invalid-token');
        expect(isValid).toBe(false);
      });

      expect(result.current.mfaStatus.verified).toBe(false);
    });
  });
});