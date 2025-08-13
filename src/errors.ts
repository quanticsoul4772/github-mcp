/**
 * Standardized error handling for GitHub MCP Server
 * Provides consistent error types and handling patterns
 */

import { logger, LogContext } from './logger.js';
import { metrics } from './metrics.js';

/**
 * Base error class for all GitHub MCP errors
 */
export class GitHubMCPError extends Error {
  public readonly code: string;
  public readonly statusCode?: number | undefined;
  public readonly context?: Record<string, any> | undefined;
  public readonly isRetryable: boolean;
  public readonly originalError?: Error | undefined;
  public readonly correlationId?: string | undefined;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    context?: Record<string, any>,
    originalError?: Error,
    correlationId?: string
  ) {
    super(message);
    this.name = 'GitHubMCPError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.originalError = originalError;
    this.correlationId = correlationId;
    this.timestamp = new Date();
    this.isRetryable = this.determineRetryability();
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GitHubMCPError);
    }
  }

  private determineRetryability(): boolean {
    // Network and rate limit errors are retryable
    if (this.statusCode && [429, 502, 503, 504].includes(this.statusCode)) {
      return true;
    }
    // Specific error codes that are retryable
    if (['RATE_LIMIT', 'NETWORK_ERROR', 'TIMEOUT'].includes(this.code)) {
      return true;
    }
    return false;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      isRetryable: this.isRetryable,
      correlationId: this.correlationId,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends GitHubMCPError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'AUTHENTICATION_ERROR', 401, context);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends GitHubMCPError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'AUTHORIZATION_ERROR', 403, context);
    this.name = 'AuthorizationError';
  }
}

/**
 * Resource not found error
 */
export class NotFoundError extends GitHubMCPError {
  constructor(resource: string, context?: Record<string, any>) {
    super(`Resource not found: ${resource}`, 'NOT_FOUND', 404, context);
    this.name = 'NotFoundError';
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends GitHubMCPError {
  public readonly resetTime?: Date | undefined;
  public readonly limit?: number | undefined;
  public readonly remaining?: number | undefined;

  constructor(
    message: string,
    resetTime?: number,
    limit?: number,
    remaining?: number
  ) {
    const context = { resetTime, limit, remaining };
    super(message, 'RATE_LIMIT', 429, context);
    this.name = 'RateLimitError';
    this.resetTime = resetTime ? new Date(resetTime * 1000) : undefined;
    this.limit = limit;
    this.remaining = remaining;
  }
}

/**
 * Network error
 */
export class NetworkError extends GitHubMCPError {
  constructor(message: string, originalError?: Error) {
    super(message, 'NETWORK_ERROR', undefined, undefined, originalError);
    this.name = 'NetworkError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends GitHubMCPError {
  constructor(operation: string, timeout: number) {
    super(
      `Operation '${operation}' timed out after ${timeout}ms`,
      'TIMEOUT',
      undefined,
      { operation, timeout }
    );
    this.name = 'TimeoutError';
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends GitHubMCPError {
  constructor(message: string, missingConfig?: string[]) {
    super(message, 'CONFIGURATION_ERROR', undefined, { missingConfig });
    this.name = 'ConfigurationError';
  }
}

/**
 * Generic API error for user-facing responses
 */
export class APIError extends GitHubMCPError {
  constructor(message: string, statusCode: number = 500, context?: Record<string, any>) {
    super(message, 'API_ERROR', statusCode, context);
    this.name = 'APIError';
  }
}

/**
 * Error handler wrapper for consistent error handling with observability
 */
export async function withErrorHandling<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  const startTime = Date.now();
  const correlationId = logger.generateCorrelationId();
  const operationLogger = logger.child({
    correlationId,
    operation,
    ...context
  });

  operationLogger.debug('Operation started', { context });

  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    
    operationLogger.info('Operation completed successfully', {
      duration,
      success: true
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const normalizedError = normalizeError(error, operation, context);
    
    // Record error metrics
    metrics.recordError({
      tool: context?.tool || 'unknown',
      operation,
      errorType: normalizedError.name,
      message: normalizedError.message,
      timestamp: Date.now()
    });

    operationLogger.error('Operation failed', {
      duration,
      success: false,
      errorType: normalizedError.name,
      errorCode: normalizedError.code,
      statusCode: normalizedError.statusCode || undefined,
      isRetryable: normalizedError.isRetryable
    }, normalizedError);

    throw normalizedError;
  }
}

/**
 * Normalize various error types into GitHubMCPError
 */
export function normalizeError(
  error: any,
  operation?: string,
  context?: Record<string, any>
): GitHubMCPError {
  // Already a GitHubMCPError
  if (error instanceof GitHubMCPError) {
    return error;
  }

  // GitHub API error (from Octokit)
  if (error.status) {
    const message = error.message || 'GitHub API error';
    const statusCode = error.status;
    
    // Check for specific error types
    if (statusCode === 401) {
      return new AuthenticationError(message, { ...context, operation });
    }
    if (statusCode === 403) {
      // Check if it's a rate limit error
      if (error.response?.headers?.['x-ratelimit-remaining'] === '0') {
        return new RateLimitError(
          'GitHub API rate limit exceeded',
          parseInt(error.response.headers['x-ratelimit-reset']) || undefined,
          parseInt(error.response.headers['x-ratelimit-limit']) || undefined,
          0
        );
      }
      return new AuthorizationError(message, { ...context, operation });
    }
    if (statusCode === 404) {
      return new NotFoundError(operation || 'Unknown resource', context);
    }
    if (statusCode === 429) {
      return new RateLimitError(
        message,
        parseInt(error.response?.headers?.['x-ratelimit-reset']) || undefined,
        parseInt(error.response?.headers?.['x-ratelimit-limit']) || undefined,
        parseInt(error.response?.headers?.['x-ratelimit-remaining']) || undefined
      );
    }

    return new GitHubMCPError(
      message,
      'GITHUB_API_ERROR',
      statusCode,
      { ...context, operation },
      error
    );
  }

  // Network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
    return new NetworkError(
      `Network error during ${operation}: ${error.message}`,
      error
    );
  }

  // Timeout errors
  if (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT') {
    return new TimeoutError(operation || 'Unknown operation', 30000);
  }

  // Generic error
  return new GitHubMCPError(
    error.message || 'An unknown error occurred',
    'UNKNOWN_ERROR',
    undefined,
    { ...context, operation },
    error
  );
}

/**
 * Retry logic for retryable errors with observability
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    backoffMs?: number;
    maxBackoffMs?: number;
    operation?: string;
    context?: LogContext;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    backoffMs = 1000,
    maxBackoffMs = 10000,
    operation = 'unknown_operation',
    context = {},
    onRetry,
  } = options;

  const retryLogger = logger.child({ 
    ...context, 
    operation,
    maxAttempts 
  });

  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        retryLogger.info('Retrying operation', { attempt, maxAttempts });
      }
      
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      const normalizedError = error instanceof GitHubMCPError 
        ? error 
        : normalizeError(error, operation, context);
      
      // Log retry attempt
      retryLogger.warn('Operation failed, checking retry eligibility', {
        attempt,
        maxAttempts,
        errorType: normalizedError.name,
        isRetryable: normalizedError.isRetryable
      });
      
      // Don't retry if not retryable or last attempt
      if (!normalizedError.isRetryable || attempt === maxAttempts) {
        retryLogger.error('Operation failed permanently', {
          attempt,
          maxAttempts,
          reason: !normalizedError.isRetryable ? 'not_retryable' : 'max_attempts_reached'
        });
        
        // Record retry failure metric
        metrics.incrementCounter(`retry_failures_total{operation="${operation}",reason="${!normalizedError.isRetryable ? 'not_retryable' : 'max_attempts'}"}`); 
        
        throw normalizedError;
      }

      // Calculate backoff with exponential increase
      const delay = Math.min(backoffMs * Math.pow(2, attempt - 1), maxBackoffMs);
      
      retryLogger.info('Will retry operation', {
        attempt,
        nextAttempt: attempt + 1,
        delayMs: delay
      });
      
      // Record retry attempt metric
      metrics.incrementCounter(`retry_attempts_total{operation="${operation}"}`);
      
      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, normalizedError);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Error response formatter for MCP
 */
export function formatErrorResponse(error: Error): {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
} {
  if (error instanceof GitHubMCPError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: {
          statusCode: error.statusCode,
          context: error.context,
          isRetryable: error.isRetryable,
        },
      },
    };
  }

  return {
    error: {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
    },
  };
}