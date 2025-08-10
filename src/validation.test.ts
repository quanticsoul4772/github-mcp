import { describe, it, expect } from 'vitest';
import {
  validateRepoName,
  validateOwnerName,
  validateFilePath,
  validateRef,
  validateCommitSha,
  sanitizeText,
  validateGitHubToken,
  validateGitHubTokenFormat,
  ValidationLevel,
  ValidationError,
  LegacyValidationError,
} from './validation.js';

describe('Validation Module', () => {
  describe('validateRepoName', () => {
    it('should accept valid repository names', () => {
      expect(validateRepoName('my-repo')).toBe(true);
      expect(validateRepoName('my_repo')).toBe(true);
      expect(validateRepoName('my.repo')).toBe(true);
      expect(validateRepoName('MyRepo123')).toBe(true);
    });

    it('should reject invalid repository names', () => {
      expect(validateRepoName('')).toBe(false);
      expect(validateRepoName('.repo')).toBe(false);
      expect(validateRepoName('repo.')).toBe(false);
      expect(validateRepoName('repo..name')).toBe(false);
      expect(validateRepoName('a'.repeat(101))).toBe(false);
      expect(validateRepoName('repo/name')).toBe(false);
      expect(validateRepoName('repo name')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(validateRepoName(null as any)).toBe(false);
      expect(validateRepoName(undefined as any)).toBe(false);
      expect(validateRepoName(123 as any)).toBe(false);
    });
  });

  describe('validateOwnerName', () => {
    it('should accept valid owner names', () => {
      expect(validateOwnerName('github')).toBe(true);
      expect(validateOwnerName('my-org')).toBe(true);
      expect(validateOwnerName('User123')).toBe(true);
    });

    it('should reject invalid owner names', () => {
      expect(validateOwnerName('')).toBe(false);
      expect(validateOwnerName('-user')).toBe(false);
      expect(validateOwnerName('user-')).toBe(false);
      expect(validateOwnerName('user--name')).toBe(false);
      expect(validateOwnerName('a'.repeat(40))).toBe(false);
      expect(validateOwnerName('user_name')).toBe(false);
      expect(validateOwnerName('user.name')).toBe(false);
    });
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

  describe('validateGitHubToken (legacy)', () => {
    it('should accept valid GitHub tokens (classic PAT)', () => {
      expect(validateGitHubToken('ghp_1234567890123456789012345678901234567890')).toBe(true);
    });

    it('should accept valid GitHub tokens (fine-grained PAT)', () => {
      expect(validateGitHubToken('github_pat_11ABCDEFG0123456789012_abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOP')).toBe(true);
    });

    it('should accept valid OAuth tokens', () => {
      expect(validateGitHubToken('gho_1234567890123456789012345678901234567890')).toBe(true);
    });

    it('should accept valid installation tokens', () => {
      expect(validateGitHubToken('ghi_1234567890123456789012345678901234567890')).toBe(true);
    });

    it('should accept legacy 40-character hex tokens', () => {
      expect(validateGitHubToken('1234567890abcdef1234567890abcdef12345678')).toBe(true);
    });

    it('should reject invalid tokens', () => {
      expect(validateGitHubToken('')).toBe(false);
      expect(validateGitHubToken('invalid-token')).toBe(false);
      expect(validateGitHubToken('ghp_123')).toBe(false); // too short
      expect(validateGitHubToken('unknown_prefix_token')).toBe(false);
    });
  });

  describe('validateGitHubTokenFormat', () => {
    describe('MODERATE validation (default)', () => {
      it('should accept valid classic PAT tokens', () => {
        const result = validateGitHubTokenFormat('ghp_' + 'a'.repeat(36));
        expect(result.isValid).toBe(true);
        expect(result.format?.description).toBe('GitHub Personal Access Token (classic)');
      });

      it('should accept valid fine-grained PAT tokens', () => {
        // Fine-grained tokens have github_pat_ prefix and are minimum 82 characters total
        const token = 'github_pat_' + 'A'.repeat(71); // 12 + 71 = 83 characters
        const result = validateGitHubTokenFormat(token);
        expect(result.isValid).toBe(true);
        expect(result.format?.description).toBe('GitHub Fine-grained Personal Access Token');
      });

      it('should accept tokens with length variations', () => {
        // Test minimum length
        const shortResult = validateGitHubTokenFormat('ghp_' + 'a'.repeat(36));
        expect(shortResult.isValid).toBe(true);

        // Test longer than minimum
        const longResult = validateGitHubTokenFormat('ghp_' + 'a'.repeat(100));
        expect(longResult.isValid).toBe(true);
      });

      it('should reject tokens that are too short', () => {
        const result = validateGitHubTokenFormat('ghp_123');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('must be between');
      });

      it('should reject tokens that are too long', () => {
        const result = validateGitHubTokenFormat('ghp_' + 'a'.repeat(300));
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('must be between');
      });

      it('should reject unrecognized token formats', () => {
        // Use a token that won't match legacy format (non-hex characters)
        const result = validateGitHubTokenFormat('unknown_prefix_with_invalid_chars!@#');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Unrecognized token format');
      });
    });

    describe('STRICT validation', () => {
      it('should enforce exact pattern matching', () => {
        // Valid pattern
        const validResult = validateGitHubTokenFormat('ghp_' + 'A'.repeat(36), ValidationLevel.STRICT);
        expect(validResult.isValid).toBe(true);

        // Invalid characters
        const invalidResult = validateGitHubTokenFormat('ghp_' + 'A'.repeat(35) + '!', ValidationLevel.STRICT);
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.error).toContain('invalid character pattern');
      });

      it('should validate legacy tokens strictly', () => {
        const validLegacy = validateGitHubTokenFormat('1234567890abcdef1234567890abcdef12345678', ValidationLevel.STRICT);
        expect(validLegacy.isValid).toBe(true);

        const invalidLegacy = validateGitHubTokenFormat('1234567890abcdef1234567890abcdef1234567g', ValidationLevel.STRICT);
        expect(invalidLegacy.isValid).toBe(false);
      });
    });

    describe('LENIENT validation', () => {
      it('should accept any non-empty token', () => {
        expect(validateGitHubTokenFormat('any_token_format', ValidationLevel.LENIENT).isValid).toBe(true);
        expect(validateGitHubTokenFormat('123', ValidationLevel.LENIENT).isValid).toBe(true);
        expect(validateGitHubTokenFormat('!@#$%^&*()', ValidationLevel.LENIENT).isValid).toBe(true);
      });

      it('should reject empty tokens', () => {
        expect(validateGitHubTokenFormat('', ValidationLevel.LENIENT).isValid).toBe(false);
        expect(validateGitHubTokenFormat('   ', ValidationLevel.LENIENT).isValid).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      expect(validateGitHubTokenFormat(null as any).isValid).toBe(false);
      expect(validateGitHubTokenFormat(undefined as any).isValid).toBe(false);
      expect(validateGitHubTokenFormat(123 as any).isValid).toBe(false);
    });
  });

  describe('LegacyValidationError', () => {
    it('should create error with proper message', () => {
      const error = new LegacyValidationError('repo', 'Invalid repository name');
      expect(error.message).toBe('Validation failed for repo: Invalid repository name');
      expect(error.name).toBe('LegacyValidationError');
    });
  });
});