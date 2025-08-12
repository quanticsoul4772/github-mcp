/**
 * Tests for error handling utilities
 */
import { describe, it, expect, vi } from 'vitest';
import {
  GitHubMCPError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  NetworkError,
  TimeoutError,
  ConfigurationError,
  withErrorHandling,
  normalizeError,
  withRetry,
  formatErrorResponse,
} from './errors.js';

describe('Error Classes', () => {
  describe('GitHubMCPError', () => {
    it('should create error with basic properties', () => {
      const error = new GitHubMCPError('Test error', 'TEST_CODE', 400);
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('GitHubMCPError');
      expect(error.isRetryable).toBe(false);
    });

    it('should determine retryability correctly', () => {
      const retryableError = new GitHubMCPError('Rate limited', 'RATE_LIMIT', 429);
      expect(retryableError.isRetryable).toBe(true);

      const nonRetryableError = new GitHubMCPError('Not found', 'NOT_FOUND', 404);
      expect(nonRetryableError.isRetryable).toBe(false);

      const networkError = new GitHubMCPError('Network error', 'NETWORK_ERROR');
      expect(networkError.isRetryable).toBe(true);
    });

    it('should serialize to JSON correctly', () => {
      const error = new GitHubMCPError(
        'Test error',
        'TEST_CODE',
        400,
        { resource: 'test' }
      );

      const json = error.toJSON();
      expect(json).toMatchObject({
        name: 'GitHubMCPError',
        message: 'Test error',
        code: 'TEST_CODE',
        statusCode: 400,
        context: { resource: 'test' },
        isRetryable: false,
      });
      expect(json.correlationId).toBeDefined();
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error correctly', () => {
      const error = new AuthenticationError('Invalid token');
      
      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toBe('Invalid token');
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.statusCode).toBe(401);
      expect(error.isRetryable).toBe(false);
    });
  });

  describe('AuthorizationError', () => {
    it('should create authorization error correctly', () => {
      const error = new AuthorizationError('Insufficient permissions');
      
      expect(error.name).toBe('AuthorizationError');
      expect(error.message).toBe('Insufficient permissions');
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.statusCode).toBe(403);
      expect(error.isRetryable).toBe(false);
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error correctly', () => {
      const error = new NotFoundError('Repository');
      
      expect(error.name).toBe('NotFoundError');
      expect(error.message).toBe('Resource not found: Repository');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.isRetryable).toBe(false);
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error correctly', () => {
      const resetTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const error = new RateLimitError('Rate limited', resetTime, 5000, 0);
      
      expect(error.name).toBe('RateLimitError');
      expect(error.message).toBe('Rate limited');
      expect(error.code).toBe('RATE_LIMIT');
      expect(error.statusCode).toBe(429);
      expect(error.isRetryable).toBe(true);
      expect(error.limit).toBe(5000);
      expect(error.remaining).toBe(0);
      expect(error.resetTime).toBeInstanceOf(Date);
    });

    it('should handle missing rate limit data', () => {
      const error = new RateLimitError('Rate limited');
      
      expect(error.resetTime).toBeUndefined();
      expect(error.limit).toBeUndefined();
      expect(error.remaining).toBeUndefined();
    });
  });

  describe('NetworkError', () => {
    it('should create network error correctly', () => {
      const originalError = new Error('Connection refused');
      const error = new NetworkError('Network failed', originalError);
      
      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Network failed');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.isRetryable).toBe(true);
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('TimeoutError', () => {
    it('should create timeout error correctly', () => {
      const error = new TimeoutError('API call', 30000);
      
      expect(error.name).toBe('TimeoutError');
      expect(error.message).toBe('Operation \'API call\' timed out after 30000ms');
      expect(error.code).toBe('TIMEOUT');
      expect(error.isRetryable).toBe(true);
      expect(error.context).toEqual({ operation: 'API call', timeout: 30000 });
    });
  });

  describe('ConfigurationError', () => {
    it('should create configuration error correctly', () => {
      const error = new ConfigurationError('Missing token', ['GITHUB_TOKEN']);
      
      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe('Missing token');
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.isRetryable).toBe(false);
      expect(error.context).toEqual({ missingConfig: ['GITHUB_TOKEN'] });
    });
  });
});

describe('Error Handling Utilities', () => {
  describe('withErrorHandling', () => {
    it('should execute function successfully', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await withErrorHandling('test-operation', fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should normalize errors', async () => {
      const originalError = new Error('Test error');
      const fn = vi.fn().mockRejectedValue(originalError);
      
      await expect(withErrorHandling('test-operation', fn)).rejects.toThrow(GitHubMCPError);
    });
  });

  describe('normalizeError', () => {
    it('should return GitHubMCPError as-is', () => {
      const original = new GitHubMCPError('Test', 'TEST_CODE');
      const normalized = normalizeError(original);
      
      expect(normalized).toBe(original);
    });

    it('should normalize GitHub API 401 error', () => {
      const apiError = {
        status: 401,
        message: 'Bad credentials',
      };
      
      const normalized = normalizeError(apiError, 'get-user');
      
      expect(normalized).toBeInstanceOf(AuthenticationError);
      expect(normalized.message).toBe('Bad credentials');
      expect(normalized.context).toEqual({ operation: 'get-user' });
    });

    it('should normalize GitHub API 403 error', () => {
      const apiError = {
        status: 403,
        message: 'Forbidden',
      };
      
      const normalized = normalizeError(apiError);
      
      expect(normalized).toBeInstanceOf(AuthorizationError);
      expect(normalized.message).toBe('Forbidden');
    });

    it('should normalize GitHub API 403 rate limit error', () => {
      const apiError = {
        status: 403,
        message: 'Rate limit exceeded',
        response: {
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '1640995200',
            'x-ratelimit-limit': '5000',
          },
        },
      };
      
      const normalized = normalizeError(apiError);
      
      expect(normalized).toBeInstanceOf(RateLimitError);
      expect(normalized.message).toBe('GitHub API rate limit exceeded');
    });

    it('should normalize GitHub API 404 error', () => {
      const apiError = {
        status: 404,
        message: 'Not Found',
      };
      
      const normalized = normalizeError(apiError, 'get-repo');
      
      expect(normalized).toBeInstanceOf(NotFoundError);
      expect(normalized.message).toBe('Resource not found: get-repo');
    });

    it('should normalize GitHub API 429 error', () => {
      const apiError = {
        status: 429,
        message: 'Rate limit exceeded',
        response: {
          headers: {
            'x-ratelimit-reset': '1640995200',
            'x-ratelimit-limit': '5000',
            'x-ratelimit-remaining': '0',
          },
        },
      };
      
      const normalized = normalizeError(apiError) as RateLimitError;
      
      expect(normalized).toBeInstanceOf(RateLimitError);
      expect(normalized.limit).toBe(5000);
      expect(normalized.remaining).toBe(0);
    });

    it('should normalize network errors', () => {
      const networkError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      };
      
      const normalized = normalizeError(networkError, 'api-call');
      
      expect(normalized).toBeInstanceOf(NetworkError);
      expect(normalized.message).toContain('Network error during api-call');
    });

    it('should normalize timeout errors', () => {
      const timeoutError = {
        name: 'TimeoutError',
        message: 'Request timed out',
      };
      
      const normalized = normalizeError(timeoutError, 'api-request');
      
      expect(normalized).toBeInstanceOf(TimeoutError);
      expect(normalized.message).toContain('api-request');
    });

    it('should normalize generic errors', () => {
      const genericError = new Error('Unknown error');
      
      const normalized = normalizeError(genericError, 'operation');
      
      expect(normalized).toBeInstanceOf(GitHubMCPError);
      expect(normalized.code).toBe('UNKNOWN_ERROR');
      expect(normalized.originalError).toBe(genericError);
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await withRetry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new RateLimitError('Rate limited'))
        .mockRejectedValueOnce(new NetworkError('Network error'))
        .mockResolvedValue('success');
      
      const onRetry = vi.fn();
      const result = await withRetry(fn, { maxAttempts: 3, onRetry });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new NotFoundError('Not found'));
      
      await expect(withRetry(fn)).rejects.toThrow(NotFoundError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should give up after max attempts', async () => {
      const error = new RateLimitError('Rate limited');
      const fn = vi.fn().mockRejectedValue(error);
      
      await expect(withRetry(fn, { maxAttempts: 2 })).rejects.toThrow(RateLimitError);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should apply exponential backoff', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new NetworkError('Network error'))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      await withRetry(fn, { maxAttempts: 2, backoffMs: 100 });
      const duration = Date.now() - startTime;
      
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('formatErrorResponse', () => {
    it('should format GitHubMCPError correctly', () => {
      const error = new GitHubMCPError(
        'Test error',
        'TEST_CODE',
        400,
        { resource: 'test' }
      );
      
      const formatted = formatErrorResponse(error);
      
      expect(formatted).toEqual({
        error: {
          code: 'TEST_CODE',
          message: 'Test error',
          details: {
            statusCode: 400,
            context: { resource: 'test' },
            isRetryable: false,
          },
        },
      });
    });

    it('should format generic error correctly', () => {
      const error = new Error('Generic error');
      
      const formatted = formatErrorResponse(error);
      
      expect(formatted).toEqual({
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'Generic error',
        },
      });
    });

    it('should handle error without message', () => {
      const error = {} as Error;
      
      const formatted = formatErrorResponse(error);
      
      expect(formatted).toEqual({
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'An unknown error occurred',
        },
      });
    });
  });
});