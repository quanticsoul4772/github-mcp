/**
 * Tests for validation-utils: createSuccessResult, createErrorResult,
 * createValidationError, createValidationWarning, withRetry
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createSuccessResult,
  createErrorResult,
  createValidationError,
  createValidationWarning,
  withRetry,
  DEFAULT_RETRY_CONFIG,
} from './validation-utils.js';

describe('validation-utils', () => {
  // ============================================================================
  // createSuccessResult
  // ============================================================================

  describe('createSuccessResult', () => {
    it('should return isValid=true with data', () => {
      const result = createSuccessResult({ id: 1 });
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({ id: 1 });
      expect(result.errors).toHaveLength(0);
    });

    it('should include warnings and suggestions when provided', () => {
      const warnings = [{ field: 'f', message: 'm', code: 'c' }];
      const suggestions = ['try this'];
      const result = createSuccessResult('data', warnings, suggestions);
      expect(result.warnings).toEqual(warnings);
      expect(result.suggestions).toEqual(suggestions);
    });

    it('should default to empty warnings and suggestions', () => {
      const result = createSuccessResult(42);
      expect(result.warnings).toEqual([]);
      expect(result.suggestions).toEqual([]);
    });
  });

  // ============================================================================
  // createErrorResult
  // ============================================================================

  describe('createErrorResult', () => {
    it('should return isValid=false with errors', () => {
      const errors = [{ field: 'token', message: 'required', code: 'MISSING' }];
      const result = createErrorResult(errors);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(errors);
      expect(result.data).toBeUndefined();
    });

    it('should include warnings and suggestions when provided', () => {
      const warnings = [{ field: 'f', message: 'm', code: 'c' }];
      const result = createErrorResult<string>([], warnings, ['suggestion']);
      expect(result.warnings).toEqual(warnings);
      expect(result.suggestions).toEqual(['suggestion']);
    });
  });

  // ============================================================================
  // createValidationError
  // ============================================================================

  describe('createValidationError', () => {
    it('should create error with required fields', () => {
      const err = createValidationError('field', 'message', 'CODE');
      expect(err.field).toBe('field');
      expect(err.message).toBe('message');
      expect(err.code).toBe('CODE');
    });

    it('should include value and context when provided', () => {
      const err = createValidationError('f', 'm', 'C', 'bad-value', { extra: 'info' });
      expect(err.value).toBe('bad-value');
      expect(err.context).toEqual({ extra: 'info' });
    });
  });

  // ============================================================================
  // createValidationWarning
  // ============================================================================

  describe('createValidationWarning', () => {
    it('should create warning with required fields', () => {
      const w = createValidationWarning('field', 'message', 'WARN_CODE');
      expect(w.field).toBe('field');
      expect(w.message).toBe('message');
      expect(w.code).toBe('WARN_CODE');
    });

    it('should include value and suggestion when provided', () => {
      const w = createValidationWarning('f', 'm', 'C', 'val', 'do this instead');
      expect(w.value).toBe('val');
      expect(w.suggestion).toBe('do this instead');
    });
  });

  // ============================================================================
  // DEFAULT_RETRY_CONFIG
  // ============================================================================

  it('DEFAULT_RETRY_CONFIG should have expected defaults', () => {
    expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBe(3);
    expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBe(1000);
    expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(5000);
    expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
  });

  // ============================================================================
  // withRetry
  // ============================================================================

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 2 });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed on second attempt', async () => {
      vi.useFakeTimers();
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('first fail'))
        .mockResolvedValueOnce('second ok');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2 }, 'test');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('second ok');
      expect(fn).toHaveBeenCalledTimes(2);
      warn.mockRestore();
      vi.useRealTimers();
    });

    it('should throw last error after all retries exhausted', async () => {
      vi.useFakeTimers();
      const error = new Error('always fail');
      const fn = vi.fn().mockRejectedValue(error);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2 });
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow('always fail');

      expect(fn).toHaveBeenCalledTimes(3);
      warn.mockRestore();
      vi.useRealTimers();
    });

    it('should cap delay at maxDelayMs', async () => {
      vi.useFakeTimers();
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('ok');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // backoffMultiplier=100 would compute 10000ms but maxDelayMs=50 caps it
      const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 50, backoffMultiplier: 100 });
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result).toBe('ok');
      warn.mockRestore();
      vi.useRealTimers();
    });

    it('should use DEFAULT_RETRY_CONFIG when no config provided', async () => {
      vi.useFakeTimers();
      const fn = vi.fn().mockRejectedValue(new Error('always fail'));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const promise = withRetry(fn);
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow('always fail');
      expect(fn).toHaveBeenCalledTimes(DEFAULT_RETRY_CONFIG.maxAttempts);
      warn.mockRestore();
      vi.useRealTimers();
    });
  });
});
