import { describe, it, expect } from 'vitest';
import {
  validateRepoName,
  validateOwnerName,
  validateFilePath,
  validateRef,
  validateCommitSha,
  sanitizeText,
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

  describe('LegacyValidationError', () => {
    it('should create error with proper message', () => {
      const error = new LegacyValidationError('repo', 'Invalid repository name');
      expect(error.message).toBe('Validation failed for repo: Invalid repository name');
      expect(error.name).toBe('LegacyValidationError');
    });
  });
});