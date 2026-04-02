/**
 * Tests for observability utilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger and metrics before importing observability
vi.mock('./logger.js', () => ({
  logger: {
    generateCorrelationId: vi.fn(() => 'test-correlation-id'),
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  LogContext: {},
}));

vi.mock('./metrics.js', () => ({
  metrics: {
    recordApiCall: vi.fn(),
    recordError: vi.fn(),
    recordPerformance: vi.fn(),
    setGauge: vi.fn(),
  },
}));

import {
  withObservability,
  withRateLimitTracking,
  PerformanceTimer,
  monitorMemoryUsage,
  startMemoryMonitoring,
} from './observability.js';
import { metrics } from './metrics.js';
import { logger } from './logger.js';

describe('observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup the child mock since it creates a new object
    (logger.child as any).mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    });
  });

  // ============================================================================
  // withObservability
  // ============================================================================

  describe('withObservability', () => {
    it('should return the handler result on success', async () => {
      const handler = vi.fn().mockResolvedValue({ data: 42 });
      const wrapped = withObservability('my-tool', 'get', handler);
      const result = await wrapped({ param: 'x' });
      expect(result).toEqual({ data: 42 });
      expect(handler).toHaveBeenCalledWith({ param: 'x' });
    });

    it('should record an API call metric on success', async () => {
      const handler = vi.fn().mockResolvedValue('ok');
      const wrapped = withObservability('my-tool', 'create', handler);
      await wrapped({});
      expect(metrics.recordApiCall).toHaveBeenCalledWith(
        expect.objectContaining({ tool: 'my-tool', operation: 'create', success: true })
      );
    });

    it('should rethrow errors and record failure metrics', async () => {
      const error = new Error('API error');
      const handler = vi.fn().mockRejectedValue(error);
      const wrapped = withObservability('my-tool', 'update', handler);
      await expect(wrapped({})).rejects.toThrow('API error');
      expect(metrics.recordApiCall).toHaveBeenCalledWith(
        expect.objectContaining({ tool: 'my-tool', operation: 'update', success: false })
      );
      expect(metrics.recordError).toHaveBeenCalledWith(
        expect.objectContaining({ tool: 'my-tool', operation: 'update', errorType: 'Error' })
      );
    });

    it('should handle non-Error thrown values', async () => {
      const handler = vi.fn().mockRejectedValue('string error');
      const wrapped = withObservability('my-tool', 'delete', handler);
      await expect(wrapped({})).rejects.toBe('string error');
      expect(metrics.recordError).toHaveBeenCalledWith(
        expect.objectContaining({ errorType: 'UnknownError', message: 'Unknown error occurred' })
      );
    });

    it('should generate a correlation ID for each call', async () => {
      const handler = vi.fn().mockResolvedValue(null);
      const wrapped = withObservability('tool', 'op', handler);
      await wrapped({});
      expect(logger.generateCorrelationId).toHaveBeenCalled();
      expect(logger.child).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: 'test-correlation-id' })
      );
    });
  });

  // ============================================================================
  // withRateLimitTracking
  // ============================================================================

  describe('withRateLimitTracking', () => {
    it('should return result on success', async () => {
      const apiCall = vi.fn().mockResolvedValue({ data: 'result' });
      const wrapped = withRateLimitTracking(apiCall, 'repos.get');
      const result = await wrapped('arg1');
      expect(result).toEqual({ data: 'result' });
      expect(apiCall).toHaveBeenCalledWith('arg1');
    });

    it('should record rate limit gauge when headers present', async () => {
      const apiCall = vi.fn().mockResolvedValue({
        data: {},
        headers: {
          'x-ratelimit-remaining': '500',
          'x-ratelimit-reset': '1700000000',
        },
      });
      const wrapped = withRateLimitTracking(apiCall, 'repos.get');
      await wrapped();
      expect(metrics.setGauge).toHaveBeenCalledWith('github_rate_limit_remaining', 500);
      expect(metrics.setGauge).toHaveBeenCalledWith('github_rate_limit_reset_timestamp', 1700000000);
    });

    it('should warn when rate limit is below 100', async () => {
      const apiCall = vi.fn().mockResolvedValue({
        data: {},
        headers: { 'x-ratelimit-remaining': '50' },
      });
      const wrapped = withRateLimitTracking(apiCall, 'repos.list');
      await wrapped();
      expect(logger.warn).toHaveBeenCalledWith(
        'GitHub rate limit running low',
        expect.objectContaining({ remaining: 50 })
      );
    });

    it('should not warn when rate limit is 100 or above', async () => {
      const apiCall = vi.fn().mockResolvedValue({
        data: {},
        headers: { 'x-ratelimit-remaining': '100' },
      });
      const wrapped = withRateLimitTracking(apiCall, 'repos.list');
      await wrapped();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should not set gauges when no headers', async () => {
      const apiCall = vi.fn().mockResolvedValue({ data: 'no-headers' });
      const wrapped = withRateLimitTracking(apiCall, 'repos.get');
      await wrapped();
      expect(metrics.setGauge).not.toHaveBeenCalled();
    });

    it('should rethrow non-rate-limit errors', async () => {
      const error = new Error('server error');
      const apiCall = vi.fn().mockRejectedValue(error);
      const wrapped = withRateLimitTracking(apiCall, 'repos.get');
      await expect(wrapped()).rejects.toThrow('server error');
      expect(metrics.recordError).not.toHaveBeenCalled();
    });

    it('should record error and rethrow rate limit errors', async () => {
      const error = new Error('API rate limit exceeded');
      const apiCall = vi.fn().mockRejectedValue(error);
      const wrapped = withRateLimitTracking(apiCall, 'repos.get');
      await expect(wrapped()).rejects.toThrow('API rate limit exceeded');
      expect(metrics.recordError).toHaveBeenCalledWith(
        expect.objectContaining({ errorType: 'RateLimitError' })
      );
    });
  });

  // ============================================================================
  // PerformanceTimer
  // ============================================================================

  describe('PerformanceTimer', () => {
    it('should return elapsed duration on end()', async () => {
      const timer = new PerformanceTimer('test-op', { tag: 'value' });
      // Small delay to ensure some duration
      await new Promise(resolve => setTimeout(resolve, 5));
      const duration = timer.end();
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(typeof duration).toBe('number');
    });

    it('should call metrics.recordPerformance with operation and duration', () => {
      const timer = new PerformanceTimer('my-operation');
      timer.end({ extra: 'context' });
      expect(metrics.recordPerformance).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'my-operation' })
      );
    });
  });

  // ============================================================================
  // monitorMemoryUsage
  // ============================================================================

  describe('monitorMemoryUsage', () => {
    it('should set memory gauges', () => {
      monitorMemoryUsage();
      expect(metrics.setGauge).toHaveBeenCalledWith('memory_heap_used_bytes', expect.any(Number));
      expect(metrics.setGauge).toHaveBeenCalledWith('memory_heap_total_bytes', expect.any(Number));
      expect(metrics.setGauge).toHaveBeenCalledWith('memory_external_bytes', expect.any(Number));
      expect(metrics.setGauge).toHaveBeenCalledWith('memory_rss_bytes', expect.any(Number));
    });
  });

  // ============================================================================
  // startMemoryMonitoring
  // ============================================================================

  describe('startMemoryMonitoring', () => {
    it('should return a timer handle', () => {
      vi.useFakeTimers();
      const handle = startMemoryMonitoring(60000);
      expect(handle).toBeDefined();
      clearInterval(handle);
      vi.useRealTimers();
    });

    it('should call monitorMemoryUsage on each interval', () => {
      vi.useFakeTimers();
      startMemoryMonitoring(1000);
      vi.advanceTimersByTime(2500);
      // Should have called setGauge 2+ times (2 intervals)
      expect((metrics.setGauge as any).mock.calls.length).toBeGreaterThanOrEqual(8); // 4 gauges × 2 intervals
      vi.useRealTimers();
    });
  });
});
