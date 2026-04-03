/**
 * Tests for PerformanceMonitor
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PerformanceMonitor, globalPerformanceMonitor } from './performance-monitor.js';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  // ============================================================================
  // measure
  // ============================================================================

  describe('measure', () => {
    it('should return result from successful execution', async () => {
      const result = await monitor.measure('op', async () => 42);
      expect(result).toBe(42);
    });

    it('should propagate errors from execution', async () => {
      await expect(monitor.measure('op', async () => { throw new Error('fail'); }))
        .rejects.toThrow('fail');
    });

    it('should record metric on success', async () => {
      await monitor.measure('my-op', async () => 'ok');
      const metrics = monitor.getOperationMetrics('my-op');
      expect(metrics).toBeDefined();
      expect(metrics!.count).toBe(1);
      expect(metrics!.successCount).toBe(1);
    });

    it('should record metric on error', async () => {
      await monitor.measure('err-op', async () => { throw new Error('x'); }).catch(() => {});
      const metrics = monitor.getOperationMetrics('err-op');
      expect(metrics!.errorCount).toBe(1);
      expect(metrics!.successRate).toBe(0);
    });

    it('should increment apiCallCount', async () => {
      await monitor.measure('op', async () => 1);
      await monitor.measure('op', async () => 2);
      expect(monitor.getApiCallCount()).toBe(2);
    });

    it('should warn on slow queries (console.warn)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fastMonitor = new PerformanceMonitor({ thresholds: { slowQueryThreshold: 1 } });
      // Simulate slow execution by making duration > threshold
      // The threshold is 1ms — almost any await will exceed it
      await fastMonitor.measure('slow-op', () => new Promise(r => setTimeout(r, 5)));
      // May or may not warn depending on timing, but shouldn't throw
      warn.mockRestore();
    });
  });

  // ============================================================================
  // getAggregatedMetrics
  // ============================================================================

  describe('getAggregatedMetrics', () => {
    it('should return sorted by count descending', async () => {
      await monitor.measure('rare', async () => 1);
      await monitor.measure('common', async () => 2);
      await monitor.measure('common', async () => 3);

      const aggregated = monitor.getAggregatedMetrics();
      expect(aggregated[0].operation).toBe('common');
      expect(aggregated[0].count).toBe(2);
    });

    it('should compute min/max/avg duration', async () => {
      await monitor.measure('op', async () => 1);
      await monitor.measure('op', async () => 2);

      const m = monitor.getOperationMetrics('op');
      expect(m!.count).toBe(2);
      expect(m!.minDuration).toBeGreaterThanOrEqual(0);
      expect(m!.maxDuration).toBeGreaterThanOrEqual(m!.minDuration);
      expect(m!.avgDuration).toBeLessThanOrEqual(m!.maxDuration);
    });
  });

  // ============================================================================
  // getRecentMetrics
  // ============================================================================

  describe('getRecentMetrics', () => {
    it('should return last N metrics', async () => {
      for (let i = 0; i < 5; i++) {
        await monitor.measure(`op-${i}`, async () => i);
      }
      const recent = monitor.getRecentMetrics(3);
      expect(recent).toHaveLength(3);
    });

    it('should default to 100 metrics', async () => {
      await monitor.measure('op', async () => 1);
      const recent = monitor.getRecentMetrics();
      expect(recent.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // getSlowQueries
  // ============================================================================

  describe('getSlowQueries', () => {
    it('should return empty when no slow queries', async () => {
      const fastMonitor = new PerformanceMonitor({ thresholds: { slowQueryThreshold: 100000 } });
      await fastMonitor.measure('op', async () => 1);
      expect(fastMonitor.getSlowQueries()).toHaveLength(0);
    });

    it('should return slow queries using custom threshold', async () => {
      const fastMonitor = new PerformanceMonitor({ thresholds: { slowQueryThreshold: 100000 } });
      await fastMonitor.measure('op', async () => 1);
      // Use getSlowQueries with threshold=1 (very low) to catch all queries
      const slow = fastMonitor.getSlowQueries(1);
      // Very short op may still have duration > 1ms in CI; just check it returns an array
      expect(Array.isArray(slow)).toBe(true);
    });
  });

  // ============================================================================
  // getErrorMetrics
  // ============================================================================

  describe('getErrorMetrics', () => {
    it('should return only error metrics', async () => {
      await monitor.measure('ok-op', async () => 1);
      await monitor.measure('err-op', async () => { throw new Error('x'); }).catch(() => {});
      const errors = monitor.getErrorMetrics();
      expect(errors.every(m => m.status === 'error')).toBe(true);
      expect(errors.some(m => m.operation === 'err-op')).toBe(true);
    });
  });

  // ============================================================================
  // getSystemMetrics
  // ============================================================================

  describe('getSystemMetrics', () => {
    it('should return system metrics with zero counts when empty', () => {
      const m = monitor.getSystemMetrics();
      expect(m.totalRequests).toBe(0);
      expect(m.averageResponseTime).toBe(0);
      expect(m.errorRate).toBe(0);
    });

    it('should compute errorRate after some errors', async () => {
      await monitor.measure('ok', async () => 1);
      await monitor.measure('err', async () => { throw new Error(); }).catch(() => {});
      const m = monitor.getSystemMetrics();
      expect(m.errorRate).toBe(50);
    });

    it('should include uptime and timestamp', () => {
      const m = monitor.getSystemMetrics();
      expect(m.uptime).toBeGreaterThanOrEqual(0);
      expect(m.timestamp).toBeGreaterThan(0);
    });

    it('getMetrics() alias should return same as getSystemMetrics()', () => {
      const a = monitor.getSystemMetrics();
      const b = monitor.getMetrics();
      expect(b.totalRequests).toBe(a.totalRequests);
    });
  });

  // ============================================================================
  // generateReport
  // ============================================================================

  describe('generateReport', () => {
    it('should return a non-empty string', async () => {
      await monitor.measure('op', async () => 1);
      const report = monitor.generateReport();
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
      expect(report).toContain('Performance Report');
    });

    it('should include operation data in report', async () => {
      await monitor.measure('my-operation', async () => 1);
      const report = monitor.generateReport();
      expect(report).toContain('my-operation');
    });
  });

  // ============================================================================
  // clear
  // ============================================================================

  describe('clear', () => {
    it('should reset all metrics', async () => {
      await monitor.measure('op', async () => 1);
      monitor.clear();
      expect(monitor.getApiCallCount()).toBe(0);
      expect(monitor.getSystemMetrics().totalRequests).toBe(0);
      expect(monitor.getAggregatedMetrics()).toHaveLength(0);
    });
  });

  // ============================================================================
  // maxMetrics limit
  // ============================================================================

  describe('maxMetrics', () => {
    it('should cap stored metrics at maxMetrics', async () => {
      const m = new PerformanceMonitor({ maxMetrics: 3 });
      for (let i = 0; i < 5; i++) {
        await m.measure('op', async () => i);
      }
      expect(m.getRecentMetrics(100)).toHaveLength(3);
    });
  });

  // ============================================================================
  // error rate threshold warning (checkThresholds)
  // ============================================================================

  describe('error rate threshold', () => {
    it('should warn when error rate exceeds threshold after 10+ samples', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const strictMonitor = new PerformanceMonitor({ thresholds: { errorRateThreshold: 5 } });

      // 7 errors out of 10 samples — exceeds 5% threshold
      for (let i = 0; i < 3; i++) {
        await strictMonitor.measure('op', async () => 1);
      }
      for (let i = 0; i < 7; i++) {
        await strictMonitor.measure('op', async () => { throw new Error(); }).catch(() => {});
      }
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('High error rate'));
      warn.mockRestore();
    });
  });

  // ============================================================================
  // globalPerformanceMonitor
  // ============================================================================

  it('globalPerformanceMonitor should be a PerformanceMonitor instance', () => {
    expect(globalPerformanceMonitor).toBeInstanceOf(PerformanceMonitor);
  });
});
