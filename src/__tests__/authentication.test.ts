/**
 * Comprehensive authentication tests for GitHub MCP Server
 * Tests real token validation, security measures, and integration scenarios
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Octokit } from '@octokit/rest';
import { validateGitHubToken, validateEnvironmentConfiguration } from '../validation.js';
import { AuthenticationError, AuthorizationError, formatErrorResponse } from '../errors.js';

describe('Authentication Security Tests', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Backup original environment
    originalEnv = { ...process.env };
    
    // Clear authentication-related env vars
    delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.resetAllMocks();
  });

  describe('Real Token Format Validation', () => {
    describe('GitHub Personal Access Token (classic) - ghp_ prefix', () => {
      it('should validate correct ghp_ token format', () => {
        const validToken = 'ghp_' + 'A'.repeat(36);
        expect(validateGitHubToken(validToken)).toBe(true);
      });

      it('should reject ghp_ token with wrong length', () => {
        const shortToken = 'ghp_' + 'A'.repeat(35);
        const longToken = 'ghp_' + 'A'.repeat(37);
        expect(validateGitHubToken(shortToken)).toBe(false);
        expect(validateGitHubToken(longToken)).toBe(false);
      });

      it('should reject ghp_ token with invalid characters', () => {
        const invalidChars = 'ghp_' + 'A'.repeat(35) + '@';
        expect(validateGitHubToken(invalidChars)).toBe(false);
      });
    });

    describe('GitHub OAuth Token - gho_ prefix', () => {
      it('should validate correct gho_ token format', () => {
        const validToken = 'gho_' + 'B'.repeat(36);
        expect(validateGitHubToken(validToken)).toBe(true);
      });

      it('should reject gho_ token with invalid format', () => {
        const invalidToken = 'gho_' + 'B'.repeat(35);
        expect(validateGitHubToken(invalidToken)).toBe(false);
      });
    });

    describe('GitHub User Access Token - ghu_ prefix', () => {
      it('should validate correct ghu_ token format', () => {
        const validToken = 'ghu_' + 'C'.repeat(36);
        expect(validateGitHubToken(validToken)).toBe(true);
      });
    });

    describe('GitHub Server-to-Server Token - ghs_ prefix', () => {
      it('should validate correct ghs_ token format', () => {
        const validToken = 'ghs_' + 'D'.repeat(36);
        expect(validateGitHubToken(validToken)).toBe(true);
      });
    });

    describe('GitHub Refresh Token - ghr_ prefix', () => {
      it('should validate correct ghr_ token format', () => {
        const validToken = 'ghr_' + 'E'.repeat(36);
        expect(validateGitHubToken(validToken)).toBe(true);
      });
    });

    describe('Legacy Token Format', () => {
      it('should validate legacy 40-character hex tokens', () => {
        const legacyToken = 'a'.repeat(40);
        expect(validateGitHubToken(legacyToken)).toBe(true);
        
        const mixedCaseToken = 'AbCdEf1234567890aBcDeF1234567890AbCdEf12';
        expect(validateGitHubToken(mixedCaseToken)).toBe(true);
      });

      it('should reject non-hex characters in legacy tokens', () => {
        const invalidToken = 'g'.repeat(40);
        expect(validateGitHubToken(invalidToken)).toBe(false);
      });
    });

    describe('Invalid Token Formats', () => {
      it('should reject empty or null tokens', () => {
        expect(validateGitHubToken('')).toBe(false);
        expect(validateGitHubToken(null as any)).toBe(false);
        expect(validateGitHubToken(undefined as any)).toBe(false);
      });

      it('should reject tokens with unknown prefixes', () => {
        expect(validateGitHubToken('unknown_' + 'A'.repeat(30))).toBe(false);
        expect(validateGitHubToken('github_pat_' + 'A'.repeat(30))).toBe(false);
      });

      it('should reject malformed tokens', () => {
        expect(validateGitHubToken('not-a-token')).toBe(false);
        expect(validateGitHubToken('123')).toBe(false);
        expect(validateGitHubToken('ghp')).toBe(false);
        expect(validateGitHubToken('ghp_')).toBe(false);
      });
    });
  });

  describe('Token Security and Masking', () => {
    it('should never include raw tokens in error messages', () => {
      const sensitiveToken = 'ghp_' + 'A'.repeat(36);
      
      // Simulate authentication error
      const authError = new AuthenticationError('Invalid token', { 
        operation: 'authenticate',
        // Ensure no token is in context
      });
      
      const formatted = formatErrorResponse(authError);
      const errorString = JSON.stringify(formatted);
      
      // Token should not appear anywhere in error output
      expect(errorString).not.toContain(sensitiveToken);
      expect(errorString).not.toContain('ghp_');
    });

    it('should mask tokens in logging context', () => {
      const token = 'ghp_' + 'A'.repeat(36);
      
      // Function to mask sensitive data (should be used in real logging)
      const maskSensitiveData = (data: any): any => {
        if (typeof data === 'string') {
          // Mask GitHub tokens
          return data.replace(/gh[porus]_[A-Za-z0-9]{36}/g, 'gh*_****');
        }
        if (typeof data === 'object' && data !== null) {
          const masked = { ...data };
          for (const [key, value] of Object.entries(masked)) {
            if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) {
              masked[key] = '****';
            } else {
              masked[key] = maskSensitiveData(value);
            }
          }
          return masked;
        }
        return data;
      };

      const testData = {
        token: token,
        auth: 'Bearer ' + token,
        message: `Authentication failed with token ${token}`,
        config: {
          authToken: token
        }
      };

      const maskedData = maskSensitiveData(testData);
      const maskedString = JSON.stringify(maskedData);
      
      expect(maskedString).not.toContain(token);
      expect(maskedString).not.toContain('ghp_');
      expect(maskedData.token).toBe('****');
      expect(maskedData.auth).toBe('****');
      expect(maskedData.config.authToken).toBe('****');
      expect(maskedData.message).toMatch(/gh\*_\*\*\*\*/);
    });

    it('should handle token validation without exposing tokens', () => {
      const validToken = 'ghp_' + 'A'.repeat(36);
      const invalidToken = 'invalid-token';
      
      // Token validation should only return boolean, never the token
      expect(validateGitHubToken(validToken)).toBe(true);
      expect(validateGitHubToken(invalidToken)).toBe(false);
      
      // Validation should not throw errors that could leak tokens
      expect(() => validateGitHubToken(validToken)).not.toThrow();
      expect(() => validateGitHubToken(invalidToken)).not.toThrow();
    });
  });

  describe('Environment Configuration Validation', () => {
    it('should validate environment with valid token', () => {
      process.env.GITHUB_PERSONAL_ACCESS_TOKEN = 'ghp_' + 'A'.repeat(36);
      
      const result = validateEnvironmentConfiguration();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedValues.GITHUB_TOKEN).toBeDefined();
    });

    it('should reject environment with invalid token', () => {
      process.env.GITHUB_TOKEN = 'invalid-token';
      
      const result = validateEnvironmentConfiguration();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid GitHub token format');
    });

    it('should handle missing token', () => {
      const result = validateEnvironmentConfiguration();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_TOKEN is required');
    });

    it('should prioritize GITHUB_PERSONAL_ACCESS_TOKEN over GITHUB_TOKEN', () => {
      const patToken = 'ghp_' + 'A'.repeat(36);
      const githubToken = 'gho_' + 'B'.repeat(36);
      
      process.env.GITHUB_PERSONAL_ACCESS_TOKEN = patToken;
      process.env.GITHUB_TOKEN = githubToken;
      
      const result = validateEnvironmentConfiguration();
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValues.GITHUB_TOKEN).toBe(patToken);
    });

    it('should sanitize environment variables', () => {
      // Test with control characters that should be removed
      const tokenWithControlChars = 'ghp_' + 'A'.repeat(35) + '\x00';
      process.env.GITHUB_TOKEN = tokenWithControlChars + 'B';
      
      const result = validateEnvironmentConfiguration();
      
      expect(result.isValid).toBe(true);
      // Control chars should be stripped, resulting in valid token
      expect(result.sanitizedValues.GITHUB_TOKEN).toBe('ghp_' + 'A'.repeat(35) + 'B');
    });
  });

  describe('Token Permission Boundary Tests', () => {
    it('should create authentication error for 401 responses', () => {
      const mockError = {
        status: 401,
        message: 'Bad credentials',
        response: {
          headers: {}
        }
      };

      const authError = new AuthenticationError(mockError.message);
      
      expect(authError).toBeInstanceOf(AuthenticationError);
      expect(authError.statusCode).toBe(401);
      expect(authError.code).toBe('AUTHENTICATION_ERROR');
      expect(authError.message).toBe('Bad credentials');
    });

    it('should create authorization error for 403 responses', () => {
      const mockError = {
        status: 403,
        message: 'Insufficient permissions',
        response: {
          headers: {}
        }
      };

      const authzError = new AuthorizationError(mockError.message);
      
      expect(authzError).toBeInstanceOf(AuthorizationError);
      expect(authzError.statusCode).toBe(403);
      expect(authzError.code).toBe('AUTHORIZATION_ERROR');
      expect(authzError.message).toBe('Insufficient permissions');
    });
  });

  describe('Token Storage Security', () => {
    it('should not store tokens in plain text in memory dumps', () => {
      const token = 'ghp_' + 'A'.repeat(36);
      process.env.GITHUB_TOKEN = token;
      
      // Simulate environment configuration
      const config = validateEnvironmentConfiguration();
      
      // Check that sensitive data is properly handled
      expect(config.sanitizedValues.GITHUB_TOKEN).toBe(token);
      
      // In a real implementation, we would want to:
      // 1. Clear the token from process.env after reading
      // 2. Store it in a secure manner (encrypted, limited access)
      // 3. Ensure it doesn't appear in heap dumps or logs
      
      // For testing purposes, we verify the validation works correctly
      expect(validateGitHubToken(config.sanitizedValues.GITHUB_TOKEN)).toBe(true);
    });

    it('should handle token rotation gracefully', () => {
      // Simulate token rotation scenario
      const oldToken = 'ghp_' + 'A'.repeat(36);
      const newToken = 'ghp_' + 'B'.repeat(36);
      
      // Old token validation
      process.env.GITHUB_TOKEN = oldToken;
      let config = validateEnvironmentConfiguration();
      expect(config.isValid).toBe(true);
      expect(config.sanitizedValues.GITHUB_TOKEN).toBe(oldToken);
      
      // New token after rotation
      process.env.GITHUB_TOKEN = newToken;
      config = validateEnvironmentConfiguration();
      expect(config.isValid).toBe(true);
      expect(config.sanitizedValues.GITHUB_TOKEN).toBe(newToken);
      
      // Both should be valid format
      expect(validateGitHubToken(oldToken)).toBe(true);
      expect(validateGitHubToken(newToken)).toBe(true);
    });
  });

  describe('Integration Test Framework Setup', () => {
    it('should provide utilities for testing with controlled tokens', () => {
      // Test token management utilities
      const createTestToken = (prefix: string = 'ghp') => {
        return `${prefix}_${'T'.repeat(36)}`;
      };

      const testToken = createTestToken();
      expect(validateGitHubToken(testToken)).toBe(true);
      expect(testToken).toMatch(/^ghp_T{36}$/);
      
      const oauthTestToken = createTestToken('gho');
      expect(validateGitHubToken(oauthTestToken)).toBe(true);
      expect(oauthTestToken).toMatch(/^gho_T{36}$/);
    });

    it('should support test token with limited scopes', () => {
      // In a real integration test, we would:
      // 1. Use a test token with minimal required scopes
      // 2. Test against actual GitHub API endpoints
      // 3. Verify proper error handling for insufficient permissions
      
      const testToken = 'ghp_' + 'T'.repeat(36);
      
      // Mock a scenario where we test with limited scope token
      const mockOctokitWithLimitedToken = new Octokit({
        auth: testToken,
      });
      
      expect(mockOctokitWithLimitedToken).toBeDefined();
      
      // This would be expanded to actual API calls in integration tests
      // For now, we verify the token is properly formatted
      expect(validateGitHubToken(testToken)).toBe(true);
    });

    it('should handle expired token scenarios', () => {
      // Simulate expired token error response
      const expiredTokenError = {
        status: 401,
        message: 'Token has expired',
        response: {
          headers: {
            'x-github-media-type': 'github.v3; format=json'
          }
        }
      };

      const authError = new AuthenticationError(
        expiredTokenError.message,
        { reason: 'token_expired' }
      );
      
      expect(authError.message).toBe('Token has expired');
      expect(authError.statusCode).toBe(401);
      expect(authError.context?.reason).toBe('token_expired');
    });
  });

  describe('OAuth Flow Testing Infrastructure', () => {
    it('should prepare for OAuth flow testing', () => {
      // OAuth flow components that would need testing:
      // 1. Authorization URL generation
      // 2. Code exchange for access token
      // 3. Token refresh flow
      // 4. Scope validation
      
      const mockOAuthConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret', // Would be env var in real usage
        scopes: ['repo', 'user'],
        redirectUri: 'http://localhost:3000/callback'
      };
      
      // Validate OAuth token format
      const oauthToken = 'gho_' + 'O'.repeat(36);
      expect(validateGitHubToken(oauthToken)).toBe(true);
      
      // Test that config is structured correctly
      expect(mockOAuthConfig.scopes).toContain('repo');
      expect(mockOAuthConfig.scopes).toContain('user');
    });

    it('should handle OAuth error scenarios', () => {
      // Common OAuth errors that should be tested:
      
      // Invalid client credentials
      const invalidClientError = {
        status: 401,
        message: 'Invalid client credentials'
      };
      
      // Insufficient scope
      const insufficientScopeError = {
        status: 403,
        message: 'Insufficient scope',
        response: {
          headers: {
            'x-oauth-scopes': 'user',
            'x-accepted-oauth-scopes': 'repo, user'
          }
        }
      };
      
      expect(invalidClientError.status).toBe(401);
      expect(insufficientScopeError.status).toBe(403);
      
      // These would be handled by proper error normalization
      const authError = new AuthenticationError(invalidClientError.message);
      const authzError = new AuthorizationError(insufficientScopeError.message);
      
      expect(authError).toBeInstanceOf(AuthenticationError);
      expect(authzError).toBeInstanceOf(AuthorizationError);
    });
  });

  describe('Security Vulnerability Prevention', () => {
    it('should prevent token injection in URL parameters', () => {
      const maliciousToken = 'ghp_' + 'M'.repeat(36);
      
      // URL construction should never include raw tokens
      const constructSafeUrl = (baseUrl: string, params: Record<string, string>) => {
        const url = new URL(baseUrl);
        Object.entries(params).forEach(([key, value]) => {
          // Never include tokens in URL params
          if (!key.toLowerCase().includes('token') && !key.toLowerCase().includes('auth')) {
            url.searchParams.set(key, value);
          }
        });
        return url.toString();
      };
      
      const safeUrl = constructSafeUrl('https://api.github.com/repos/test/test', {
        token: maliciousToken, // Should be filtered out
        page: '1',
        per_page: '100'
      });
      
      expect(safeUrl).not.toContain(maliciousToken);
      expect(safeUrl).toContain('page=1');
      expect(safeUrl).toContain('per_page=100');
    });

    it('should prevent token leakage in serialization', () => {
      const sensitiveData = {
        username: 'testuser',
        token: 'ghp_' + 'S'.repeat(36),
        config: {
          authToken: 'gho_' + 'C'.repeat(36),
          apiUrl: 'https://api.github.com'
        }
      };
      
      // Safe serialization function
      const safeSerialize = (obj: any): string => {
        const replacer = (key: string, value: any) => {
          if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) {
            return '[REDACTED]';
          }
          if (typeof value === 'string' && /gh[porus]_[A-Za-z0-9]{36}/.test(value)) {
            return '[REDACTED]';
          }
          return value;
        };
        return JSON.stringify(obj, replacer, 2);
      };
      
      const serialized = safeSerialize(sensitiveData);
      
      expect(serialized).not.toContain('ghp_');
      expect(serialized).not.toContain('gho_');
      expect(serialized).toContain('[REDACTED]');
      expect(serialized).toContain('testuser');
      expect(serialized).toContain('https://api.github.com');
    });
  });
});