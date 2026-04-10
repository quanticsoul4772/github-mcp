import { Octokit } from '@octokit/rest';
import { ValidationError } from '../validation.js';

/**
 * Base class for all tool handlers providing common functionality
 */
export abstract class BaseToolHandler<TParams, TResult> {
  constructor(protected readonly octokit: Octokit) {}

  /**
   * Execute operation with common error handling and logging
   */
  protected async executeWithErrorHandling(
    operation: () => Promise<TResult>,
    context: string
  ): Promise<TResult> {
    try {
      return await operation();
    } catch (error: unknown) {
      // Standardized error handling
      if (error instanceof ValidationError) {
        throw error;
      }

      const err = error as { status?: number; message?: string };

      if (err.status === 404) {
        throw new Error(`${context}: Resource not found`);
      }

      if (err.status === 403) {
        throw new Error(`${context}: Access forbidden - check token permissions`);
      }

      if (err.status === 401) {
        throw new Error(`${context}: Authentication failed - check token`);
      }

      if (err.status && err.message) {
        throw new Error(`${context}: GitHub API error (${err.status}): ${err.message}`);
      }

      throw new Error(`${context}: ${err.message ?? 'Unknown error'}`);
    }
  }

  /**
   * Validate required parameters
   */
  protected validateParams(
    params: TParams,
    validator: (params: TParams) => boolean,
    message: string
  ): void {
    if (!validator(params)) {
      throw new ValidationError('params', message);
    }
  }

  /**
   * Template method for handling tool execution
   */
  async handle(params: TParams): Promise<TResult> {
    this.validateInput(params);
    return this.executeOperation(params);
  }

  protected abstract validateInput(params: TParams): void;
  protected abstract executeOperation(params: TParams): Promise<TResult>;
}
