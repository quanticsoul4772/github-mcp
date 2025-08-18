/**
 * Metrics collection system for GitHub MCP Server
 *
 * Collects and aggregates metrics for API calls, performance,
 * rate limiting, and system health monitoring.
 */

export interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface ApiCallMetric {
  tool: string;
  operation: string;
  success: boolean;
  duration: number;
  statusCode?: number;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
  timestamp: number;
}

export interface PerformanceMetric {
  operation: string;
  duration: number;
  memoryUsage: NodeJS.MemoryUsage;
  timestamp: number;
}

export interface ErrorMetric {
  tool: string;
  operation: string;
  errorType: string;
  message: string;
  timestamp: number;
}

/**
 * Metrics collector and aggregator
 */
export class MetricsCollector {
  private static instance: MetricsCollector;
  private apiCalls: ApiCallMetric[] = [];
  private performance: PerformanceMetric[] = [];
  private errors: ErrorMetric[] = [];
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  private constructor() {
    // Cleanup old metrics every hour
    setInterval(
      () => {
        this.cleanup();
      },
      60 * 60 * 1000
    );
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Record an API call metric
   */
  public recordApiCall(metric: ApiCallMetric): void {
    this.apiCalls.push(metric);

    // Update counters
    const successKey = `api_calls_total{tool="${metric.tool}",operation="${metric.operation}",status="${metric.success ? 'success' : 'error'}"}`;
    this.incrementCounter(successKey);

    if (metric.statusCode) {
      const statusKey = `api_calls_total{tool="${metric.tool}",operation="${metric.operation}",status_code="${metric.statusCode}"}`;
      this.incrementCounter(statusKey);
    }

    // Update histograms
    const durationKey = `api_call_duration_seconds{tool="${metric.tool}",operation="${metric.operation}"}`;
    this.recordHistogram(durationKey, metric.duration / 1000);

    // Update rate limit gauge
    if (metric.rateLimitRemaining !== undefined) {
      this.setGauge('github_rate_limit_remaining', metric.rateLimitRemaining);
    }
    if (metric.rateLimitReset !== undefined) {
      this.setGauge('github_rate_limit_reset_timestamp', metric.rateLimitReset);
    }
  }

  /**
   * Record a performance metric
   */
  public recordPerformance(metric: PerformanceMetric): void {
    this.performance.push(metric);

    // Update memory usage gauges
    this.setGauge('memory_heap_used_bytes', metric.memoryUsage.heapUsed);
    this.setGauge('memory_heap_total_bytes', metric.memoryUsage.heapTotal);
    this.setGauge('memory_external_bytes', metric.memoryUsage.external);
    this.setGauge('memory_rss_bytes', metric.memoryUsage.rss);

    // Update operation duration histogram
    const durationKey = `operation_duration_seconds{operation="${metric.operation}"}`;
    this.recordHistogram(durationKey, metric.duration / 1000);
  }

  /**
   * Record an error metric
   */
  public recordError(metric: ErrorMetric): void {
    this.errors.push(metric);

    // Update error counter
    const errorKey = `errors_total{tool="${metric.tool}",operation="${metric.operation}",type="${metric.errorType}"}`;
    this.incrementCounter(errorKey);
  }

  /**
   * Increment a counter metric
   */
  public incrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  /**
   * Set a gauge metric
   */
  public setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  /**
   * Record a histogram value
   */
  public recordHistogram(name: string, value: number): void {
    const values = this.histograms.get(name) || [];
    values.push(value);
    this.histograms.set(name, values);
  }

  /**
   * Get API call statistics
   */
  public getApiCallStats(): {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
    successRate: number;
  } {
    const total = this.apiCalls.length;
    const successful = this.apiCalls.filter(call => call.success).length;
    const failed = total - successful;
    const averageResponseTime =
      total > 0 ? this.apiCalls.reduce((sum, call) => sum + call.duration, 0) / total : 0;
    const successRate = total > 0 ? successful / total : 0;

    return {
      total,
      successful,
      failed,
      averageResponseTime,
      successRate,
    };
  }

  /**
   * Get current memory usage
   */
  public getMemoryStats(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  /**
   * Get error statistics
   */
  public getErrorStats(): {
    total: number;
    byType: Record<string, number>;
    byTool: Record<string, number>;
  } {
    const total = this.errors.length;
    const byType: Record<string, number> = {};
    const byTool: Record<string, number> = {};

    this.errors.forEach(error => {
      byType[error.errorType] = (byType[error.errorType] || 0) + 1;
      byTool[error.tool] = (byTool[error.tool] || 0) + 1;
    });

    return { total, byType, byTool };
  }

  /**
   * Get rate limit status
   */
  public getRateLimitStatus(): {
    remaining: number;
    resetTimestamp: number;
    resetTimeRemaining: number;
  } {
    const remaining = this.gauges.get('github_rate_limit_remaining') || 0;
    const resetTimestamp = this.gauges.get('github_rate_limit_reset_timestamp') || 0;
    const resetTimeRemaining =
      resetTimestamp > 0 ? Math.max(0, resetTimestamp - Math.floor(Date.now() / 1000)) : 0;

    return {
      remaining,
      resetTimestamp,
      resetTimeRemaining,
    };
  }

  /**
   * Get all counters
   */
  public getCounters(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }

  /**
   * Get all gauges
   */
  public getGauges(): Record<string, number> {
    return Object.fromEntries(this.gauges);
  }

  /**
   * Get histogram statistics
   */
  public getHistogramStats(name: string): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = sorted[0];
    const max = sorted[count - 1];

    const percentile = (p: number) => {
      const index = Math.ceil((p / 100) * count) - 1;
      return sorted[Math.max(0, index)];
    };

    return {
      count,
      sum,
      avg,
      min,
      max,
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  public exportPrometheusMetrics(): string {
    const lines: string[] = [];

    // Export counters
    for (const [name, value] of this.counters) {
      lines.push(`# TYPE ${name.split('{')[0]} counter`);
      lines.push(`${name} ${value}`);
    }

    // Export gauges
    for (const [name, value] of this.gauges) {
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }

    // Export histograms
    for (const [name, values] of this.histograms) {
      const baseName = name.split('{')[0];
      const labels = name.includes('{') ? name.split('{')[1].split('}')[0] : '';
      const labelPart = labels ? `{${labels}}` : '';

      const sorted = [...values].sort((a, b) => a - b);
      const count = values.length;
      const sum = values.reduce((a, b) => a + b, 0);

      lines.push(`# TYPE ${baseName} histogram`);
      lines.push(`${baseName}_count${labelPart} ${count}`);
      lines.push(`${baseName}_sum${labelPart} ${sum}`);

      // Add histogram buckets
      const buckets = [
        0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0,
      ];
      for (const bucket of buckets) {
        const countInBucket = sorted.filter(v => v <= bucket).length;
        lines.push(
          `${baseName}_bucket{le="${bucket}"${labels ? ',' + labels : ''}} ${countInBucket}`
        );
      }
      lines.push(`${baseName}_bucket{le="+Inf"${labels ? ',' + labels : ''}} ${count}`);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Clean up old metrics (keep last hour)
   */
  private cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    this.apiCalls = this.apiCalls.filter(metric => metric.timestamp > oneHourAgo);
    this.performance = this.performance.filter(metric => metric.timestamp > oneHourAgo);
    this.errors = this.errors.filter(metric => metric.timestamp > oneHourAgo);
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.apiCalls = [];
    this.performance = [];
    this.errors = [];
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

// Export singleton instance
export const metrics = MetricsCollector.getInstance();
