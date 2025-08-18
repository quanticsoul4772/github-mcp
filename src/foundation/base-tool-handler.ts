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
    } catch (error: any) {
      // Standardized error handling
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

      if (error.status && error.message) {
        throw new Error(`${context}: GitHub API error (${error.status}): ${error.message}`);
      }

      throw new Error(`${context}: ${error.message || 'Unknown error'}`);
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
