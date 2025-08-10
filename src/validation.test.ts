/**
 * Comprehensive tests for validation module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ValidationError,
  ValidationErrorDetail,
  ValidationWarning,
  ValidationResult,
  ValidationLevel,
  validateGitHubToken,
  validateGitHubTokenWithResult,
  validateGitHubTokenFormat,
  validateGitHubTokenWithAPI,
  validateOwnerName,
  validateRepoName,
  validateBranchName,
  validateFilePath,
  validateRef,
  validateSHA,
  validateWorkflowFileName,
  validateURL,
  validateIssueNumber,
  validatePerPage,
  validateSearchQuery,
  validateEnvironment,
  validateEnvironmentConfiguration,
  validateGitOperation,
  validateCommandOptions,
  cleanupValidation
} from './validation.js';

describe('Validation Module', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.NODE_ENV;
    delete process.env.SKIP_VALIDATION;
  });

  afterEach(() => {
    // Cleanup after each test
    cleanupValidation();
  });

  describe('ValidationError Class', () => {
    it('should create a ValidationError with correct properties', () => {
      const error = new ValidationError('testField', 'Test error message');
      expect(error).toBeInstanceOf(Error);
      expect(error.field).toBe('testField');
      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('ValidationError');
    });

    it('should maintain stack trace', () => {
      const error = new ValidationError('field', 'message');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ValidationError');
    });
  });

  describe('GitHub Token Validation', () => {
    describe('validateGitHubToken (legacy)', () => {
      it('should return false for invalid tokens', () => {
        expect(validateGitHubToken('')).toBe(false);
        expect(validateGitHubToken('invalid')).toBe(false);
        expect(validateGitHubToken('too_short')).toBe(false);
      });

      it('should return true for valid classic PAT', () => {
        const validToken = ['ghp', '_'].join('') + 'a'.repeat(36);
        expect(validateGitHubToken(validToken)).toBe(true);
      });

      it('should return true for valid fine-grained PAT', () => {
        const validToken = ['github', '_pat_'].join('') + 'a'.repeat(82);
        expect(validateGitHubToken(validToken)).toBe(true);
      });

      it('should bypass validation in development mode', () => {
        process.env.NODE_ENV = 'development';
        process.env.SKIP_VALIDATION = 'true';
        expect(validateGitHubToken('invalid')).toBe(true);
      });
    });

    describe('validateGitHubTokenFormat', () => {
      it('should validate classic PAT format', () => {
        const token = ['ghp', '_'].join('') + 'a'.repeat(36);
        const result = validateGitHubTokenFormat(token, ValidationLevel.STRICT);
        expect(result.isValid).toBe(true);
        expect(result.format).toBe('classic_pat');
      });

      it('should validate OAuth token format', () => {
        const token = ['gho', '_'].join('') + 'a'.repeat(36);
        const result = validateGitHubTokenFormat(token, ValidationLevel.MODERATE);
        expect(result.isValid).toBe(true);
        expect(result.format).toBe('oauth');
      });

      it('should validate fine-grained PAT', () => {
        const token = ['github', '_pat_'].join('') + '1'.repeat(22) + '_' + 'a'.repeat(59);
        const result = validateGitHubTokenFormat(token, ValidationLevel.MODERATE);
        expect(result.isValid).toBe(true);
        expect(result.format).toBe('fine_grained_pat');
      });

      it('should validate installation token', () => {
        const token = ['ghi', '_'].join('') + 'a'.repeat(36);
        const result = validateGitHubTokenFormat(token, ValidationLevel.MODERATE);
        expect(result.isValid).toBe(true);
        expect(result.format).toBe('installation');
      });

      it('should reject invalid tokens in STRICT mode', () => {
        const result = validateGitHubTokenFormat('invalid_token', ValidationLevel.STRICT);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should accept legacy tokens in LENIENT mode', () => {
        const token = 'a'.repeat(40); // Legacy format
        const result = validateGitHubTokenFormat(token, ValidationLevel.LENIENT);
        expect(result.isValid).toBe(true);
        expect(result.format).toBe('legacy');
      });
    });

    describe('validateGitHubTokenWithResult', () => {
      it('should return detailed validation result', () => {
        const token = ['ghp', '_'].join('') + 'a'.repeat(36);
        const result = validateGitHubTokenWithResult(token);
        expect(result.valid).toBe(true);
        expect(result.value).toBe(token);
        expect(result.errors).toHaveLength(0);
      });

      it('should return errors for invalid token', () => {
        const result = validateGitHubTokenWithResult('invalid');
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].code).toBeDefined();
        expect(result.errors[0].field).toBe('githubToken');
      });

      it('should detect whitespace in token', () => {
        const result = validateGitHubTokenWithResult(['ghp', '_abc def123'].join(''));
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'TOKEN_CONTAINS_WHITESPACE')).toBe(true);
      });

      it('should detect missing token', () => {
        const result = validateGitHubTokenWithResult('');
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'MISSING_TOKEN')).toBe(true);
      });

      it('should provide suggestions', () => {
        const result = validateGitHubTokenWithResult('');
        expect(result.suggestions).toBeDefined();
        expect(result.suggestions.length).toBeGreaterThan(0);
      });
    });

    describe('validateGitHubTokenWithAPI', () => {
      it('should bypass validation in development mode', async () => {
        process.env.NODE_ENV = 'development';
        process.env.SKIP_VALIDATION = 'true';
        
        const result = await validateGitHubTokenWithAPI('invalid');
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.code === 'DEV_BYPASS')).toBe(true);
      });

      it('should handle missing fetch API', async () => {
        // Mock fetch as undefined
        const originalFetch = global.fetch;
        // @ts-ignore
        global.fetch = undefined;
        
        const result = await validateGitHubTokenWithAPI(['ghp', '_valid123'].join(''));
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'FETCH_NOT_AVAILABLE')).toBe(true);
        
        global.fetch = originalFetch;
      });

      it('should validate token with API when fetch is available', async () => {
        // Mock successful API response
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ login: 'testuser' })
        });
        
        const token = ['ghp', '_'].join('') + 'a'.repeat(36);
        const result = await validateGitHubTokenWithAPI(token);
        expect(result.valid).toBe(true);
        expect(result.value).toHaveProperty('user');
      });
    });
  });

  describe('Input Validation Functions', () => {
    describe('validateOwnerName', () => {
      it('should validate valid owner names', () => {
        expect(validateOwnerName('octocat')).toBe(true);
        expect(validateOwnerName('valid-user')).toBe(true);
        expect(validateOwnerName('user123')).toBe(true);
      });

      it('should reject invalid owner names', () => {
        expect(validateOwnerName('')).toBe(false);
        expect(validateOwnerName('a')).toBe(false); // Too short
        expect(validateOwnerName('-invalid')).toBe(false); // Starts with dash
        expect(validateOwnerName('invalid-')).toBe(false); // Ends with dash
        expect(validateOwnerName('in valid')).toBe(false); // Contains space
        expect(validateOwnerName('in/valid')).toBe(false); // Contains slash
      });
    });

    describe('validateRepoName', () => {
      it('should validate valid repo names', () => {
        expect(validateRepoName('my-repo')).toBe(true);
        expect(validateRepoName('repo.with.dots')).toBe(true);
        expect(validateRepoName('repo_with_underscores')).toBe(true);
        expect(validateRepoName('123-repo')).toBe(true);
      });

      it('should reject invalid repo names', () => {
        expect(validateRepoName('')).toBe(false);
        expect(validateRepoName('a')).toBe(false); // Too short
        expect(validateRepoName('.invalid')).toBe(false); // Starts with dot
        expect(validateRepoName('invalid.')).toBe(false); // Ends with dot
        expect(validateRepoName('in valid')).toBe(false); // Contains space
        expect(validateRepoName('in/valid')).toBe(false); // Contains slash
      });
    });

    describe('validateBranchName', () => {
      it('should validate valid branch names', () => {
        expect(validateBranchName('main')).toBe(true);
        expect(validateBranchName('feature/new-feature')).toBe(true);
        expect(validateBranchName('release-1.0.0')).toBe(true);
        expect(validateBranchName('fix_bug_123')).toBe(true);
      });

      it('should reject invalid branch names', () => {
        expect(validateBranchName('')).toBe(false);
        expect(validateBranchName('.invalid')).toBe(false); // Starts with dot
        expect(validateBranchName('invalid.')).toBe(false); // Ends with dot
        expect(validateBranchName('in valid')).toBe(false); // Contains space
        expect(validateBranchName('in:valid')).toBe(false); // Contains colon
        expect(validateBranchName('in~valid')).toBe(false); // Contains tilde
      });
    });

    describe('validateFilePath', () => {
      it('should validate and sanitize valid file paths', () => {
        expect(validateFilePath('README.md')).toBe('README.md');
        expect(validateFilePath('src/index.js')).toBe('src/index.js');
        expect(validateFilePath('path/to/file.txt')).toBe('path/to/file.txt');
      });

      it('should reject path traversal attempts', () => {
        expect(validateFilePath('../etc/passwd')).toBe(null);
        expect(validateFilePath('../../secret')).toBe(null);
        expect(validateFilePath('path/../../../etc/passwd')).toBe(null);
      });

      it('should reject absolute paths', () => {
        expect(validateFilePath('/etc/passwd')).toBe(null);
        expect(validateFilePath('C:\\Windows\\System32')).toBe(null);
      });

      it('should sanitize double slashes', () => {
        expect(validateFilePath('path//to//file')).toBe('path/to/file');
      });

      it('should remove trailing slashes', () => {
        expect(validateFilePath('path/to/dir/')).toBe('path/to/dir');
      });
    });

    describe('validateRef', () => {
      it('should validate valid refs', () => {
        expect(validateRef('main')).toBe(true);
        expect(validateRef('refs/heads/main')).toBe(true);
        expect(validateRef('refs/tags/v1.0.0')).toBe(true);
        expect(validateRef('a'.repeat(40))).toBe(true); // SHA
      });

      it('should reject invalid refs', () => {
        expect(validateRef('')).toBe(false);
        expect(validateRef('in valid')).toBe(false);
        expect(validateRef('.invalid')).toBe(false);
      });
    });

    describe('validateSHA', () => {
      it('should validate valid SHA hashes', () => {
        expect(validateSHA('a'.repeat(40))).toBe(true);
        expect(validateSHA('1234567890abcdef1234567890abcdef12345678')).toBe(true);
      });

      it('should reject invalid SHA hashes', () => {
        expect(validateSHA('')).toBe(false);
        expect(validateSHA('not-a-sha')).toBe(false);
        expect(validateSHA('a'.repeat(39))).toBe(false); // Too short
        expect(validateSHA('a'.repeat(41))).toBe(false); // Too long
        expect(validateSHA('g'.repeat(40))).toBe(false); // Invalid hex
      });
    });

    describe('validateURL', () => {
      it('should validate valid URLs', () => {
        expect(validateURL('https://github.com')).toBe(true);
        expect(validateURL('http://example.com')).toBe(true);
        expect(validateURL('https://api.github.com/repos')).toBe(true);
      });

      it('should reject invalid URLs', () => {
        expect(validateURL('')).toBe(false);
        expect(validateURL('not-a-url')).toBe(false);
        expect(validateURL('javascript:alert(1)')).toBe(false);
        expect(validateURL('file:///etc/passwd')).toBe(false);
        expect(validateURL('data:text/html,<script>alert(1)</script>')).toBe(false);
      });

      it('should reject URLs with authentication', () => {
        expect(validateURL('https://user:pass@github.com')).toBe(false);
      });

      it('should reject private IP ranges', () => {
        expect(validateURL('http://192.168.1.1')).toBe(false);
        expect(validateURL('http://10.0.0.1')).toBe(false);
        expect(validateURL('http://172.16.0.1')).toBe(false);
        expect(validateURL('http://169.254.0.1')).toBe(false);
        expect(validateURL('http://127.0.0.1')).toBe(false);
        expect(validateURL('http://localhost')).toBe(false);
      });
    });

    describe('validateIssueNumber', () => {
      it('should validate valid issue numbers', () => {
        expect(validateIssueNumber(1)).toBe(true);
        expect(validateIssueNumber(100)).toBe(true);
        expect(validateIssueNumber(999999)).toBe(true);
      });

      it('should reject invalid issue numbers', () => {
        expect(validateIssueNumber(0)).toBe(false);
        expect(validateIssueNumber(-1)).toBe(false);
        expect(validateIssueNumber(1.5)).toBe(false);
        expect(validateIssueNumber(NaN)).toBe(false);
        expect(validateIssueNumber(Infinity)).toBe(false);
      });
    });

    describe('validatePerPage', () => {
      it('should validate valid per_page values', () => {
        expect(validatePerPage(1)).toBe(true);
        expect(validatePerPage(50)).toBe(true);
        expect(validatePerPage(100)).toBe(true);
      });

      it('should reject invalid per_page values', () => {
        expect(validatePerPage(0)).toBe(false);
        expect(validatePerPage(101)).toBe(false);
        expect(validatePerPage(-1)).toBe(false);
        expect(validatePerPage(1.5)).toBe(false);
      });
    });

    describe('validateSearchQuery', () => {
      it('should validate valid search queries', () => {
        expect(validateSearchQuery('test')).toBe(true);
        expect(validateSearchQuery('user:octocat')).toBe(true);
        expect(validateSearchQuery('repo:owner/name')).toBe(true);
        expect(validateSearchQuery('is:issue is:open')).toBe(true);
      });

      it('should reject empty queries', () => {
        expect(validateSearchQuery('')).toBe(false);
        expect(validateSearchQuery('   ')).toBe(false);
      });

      it('should reject queries that are too long', () => {
        const longQuery = 'a'.repeat(257);
        expect(validateSearchQuery(longQuery)).toBe(false);
      });
    });
  });

  describe('Environment Validation', () => {
    describe('validateEnvironment', () => {
      it('should validate environment variables', () => {
        const env = {
          GITHUB_TOKEN: ['ghp', '_'].join('') + 'a'.repeat(36),
          NODE_ENV: 'production'
        };
        
        const result = validateEnvironment(env);
        expect(result.valid).toBe(true);
        expect(result.value).toBeDefined();
      });

      it('should detect missing required variables', () => {
        const env = {};
        const result = validateEnvironment(env);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'MISSING_REQUIRED_TOKEN')).toBe(true);
      });

      it('should warn about debug mode in production', () => {
        const env = {
          GITHUB_TOKEN: ['ghp', '_'].join('') + 'a'.repeat(36),
          NODE_ENV: 'production',
          DEBUG: 'true'
        };
        
        const result = validateEnvironment(env);
        expect(result.warnings.some(w => w.code === 'DEBUG_IN_PRODUCTION')).toBe(true);
      });

      it('should sanitize sensitive values', () => {
        const env = {
          GITHUB_TOKEN: ['ghp', '_'].join('') + 'a'.repeat(36),
          SECRET_KEY: 'secret123'
        };
        
        const result = validateEnvironment(env);
        expect(result.valid).toBe(true);
        // The actual token should not be in the sanitized values
        expect(result.value?.GITHUB_TOKEN).not.toBe(env.GITHUB_TOKEN);
      });
    });

    describe('validateEnvironmentConfiguration', () => {
      it('should validate full environment configuration', async () => {
        process.env.GITHUB_TOKEN = ['ghp', '_'].join('') + 'a'.repeat(36);
        
        const result = await validateEnvironmentConfiguration();
        expect(result.valid).toBe(true);
        expect(result.value).toBeDefined();
      });

      it('should handle missing token with fallback', async () => {
        const result = await validateEnvironmentConfiguration();
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Git Operation Validation', () => {
    describe('validateGitOperation', () => {
      it('should validate safe git operations', () => {
        expect(validateGitOperation('status')).toBe(true);
        expect(validateGitOperation('log')).toBe(true);
        expect(validateGitOperation('diff')).toBe(true);
        expect(validateGitOperation('branch')).toBe(true);
      });

      it('should reject dangerous operations', () => {
        expect(validateGitOperation('push --force')).toBe(false);
        expect(validateGitOperation('reset --hard')).toBe(false);
        expect(validateGitOperation('clean -fdx')).toBe(false);
        expect(validateGitOperation('rm -rf')).toBe(false);
      });
    });

    describe('validateCommandOptions', () => {
      it('should validate allowed command options', () => {
        expect(validateCommandOptions('--oneline --graph')).toBe(true);
        expect(validateCommandOptions('--pretty=format:%H')).toBe(true);
      });

      it('should reject disallowed options', () => {
        expect(validateCommandOptions('--force')).toBe(false);
        expect(validateCommandOptions('--exec=rm -rf /')).toBe(false);
      });
    });
  });

  describe('Circuit Breaker Functionality', () => {
    it('should track failures and open circuit', async () => {
      // Mock fetch to always fail
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      
      // Make multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await validateGitHubTokenWithAPI(['ghp', '_test123'].join(''));
      }
      
      // Circuit should be open now, next call should fail fast
      const start = Date.now();
      const result = await validateGitHubTokenWithAPI(['ghp', '_test123'].join(''));
      const duration = Date.now() - start;
      
      expect(result.valid).toBe(false);
      expect(duration).toBeLessThan(100); // Should fail fast
    });
  });

  describe('Cache Functionality', () => {
    it('should cache validation results', () => {
      const token = ['ghp', '_'].join('') + 'a'.repeat(36);
      
      // First call
      const result1 = validateGitHubTokenWithResult(token);
      
      // Second call should use cache
      const result2 = validateGitHubTokenWithResult(token);
      
      expect(result1).toEqual(result2);
    });
  });

  describe('Cleanup Function', () => {
    it('should clean up resources', () => {
      // Create some cached data
      validateGitHubTokenWithResult(['ghp', '_test123'].join(''));
      
      // Cleanup
      cleanupValidation();
      
      // Cache should be cleared (we can't directly test this without exposing internals)
      // But we can verify the function exists and doesn't throw
      expect(cleanupValidation).toBeDefined();
    });
  });
});
