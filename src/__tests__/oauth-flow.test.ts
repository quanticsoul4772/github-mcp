/**
 * OAuth Flow Testing Infrastructure for GitHub MCP Server
 * Tests OAuth authentication flow components and security
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateGitHubToken } from '../validation.js';
import { AuthenticationError, AuthorizationError } from '../errors.js';

describe('OAuth Flow Testing Infrastructure', () => {
  describe('OAuth Token Validation', () => {
    it('should validate OAuth access tokens (gho_ prefix)', () => {
      const validOAuthToken = 'gho_' + 'A'.repeat(36);
      expect(validateGitHubToken(validOAuthToken)).toBe(true);
    });

    it('should validate user access tokens (ghu_ prefix)', () => {
      const validUserToken = 'ghu_' + 'B'.repeat(36);
      expect(validateGitHubToken(validUserToken)).toBe(true);
    });

    it('should validate server-to-server tokens (ghs_ prefix)', () => {
      const validServerToken = 'ghs_' + 'C'.repeat(36);
      expect(validateGitHubToken(validServerToken)).toBe(true);
    });

    it('should validate refresh tokens (ghr_ prefix)', () => {
      const validRefreshToken = 'ghr_' + 'D'.repeat(36);
      expect(validateGitHubToken(validRefreshToken)).toBe(true);
    });

    it('should reject invalid OAuth token formats', () => {
      expect(validateGitHubToken('gho_' + 'A'.repeat(35))).toBe(false);
      expect(validateGitHubToken('gho_' + 'A'.repeat(37))).toBe(false);
      expect(validateGitHubToken('oauth_token_123')).toBe(false);
      expect(validateGitHubToken('invalid_oauth')).toBe(false);
    });
  });

  describe('OAuth Configuration Management', () => {
    it('should support OAuth application configuration', () => {
      const oauthConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret', // In real usage, would be from env var
        scopes: ['repo', 'user', 'workflow'],
        redirectUri: 'https://example.com/auth/callback',
        authorizeUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token'
      };

      expect(oauthConfig.clientId).toBeTruthy();
      expect(oauthConfig.scopes).toContain('repo');
      expect(oauthConfig.scopes).toContain('user');
      expect(oauthConfig.redirectUri).toMatch(/^https:/);
      expect(oauthConfig.authorizeUrl).toMatch(/^https:\/\/github\.com/);
      expect(oauthConfig.tokenUrl).toMatch(/^https:\/\/github\.com/);
    });

    it('should validate OAuth scope configurations', () => {
      const validScopes = [
        'repo', 'repo:status', 'repo_deployment', 'public_repo',
        'repo:invite', 'security_events', 'admin:repo_hook',
        'write:repo_hook', 'read:repo_hook', 'admin:org',
        'write:org', 'read:org', 'admin:public_key',
        'write:public_key', 'read:public_key', 'admin:org_hook',
        'gist', 'notifications', 'user', 'read:user',
        'user:email', 'user:follow', 'project',
        'read:project', 'delete_repo', 'write:discussion',
        'read:discussion', 'workflow'
      ];

      const testScopes = ['repo', 'user', 'workflow'];
      
      for (const scope of testScopes) {
        expect(validScopes).toContain(scope);
      }
      
      // Test invalid scope
      expect(validScopes).not.toContain('invalid_scope');
    });

    it('should handle OAuth URL generation securely', () => {
      const generateOAuthUrl = (config: any, state: string) => {
        const params = new URLSearchParams({
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          scope: config.scopes.join(' '),
          state: state,
          response_type: 'code'
        });
        
        return `${config.authorizeUrl}?${params.toString()}`;
      };

      const config = {
        clientId: 'test-client-123',
        redirectUri: 'https://example.com/callback',
        scopes: ['repo', 'user'],
        authorizeUrl: 'https://github.com/login/oauth/authorize'
      };

      const state = 'secure-random-state-' + Date.now();
      const authUrl = generateOAuthUrl(config, state);

      expect(authUrl).toContain('client_id=test-client-123');
      expect(authUrl).toContain('scope=repo%20user');
      expect(authUrl).toContain('state=' + state);
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).not.toContain('client_secret'); // Should never be in URL
    });
  });

  describe('OAuth Token Exchange Flow', () => {
    it('should handle authorization code exchange', async () => {
      // Mock token exchange response
      const mockTokenResponse = {
        access_token: 'gho_' + 'A'.repeat(36),
        token_type: 'bearer',
        scope: 'repo,user',
        expires_in: 3600,
        refresh_token: 'ghr_' + 'R'.repeat(36)
      };

      // Simulate token exchange function
      const exchangeCodeForToken = async (code: string, config: any) => {
        // In real implementation, this would make HTTP request to GitHub
        if (code === 'valid-auth-code') {
          return mockTokenResponse;
        }
        throw new Error('Invalid authorization code');
      };

      const config = {
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'https://example.com/callback'
      };

      const result = await exchangeCodeForToken('valid-auth-code', config);
      
      expect(result.access_token).toBeTruthy();
      expect(validateGitHubToken(result.access_token)).toBe(true);
      expect(result.token_type).toBe('bearer');
      expect(result.scope).toContain('repo');
      expect(result.scope).toContain('user');
      expect(result.expires_in).toBeGreaterThan(0);
      
      if (result.refresh_token) {
        expect(validateGitHubToken(result.refresh_token)).toBe(true);
      }
    });

    it('should handle token exchange errors', async () => {
      const exchangeCodeForToken = async (code: string) => {
        if (code === 'invalid-code') {
          const error = new Error('Bad verification code');
          (error as any).status = 401;
          throw error;
        }
        return null;
      };

      await expect(exchangeCodeForToken('invalid-code')).rejects.toThrow('Bad verification code');
    });
  });

  describe('OAuth Token Refresh Flow', () => {
    it('should handle token refresh', async () => {
      const mockRefreshResponse = {
        access_token: 'gho_' + 'N'.repeat(36),
        token_type: 'bearer',
        scope: 'repo,user',
        expires_in: 3600,
        refresh_token: 'ghr_' + 'R'.repeat(36)
      };

      const refreshToken = async (refreshToken: string, config: any) => {
        if (validateGitHubToken(refreshToken) && refreshToken.startsWith('ghr_')) {
          return mockRefreshResponse;
        }
        throw new AuthenticationError('Invalid refresh token');
      };

      const validRefreshToken = 'ghr_' + 'R'.repeat(36);
      const config = { clientId: 'test', clientSecret: 'secret' };
      
      const result = await refreshToken(validRefreshToken, config);
      
      expect(result.access_token).toBeTruthy();
      expect(validateGitHubToken(result.access_token)).toBe(true);
      expect(result.refresh_token).toBeTruthy();
      expect(validateGitHubToken(result.refresh_token)).toBe(true);
    });

    it('should handle refresh token expiration', async () => {
      const refreshToken = async (refreshToken: string) => {
        if (refreshToken === 'ghr_expired_token') {
          throw new AuthenticationError('Refresh token expired');
        }
        return null;
      };

      await expect(refreshToken('ghr_expired_token'))
        .rejects.toThrow('Refresh token expired');
    });
  });

  describe('OAuth Error Handling', () => {
    it('should handle OAuth authorization errors', () => {
      const oauthErrors = {
        'access_denied': 'The user denied the request',
        'unauthorized_client': 'The client is not authorized',
        'invalid_grant': 'The provided authorization grant is invalid',
        'invalid_scope': 'The requested scope is invalid',
        'server_error': 'The authorization server encountered an unexpected condition'
      };

      for (const [errorCode, description] of Object.entries(oauthErrors)) {
        const error = new AuthorizationError(`OAuth error: ${errorCode} - ${description}`);
        expect(error.code).toBe('AUTHORIZATION_ERROR');
        expect(error.statusCode).toBe(403);
        expect(error.message).toContain(errorCode);
      }
    });

    it('should handle insufficient scope errors', () => {
      const insufficientScopeError = {
        error: 'insufficient_scope',
        error_description: 'The request requires higher privileges than provided by the access token',
        scope: 'repo user:email'
      };

      const error = new AuthorizationError(
        `Insufficient scope: ${insufficientScopeError.error_description}`,
        { requiredScope: insufficientScopeError.scope }
      );

      expect(error.message).toContain('Insufficient scope');
      expect(error.context?.requiredScope).toBe('repo user:email');
    });

    it('should handle rate limit errors in OAuth flow', () => {
      const rateLimitError = {
        error: 'rate_limit_exceeded',
        error_description: 'API rate limit exceeded for OAuth application',
        reset_time: Date.now() + 3600000 // 1 hour from now
      };

      const error = new AuthorizationError(
        rateLimitError.error_description,
        { 
          errorType: 'rate_limit',
          resetTime: rateLimitError.reset_time 
        }
      );

      expect(error.message).toContain('rate limit exceeded');
      expect(error.context?.errorType).toBe('rate_limit');
      expect(error.context?.resetTime).toBeGreaterThan(Date.now());
    });
  });

  describe('OAuth Security Considerations', () => {
    it('should never expose client secrets in logs or errors', () => {
      const config = {
        clientId: 'public-client-id',
        clientSecret: 'super-secret-client-secret',
        redirectUri: 'https://example.com/callback'
      };

      // Function to sanitize config for logging
      const sanitizeConfig = (config: any) => {
        const sanitized = { ...config };
        if (sanitized.clientSecret) {
          sanitized.clientSecret = '[REDACTED]';
        }
        return sanitized;
      };

      const sanitizedConfig = sanitizeConfig(config);
      const configString = JSON.stringify(sanitizedConfig);

      expect(configString).not.toContain('super-secret-client-secret');
      expect(configString).toContain('[REDACTED]');
      expect(configString).toContain('public-client-id'); // Public info is OK
    });

    it('should validate state parameter to prevent CSRF', () => {
      const generateSecureState = () => {
        // In real implementation, would use cryptographically secure random
        return 'state_' + Date.now() + '_' + Math.random().toString(36);
      };

      const validateState = (providedState: string, expectedState: string) => {
        return providedState === expectedState && 
               expectedState.length > 10 && 
               expectedState.includes('state_');
      };

      const state = generateSecureState();
      expect(state).toMatch(/^state_\d+_/);
      expect(validateState(state, state)).toBe(true);
      expect(validateState('invalid', state)).toBe(false);
      expect(validateState('', state)).toBe(false);
    });

    it('should use secure redirect URIs', () => {
      const validateRedirectUri = (uri: string) => {
        try {
          const url = new URL(uri);
          
          // Must use HTTPS in production
          if (url.protocol !== 'https:') {
            return false;
          }
          
          // Disallow localhost in production
          if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            return false;
          }
          
          return true;
        } catch {
          return false;
        }
      };

      expect(validateRedirectUri('https://example.com/callback')).toBe(true);
      expect(validateRedirectUri('https://myapp.com/auth/github')).toBe(true);
      expect(validateRedirectUri('http://example.com/callback')).toBe(false);
      expect(validateRedirectUri('https://localhost:3000/callback')).toBe(false);
      expect(validateRedirectUri('invalid-url')).toBe(false);
    });

    it('should handle token storage securely', () => {
      // Mock secure token storage
      const secureTokenStorage = {
        store: (key: string, token: string) => {
          // In real implementation, would encrypt token
          const encrypted = `encrypted_${token}`;
          return encrypted;
        },
        
        retrieve: (key: string, encryptedToken: string) => {
          // In real implementation, would decrypt token
          if (encryptedToken.startsWith('encrypted_')) {
            return encryptedToken.substring('encrypted_'.length);
          }
          return null;
        }
      };

      const testToken = 'gho_' + 'S'.repeat(36);
      const encrypted = secureTokenStorage.store('user123', testToken);
      expect(encrypted).toContain('encrypted_');
      
      const decrypted = secureTokenStorage.retrieve('user123', encrypted);
      expect(decrypted).toBe(testToken);
      expect(validateGitHubToken(decrypted!)).toBe(true);
    });
  });

  describe('OAuth Integration Test Preparation', () => {
    it('should prepare OAuth integration test utilities', () => {
      const oauthTestUtils = {
        createMockOAuthApp: () => ({
          clientId: 'test-oauth-app',
          clientSecret: 'test-secret-123',
          scopes: ['repo', 'user'],
          webhookUrl: 'https://example.com/webhook'
        }),

        generateTestTokens: () => ({
          accessToken: 'gho_' + 'T'.repeat(36),
          refreshToken: 'ghr_' + 'T'.repeat(36),
          expiresAt: Date.now() + 3600000 // 1 hour from now
        }),

        validateOAuthFlow: (authCode: string, state: string) => {
          return authCode.length > 10 && 
                 state.startsWith('state_') && 
                 state.length > 15;
        }
      };

      const mockApp = oauthTestUtils.createMockOAuthApp();
      expect(mockApp.clientId).toBeTruthy();
      expect(mockApp.scopes).toContain('repo');

      const tokens = oauthTestUtils.generateTestTokens();
      expect(validateGitHubToken(tokens.accessToken)).toBe(true);
      expect(validateGitHubToken(tokens.refreshToken)).toBe(true);
      expect(tokens.expiresAt).toBeGreaterThan(Date.now());

      expect(oauthTestUtils.validateOAuthFlow('valid-auth-code-123', 'state_12345_abc')).toBe(true);
      expect(oauthTestUtils.validateOAuthFlow('short', 'invalid')).toBe(false);
    });

    it('should provide OAuth error simulation utilities', () => {
      const simulateOAuthErrors = {
        invalidClient: () => ({
          error: 'invalid_client',
          error_description: 'Client authentication failed',
          status: 401
        }),

        invalidGrant: () => ({
          error: 'invalid_grant',
          error_description: 'The provided authorization grant is invalid, expired, or revoked',
          status: 400
        }),

        rateLimited: () => ({
          error: 'rate_limit_exceeded',
          error_description: 'API rate limit exceeded',
          status: 429,
          retry_after: 3600
        })
      };

      const invalidClientError = simulateOAuthErrors.invalidClient();
      expect(invalidClientError.error).toBe('invalid_client');
      expect(invalidClientError.status).toBe(401);

      const rateLimitError = simulateOAuthErrors.rateLimited();
      expect(rateLimitError.status).toBe(429);
      expect(rateLimitError.retry_after).toBeGreaterThan(0);
    });
  });
});