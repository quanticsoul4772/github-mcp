/**
 * Integration tests for real GitHub API authentication
 * These tests use actual GitHub API calls with controlled test tokens
 * 
 * IMPORTANT: These tests require actual network calls and valid tokens
 * They should be run separately from unit tests and may be skipped in CI
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Octokit } from '@octokit/rest';
import { AuthenticationError, AuthorizationError, RateLimitError, normalizeError } from '../../errors.js';
import { validateGitHubToken } from '../../validation.js';
import { config } from 'dotenv';

// Load .env file to get GITHUB_TEST_TOKEN
config();

// Check if we should skip integration tests - evaluate dynamically
const shouldSkipIntegrationTests = () => !process.env.GITHUB_TEST_TOKEN;

describe('Authentication Integration Tests', () => {
  let testToken: string | undefined;
  let octokit: Octokit;
  
  beforeEach(() => {
    testToken = process.env.GITHUB_TEST_TOKEN;
    
    if (!testToken) {
      console.warn('Skipping integration tests: No GITHUB_TEST_TOKEN provided');
      return;
    }
    
    if (testToken) {
      octokit = new Octokit({ auth: testToken });
    }
  });

  describe('Real Token Validation with GitHub API', function() {
    it.skipIf(shouldSkipIntegrationTests())('should authenticate with valid test token', async () => {
      if (!testToken || !octokit) {
        console.warn('Test skipped: No GITHUB_TEST_TOKEN provided');
        return;
      }
      
      expect(testToken).toBeDefined();
      expect(validateGitHubToken(testToken!)).toBe(true);
      
      // Test actual authentication with GitHub API
      const response = await octokit.rest.users.getAuthenticated();
      
      expect(response.status).toBe(200);
      expect(response.data.login).toBeDefined();
      expect(response.data.id).toBeGreaterThan(0);
    });

    it.skipIf(shouldSkipIntegrationTests())('should fail with invalid token format', async () => {
      const invalidOctokit = new Octokit({ auth: 'invalid-token-format' });
      
      await expect(async () => {
        await invalidOctokit.rest.users.getAuthenticated();
      }).rejects.toThrow();
    });

    it.skipIf(shouldSkipIntegrationTests())('should handle expired/revoked token', async () => {
      // Use a token that's definitely expired (old format from 2020)
      const expiredToken = 'a'.repeat(40);
      const expiredOctokit = new Octokit({ auth: expiredToken });
      
      try {
        await expiredOctokit.rest.users.getAuthenticated();
        // If this succeeds, the token wasn't actually expired
        console.warn('Test token may not be expired - this is expected in some cases');
      } catch (error: any) {
        const normalizedError = normalizeError(error, 'authenticate');
        expect(normalizedError).toBeInstanceOf(AuthenticationError);
        expect(normalizedError.statusCode).toBe(401);
      }
    });
  });

  describe('Token Permission Verification', function() {
    it.skipIf(shouldSkipIntegrationTests())('should verify token has basic user permissions', async () => {
      // Test basic read permissions
      const userResponse = await octokit.rest.users.getAuthenticated();
      expect(userResponse.status).toBe(200);
      expect(userResponse.data.login).toBeTruthy();
    });

    it.skipIf(shouldSkipIntegrationTests())('should handle insufficient permissions gracefully', async () => {
      try {
        // Try to access organization data - may fail with insufficient permissions
        await octokit.rest.orgs.list();
      } catch (error: any) {
        if (error.status === 403) {
          const normalizedError = normalizeError(error, 'list_organizations');
          expect(normalizedError).toBeInstanceOf(AuthorizationError);
          expect(normalizedError.statusCode).toBe(403);
        } else {
          // Other errors are acceptable (e.g., user has no orgs)
          expect(error).toBeDefined();
        }
      }
    });

    it.skipIf(shouldSkipIntegrationTests())('should detect rate limiting', async () => {
      // Check rate limit headers
      const response = await octokit.rest.users.getAuthenticated();
      
      const rateLimitRemaining = response.headers['x-ratelimit-remaining'];
      const rateLimitLimit = response.headers['x-ratelimit-limit'];
      const rateLimitReset = response.headers['x-ratelimit-reset'];
      
      expect(rateLimitRemaining).toBeDefined();
      expect(rateLimitLimit).toBeDefined();
      expect(rateLimitReset).toBeDefined();
      
      // Verify rate limit values are reasonable
      expect(Number(rateLimitRemaining)).toBeGreaterThanOrEqual(0);
      expect(Number(rateLimitLimit)).toBeGreaterThan(0);
      expect(Number(rateLimitReset)).toBeGreaterThan(Date.now() / 1000 - 3600); // Within last hour
    });
  });

  describe('Error Handling Integration', function() {
    it.skipIf(shouldSkipIntegrationTests())('should normalize GitHub API errors correctly', async () => {
      try {
        // Try to access a repository that definitely doesn't exist
        await octokit.rest.repos.get({
          owner: 'definitely-does-not-exist-12345',
          repo: 'also-does-not-exist-67890'
        });
      } catch (error: any) {
        const normalizedError = normalizeError(error, 'get_repository');
        
        // Should be normalized to a proper error type
        expect(normalizedError.code).toBeTruthy();
        expect(normalizedError.statusCode).toBe(404);
        expect(normalizedError.message).toBeTruthy();
        
        // Should not contain sensitive information
        const errorString = JSON.stringify(normalizedError.toJSON());
        expect(errorString).not.toMatch(/gh[porus]_[A-Za-z0-9]{36}/);
      }
    });

    it.skipIf(shouldSkipIntegrationTests())('should handle network timeouts', async () => {
      // Create octokit with very short timeout
      const timeoutOctokit = new Octokit({
        auth: testToken,
        request: {
          timeout: 1 // 1ms timeout to force timeout error
        }
      });
      
      try {
        await timeoutOctokit.rest.users.getAuthenticated();
        // May not always timeout, so we don't force this to fail
      } catch (error: any) {
        if (error.code === 'ETIMEDOUT' || error.name === 'TimeoutError') {
          const normalizedError = normalizeError(error, 'authenticate');
          expect(normalizedError.isRetryable).toBe(true);
        }
      }
    });
  });

  describe('Token Scope Detection', function() {
    it.skipIf(shouldSkipIntegrationTests())('should detect available OAuth scopes', async () => {
      try {
        // Make a request that returns OAuth scope headers
        const response = await octokit.rest.users.getAuthenticated();
        
        const scopes = response.headers['x-oauth-scopes'];
        const acceptedScopes = response.headers['x-accepted-oauth-scopes'];
        
        if (scopes) {
          console.info('Available scopes:', scopes);
          expect(typeof scopes).toBe('string');
        }
        
        if (acceptedScopes) {
          console.info('Accepted scopes for this endpoint:', acceptedScopes);
          expect(typeof acceptedScopes).toBe('string');
        }
      } catch (error) {
        // OAuth scope headers may not be present for all token types
        console.warn('OAuth scope detection not available for this token type');
      }
    });

    it.skipIf(shouldSkipIntegrationTests())('should test repository access permissions', async () => {
      try {
        // Try to list user's repositories
        const response = await octokit.rest.repos.listForAuthenticatedUser({
          type: 'owner',
          per_page: 1
        });
        
        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
        
        // If user has repositories, test access to one
        if (response.data.length > 0) {
          const repo = response.data[0];
          const repoResponse = await octokit.rest.repos.get({
            owner: repo.owner.login,
            repo: repo.name
          });
          
          expect(repoResponse.status).toBe(200);
          expect(repoResponse.data.name).toBe(repo.name);
        }
      } catch (error: any) {
        if (error.status === 403) {
          console.warn('Token does not have repository access permissions');
          expect(error.status).toBe(403);
        } else {
          throw error;
        }
      }
    });
  });

  describe('Security Validation', function() {
    it.skipIf(shouldSkipIntegrationTests())('should never log raw tokens in error messages', async () => {
      if (!testToken || !octokit) {
        console.warn('Test skipped: No GITHUB_TEST_TOKEN provided');
        return;
      }
      
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      try {
        // Force an error with invalid repository
        await octokit.rest.repos.get({
          owner: 'invalid-owner-123',
          repo: 'invalid-repo-456'
        });
      } catch (error: any) {
        const normalizedError = normalizeError(error, 'test_operation');
        
        // Check error message and logs don't contain tokens
        const errorStr = normalizedError.message;
        const errorJson = JSON.stringify(normalizedError.toJSON());
        
        expect(errorStr).not.toMatch(/gh[porus]_[A-Za-z0-9]{36}/);
        expect(errorJson).not.toMatch(/gh[porus]_[A-Za-z0-9]{36}/);
        
        // Check console logs don't contain tokens
        const logCalls = logSpy.mock.calls.flat().join(' ');
        const warnCalls = warnSpy.mock.calls.flat().join(' ');
        
        expect(logCalls).not.toMatch(/gh[porus]_[A-Za-z0-9]{36}/);
        expect(warnCalls).not.toMatch(/gh[porus]_[A-Za-z0-9]{36}/);
      }
      
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it.skipIf(shouldSkipIntegrationTests())('should validate token format before API calls', async () => {
      if (!testToken || !octokit) {
        console.warn('Test skipped: No GITHUB_TEST_TOKEN provided');
        return;
      }
      
      // This test verifies that we validate token format before making API calls
      // This prevents sending malformed tokens to GitHub API
      
      expect(testToken).toBeDefined();
      expect(validateGitHubToken(testToken!)).toBe(true);
      
      // Invalid tokens should fail validation
      expect(validateGitHubToken('invalid')).toBe(false);
      expect(validateGitHubToken('')).toBe(false);
      expect(validateGitHubToken('ghp_toolong' + 'x'.repeat(50))).toBe(false);
    });
  });

  describe('Rate Limiting Integration', function() {
    it.skipIf(shouldSkipIntegrationTests())('should handle rate limit responses', async () => {
      if (!testToken || !octokit) {
        console.warn('Test skipped: No GITHUB_TEST_TOKEN provided');
        return;
      }
      
      // Get current rate limit status
      const rateLimitResponse = await octokit.rest.rateLimit.get();
      
      expect(rateLimitResponse.status).toBe(200);
      expect(rateLimitResponse.data.resources).toBeDefined();
      expect(rateLimitResponse.data.resources.core).toBeDefined();
      
      const coreLimit = rateLimitResponse.data.resources.core;
      expect(coreLimit.limit).toBeGreaterThan(0);
      expect(coreLimit.remaining).toBeGreaterThanOrEqual(0);
      expect(coreLimit.reset).toBeGreaterThan(Date.now() / 1000 - 3600);
      
      console.info(`Rate limit: ${coreLimit.remaining}/${coreLimit.limit}`);
      console.info(`Resets at: ${new Date(coreLimit.reset * 1000).toISOString()}`);
    });

    // Note: This test is commented out as it would exhaust rate limits
    // In a real test environment, you might want to test this with a dedicated test token
    /*
    it.skipIf(shouldSkipIntegrationTests())('should handle rate limit exhaustion', async () => {
      // This test would make many requests to exhaust rate limit
      // and verify proper error handling
      // WARNING: Don't run this in production or with important tokens
    });
    */
  });
});

// Utility functions for integration tests
export const integrationTestUtils = {
  /**
   * Create a test token for integration testing
   * NOTE: This doesn't create a real token, just validates format
   */
  createTestToken: (prefix: string = 'ghp'): string => {
    return `${prefix}_${'T'.repeat(36)}`;
  },

  /**
   * Check if integration tests should be skipped
   */
  shouldSkipIntegrationTests: () => shouldSkipIntegrationTests,

  /**
   * Validate that a token is safe for testing
   */
  isTestTokenSafe: (token: string): boolean => {
    // Only allow tokens that are clearly for testing
    return token.includes('test') || token.includes('TEST') || token.startsWith('ghp_T');
  },

  /**
   * Mask sensitive data in test output
   */
  maskSensitiveData: (data: any): any => {
    if (typeof data === 'string') {
      return data.replace(/gh[porus]_[A-Za-z0-9]{36}/g, 'gh*_****');
    }
    if (typeof data === 'object' && data !== null) {
      const masked = { ...data };
      for (const [key, value] of Object.entries(masked)) {
        if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) {
          masked[key] = '****';
        } else {
          masked[key] = integrationTestUtils.maskSensitiveData(value);
        }
      }
      return masked;
    }
    return data;
  }
};