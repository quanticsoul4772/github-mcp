/**
 * Reliability and resilience infrastructure for GitHub MCP Server
 * Includes circuit breaker, enhanced retry logic, telemetry, and monitoring
 */

import { GitHubMCPError } from './errors.js';

/**
 * Interface for telemetry and monitoring hooks
 */
export interface Telemetry {
  trackRequest(operation: string, duration: number, success: boolean): void;
  trackError(error: Error, context?: Record<string, any>): void;
  trackMetric(name: string, value: number, tags?: Record<string, string>): void;
  trackRetry(operation: string, attempt: number, error: Error): void;
  trackCircuitBreakerState(operation: string, state: CircuitBreakerState): void;
}

/**
 * Default no-op telemetry implementation
 */
export class NoOpTelemetry implements Telemetry {
  trackRequest(): void {}
  trackError(): void {}
  trackMetric(): void {}
  trackRetry(): void {}
  trackCircuitBreakerState(): void {}
}

/**
 * Console-based telemetry for development
 */
export class ConsoleTelemetry implements Telemetry {
  constructor(private verbose: boolean = false) {}

  trackRequest(operation: string, duration: number, success: boolean): void {
    if (this.verbose) {
      console.error(`[TELEMETRY] Request: ${operation} - ${duration}ms - ${success ? 'SUCCESS' : 'FAILED'}`);
    }
  }

  trackError(error: Error, context?: Record<string, any>): void {
    console.error(`[TELEMETRY] Error: ${error.message}`, context);
  }

  trackMetric(name: string, value: number, tags?: Record<string, string>): void {
    if (this.verbose) {
      console.error(`[TELEMETRY] Metric: ${name}=${value}`, tags);
    }
  }

  trackRetry(operation: string, attempt: number, error: Error): void {
    console.error(`[TELEMETRY] Retry: ${operation} attempt ${attempt} - ${error.message}`);
  }

  trackCircuitBreakerState(operation: string, state: CircuitBreakerState): void {
    console.error(`[TELEMETRY] Circuit Breaker: ${operation} -> ${state}`);
  }
}

/**
 * Circuit breaker states
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitor?: boolean;
}

/**
 * Circuit breaker implementation to prevent cascade failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailTime?: Date;
  private state: CircuitBreakerState = 'closed';
  private readonly operation: string;

  constructor(
    operation: string,
    private config: CircuitBreakerConfig,
    private telemetry: Telemetry = new NoOpTelemetry()
  ) {
    this.operation = operation;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.setState('half-open');
      } else {
        throw new GitHubMCPError(
          `Circuit breaker is open for operation: ${this.operation}`,
          'CIRCUIT_BREAKER_OPEN',
          503,
          { 
            operation: this.operation,
            failures: this.failures,
            lastFailTime: this.lastFailTime,
            resetTime: this.getResetTime()
          }
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailTime) return false;
    return Date.now() - this.lastFailTime.getTime() >= this.config.resetTimeout;
  }

  private getResetTime(): Date | undefined {
    if (!this.lastFailTime) return undefined;
    return new Date(this.lastFailTime.getTime() + this.config.resetTimeout);
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state !== 'closed') {
      this.setState('closed');
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailTime = new Date();

    if (this.state === 'half-open') {
      this.setState('open');
    } else if (this.failures >= this.config.failureThreshold) {
      this.setState('open');
    }
  }

  private setState(newState: CircuitBreakerState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.telemetry.trackCircuitBreakerState(this.operation, newState);
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getStats(): {
    state: CircuitBreakerState;
    failures: number;
    lastFailTime?: Date;
    resetTime?: Date;
  } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailTime: this.lastFailTime,
      resetTime: this.getResetTime(),
    };
  }
}

/**
 * Enhanced retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffType: 'exponential' | 'linear' | 'constant';
  jitter: boolean;
  retryableErrors?: string[];
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffType: 'exponential',
  jitter: true,
  retryableErrors: ['RATE_LIMIT', 'NETWORK_ERROR', 'TIMEOUT', 'GITHUB_API_ERROR'],
};

/**
 * Enhanced retry manager with multiple backoff strategies
 */
export class RetryManager {
  constructor(
    private config: RetryConfig = DEFAULT_RETRY_CONFIG,
    private telemetry: Telemetry = new NoOpTelemetry()
  ) {}

  get retryConfig(): RetryConfig {
    return this.config;
  }

  async withRetry<T>(
    operation: string,
    fn: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const effectiveConfig = { ...this.config, ...config };
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= effectiveConfig.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        const normalizedError = error instanceof GitHubMCPError 
          ? error 
          : this.normalizeError(error, operation);

        // Track the error
        this.telemetry.trackError(normalizedError, { 
          operation, 
          attempt, 
          maxAttempts: effectiveConfig.maxAttempts 
        });

        // Don't retry if not retryable or last attempt
        if (!this.isRetryable(normalizedError, effectiveConfig) || attempt === effectiveConfig.maxAttempts) {
          throw normalizedError;
        }

        // Calculate delay
        const delay = this.calculateDelay(attempt, effectiveConfig);
        
        // Track retry attempt
        this.telemetry.trackRetry(operation, attempt, normalizedError);

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private normalizeError(error: any, operation: string): GitHubMCPError {
    if (error instanceof GitHubMCPError) {
      return error;
    }

    // Handle GitHub API errors (from Octokit)
    if (error.status) {
      return new GitHubMCPError(
        error.message || 'GitHub API error',
        'GITHUB_API_ERROR',
        error.status,
        { operation, originalError: error.message },
        error
      );
    }

    // Handle network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return new GitHubMCPError(
        `Network error during ${operation}: ${error.message}`,
        'NETWORK_ERROR',
        undefined,
        { operation, networkError: error.code },
        error
      );
    }

    // Generic error
    return new GitHubMCPError(
      error.message || 'Unknown error occurred',
      'UNKNOWN_ERROR',
      undefined,
      { operation },
      error
    );
  }

  private isRetryable(error: GitHubMCPError, config: RetryConfig): boolean {
    // Use the error's built-in retryability if available
    if (error.isRetryable !== undefined) {
      return error.isRetryable;
    }

    // Check against configured retryable errors
    return config.retryableErrors?.includes(error.code) || false;
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay: number;

    switch (config.backoffType) {
      case 'exponential':
        delay = config.baseDelayMs * Math.pow(2, attempt - 1);
        break;
      case 'linear':
        delay = config.baseDelayMs * attempt;
        break;
      case 'constant':
        delay = config.baseDelayMs;
        break;
      default:
        delay = config.baseDelayMs;
    }

    // Apply maximum delay limit
    delay = Math.min(delay, config.maxDelayMs);

    // Apply jitter to prevent thundering herd
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Correlation ID generator for request tracking
 */
export class CorrelationManager {
  private static instance?: CorrelationManager;
  private currentId?: string;

  static getInstance(): CorrelationManager {
    if (!this.instance) {
      this.instance = new CorrelationManager();
    }
    return this.instance;
  }

  generateId(): string {
    return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setCorrelationId(id: string): void {
    this.currentId = id;
  }

  getCorrelationId(): string | undefined {
    return this.currentId;
  }

  withCorrelationId<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const previousId = this.currentId;
    this.currentId = id;
    
    return fn().finally(() => {
      this.currentId = previousId;
    });
  }

  async withNewCorrelationId<T>(fn: () => Promise<T>): Promise<T> {
    const id = this.generateId();
    return this.withCorrelationId(id, fn);
  }
}

/**
 * Request context for tracking operations
 */
export interface RequestContext {
  operation: string;
  correlationId: string;
  startTime: number;
  metadata?: Record<string, any>;
}

/**
 * Reliability orchestrator that combines all reliability features
 */
export class ReliabilityManager {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private correlationManager = CorrelationManager.getInstance();

  constructor(
    private retryManager: RetryManager,
    private telemetry: Telemetry = new NoOpTelemetry(),
    private circuitBreakerConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      resetTimeout: 30000, // 30 seconds
      monitor: true,
    }
  ) {}

  /**
   * Execute an operation with full reliability features
   */
  async executeWithReliability<T>(
    operation: string,
    fn: () => Promise<T>,
    options?: {
      retryConfig?: Partial<RetryConfig>;
      useCircuitBreaker?: boolean;
      correlationId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<T> {
    const correlationId = options?.correlationId || this.correlationManager.generateId();
    const startTime = Date.now();
    const context: RequestContext = {
      operation,
      correlationId,
      startTime,
      metadata: options?.metadata,
    };

    return this.correlationManager.withCorrelationId(correlationId, async () => {
      const wrappedFn = options?.useCircuitBreaker !== false
        ? () => this.getCircuitBreaker(operation).execute(fn)
        : fn;

      const retryFn = () => this.retryManager.withRetry(operation, wrappedFn, options?.retryConfig);

      try {
        const result = await retryFn();
        this.trackSuccess(context);
        return result;
      } catch (error) {
        this.trackFailure(context, error as Error);
        throw error;
      }
    });
  }

  private getCircuitBreaker(operation: string): CircuitBreaker {
    if (!this.circuitBreakers.has(operation)) {
      this.circuitBreakers.set(
        operation,
        new CircuitBreaker(operation, this.circuitBreakerConfig, this.telemetry)
      );
    }
    return this.circuitBreakers.get(operation)!;
  }

  private trackSuccess(context: RequestContext): void {
    const duration = Date.now() - context.startTime;
    this.telemetry.trackRequest(context.operation, duration, true);
    this.telemetry.trackMetric('request_duration', duration, {
      operation: context.operation,
      status: 'success',
    });
  }

  private trackFailure(context: RequestContext, error: Error): void {
    const duration = Date.now() - context.startTime;
    this.telemetry.trackRequest(context.operation, duration, false);
    this.telemetry.trackError(error, {
      operation: context.operation,
      correlationId: context.correlationId,
      duration,
      metadata: context.metadata,
    });
    this.telemetry.trackMetric('request_duration', duration, {
      operation: context.operation,
      status: 'error',
    });
  }

  /**
   * Get health status of all circuit breakers
   */
  getHealthStatus(): Record<string, any> {
    const circuitBreakers: Record<string, any> = {};
    
    for (const [operation, breaker] of this.circuitBreakers) {
      circuitBreakers[operation] = breaker.getStats();
    }

    return {
      timestamp: new Date().toISOString(),
      correlationId: this.correlationManager.getCorrelationId(),
      circuitBreakers,
      retryConfig: this.retryManager.retryConfig,
    };
  }

  /**
   * Reset all circuit breakers (for testing/recovery)
   */
  resetCircuitBreakers(): void {
    this.circuitBreakers.clear();
  }
}