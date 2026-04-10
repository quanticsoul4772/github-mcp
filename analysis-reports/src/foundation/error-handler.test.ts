/**
 * Tests for ErrorHandler
 */
import { describe, it, expect } from 'vitest';
import { ErrorHandler, withErrorHandling } from './error-handler.js';
import { ValidationError } from '../validation.js';

describe('ErrorHandler', () => {

  describe('handleGitHubError', () => {
    it('should rethrow ValidationError as-is', () => {
      const valErr = new ValidationError('field', 'bad value');
      expect(() => ErrorHandler.handleGitHubError(valErr, 'ctx')).toThrow(ValidationError);
    });

    it('should throw "Resource not found" for 404', () => {
      const error = { status: 404, message: 'Not Found' };
      expect(() => ErrorHandler.handleGitHubError(error, 'GetIssue')).toThrow('Resource not found');
    });

    it('should throw "Access forbidden" for 403', () => {
      const error = { status: 403, message: 'Forbidden' };
      expect(() => ErrorHandler.handleGitHubError(error, 'ctx')).toThrow('Access forbidden');
    });

    it('should throw "Authentication failed" for 401', () => {
      const error = { status: 401, message: 'Unauthorized' };
      expect(() => ErrorHandler.handleGitHubError(error, 'ctx')).toThrow('Authentication failed');
    });

    it('should format 422 with validation message', () => {
      const error = {
        status: 422,
        response: { data: { message: 'Validation Failed', errors: [{ message: 'title is required' }] } },
      };
      expect(() => ErrorHandler.handleGitHubError(error, 'ctx')).toThrow('Validation Failed: title is required');
    });

    it('should format 422 without detailed errors', () => {
      const error = { status: 422, response: { data: { message: 'Unprocessable' } } };
      expect(() => ErrorHandler.handleGitHubError(error, 'ctx')).toThrow('Unprocessable');
    });

    it('should format generic status errors', () => {
      const error = { status: 500, message: 'Internal Server Error' };
      expect(() => ErrorHandler.handleGitHubError(error, 'ctx')).toThrow('GitHub API error (500)');
    });

    it('should use message as fallback for unknown errors', () => {
      const error = { message: 'something weird' };
      expect(() => ErrorHandler.handleGitHubError(error, 'ctx')).toThrow('something weird');
    });

    it('should use "Unknown error" when no message', () => {
      expect(() => ErrorHandler.handleGitHubError({}, 'ctx')).toThrow('Unknown error');
    });
  });

  describe('withErrorHandling', () => {
    it('should return result on success', async () => {
      const result = await ErrorHandler.withErrorHandling(async () => 42, 'ctx');
      expect(result).toBe(42);
    });

    it('should handle errors from the operation', async () => {
      const error = { status: 404 };
      await expect(
        ErrorHandler.withErrorHandling(async () => { throw error; }, 'ctx')
      ).rejects.toThrow('Resource not found');
    });
  });

  describe('createValidationError', () => {
    it('should create a ValidationError', () => {
      const err = ErrorHandler.createValidationError('owner', 'is required');
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.message).toContain('is required');
    });
  });

  describe('withErrorHandling decorator', () => {
    it('should pass through on success', async () => {
      // Apply the decorator manually (without @-syntax)
      const descriptor: PropertyDescriptor = {
        value: async () => 'done',
      };
      const decorated = withErrorHandling('test')({}, 'doWork', descriptor);
      const result = await decorated.value.call({});
      expect(result).toBe('done');
    });

    it('should convert GitHub errors via handleGitHubError', async () => {
      const descriptor: PropertyDescriptor = {
        value: async () => { throw { status: 404 }; },
      };
      const decorated = withErrorHandling('test')({}, 'doWork', descriptor);
      await expect(decorated.value.call({})).rejects.toThrow('Resource not found');
    });
  });
});
