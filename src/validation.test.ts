import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateRepoName,
  validateOwnerName,
  validateFilePath,
  validateRef,
  validateCommitSha,
  sanitizeText,
  validateGitHubToken,
  validateEnvironmentConfiguration,
  ValidationError,
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

  describe('validateGitHubToken', () => {
    describe('GitHub Personal Access Token (classic) - ghp_ prefix', () => {
      it('should accept valid ghp_ tokens', () => {
        expect(validateGitHubToken('ghp_' + 'A'.repeat(36))).toBe(true);
        expect(validateGitHubToken('ghp_' + 'a'.repeat(36))).toBe(true);
        expect(validateGitHubToken('ghp_' + '1'.repeat(36))).toBe(true);
        expect(validateGitHubToken('ghp_AbCdEf1234567890aBcDeF1234567890AbCd')).toBe(true);
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
        expect(validateGitHubToken('gho_1234567890abcdef1234567890abcdef1234')).toBe(true);
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

  describe('validateEnvironmentConfiguration', () => {
    let originalEnv: Record<string, string | undefined>;

    beforeEach(() => {
      originalEnv = { ...process.env };
      // Clear auth-related env vars
      delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      delete process.env.GITHUB_TOKEN;
      delete process.env.GITHUB_HOST;
      delete process.env.GITHUB_READ_ONLY;
      delete process.env.GITHUB_TOOLSETS;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    describe('Required Token Validation', () => {
      it('should validate with GITHUB_PERSONAL_ACCESS_TOKEN', () => {
        process.env.GITHUB_PERSONAL_ACCESS_TOKEN = 'ghp_' + 'A'.repeat(36);
        
        const result = validateEnvironmentConfiguration();
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.sanitizedValues.GITHUB_TOKEN).toBe(process.env.GITHUB_PERSONAL_ACCESS_TOKEN);
      });

      it('should validate with GITHUB_TOKEN', () => {
        process.env.GITHUB_TOKEN = 'gho_' + 'B'.repeat(36);
        
        const result = validateEnvironmentConfiguration();
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.sanitizedValues.GITHUB_TOKEN).toBe(process.env.GITHUB_TOKEN);
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

      it('should fail when no token is provided', () => {
        const result = validateEnvironmentConfiguration();
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_TOKEN is required');
      });

      it('should fail with invalid token format', () => {
        process.env.GITHUB_TOKEN = 'invalid-token-format';
        
        const result = validateEnvironmentConfiguration();
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid GitHub token format');
      });
    });

    describe('Optional Environment Variables', () => {
      beforeEach(() => {
        process.env.GITHUB_TOKEN = 'ghp_' + 'A'.repeat(36);
      });

      it('should validate GITHUB_READ_ONLY values', () => {
        const validValues = ['1', 'true', 'false', '0'];
        
        for (const value of validValues) {
          process.env.GITHUB_READ_ONLY = value;
          const result = validateEnvironmentConfiguration();
          expect(result.isValid).toBe(true);
          expect(result.sanitizedValues.GITHUB_READ_ONLY).toBe(value);
        }
      });

      it('should reject invalid GITHUB_READ_ONLY values', () => {
        process.env.GITHUB_READ_ONLY = 'maybe';
        
        const result = validateEnvironmentConfiguration();
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid format for GITHUB_READ_ONLY');
      });

      it('should validate GITHUB_TOOLSETS', () => {
        process.env.GITHUB_TOOLSETS = 'repos,issues,pull_requests';
        
        const result = validateEnvironmentConfiguration();
        
        expect(result.isValid).toBe(true);
        expect(result.sanitizedValues.GITHUB_TOOLSETS).toBe('repos,issues,pull_requests');
      });

      it('should accept "all" for GITHUB_TOOLSETS', () => {
        process.env.GITHUB_TOOLSETS = 'all';
        
        const result = validateEnvironmentConfiguration();
        
        expect(result.isValid).toBe(true);
        expect(result.sanitizedValues.GITHUB_TOOLSETS).toBe('all');
      });

      it('should reject invalid toolset names', () => {
        process.env.GITHUB_TOOLSETS = 'invalid_toolset,repos';
        
        const result = validateEnvironmentConfiguration();
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid format for GITHUB_TOOLSETS');
      });

      it('should validate GITHUB_HOST URLs', () => {
        process.env.GITHUB_HOST = 'https://github.enterprise.com/api/v3';
        
        const result = validateEnvironmentConfiguration();
        
        expect(result.isValid).toBe(true);
        expect(result.sanitizedValues.GITHUB_HOST).toBe('https://github.enterprise.com/api/v3');
      });

      it('should reject non-HTTPS URLs', () => {
        process.env.GITHUB_HOST = 'http://github.com/api/v3';
        
        const result = validateEnvironmentConfiguration();
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid format for GITHUB_HOST');
      });

      it('should reject localhost URLs', () => {
        process.env.GITHUB_HOST = 'https://localhost:3000/api/v3';
        
        const result = validateEnvironmentConfiguration();
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid format for GITHUB_HOST');
      });
    });

    describe('Security Sanitization', () => {
      it('should remove control characters from tokens', () => {
        const tokenWithControlChars = 'ghp_' + 'A'.repeat(35) + '\x00';
        process.env.GITHUB_TOKEN = tokenWithControlChars + 'B';
        
        const result = validateEnvironmentConfiguration();
        
        expect(result.isValid).toBe(true);
        expect(result.sanitizedValues.GITHUB_TOKEN).toBe('ghp_' + 'A'.repeat(35) + 'B');
        expect(result.sanitizedValues.GITHUB_TOKEN).not.toContain('\x00');
      });

      it('should prevent injection attacks in environment variables', () => {
        process.env.GITHUB_TOKEN = 'ghp_' + 'A'.repeat(36);
        process.env.GITHUB_TOOLSETS = 'repos$(cat /etc/passwd)';
        
        const result = validateEnvironmentConfiguration();
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid format for GITHUB_TOOLSETS');
      });

      it('should handle multiple validation errors', () => {
        process.env.GITHUB_TOKEN = 'invalid-token';
        process.env.GITHUB_READ_ONLY = 'invalid-value';
        process.env.GITHUB_HOST = 'http://localhost';
        
        const result = validateEnvironmentConfiguration();
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(3);
        expect(result.errors).toContain('Invalid GitHub token format');
        expect(result.errors).toContain('Invalid format for GITHUB_READ_ONLY');
        expect(result.errors).toContain('Invalid format for GITHUB_HOST');
      });
    });
  });

  describe('ValidationError', () => {
    it('should create error with proper message', () => {
      const error = new ValidationError('repo', 'Invalid repository name');
      expect(error.message).toBe('Validation failed for repo: Invalid repository name');
      expect(error.name).toBe('ValidationError');
    });
  });
});