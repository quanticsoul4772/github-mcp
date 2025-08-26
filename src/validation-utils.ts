/**
 * Basic validation utilities without external dependencies
 * These utilities are used by both config.ts and validation.ts
 */

/**
 * Validation error detail with context information for comprehensive debugging
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
  value?: unknown;
  context?: Record<string, unknown>;
}

/**
 * Validation warning for non-critical issues that don't prevent operation
 */
export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  value?: unknown;
  suggestion?: string;
}

/**
 * Validation result interface with comprehensive error and warning support
 */
export interface ValidationResult<T> {
  isValid: boolean;
  data?: T;
  errors: ValidationErrorDetail[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

/**
 * Create a successful validation result
 */
export function createSuccessResult<T>(
  data: T,
  warnings: ValidationWarning[] = [],
  suggestions: string[] = []
): ValidationResult<T> {
  return {
    isValid: true,
    data,
    errors: [],
    warnings,
    suggestions,
  };
}

/**
 * Create a failed validation result
 */
export function createErrorResult<T>(
  errors: ValidationErrorDetail[],
  warnings: ValidationWarning[] = [],
  suggestions: string[] = []
): ValidationResult<T> {
  return {
    isValid: false,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Create a validation error
 */
export function createValidationError(
  field: string,
  message: string,
  code: string,
  value?: unknown,
  context?: Record<string, unknown>
): ValidationErrorDetail {
  return { field, message, code, value, context };
}

/**
 * Create a validation warning
 */
export function createValidationWarning(
  field: string,
  message: string,
  code: string,
  value?: unknown,
  suggestion?: string
): ValidationWarning {
  return { field, message, code, value, suggestion };
}

/**
 * Retry configuration interface
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration for validation operations
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

/**
 * Execute a function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context: string = 'operation'
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === config.maxAttempts) {
        break;
      }
      
      const delay = Math.min(
        config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelayMs
      );
      
      console.warn(`${context} failed (attempt ${attempt}/${config.maxAttempts}), retrying in ${delay}ms:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}