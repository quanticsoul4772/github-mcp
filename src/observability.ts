/**
 * Observability utilities for GitHub MCP Server
 *
 * Provides utilities to wrap tool handlers and API calls
 * with logging, metrics, and error tracking.
 */

import { logger, LogContext } from './logger.js';
import { metrics, ApiCallMetric, ErrorMetric } from './metrics.js';

/**
 * Wrap a tool handler with observability features
 */
export function withObservability<T extends (...args: any[]) => Promise<any>>(
  toolName: string,
  operation: string,
  handler: T
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now();
    const correlationId = logger.generateCorrelationId();
    const toolLogger = logger.child({
      correlationId,
      tool: toolName,
      operation,
    });

    toolLogger.debug('Operation started', { args: args[0] });

    try {
      const result = await handler(...args);
      const duration = Date.now() - startTime;

      // Record successful metric
      const apiMetric: ApiCallMetric = {
        tool: toolName,
        operation,
        success: true,
        duration,
        timestamp: Date.now(),
      };
      metrics.recordApiCall(apiMetric);

      toolLogger.info('Operation completed successfully', {
        duration,
        success: true,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Record failed metric
      const apiMetric: ApiCallMetric = {
        tool: toolName,
        operation,
        success: false,
        duration,
        timestamp: Date.now(),
      };
      metrics.recordApiCall(apiMetric);

      // Record error metric
      const errorMetric: ErrorMetric = {
        tool: toolName,
        operation,
        errorType: error instanceof Error ? error.name : 'UnknownError',
        message: errorMessage,
        timestamp: Date.now(),
      };
      metrics.recordError(errorMetric);

      toolLogger.error(
        'Operation failed',
        {
          duration,
          success: false,
          errorType: error instanceof Error ? error.name : 'UnknownError',
        },
        error instanceof Error ? error : undefined
      );

      throw error;
    }
  }) as T;
}

/**
 * Wrap GitHub API calls with rate limit tracking
 */
export function withRateLimitTracking<T extends (...args: any[]) => Promise<any>>(
  apiCall: T,
  apiName: string
): T {
  return (async (...args: any[]) => {
    try {
      const result = await apiCall(...args);

      // Extract rate limit headers if available
      if (result && typeof result === 'object' && 'headers' in result) {
        const headers = (result as any).headers;
        const rateLimit = headers['x-ratelimit-remaining'];
        const rateLimitReset = headers['x-ratelimit-reset'];

        if (rateLimit !== undefined) {
          metrics.setGauge('github_rate_limit_remaining', parseInt(rateLimit));
        }
        if (rateLimitReset !== undefined) {
          metrics.setGauge('github_rate_limit_reset_timestamp', parseInt(rateLimitReset));
        }

        // Log warnings if rate limit is getting low
        if (rateLimit && parseInt(rateLimit) < 100) {
          logger.warn('GitHub rate limit running low', {
            remaining: parseInt(rateLimit),
            resetTimestamp: rateLimitReset ? parseInt(rateLimitReset) : undefined,
            apiCall: apiName,
          });
        }
      }

      return result;
    } catch (error) {
      // Check if this is a rate limit error
      if (error instanceof Error && error.message.includes('rate limit')) {
        logger.error(
          'GitHub rate limit exceeded',
          {
            apiCall: apiName,
            error: error.message,
          },
          error
        );

        metrics.recordError({
          tool: 'github-api',
          operation: apiName,
          errorType: 'RateLimitError',
          message: error.message,
          timestamp: Date.now(),
        });
      }

      throw error;
    }
  }) as T;
}

/**
 * Create a performance timer for operations
 */
export class PerformanceTimer {
  private startTime: number;
  private operation: string;
  private context: LogContext;

  constructor(operation: string, context: LogContext = {}) {
    this.startTime = Date.now();
    this.operation = operation;
    this.context = context;
  }

  /**
   * End the timer and record performance metrics
   */
  public end(additionalContext: LogContext = {}): number {
    const duration = Date.now() - this.startTime;

    metrics.recordPerformance({
      operation: this.operation,
      duration,
      memoryUsage: process.memoryUsage(),
      timestamp: Date.now(),
    });

    logger.debug('Performance measurement', {
      ...this.context,
      ...additionalContext,
      operation: this.operation,
      duration,
    });

    return duration;
  }
}

/**
 * Monitor memory usage and log warnings
 */
export function monitorMemoryUsage(): void {
  const memory = process.memoryUsage();
  const heapUsedMB = Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100;
  const heapTotalMB = Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100;
  const usagePercent = Math.round((memory.heapUsed / memory.heapTotal) * 100);

  // Update memory metrics
  metrics.setGauge('memory_heap_used_bytes', memory.heapUsed);
  metrics.setGauge('memory_heap_total_bytes', memory.heapTotal);
  metrics.setGauge('memory_external_bytes', memory.external);
  metrics.setGauge('memory_rss_bytes', memory.rss);

  // Log warnings for high memory usage
  if (usagePercent > 90) {
    logger.error('Critical memory usage detected', {
      heapUsedMB,
      heapTotalMB,
      usagePercent,
      external: Math.round((memory.external / 1024 / 1024) * 100) / 100,
      rss: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
    });
  } else if (usagePercent > 80) {
    logger.warn('High memory usage detected', {
      heapUsedMB,
      heapTotalMB,
      usagePercent,
    });
  }
}

/**
 * Start periodic memory monitoring
 */
export function startMemoryMonitoring(intervalMs: number = 30000): NodeJS.Timeout {
  return setInterval(monitorMemoryUsage, intervalMs);
}
