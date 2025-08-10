import { ValidationError } from '../validation.js';

/**
 * Centralized error handling utilities
 * Provides consistent error handling patterns across all tools
 */
export class ErrorHandler {
  /**
   * Handle GitHub API errors with consistent formatting
   */
  static handleGitHubError(error: any, context: string): never {
    if (error instanceof ValidationError) {
      throw error;
    }

    const messageFrom = (msg: string) =>
      new Error(`${context}: ${msg}`, { cause: error });

    if (error?.status === 404) {
      throw messageFrom('Resource not found');
    }

    if (error?.status === 403) {
      throw messageFrom('Access forbidden - check token permissions');
    }

    if (error?.status === 401) {
      throw messageFrom('Authentication failed - check token');
    }

    if (error?.status === 422) {
      const message = error?.response?.data?.message || 'Validation failed';
      const errors = Array.isArray(error?.response?.data?.errors) ? error.response.data.errors : [];
      const errorDetails = errors.length > 0 ? `: ${errors.map((e: any) => e?.message).filter(Boolean).join(', ')}` : '';
      throw messageFrom(`${message}${errorDetails}`);
    }

    if (error?.status && error?.message) {
      throw messageFrom(`GitHub API error (${error.status}): ${error.message}`);
    }

    const fallbackMsg = typeof error?.message === 'string' && error.message.length > 0 ? error.message : 'Unknown error';
    throw messageFrom(fallbackMsg);
  }

  /**
   * Wrap async operations with error handling
   */
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      ErrorHandler.handleGitHubError(error, context);
    }
  }

  /**
   * Create a standardized validation error
   */
  static createValidationError(field: string, message: string): ValidationError {
    return new ValidationError(field, message);
  }
}

/**
 * Decorator for methods that need error handling
 */
export function withErrorHandling(context: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        ErrorHandler.handleGitHubError(error, `${target.constructor.name}.${propertyKey} (${context})`);
      }
    };

    return descriptor;
  };
}