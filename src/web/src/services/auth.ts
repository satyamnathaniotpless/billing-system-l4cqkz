// @version: axios@1.x
// @version: @auth0/auth0-spa-js@2.x
// @version: @fingerprintjs/fingerprintjs@3.x
// @version: crypto-js@4.x

import axios from 'axios';
import { Auth0Client } from '@auth0/auth0-spa-js';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import CryptoJS from 'crypto-js';
import { ApiResponse, ApiError, ApiHeaders } from '../types/api';
import { apiConfig, API_ENDPOINTS } from '../config/api';

/**
 * Constants for authentication configuration
 */
const TOKEN_STORAGE_KEY = 'otpless_auth_tokens_encrypted';

const AUTH0_CONFIG = {
  domain: process.env.REACT_APP_AUTH0_DOMAIN || '',
  clientId: process.env.REACT_APP_AUTH0_CLIENT_ID || '',
  audience: process.env.REACT_APP_AUTH0_AUDIENCE || '',
  scope: 'openid profile email',
  mfaProvider: 'auth0',
  sessionTimeout: 3600, // 1 hour
  maxRetries: 3,
  backoffFactor: 1.5
};

const SECURITY_CONFIG = {
  tokenEncryptionKey: process.env.REACT_APP_TOKEN_ENCRYPTION_KEY || '',
  maxLoginAttempts: 5,
  lockoutDuration: 900000, // 15 minutes
  sessionInactivityTimeout: 900000 // 15 minutes
};

/**
 * Interface for authenticated user data
 */
interface AuthUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  mfaEnabled: boolean;
  lastLogin: Date;
  deviceId: string;
  sessionTimeout: number;
}

/**
 * Interface for authentication tokens
 */
interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  encryptedAt: number;
  deviceFingerprint: string;
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
 * Authentication service class with enhanced security features
 */
class AuthService {
  private auth0Client: Auth0Client;
  private fingerprintJS: any;
  private loginAttempts: Map<string, number>;
  private lockoutTimers: Map<string, NodeJS.Timeout>;

  constructor() {
    this.auth0Client = new Auth0Client({
      domain: AUTH0_CONFIG.domain,
      client_id: AUTH0_CONFIG.clientId,
      audience: AUTH0_CONFIG.audience,
      scope: AUTH0_CONFIG.scope
    });
    this.fingerprintJS = FingerprintJS.load();
    this.loginAttempts = new Map();
    this.lockoutTimers = new Map();
  }

  /**
   * Encrypts sensitive data using AES encryption
   */
  private encryptData(data: string): string {
    return CryptoJS.AES.encrypt(data, SECURITY_CONFIG.tokenEncryptionKey).toString();
  }

  /**
   * Decrypts encrypted data using AES decryption
   */
  private decryptData(encryptedData: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedData, SECURITY_CONFIG.tokenEncryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Generates device fingerprint for enhanced security
   */
  private async generateDeviceFingerprint(): Promise<string> {
    const fp = await this.fingerprintJS;
    const result = await fp.get();
    return result.visitorId;
  }

  /**
   * Validates device fingerprint against stored value
   */
  private validateDeviceFingerprint(storedFingerprint: string, currentFingerprint: string): boolean {
    return storedFingerprint === currentFingerprint;
  }

  /**
   * Enhanced login with MFA and device tracking
   */
  public async login(
    credentials: { email: string; password: string },
    mfaCode?: string,
    deviceInfo?: DeviceInfo
  ): Promise<ApiResponse<AuthTokens>> {
    try {
      // Check for account lockout
      if (this.isAccountLocked(credentials.email)) {
        throw new Error('Account temporarily locked. Please try again later.');
      }

      // Generate device fingerprint
      const deviceFingerprint = await this.generateDeviceFingerprint();
      
      // Authenticate with Auth0
      const authResult = await this.auth0Client.loginWithCredentials({
        ...credentials,
        otp: mfaCode
      });

      // Validate MFA if enabled
      if (authResult.mfaRequired && !mfaCode) {
        return {
          status: 'error',
          data: null,
          meta: { timestamp: new Date().toISOString(), version: '1.0' },
          error_code: 'MFA_REQUIRED',
          request_id: ''
        };
      }

      // Create tokens object
      const tokens: AuthTokens = {
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
        expiresIn: authResult.expiresIn,
        encryptedAt: Date.now(),
        deviceFingerprint
      };

      // Encrypt tokens before storage
      const encryptedTokens = this.encryptData(JSON.stringify(tokens));
      localStorage.setItem(TOKEN_STORAGE_KEY, encryptedTokens);

      // Reset login attempts on successful login
      this.resetLoginAttempts(credentials.email);

      return {
        status: 'success',
        data: tokens,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0'
        },
        request_id: ''
      };

    } catch (error) {
      this.incrementLoginAttempts(credentials.email);
      throw error;
    }
  }

  /**
   * Enhanced token refresh with validation and backoff
   */
  public async refreshToken(refreshToken: string, deviceFingerprint: string): Promise<ApiResponse<AuthTokens>> {
    try {
      // Decrypt stored tokens
      const storedTokens = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedTokens) {
        throw new Error('No stored tokens found');
      }

      const decryptedTokens = JSON.parse(this.decryptData(storedTokens)) as AuthTokens;

      // Validate device fingerprint
      if (!this.validateDeviceFingerprint(decryptedTokens.deviceFingerprint, deviceFingerprint)) {
        throw new Error('Invalid device fingerprint');
      }

      // Refresh tokens with Auth0
      const newTokens = await this.auth0Client.refreshToken({
        refreshToken: decryptedTokens.refreshToken
      });

      // Update tokens
      const updatedTokens: AuthTokens = {
        ...decryptedTokens,
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresIn: newTokens.expiresIn,
        encryptedAt: Date.now()
      };

      // Encrypt and store new tokens
      const encryptedTokens = this.encryptData(JSON.stringify(updatedTokens));
      localStorage.setItem(TOKEN_STORAGE_KEY, encryptedTokens);

      return {
        status: 'success',
        data: updatedTokens,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0'
        },
        request_id: ''
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Secure logout with token revocation
   */
  public async logout(): Promise<void> {
    try {
      const storedTokens = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedTokens) {
        const decryptedTokens = JSON.parse(this.decryptData(storedTokens)) as AuthTokens;
        await this.auth0Client.logout({
          clientId: AUTH0_CONFIG.clientId,
          returnTo: window.location.origin
        });
      }
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * Get current authenticated user with session validation
   */
  public async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const storedTokens = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedTokens) {
        return null;
      }

      const decryptedTokens = JSON.parse(this.decryptData(storedTokens)) as AuthTokens;
      const user = await this.auth0Client.getUser(decryptedTokens.accessToken);

      if (!user) {
        return null;
      }

      return {
        id: user.sub!,
        email: user.email!,
        role: user['https://otpless.com/roles']?.[0] || 'user',
        permissions: user['https://otpless.com/permissions'] || [],
        mfaEnabled: user['https://otpless.com/mfa_enabled'] || false,
        lastLogin: new Date(user.updated_at!),
        deviceId: decryptedTokens.deviceFingerprint,
        sessionTimeout: AUTH0_CONFIG.sessionTimeout
      };
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  /**
   * Validate session with security checks
   */
  public async validateSession(): Promise<boolean> {
    try {
      const storedTokens = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedTokens) {
        return false;
      }

      const decryptedTokens = JSON.parse(this.decryptData(storedTokens)) as AuthTokens;
      const currentFingerprint = await this.generateDeviceFingerprint();

      // Validate device fingerprint
      if (!this.validateDeviceFingerprint(decryptedTokens.deviceFingerprint, currentFingerprint)) {
        await this.logout();
        return false;
      }

      // Check token expiration
      const tokenAge = Date.now() - decryptedTokens.encryptedAt;
      if (tokenAge >= decryptedTokens.expiresIn * 1000) {
        await this.refreshToken(decryptedTokens.refreshToken, currentFingerprint);
      }

      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  }

  /**
   * Handle MFA challenge
   */
  public async handleMfaChallenge(mfaCode: string): Promise<boolean> {
    try {
      const result = await this.auth0Client.sendMfaChallenge({
        mfaToken: mfaCode,
        client_id: AUTH0_CONFIG.clientId
      });
      return result.status === 'success';
    } catch (error) {
      console.error('MFA challenge error:', error);
      return false;
    }
  }

  /**
   * Account lockout management
   */
  private isAccountLocked(email: string): boolean {
    const attempts = this.loginAttempts.get(email) || 0;
    return attempts >= SECURITY_CONFIG.maxLoginAttempts;
  }

  private incrementLoginAttempts(email: string): void {
    const attempts = (this.loginAttempts.get(email) || 0) + 1;
    this.loginAttempts.set(email, attempts);

    if (attempts >= SECURITY_CONFIG.maxLoginAttempts) {
      this.lockoutTimers.set(email, setTimeout(() => {
        this.resetLoginAttempts(email);
      }, SECURITY_CONFIG.lockoutDuration));
    }
  }

  private resetLoginAttempts(email: string): void {
    this.loginAttempts.delete(email);
    const timer = this.lockoutTimers.get(email);
    if (timer) {
      clearTimeout(timer);
      this.lockoutTimers.delete(email);
    }
  }
}

// Export singleton instance
export const authService = new AuthService();