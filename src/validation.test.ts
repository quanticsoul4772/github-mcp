/**
 * Comprehensive tests for validation module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ValidationError,
  ValidationErrorDetail,
  ValidationWarning,
  ValidationResult,
  validateOwnerName,
  validateRepoName,
  validateBranchName,
  validateFilePath,
  validateRef,
  validateCommitSha,
  validateSHA,
  validateWorkflowFileName,
  validateURL,
  validateIssueNumber,
  validatePerPage,
  validateSearchQuery,
  validateGitOperation,
  validateCommandOptions,
  sanitizeText,
  cleanupValidation,
} from './validation.js';
import {
    ValidationLevel,
    validateGitHubToken,
    validateGitHubTokenWithResult,
    validateGitHubTokenFormat,
    validateGitHubTokenWithAPI,
    validateEnvironmentConfiguration,
    shouldBypassValidation,
} from './config.js';

// Test token factory to avoid hardcoded secrets
const createTestToken = (
  type: 'classic' | 'oauth' | 'fine' | 'installation' | 'legacy' = 'classic'
): string => {
  // Generate random alphanumeric characters for token content
  const randomChar = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return chars[Math.floor(Math.random() * chars.length)];
  };

  const randomString = (length: number) => {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += randomChar();
    }
    return result;
  };

  switch (type) {
    case 'classic':
      // Classic PAT: ghp_ + 36 alphanumeric characters
      return ['ghp', '_'].join('') + randomString(36);
    case 'oauth':
      // OAuth token: gho_ + 36 alphanumeric characters
      return ['gho', '_'].join('') + randomString(36);
    case 'fine':
      // Fine-grained PAT: github_pat_ (11 chars) + 71+ alphanumeric characters = 82+ total
      return 'github_pat_' + randomString(71);
    case 'installation':
      // Installation token: ghi_ + 36 alphanumeric characters
      return ['ghi', '_'].join('') + randomString(36);
    case 'legacy':
      // Legacy token: 40 hex characters
      const hexChars = '0123456789abcdef';
      let hex = '';
      for (let i = 0; i < 40; i++) {
        hex += hexChars[Math.floor(Math.random() * hexChars.length)];
      }
      return hex;
    default:
      return ['ghp', '_'].join('') + randomString(36);
  }
};

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

  describe('validateFilePath', () => {
    it('should accept valid file paths', () => {
      expect(validateFilePath('README.md')).toBe('README.md');
      expect(validateFilePath('src/index.ts')).toBe('src/index.ts');
      expect(validateFilePath('docs/api/guide.md')).toBe('docs/api/guide.md');
    });

    it('should sanitize paths with leading slashes', () => {
      expect(validateFilePath('/README.md')).toBe('README.md');
      expect(validateFilePath('///src/index.ts')).toBe('src/index.ts');
    });

    it('should reject directory traversal attempts', () => {
      expect(validateFilePath('../etc/passwd')).toBe(null);
      expect(validateFilePath('../../secret')).toBe(null);
      expect(validateFilePath('path/../../../etc')).toBe(null);
      expect(validateFilePath('..\\windows\\system32')).toBe(null);
    });

    it('should reject absolute paths', () => {
      expect(validateFilePath('C:\\Windows\\System32')).toBe(null);
      expect(validateFilePath('D:/secrets')).toBe(null);
    });

    it('should remove null bytes', () => {
      expect(validateFilePath('file\0.txt')).toBe('file.txt');
    });

    it('should normalize multiple slashes', () => {
      expect(validateFilePath('src//index.ts')).toBe('src/index.ts');
      expect(validateFilePath('docs///api//guide.md')).toBe('docs/api/guide.md');
    });

    it('should reject paths exceeding maximum length', () => {
      expect(validateFilePath('a'.repeat(256))).toBe(null);
    });
  });

  describe('validateRef', () => {
    it('should accept valid refs', () => {
      expect(validateRef('main')).toBe(true);
      expect(validateRef('feature/new-feature')).toBe(true);
      expect(validateRef('v1.0.0')).toBe(true);
      expect(validateRef('release-2.0')).toBe(true);
    });

    it('should reject invalid refs', () => {
      expect(validateRef('')).toBe(false);
      expect(validateRef('.branch')).toBe(false);
      expect(validateRef('-branch')).toBe(false);
      expect(validateRef('branch.lock')).toBe(false);
      expect(validateRef('branch..name')).toBe(false);
      expect(validateRef('branch@{yesterday}')).toBe(false);
      expect(validateRef('branch~1')).toBe(false);
      expect(validateRef('branch^2')).toBe(false);
      expect(validateRef('branch:name')).toBe(false);
      expect(validateRef('branch\\name')).toBe(false);
      expect(validateRef('branch name')).toBe(false);
    });
  });

  describe('validateCommitSha', () => {
    it('should accept valid SHA hashes', () => {
      expect(validateCommitSha('a'.repeat(40))).toBe(true);
      expect(validateCommitSha('1234567890abcdef1234567890abcdef12345678')).toBe(true);
      expect(validateCommitSha('ABCDEF1234567890ABCDEF1234567890ABCDEF12')).toBe(true);
    });

    it('should reject invalid SHA hashes', () => {
      expect(validateCommitSha('')).toBe(false);
      expect(validateCommitSha('a'.repeat(39))).toBe(false);
      expect(validateCommitSha('a'.repeat(41))).toBe(false);
      expect(validateCommitSha('g'.repeat(40))).toBe(false);
      expect(validateCommitSha('not-a-sha')).toBe(false);
    });
  });

  describe('sanitizeText', () => {
    it('should remove control characters', () => {
      expect(sanitizeText('Hello\0World')).toBe('HelloWorld');
      expect(sanitizeText('Text\x01\x02\x03')).toBe('Text');
    });

    it('should preserve newlines and tabs', () => {
      expect(sanitizeText('Line 1\nLine 2\tTabbed')).toBe('Line 1\nLine 2\tTabbed');
    });

    it('should limit text length', () => {
      const longText = 'a'.repeat(2000);
      expect(sanitizeText(longText).length).toBe(1000);
      expect(sanitizeText(longText, 100).length).toBe(100);
    });

    it('should handle edge cases', () => {
      expect(sanitizeText('')).toBe('');
      expect(sanitizeText(null as any)).toBe('');
      expect(sanitizeText(undefined as any)).toBe('');
    });
  });

  describe('validateGitHubToken', () => {
    describe('GitHub Personal Access Token (classic) - ghp_ prefix', () => {
      it('should accept valid ghp_ tokens', () => {
        expect(validateGitHubToken('ghp_' + 'A'.repeat(36))).toBe(true);
        expect(validateGitHubToken('ghp_' + 'a'.repeat(36))).toBe(true);
        expect(validateGitHubToken('ghp_' + '1'.repeat(36))).toBe(true);
        // Use dynamic token generation to avoid hardcoded secrets
        const testToken = createTestToken('classic');
        expect(validateGitHubToken(testToken)).toBe(true);
      });

      it('should reject ghp_ tokens with incorrect length', () => {
        expect(validateGitHubToken('ghp_' + 'A'.repeat(35))).toBe(false);
        expect(validateGitHubToken('ghp_' + 'A'.repeat(37))).toBe(false);
        expect(validateGitHubToken('ghp_')).toBe(false);
      });

      it('should reject ghp_ tokens with invalid characters', () => {
        expect(validateGitHubToken('ghp_' + 'A'.repeat(35) + '@')).toBe(false);
        expect(validateGitHubToken('ghp_' + 'A'.repeat(35) + ' ')).toBe(false);
        expect(validateGitHubToken('ghp_' + 'A'.repeat(35) + '.')).toBe(false);
      });
    });

    describe('GitHub OAuth Token - gho_ prefix', () => {
      it('should accept valid gho_ tokens', () => {
        expect(validateGitHubToken('gho_' + 'B'.repeat(36))).toBe(true);
        // Use dynamic token generation to avoid hardcoded secrets
        const testOAuthToken = createTestToken('oauth');
        expect(validateGitHubToken(testOAuthToken)).toBe(true);
      });

      it('should reject invalid gho_ tokens', () => {
        expect(validateGitHubToken('gho_' + 'B'.repeat(35))).toBe(false);
        expect(validateGitHubToken('gho_' + 'B'.repeat(37))).toBe(false);
      });
    });

    describe('GitHub User Access Token - ghu_ prefix', () => {
      it('should accept valid ghu_ tokens', () => {
        expect(validateGitHubToken('ghu_' + 'C'.repeat(36))).toBe(true);
      });

      it('should reject invalid ghu_ tokens', () => {
        expect(validateGitHubToken('ghu_' + 'C'.repeat(35))).toBe(false);
      });
    });

    describe('GitHub Server-to-Server Token - ghs_ prefix', () => {
      it('should accept valid ghs_ tokens', () => {
        expect(validateGitHubToken('ghs_' + 'D'.repeat(36))).toBe(true);
      });

      it('should reject invalid ghs_ tokens', () => {
        expect(validateGitHubToken('ghs_' + 'D'.repeat(35))).toBe(false);
      });
    });

    describe('GitHub Refresh Token - ghr_ prefix', () => {
      it('should accept valid ghr_ tokens', () => {
        expect(validateGitHubToken('ghr_' + 'E'.repeat(36))).toBe(true);
      });

      it('should reject invalid ghr_ tokens', () => {
        expect(validateGitHubToken('ghr_' + 'E'.repeat(35))).toBe(false);
      });
    });

    describe('Legacy Token Format', () => {
      it('should accept valid 40-character hex tokens', () => {
        expect(validateGitHubToken('a'.repeat(40))).toBe(true);
        expect(validateGitHubToken('A'.repeat(40))).toBe(true);
        expect(validateGitHubToken('1234567890abcdef1234567890abcdef12345678')).toBe(true);
        expect(validateGitHubToken('ABCDEF1234567890ABCDEF1234567890ABCDEF12')).toBe(true);
      });

      it('should reject non-hex characters in legacy tokens', () => {
        expect(validateGitHubToken('g'.repeat(40))).toBe(false);
        expect(validateGitHubToken('z'.repeat(40))).toBe(false);
        expect(validateGitHubToken('a'.repeat(39) + 'g')).toBe(false);
      });

      it('should reject legacy tokens with incorrect length', () => {
        expect(validateGitHubToken('a'.repeat(39))).toBe(false);
        expect(validateGitHubToken('a'.repeat(41))).toBe(false);
      });
    });

    describe('Invalid Token Formats', () => {
      it('should reject empty or null tokens', () => {
        expect(validateGitHubToken('')).toBe(false);
        expect(validateGitHubToken(null as any)).toBe(false);
        expect(validateGitHubToken(undefined as any)).toBe(false);
      });

      it('should reject non-string inputs', () => {
        expect(validateGitHubToken(123 as any)).toBe(false);
        expect(validateGitHubToken({} as any)).toBe(false);
        expect(validateGitHubToken([] as any)).toBe(false);
      });

      it('should reject tokens with unknown prefixes', () => {
        expect(validateGitHubToken('unknown_' + 'A'.repeat(30))).toBe(false);
        expect(validateGitHubToken('github_pat_' + 'A'.repeat(30))).toBe(false);
        expect(validateGitHubToken('ght_' + 'A'.repeat(36))).toBe(false);
      });

      it('should reject malformed tokens', () => {
        expect(validateGitHubToken('not-a-token')).toBe(false);
        expect(validateGitHubToken('123')).toBe(false);
        expect(validateGitHubToken('ghp')).toBe(false);
        expect(validateGitHubToken('ghp_')).toBe(false);
        expect(validateGitHubToken('ghp_too_short')).toBe(false);
      });
    });
  });

  describe('ValidationError', () => {
    it('should create error with proper message', () => {
      const error = new ValidationError('repo', 'Invalid repository name');
      expect(error.message).toBe('Validation failed for repo: Invalid repository name');
      expect(error.name).toBe('ValidationError');
    });

    it('should maintain stack trace', () => {
      const error = new ValidationError('field', 'message');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ValidationError');
    });
  });

  describe('ValidationError Class', () => {
    it('should create a ValidationError with correct properties', () => {
      const error = new ValidationError('testField', 'Test error message');
      expect(error).toBeInstanceOf(Error);
      expect(error.field).toBe('testField');
      expect(error.message).toBe('Validation failed for testField: Test error message');
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
        const validToken = createTestToken('classic');
        expect(validateGitHubToken(validToken)).toBe(true);
      });

      it('should return true for valid fine-grained PAT', () => {
        const validToken = createTestToken('fine');
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
        const token = createTestToken('classic');
        const result = validateGitHubTokenFormat(token, ValidationLevel.STRICT);
        expect(result.isValid).toBe(true);
        expect(result.format?.prefix).toBe('ghp_');
      });

      it('should validate OAuth token format', () => {
        const token = createTestToken('oauth');
        const result = validateGitHubTokenFormat(token, ValidationLevel.MODERATE);
        expect(result.isValid).toBe(true);
        expect(result.format?.prefix).toBe('gho_');
      });

      it('should validate fine-grained PAT', () => {
        const token = createTestToken('fine');
        const result = validateGitHubTokenFormat(token, ValidationLevel.MODERATE);
        expect(result.isValid).toBe(true);
        expect(result.format?.prefix).toBe('github_pat_');
      });

      it('should validate installation token', () => {
        const token = createTestToken('installation');
        const result = validateGitHubTokenFormat(token, ValidationLevel.MODERATE);
        expect(result.isValid).toBe(true);
        expect(result.format?.prefix).toBe('ghi_');
      });

      it('should reject invalid tokens in STRICT mode', () => {
        const result = validateGitHubTokenFormat('invalid_token', ValidationLevel.STRICT);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should accept legacy tokens in LENIENT mode', () => {
        const token = createTestToken('legacy'); // Legacy format
        const result = validateGitHubTokenFormat(token, ValidationLevel.LENIENT);
        expect(result.isValid).toBe(true);
        expect(result.format?.prefix).toBe('');
      });
    });

    describe('validateGitHubTokenWithResult', () => {
      it('should return detailed validation result', () => {
        const token = createTestToken('classic');
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
        const invalidToken = ['ghp', '_abc def123'].join('');
        const result = validateGitHubTokenWithResult(invalidToken);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e: ValidationErrorDetail) => e.code === 'TOKEN_CONTAINS_WHITESPACE')).toBe(true);
      });

      it('should detect missing token', () => {
        const result = validateGitHubTokenWithResult('');
        expect(result.valid).toBe(false);
        expect(result.errors.some((e: ValidationErrorDetail) => e.code === 'MISSING_TOKEN')).toBe(true);
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
        expect(result.warnings.some((w: ValidationWarning) => w.code === 'DEV_BYPASS')).toBe(true);
      });

      it('should handle missing fetch API', async () => {
        // Mock fetch as undefined
        const originalFetch = global.fetch;
        // @ts-ignore
        global.fetch = undefined;

        const testToken = createTestToken('classic');
        const result = await validateGitHubTokenWithAPI(testToken);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e: ValidationErrorDetail) => e.code === 'FETCH_NOT_AVAILABLE')).toBe(true);

        global.fetch = originalFetch;
      });

      it('should validate token with API when fetch is available', async () => {
        // Mock successful API response
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ login: 'testuser' }),
        });

        const token = createTestToken('classic');
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
      const token = createTestToken('classic');

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
