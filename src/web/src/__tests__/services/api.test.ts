// @version: jest@29.x
// @version: axios-mock-adapter@1.x
import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';
import { 
  apiClient, 
  get, 
  post, 
  put, 
  delete as del,
  getRateLimitInfo 
} from '../../services/api';
import { 
  ApiHeaders, 
  HttpMethod, 
  ApiResponse, 
  ApiError, 
  RateLimitInfo,
  ApiErrorCode,
  ValidationError 
} from '../../types/api';

// Test constants
const BASE_URL = 'http://localhost:8080/api/v1';
const TEST_JWT_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';
const TEST_REQUEST_ID = '123e4567-e89b-12d3-a456-426614174000';

// Mock adapter instance
let mockAxios: MockAdapter;

describe('API Client', () => {
  beforeEach(() => {
    // Initialize mock adapter
    mockAxios = new MockAdapter(apiClient);
    
    // Setup default headers
    localStorage.setItem('auth_token', TEST_JWT_TOKEN);
    
    // Configure default rate limit headers
    const rateLimitHeaders = {
      'x-rate-limit-limit': '1000',
      'x-rate-limit-remaining': '999',
      'x-rate-limit-reset': String(Date.now() + 3600000)
    };

    // Apply headers to mock adapter
    mockAxios.onAny().reply(config => {
      return [200, {}, rateLimitHeaders];
    });
  });

  afterEach(() => {
    mockAxios.reset();
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('HTTP Methods', () => {
    it('should successfully make GET request with authentication', async () => {
      const testData = { id: 1, name: 'Test' };
      const response: ApiResponse<typeof testData> = {
        status: 'success',
        data: testData,
        meta: {
          timestamp: new Date().toISOString(),
          version: 'v1'
        },
        request_id: TEST_REQUEST_ID
      };

      mockAxios.onGet(`${BASE_URL}/test`).reply(200, response, {
        'x-request-id': TEST_REQUEST_ID
      });

      const result = await get<typeof testData>('/test');
      expect(result).toEqual(response);
      expect(mockAxios.history.get[0].headers?.Authorization).toBe(`Bearer ${TEST_JWT_TOKEN}`);
    });

    it('should handle POST requests with signed payloads', async () => {
      const payload = { data: 'test' };
      const response: ApiResponse<{ id: string }> = {
        status: 'success',
        data: { id: '123' },
        meta: {
          timestamp: new Date().toISOString(),
          version: 'v1'
        },
        request_id: TEST_REQUEST_ID
      };

      mockAxios.onPost(`${BASE_URL}/test`).reply(config => {
        expect(config.headers?.['X-Request-Signature']).toBeDefined();
        return [200, response];
      });

      const result = await post<{ id: string }>('/test', payload);
      expect(result).toEqual(response);
    });

    it('should validate PUT request security headers', async () => {
      const payload = { id: 1, data: 'updated' };
      mockAxios.onPut(`${BASE_URL}/test/1`).reply(config => {
        expect(config.headers?.['X-CSRF-Token']).toBeDefined();
        expect(config.headers?.['X-Request-ID']).toBeDefined();
        return [200, { status: 'success', data: payload }];
      });

      await put('/test/1', payload);
      expect(mockAxios.history.put.length).toBe(1);
    });

    it('should process DELETE requests with authentication', async () => {
      mockAxios.onDelete(`${BASE_URL}/test/1`).reply(204);
      await del('/test/1');
      expect(mockAxios.history.delete[0].headers?.Authorization).toBe(`Bearer ${TEST_JWT_TOKEN}`);
    });
  });

  describe('Security Features', () => {
    it('should handle token refresh flow', async () => {
      const newToken = 'new.jwt.token';
      mockAxios.onGet(`${BASE_URL}/test`).replyOnce(401)
        .onPost(`${BASE_URL}/auth/refresh`).replyOnce(200, {
          access_token: newToken
        })
        .onGet(`${BASE_URL}/test`).replyOnce(200, { data: 'success' });

      await get('/test');
      expect(localStorage.getItem('auth_token')).toBe(newToken);
    });

    it('should validate request signatures', async () => {
      const payload = { sensitive: 'data' };
      mockAxios.onPost(`${BASE_URL}/test`).reply(config => {
        const signature = config.headers?.['X-Request-Signature'];
        expect(signature).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64 format
        return [200, { status: 'success' }];
      });

      await post('/test', payload);
    });

    it('should handle rate limit exceeded scenarios', async () => {
      mockAxios.onGet(`${BASE_URL}/test`).reply(429, {
        status: 'error',
        code: ApiErrorCode.RATE_LIMIT_EXCEEDED,
        message: 'Rate limit exceeded'
      }, {
        'retry-after': '60'
      });

      try {
        await get('/test');
      } catch (error) {
        expect(error).toHaveProperty('code', ApiErrorCode.RATE_LIMIT_EXCEEDED);
        expect(error).toHaveProperty('retry_after', 60);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors with details', async () => {
      const validationErrors: ValidationError[] = [{
        field: 'email',
        message: 'Invalid email format',
        code: 'INVALID_FORMAT'
      }];

      mockAxios.onPost(`${BASE_URL}/test`).reply(400, {
        status: 'error',
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        validation_errors: validationErrors
      });

      try {
        await post('/test', {});
      } catch (error) {
        expect(error).toHaveProperty('validation_errors', validationErrors);
      }
    });

    it('should handle network errors with retry logic', async () => {
      let attempts = 0;
      mockAxios.onGet(`${BASE_URL}/test`).reply(() => {
        attempts++;
        return attempts < 3 ? [500, {}] : [200, { status: 'success' }];
      });

      await get('/test');
      expect(attempts).toBe(3);
    });

    it('should handle timeout errors with retry', async () => {
      mockAxios.onGet(`${BASE_URL}/test`).timeout();
      try {
        await get('/test');
      } catch (error) {
        expect(error).toHaveProperty('code', ApiErrorCode.INTERNAL_SERVER_ERROR);
      }
    });
  });

  describe('Response Processing', () => {
    it('should process rate limit headers', async () => {
      const headers = {
        'x-rate-limit-limit': '1000',
        'x-rate-limit-remaining': '999',
        'x-rate-limit-reset': '1234567890'
      };

      mockAxios.onGet(`${BASE_URL}/test`).reply(200, {
        status: 'success',
        data: {}
      }, headers);

      await get('/test');
      const rateLimitInfo = getRateLimitInfo();
      
      expect(rateLimitInfo).toEqual({
        limit: 1000,
        remaining: 999,
        reset: 1234567890
      });
    });

    it('should validate response metadata', async () => {
      const response: ApiResponse<{}> = {
        status: 'success',
        data: {},
        meta: {
          timestamp: new Date().toISOString(),
          version: 'v1'
        },
        request_id: TEST_REQUEST_ID
      };

      mockAxios.onGet(`${BASE_URL}/test`).reply(200, response);
      
      const result = await get('/test');
      expect(result.meta).toBeDefined();
      expect(result.meta.version).toBe('v1');
      expect(result.request_id).toBe(TEST_REQUEST_ID);
    });

    it('should process pagination information', async () => {
      const response: ApiResponse<any[]> = {
        status: 'success',
        data: [],
        meta: {
          timestamp: new Date().toISOString(),
          version: 'v1',
          pagination: {
            currentPage: 1,
            totalPages: 10,
            totalItems: 100,
            itemsPerPage: 10
          }
        },
        request_id: TEST_REQUEST_ID
      };

      mockAxios.onGet(`${BASE_URL}/test`).reply(200, response);
      
      const result = await get('/test', { page: 1, limit: 10 });
      expect(result.meta.pagination).toBeDefined();
      expect(result.meta.pagination?.totalItems).toBe(100);
    });
  });
});