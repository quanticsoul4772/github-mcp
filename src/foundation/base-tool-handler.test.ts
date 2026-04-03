/**
 * Tests for BaseToolHandler
 */
import { describe, it, expect } from 'vitest';
import { BaseToolHandler } from './base-tool-handler.js';
import { ValidationError } from '../validation.js';

// Concrete implementation for testing
class TestHandler extends BaseToolHandler<{ value: number }, string> {
  protected validateInput(params: { value: number }): void {
    this.validateParams(params, p => p.value >= 0, 'value must be non-negative');
  }

  protected async executeOperation(params: { value: number }): Promise<string> {
    return `result-${params.value}`;
  }
}

function makeOctokit() {
  return {} as any;
}

describe('BaseToolHandler', () => {
  let handler: TestHandler;

  beforeEach(() => {
    handler = new TestHandler(makeOctokit());
  });

  // ============================================================================
  // handle (template method)
  // ============================================================================

  describe('handle', () => {
    it('should validate and execute operation', async () => {
      const result = await handler.handle({ value: 5 });
      expect(result).toBe('result-5');
    });

    it('should throw ValidationError on invalid input', async () => {
      await expect(handler.handle({ value: -1 })).rejects.toThrow(ValidationError);
    });
  });

  // ============================================================================
  // executeWithErrorHandling
  // ============================================================================

  describe('executeWithErrorHandling', () => {
    it('should return result on success', async () => {
      const result = await (handler as any).executeWithErrorHandling(
        async () => 'ok',
        'TestOp'
      );
      expect(result).toBe('ok');
    });

    it('should re-throw ValidationError unchanged', async () => {
      const ve = new ValidationError('field', 'bad value');
      await expect(
        (handler as any).executeWithErrorHandling(() => { throw ve; }, 'ctx')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw 404 resource not found', async () => {
      const err = { status: 404, message: 'Not Found' };
      await expect(
        (handler as any).executeWithErrorHandling(() => { throw err; }, 'TestOp')
      ).rejects.toThrow('Resource not found');
    });

    it('should throw 403 access forbidden', async () => {
      const err = { status: 403, message: 'Forbidden' };
      await expect(
        (handler as any).executeWithErrorHandling(() => { throw err; }, 'TestOp')
      ).rejects.toThrow('Access forbidden');
    });

    it('should throw 401 authentication failed', async () => {
      const err = { status: 401, message: 'Unauthorized' };
      await expect(
        (handler as any).executeWithErrorHandling(() => { throw err; }, 'TestOp')
      ).rejects.toThrow('Authentication failed');
    });

    it('should throw GitHub API error for other status codes', async () => {
      const err = { status: 422, message: 'Unprocessable Entity' };
      await expect(
        (handler as any).executeWithErrorHandling(() => { throw err; }, 'TestOp')
      ).rejects.toThrow('GitHub API error (422)');
    });

    it('should throw generic error when no status', async () => {
      const err = new Error('something broke');
      await expect(
        (handler as any).executeWithErrorHandling(() => { throw err; }, 'TestOp')
      ).rejects.toThrow('something broke');
    });

    it('should throw Unknown error when no message', async () => {
      const err = { noMessage: true };
      await expect(
        (handler as any).executeWithErrorHandling(() => { throw err; }, 'ctx')
      ).rejects.toThrow('Unknown error');
    });
  });
});

// Need to import beforeEach
import { beforeEach } from 'vitest';
