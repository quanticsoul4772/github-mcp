import { ValidationError } from '../validation.js';

type GitHubApiError = {
  status?: number;
  message?: string;
  response?: {
    data?: {
      message?: string;
      errors?: Array<{ message?: string }>;
    };
  };
};

/**
 * Centralized error handling utilities
 * Provides consistent error handling patterns across all tools
 */
export class ErrorHandler {
  /**
   * Handle GitHub API errors with consistent formatting
   */
  static handleGitHubError(error: unknown, context: string): never {
    if (error instanceof ValidationError) {
      throw error;
    }

    const apiErr = error as GitHubApiError;
    const messageFrom = (msg: string) => new Error(`${context}: ${msg}`, { cause: error });

    const statusHandlers: Record<number, () => never> = {
      404: () => { throw messageFrom('Resource not found'); },
      403: () => { throw messageFrom('Access forbidden - check token permissions'); },
      401: () => { throw messageFrom('Authentication failed - check token'); },
      422: () => { throw messageFrom(ErrorHandler.format422Message(apiErr)); },
    };

    const statusHandler = apiErr.status ? statusHandlers[apiErr.status] : undefined;
    if (statusHandler) {
      return statusHandler();
    }

    if (apiErr.status && apiErr.message) {
      throw messageFrom(`GitHub API error (${apiErr.status}): ${apiErr.message}`);
    }

    throw messageFrom(ErrorHandler.getFallbackMessage(apiErr));
  }

  private static format422Message(error: GitHubApiError): string {
    const message = error.response?.data?.message ?? 'Validation failed';
    const rawErrors = error.response?.data?.errors;
    const errors = Array.isArray(rawErrors) ? rawErrors : [];
    if (errors.length === 0) {
      return message;
    }
    const details = errors.map(e => e?.message).filter(Boolean).join(', ');
    return `${message}: ${details}`;
  }

  private static getFallbackMessage(error: GitHubApiError): string {
    const msg = error.message;
    return typeof msg === 'string' && msg.length > 0 ? msg : 'Unknown error';
  }

  /**
   * Wrap async operations with error handling
   */
  static async withErrorHandling<T>(operation: () => Promise<T>, context: string): Promise<T> {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        ErrorHandler.handleGitHubError(
          error,
          `${target.constructor.name}.${propertyKey} (${context})`
        );
      }
    };

    return descriptor;
  };
}
