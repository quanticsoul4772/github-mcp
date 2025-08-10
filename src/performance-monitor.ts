/**
 * Performance monitoring system
 * Tracks API call performance, memory usage, and system metrics
 */

interface PerformanceMetric {
  operation: string;
  duration: number;
  status: 'success' | 'error';
  timestamp: number;
  memoryUsage?: NodeJS.MemoryUsage;
  apiCallCount?: number;
}

interface AggregatedMetrics {
  operation: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  lastUpdated: number;
}

interface SystemMetrics {
  totalRequests: number;
  totalDuration: number;
  averageResponseTime: number;
  errorRate: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  timestamp: number;
}

interface PerformanceThresholds {
  slowQueryThreshold?: number; // ms
  highMemoryThreshold?: number; // bytes
  errorRateThreshold?: number; // percentage
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[];
  private aggregatedMetrics: Map<string, AggregatedMetrics>;
  private readonly maxMetrics: number;
  private readonly thresholds: PerformanceThresholds;
  private readonly startTime: number;
  private apiCallCount: number;

  constructor(options: { maxMetrics?: number; thresholds?: PerformanceThresholds } = {}) {
    this.metrics = [];
    this.aggregatedMetrics = new Map();
    this.maxMetrics = options.maxMetrics || 1000;
    this.thresholds = {
      slowQueryThreshold: 2000, // 2 seconds
      highMemoryThreshold: 100 * 1024 * 1024, // 100MB
      errorRateThreshold: 10, // 10%
      ...options.thresholds,
    };
    this.startTime = Date.now();
    this.apiCallCount = 0;
  }

  /**
   * Measure performance of an operation
   */
  async measure<T>(operation: string, execution: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    let status: 'success' | 'error' = 'success';
    this.apiCallCount++;

    try {
      const result = await execution();
      return result;
    } catch (error) {
      status = 'error';
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage();
      
      const metric: PerformanceMetric = {
        operation,
        duration,
        status,
        timestamp: Date.now(),
        memoryUsage: {
          rss: endMemory.rss - startMemory.rss,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          external: endMemory.external - startMemory.external,
          arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
        },
        apiCallCount: 1,
      };

      this.recordMetric(metric);
      this.updateAggregatedMetrics(metric);
      this.checkThresholds(metric);
    }
  }

  /**
   * Record a performance metric
   */
  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Update aggregated metrics for an operation
   */
  private updateAggregatedMetrics(metric: PerformanceMetric): void {
    const existing = this.aggregatedMetrics.get(metric.operation);
    
    if (existing) {
      existing.count++;
      existing.totalDuration += metric.duration;
      existing.avgDuration = existing.totalDuration / existing.count;
      existing.minDuration = Math.min(existing.minDuration, metric.duration);
      existing.maxDuration = Math.max(existing.maxDuration, metric.duration);
      existing.lastUpdated = Date.now();
      
      if (metric.status === 'success') {
        existing.successCount++;
      } else {
        existing.errorCount++;
      }
      existing.successRate = (existing.successCount / existing.count) * 100;
    } else {
      this.aggregatedMetrics.set(metric.operation, {
        operation: metric.operation,
        count: 1,
        totalDuration: metric.duration,
        avgDuration: metric.duration,
        minDuration: metric.duration,
        maxDuration: metric.duration,
        successCount: metric.status === 'success' ? 1 : 0,
        errorCount: metric.status === 'error' ? 1 : 0,
        successRate: metric.status === 'success' ? 100 : 0,
        lastUpdated: Date.now(),
      });
    }
  }

  /**
   * Check performance thresholds and log warnings
   */
  private checkThresholds(metric: PerformanceMetric): void {
    // Check slow query threshold
    if (metric.duration > (this.thresholds.slowQueryThreshold || 2000)) {
      console.warn(`⚠️  Slow query detected: ${metric.operation} took ${metric.duration}ms`);
    }

    // Check memory usage threshold
    const currentMemory = process.memoryUsage();
    if (currentMemory.heapUsed > (this.thresholds.highMemoryThreshold || 100 * 1024 * 1024)) {
      console.warn(`⚠️  High memory usage: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }

    // Check error rate threshold
    const aggregated = this.aggregatedMetrics.get(metric.operation);
    if (aggregated && aggregated.count >= 10) { // Only check after sufficient samples
      const errorRate = (aggregated.errorCount / aggregated.count) * 100;
      if (errorRate > (this.thresholds.errorRateThreshold || 10)) {
        console.warn(`⚠️  High error rate for ${metric.operation}: ${errorRate.toFixed(1)}%`);
      }
    }
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    const now = Date.now();
    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const errorCount = this.metrics.filter(m => m.status === 'error').length;

    return {
      totalRequests: this.metrics.length,
      totalDuration,
      averageResponseTime: this.metrics.length > 0 ? totalDuration / this.metrics.length : 0,
      errorRate: this.metrics.length > 0 ? (errorCount / this.metrics.length) * 100 : 0,
      memoryUsage: process.memoryUsage(),
      uptime: now - this.startTime,
      timestamp: now,
    };
  }

  /**
   * Get aggregated metrics for all operations
   */
  getAggregatedMetrics(): AggregatedMetrics[] {
    return Array.from(this.aggregatedMetrics.values()).sort((a, b) => b.count - a.count);
  }

  /**
   * Get metrics for a specific operation
   */
  getOperationMetrics(operation: string): AggregatedMetrics | undefined {
    return this.aggregatedMetrics.get(operation);
  }

  /**
   * Get recent metrics (last N metrics)
   */
  getRecentMetrics(count: number = 100): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * Get slow queries (above threshold)
   */
  getSlowQueries(threshold?: number): PerformanceMetric[] {
    const slowThreshold = threshold || this.thresholds.slowQueryThreshold || 2000;
    return this.metrics.filter(m => m.duration > slowThreshold);
  }

  /**
   * Get error metrics
   */
  getErrorMetrics(): PerformanceMetric[] {
    return this.metrics.filter(m => m.status === 'error');
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const systemMetrics = this.getSystemMetrics();
    const aggregatedMetrics = this.getAggregatedMetrics();
    const slowQueries = this.getSlowQueries();
    const errors = this.getErrorMetrics();

    const report = [
      '📊 Performance Report',
      '==================',
      '',
      '🔢 System Metrics:',
      `  Total Requests: ${systemMetrics.totalRequests}`,
      `  Average Response Time: ${systemMetrics.averageResponseTime.toFixed(2)}ms`,
      `  Error Rate: ${systemMetrics.errorRate.toFixed(2)}%`,
      `  Memory Usage: ${(systemMetrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      `  Uptime: ${(systemMetrics.uptime / 1000 / 60).toFixed(1)} minutes`,
      '',
      '📈 Top Operations:',
      ...aggregatedMetrics.slice(0, 10).map(m => 
        `  ${m.operation}: ${m.count} calls, ${m.avgDuration.toFixed(2)}ms avg, ${m.successRate.toFixed(1)}% success`
      ),
      '',
      `🐌 Slow Queries (${slowQueries.length}):`,
      ...slowQueries.slice(0, 5).map(m => 
        `  ${m.operation}: ${m.duration}ms at ${new Date(m.timestamp).toISOString()}`
      ),
      '',
      `❌ Recent Errors (${errors.length}):`,
      ...errors.slice(-5).map(m => 
        `  ${m.operation}: ${m.status} at ${new Date(m.timestamp).toISOString()}`
      ),
    ];

    return report.join('\n');
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.aggregatedMetrics.clear();
    this.apiCallCount = 0;
  }

  /**
   * Get total API call count
   */
  getApiCallCount(): number {
    return this.apiCallCount;
  }
}

/**
 * Global performance monitor instance
 */
export const globalPerformanceMonitor = new PerformanceMonitor({
  maxMetrics: 2000,
  thresholds: {
    slowQueryThreshold: 2000, // 2 seconds
    highMemoryThreshold: 200 * 1024 * 1024, // 200MB
    errorRateThreshold: 15, // 15%
  },
});