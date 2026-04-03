/**
 * Tests for reliability utilities: CircuitBreaker, RetryManager
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CircuitBreaker,
  RetryManager,
  DEFAULT_RETRY_CONFIG,
  NoOpTelemetry,
  ReliabilityManager,
  CorrelationManager,
} from './reliability.js';
import { GitHubMCPError } from './errors.js';

describe('reliability', () => {

  // ============================================================================
  // NoOpTelemetry
  // ============================================================================

  describe('NoOpTelemetry', () => {
    it('should have methods that do nothing', () => {
      const t = new NoOpTelemetry();
      expect(() => (t as any).trackRequest('op', 100, true)).not.toThrow();
      expect(() => (t as any).trackError(new Error('x'), {})).not.toThrow();
      expect(() => (t as any).trackRetry('op', 1, new Error('x'))).not.toThrow();
      expect(() => (t as any).trackCircuitBreakerState('op', 'open')).not.toThrow();
    });
  });

  // ============================================================================
  // CircuitBreaker
  // ============================================================================

  describe('CircuitBreaker', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
      breaker = new CircuitBreaker('test-op', {
        failureThreshold: 3,
        resetTimeout: 1000,
      });
    });

    it('should execute successfully and return result', async () => {
      const result = await breaker.execute(async () => 'ok');
      expect(result).toBe('ok');
    });

    it('should start in closed state', () => {
      expect(breaker.getState()).toBe('closed');
    });

    it('should open after failureThreshold failures', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      }
      expect(breaker.getState()).toBe('open');
    });

    it('should throw CIRCUIT_BREAKER_OPEN when open', async () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      }
      // Next call should throw circuit breaker error
      await expect(breaker.execute(async () => 'should not run')).rejects.toThrow(
        'Circuit breaker is open'
      );
    });

    it('should close after successful half-open call', async () => {
      // Record the fail time before tripping
      const _originalNow = Date.now;
      let mockTime = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => mockTime);

      const shortBreaker = new CircuitBreaker('op', { failureThreshold: 1, resetTimeout: 100 });
      await expect(shortBreaker.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      // Advance fake time past resetTimeout
      mockTime += 200;
      await shortBreaker.execute(async () => 'ok');
      expect(shortBreaker.getState()).toBe('closed');

      vi.restoreAllMocks();
    });

    it('should reopen on failure in half-open state', async () => {
      let mockTime = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => mockTime);

      const shortBreaker = new CircuitBreaker('op', { failureThreshold: 1, resetTimeout: 100 });
      await expect(shortBreaker.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      mockTime += 200;
      await expect(shortBreaker.execute(async () => { throw new Error('fail again'); })).rejects.toThrow();
      expect(shortBreaker.getState()).toBe('open');

      vi.restoreAllMocks();
    });

    it('should return stats', () => {
      const stats = breaker.getStats();
      expect(stats.state).toBe('closed');
      expect(stats.failures).toBe(0);
    });
  });

  // ============================================================================
  // RetryManager
  // ============================================================================

  describe('RetryManager', () => {
    it('should return result on first success', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      const retryMgr = new RetryManager({ ...DEFAULT_RETRY_CONFIG, maxAttempts: 3, baseDelayMs: 1, jitter: false });
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retryMgr.withRetry('op', fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('should retry on retryable error and succeed', async () => {
      // Use 503 (retryable by determineRetryability) and fake only setTimeout
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      const retryMgr = new RetryManager({
        maxAttempts: 3,
        baseDelayMs: 1,
        maxDelayMs: 10,
        backoffType: 'constant',
        jitter: false,
      });
      const fn = vi.fn()
        .mockRejectedValueOnce({ status: 503, message: 'service unavailable' })
        .mockResolvedValueOnce('ok');
      const promise = retryMgr.withRetry('op', fn);
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('should throw after max attempts', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      const retryMgr = new RetryManager({
        maxAttempts: 2,
        baseDelayMs: 1,
        maxDelayMs: 10,
        backoffType: 'constant',
        jitter: false,
      });
      const fn = vi.fn().mockRejectedValue({ status: 503, message: 'always fails' });
      const promise = retryMgr.withRetry('op', fn);
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toBeDefined();
      expect(fn).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('should not retry non-retryable errors', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      const retryMgr = new RetryManager({
        maxAttempts: 3,
        baseDelayMs: 1,
        maxDelayMs: 10,
        backoffType: 'constant',
        jitter: false,
      });
      // 404 is not retryable
      const fn = vi.fn().mockRejectedValue({ status: 404, message: 'not found' });
      const promise = retryMgr.withRetry('op', fn);
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toBeDefined();
      expect(fn).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('should use exponential backoff type', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      const retryMgr = new RetryManager({
        maxAttempts: 2,
        baseDelayMs: 100,
        maxDelayMs: 5000,
        backoffType: 'exponential',
        jitter: false,
      });
      const fn = vi.fn()
        .mockRejectedValueOnce({ status: 503, message: 'error' })
        .mockResolvedValueOnce('done');
      const promise = retryMgr.withRetry('op', fn);
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result).toBe('done');
      vi.useRealTimers();
    });

    it('should use linear backoff type', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      const retryMgr = new RetryManager({
        maxAttempts: 2,
        baseDelayMs: 50,
        maxDelayMs: 5000,
        backoffType: 'linear',
        jitter: false,
      });
      const fn = vi.fn()
        .mockRejectedValueOnce({ status: 503, message: 'error' })
        .mockResolvedValueOnce('done');
      const promise = retryMgr.withRetry('op', fn);
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result).toBe('done');
      vi.useRealTimers();
    });

    it('should expose retryConfig', () => {
      const retryMgr = new RetryManager();
      expect(retryMgr.retryConfig.maxAttempts).toBeGreaterThan(0);
    });

    it('should throw lastError when maxAttempts is 0 (loop never executes)', async () => {
      const retryMgr = new RetryManager({
        maxAttempts: 0,
        baseDelayMs: 1,
        maxDelayMs: 10,
        backoffType: 'constant',
        jitter: false,
      });
      const fn = vi.fn().mockRejectedValue({ status: 503, message: 'error' });
      // Loop body never runs, lastError is undefined, throws undefined
      await expect(retryMgr.withRetry('op', fn)).rejects.toBeUndefined();
      expect(fn).toHaveBeenCalledTimes(0);
    });

    it('should handle network errors (ECONNREFUSED)', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      const retryMgr = new RetryManager({ maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 10, backoffType: 'constant', jitter: false });
      const networkError = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
      const fn = vi.fn().mockRejectedValue(networkError);
      const promise = retryMgr.withRetry('network-op', fn);
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toBeDefined();
      vi.useRealTimers();
    });

    it('should use retryableErrors config when error.isRetryable is not set', () => {
      const retryMgr = new RetryManager({
        maxAttempts: 2,
        baseDelayMs: 1,
        maxDelayMs: 10,
        backoffType: 'constant',
        jitter: false,
        retryableErrors: ['CUSTOM_CODE'],
      });
      // Call private isRetryable directly with an error where isRetryable is undefined
      const fakeError = { code: 'CUSTOM_CODE', isRetryable: undefined } as any;
      const config = (retryMgr as any).config;
      const result = (retryMgr as any).isRetryable(fakeError, config);
      expect(result).toBe(true);
    });

    it('should use default delay for unknown backoffType', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      const retryMgr = new RetryManager({
        maxAttempts: 2,
        baseDelayMs: 1,
        maxDelayMs: 10,
        backoffType: 'unknown' as any,
        jitter: false,
      });
      const fn = vi.fn()
        .mockRejectedValueOnce({ status: 503, message: 'error' })
        .mockResolvedValueOnce('done');
      const promise = retryMgr.withRetry('op', fn);
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result).toBe('done');
      vi.useRealTimers();
    });
  });

  // ============================================================================
  // CorrelationManager
  // ============================================================================

  describe('CorrelationManager', () => {
    it('should be a singleton', () => {
      const a = CorrelationManager.getInstance();
      const b = CorrelationManager.getInstance();
      expect(a).toBe(b);
    });

    it('should generate unique IDs', () => {
      const mgr = CorrelationManager.getInstance();
      const id1 = mgr.generateId();
      const id2 = mgr.generateId();
      expect(id1).not.toBe(id2);
    });

    it('should set and get correlation ID in context', async () => {
      const mgr = CorrelationManager.getInstance();
      let capturedId = '';
      await mgr.withCorrelationId('test-id-123', async () => {
        capturedId = mgr.getCorrelationId() ?? '';
      });
      expect(capturedId).toBe('test-id-123');
    });

    it('should restore previous ID after withCorrelationId', async () => {
      const mgr = CorrelationManager.getInstance();
      const before = mgr.getCorrelationId();
      await mgr.withCorrelationId('inner-id', async () => {});
      expect(mgr.getCorrelationId()).toBe(before);
    });

    it('should generate new ID in withNewCorrelationId', async () => {
      const mgr = CorrelationManager.getInstance();
      let capturedId = '';
      await mgr.withNewCorrelationId(async () => {
        capturedId = mgr.getCorrelationId() ?? '';
      });
      expect(capturedId).toBeTruthy();
      expect(capturedId).not.toBe('');
    });

    it('should set correlation ID directly via setCorrelationId', () => {
      const mgr = CorrelationManager.getInstance();
      mgr.setCorrelationId('direct-set-id');
      expect(mgr.getCorrelationId()).toBe('direct-set-id');
    });
  });

  // ============================================================================
  // ReliabilityManager
  // ============================================================================

  describe('ReliabilityManager', () => {
    let mgr: ReliabilityManager;

    beforeEach(() => {
      mgr = new ReliabilityManager(new RetryManager({ ...DEFAULT_RETRY_CONFIG, maxAttempts: 2, baseDelayMs: 1 }));
    });

    it('should execute successfully and return result', async () => {
      const result = await mgr.executeWithReliability('test-op', async () => 'result');
      expect(result).toBe('result');
    });

    it('should propagate errors from operation', async () => {
      await expect(
        mgr.executeWithReliability('test-op', async () => { throw new Error('op failed'); })
      ).rejects.toThrow('op failed');
    });

    it('should pass through GitHubMCPError unchanged (normalizeError line 268)', async () => {
      const ghError = new GitHubMCPError('Not found', 'NOT_FOUND', 404);
      await expect(
        mgr.executeWithReliability('test-op', async () => { throw ghError; })
      ).rejects.toBeInstanceOf(GitHubMCPError);
    });

    it('getHealthStatus should return status with circuit breakers', async () => {
      await mgr.executeWithReliability('health-op', async () => 'ok');
      const status = mgr.getHealthStatus();
      expect(status.circuitBreakers).toBeDefined();
      expect(status.retryConfig).toBeDefined();
      expect(status.timestamp).toBeTruthy();
    });

    it('resetCircuitBreakers should clear all breakers', async () => {
      await mgr.executeWithReliability('test-op', async () => 'ok');
      mgr.resetCircuitBreakers();
      // After reset, a new op should succeed with a fresh breaker
      const result = await mgr.executeWithReliability('test-op', async () => 'fresh');
      expect(result).toBe('fresh');
    });
  });
});
