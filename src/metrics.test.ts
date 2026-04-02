/**
 * Tests for MetricsCollector
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector, metrics } from './metrics.js';

describe('MetricsCollector', () => {
  beforeEach(() => {
    // Reset singleton state between tests
    metrics.reset();
  });

  // ============================================================================
  // Singleton
  // ============================================================================

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const a = MetricsCollector.getInstance();
      const b = MetricsCollector.getInstance();
      expect(a).toBe(b);
    });
  });

  // ============================================================================
  // recordApiCall
  // ============================================================================

  describe('recordApiCall', () => {
    it('should record API call and update stats', () => {
      metrics.recordApiCall({
        tool: 'repos',
        operation: 'getRepo',
        success: true,
        duration: 200,
        timestamp: Date.now(),
      });
      const stats = metrics.getApiCallStats();
      expect(stats.total).toBe(1);
      expect(stats.successful).toBe(1);
      expect(stats.failed).toBe(0);
      expect(stats.successRate).toBe(1);
    });

    it('should track failed calls separately', () => {
      metrics.recordApiCall({ tool: 'repos', operation: 'getRepo', success: false, duration: 50, timestamp: Date.now() });
      const stats = metrics.getApiCallStats();
      expect(stats.failed).toBe(1);
      expect(stats.successRate).toBe(0);
    });

    it('should compute average response time', () => {
      metrics.recordApiCall({ tool: 'a', operation: 'x', success: true, duration: 100, timestamp: Date.now() });
      metrics.recordApiCall({ tool: 'a', operation: 'x', success: true, duration: 300, timestamp: Date.now() });
      const stats = metrics.getApiCallStats();
      expect(stats.averageResponseTime).toBe(200);
    });

    it('should update rate limit gauge when rateLimitRemaining provided', () => {
      metrics.recordApiCall({ tool: 'a', operation: 'x', success: true, duration: 10, timestamp: Date.now(), rateLimitRemaining: 42 });
      expect(metrics.getGauges()['github_rate_limit_remaining']).toBe(42);
    });

    it('should update rate limit reset gauge when rateLimitReset provided', () => {
      metrics.recordApiCall({ tool: 'a', operation: 'x', success: true, duration: 10, timestamp: Date.now(), rateLimitReset: 1700000000 });
      expect(metrics.getGauges()['github_rate_limit_reset_timestamp']).toBe(1700000000);
    });

    it('should return 0 averageResponseTime and successRate when no calls', () => {
      const stats = metrics.getApiCallStats();
      expect(stats.averageResponseTime).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  // ============================================================================
  // recordPerformance
  // ============================================================================

  describe('recordPerformance', () => {
    it('should record performance and set memory gauges', () => {
      metrics.recordPerformance({
        operation: 'test-op',
        duration: 100,
        memoryUsage: { heapUsed: 1024, heapTotal: 2048, external: 512, rss: 4096, arrayBuffers: 0 },
        timestamp: Date.now(),
      });
      const gauges = metrics.getGauges();
      expect(gauges['memory_heap_used_bytes']).toBe(1024);
      expect(gauges['memory_heap_total_bytes']).toBe(2048);
    });
  });

  // ============================================================================
  // recordError
  // ============================================================================

  describe('recordError', () => {
    it('should record errors and track by type and tool', () => {
      metrics.recordError({ tool: 'repos', operation: 'get', errorType: 'NotFoundError', message: 'not found', timestamp: Date.now() });
      metrics.recordError({ tool: 'repos', operation: 'create', errorType: 'ValidationError', message: 'invalid', timestamp: Date.now() });
      metrics.recordError({ tool: 'issues', operation: 'get', errorType: 'NotFoundError', message: 'not found', timestamp: Date.now() });
      const stats = metrics.getErrorStats();
      expect(stats.total).toBe(3);
      expect(stats.byType['NotFoundError']).toBe(2);
      expect(stats.byType['ValidationError']).toBe(1);
      expect(stats.byTool['repos']).toBe(2);
      expect(stats.byTool['issues']).toBe(1);
    });

    it('should return zero stats when no errors', () => {
      const stats = metrics.getErrorStats();
      expect(stats.total).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.byTool).toEqual({});
    });
  });

  // ============================================================================
  // incrementCounter
  // ============================================================================

  describe('incrementCounter', () => {
    it('should increment a counter from zero', () => {
      metrics.incrementCounter('my_counter');
      expect(metrics.getCounters()['my_counter']).toBe(1);
    });

    it('should increment by custom value', () => {
      metrics.incrementCounter('my_counter', 5);
      expect(metrics.getCounters()['my_counter']).toBe(5);
    });

    it('should accumulate increments', () => {
      metrics.incrementCounter('my_counter', 3);
      metrics.incrementCounter('my_counter', 2);
      expect(metrics.getCounters()['my_counter']).toBe(5);
    });
  });

  // ============================================================================
  // setGauge
  // ============================================================================

  describe('setGauge', () => {
    it('should set a gauge value', () => {
      metrics.setGauge('cpu_usage', 75.5);
      expect(metrics.getGauges()['cpu_usage']).toBe(75.5);
    });

    it('should overwrite previous gauge value', () => {
      metrics.setGauge('cpu_usage', 50);
      metrics.setGauge('cpu_usage', 90);
      expect(metrics.getGauges()['cpu_usage']).toBe(90);
    });
  });

  // ============================================================================
  // recordHistogram / getHistogramStats
  // ============================================================================

  describe('getHistogramStats', () => {
    it('should return null for unknown histogram', () => {
      expect(metrics.getHistogramStats('unknown')).toBeNull();
    });

    it('should compute stats correctly for a single value', () => {
      metrics.recordHistogram('latency', 0.5);
      const stats = metrics.getHistogramStats('latency');
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(1);
      expect(stats!.sum).toBe(0.5);
      expect(stats!.avg).toBe(0.5);
      expect(stats!.min).toBe(0.5);
      expect(stats!.max).toBe(0.5);
    });

    it('should compute percentiles for multiple values', () => {
      for (let i = 1; i <= 100; i++) {
        metrics.recordHistogram('req_duration', i);
      }
      const stats = metrics.getHistogramStats('req_duration');
      expect(stats!.count).toBe(100);
      expect(stats!.p50).toBe(50);
      expect(stats!.p95).toBe(95);
      expect(stats!.p99).toBe(99);
    });
  });

  // ============================================================================
  // getRateLimitStatus
  // ============================================================================

  describe('getRateLimitStatus', () => {
    it('should return zeros when no rate limit data', () => {
      const status = metrics.getRateLimitStatus();
      expect(status.remaining).toBe(0);
      expect(status.resetTimestamp).toBe(0);
      expect(status.resetTimeRemaining).toBe(0);
    });

    it('should return remaining from gauge', () => {
      metrics.setGauge('github_rate_limit_remaining', 250);
      const status = metrics.getRateLimitStatus();
      expect(status.remaining).toBe(250);
    });
  });

  // ============================================================================
  // getMemoryStats
  // ============================================================================

  describe('getMemoryStats', () => {
    it('should return current process memory usage', () => {
      const mem = metrics.getMemoryStats();
      expect(mem.heapUsed).toBeGreaterThan(0);
      expect(mem.heapTotal).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // exportPrometheusMetrics
  // ============================================================================

  describe('exportPrometheusMetrics', () => {
    it('should export counters in Prometheus format', () => {
      metrics.incrementCounter('requests_total', 5);
      const output = metrics.exportPrometheusMetrics();
      expect(output).toContain('requests_total 5');
    });

    it('should export gauges in Prometheus format', () => {
      metrics.setGauge('memory_used', 1000);
      const output = metrics.exportPrometheusMetrics();
      expect(output).toContain('memory_used 1000');
      expect(output).toContain('# TYPE memory_used gauge');
    });

    it('should export histograms with count and sum', () => {
      metrics.recordHistogram('latency', 0.1);
      metrics.recordHistogram('latency', 0.2);
      const output = metrics.exportPrometheusMetrics();
      expect(output).toContain('latency_count');
      expect(output).toContain('latency_sum');
      expect(output).toContain('latency_bucket');
    });

    it('should return newline terminated output', () => {
      metrics.incrementCounter('x', 1);
      const output = metrics.exportPrometheusMetrics();
      expect(output.endsWith('\n')).toBe(true);
    });
  });

  // ============================================================================
  // reset
  // ============================================================================

  describe('reset', () => {
    it('should clear all recorded data', () => {
      metrics.recordApiCall({ tool: 'a', operation: 'b', success: true, duration: 10, timestamp: Date.now() });
      metrics.recordError({ tool: 'a', operation: 'b', errorType: 'E', message: 'm', timestamp: Date.now() });
      metrics.setGauge('g', 1);
      metrics.incrementCounter('c', 3);
      metrics.reset();
      expect(metrics.getApiCallStats().total).toBe(0);
      expect(metrics.getErrorStats().total).toBe(0);
      expect(metrics.getGauges()).toEqual({});
      expect(metrics.getCounters()).toEqual({});
    });
  });
});
