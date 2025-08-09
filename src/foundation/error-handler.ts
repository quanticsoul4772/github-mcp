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
    
    if (error.status === 404) {
      throw new Error(`${context}: Resource not found`);
    }
    
    if (error.status === 403) {
      throw new Error(`${context}: Access forbidden - check token permissions`);
    }
    
    if (error.status === 401) {
      throw new Error(`${context}: Authentication failed - check token`);
    }
    
    if (error.status === 422) {
      const message = error.response?.data?.message || 'Validation failed';
      const errors = error.response?.data?.errors || [];
      const errorDetails = errors.length > 0 ? `: ${errors.map((e: any) => e.message).join(', ')}` : '';
      throw new Error(`${context}: ${message}${errorDetails}`);
    }
    
    if (error.status && error.message) {
      throw new Error(`${context}: GitHub API error (${error.status}): ${error.message}`);
    }
    
    throw new Error(`${context}: ${error.message || 'Unknown error'}`);
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