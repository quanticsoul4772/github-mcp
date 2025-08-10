/**
 * Utilities for type-safe GraphQL operations
 * 
 * This module provides wrapper functions and utilities for making type-safe
 * GraphQL queries and mutations with proper error handling.
 */

import { Octokit } from '@octokit/rest';
import { GraphQLResponse, extractGraphQLData } from './graphql-types.js';

/**
 * Type-safe wrapper for Octokit GraphQL queries
 * 
 * @param octokit - The Octokit instance
 * @param query - The GraphQL query string
 * @param variables - Variables for the query
 * @returns Promise with typed response data
 */
export async function typedGraphQL<T>(
  octokit: Octokit,
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  try {
    // Cast the octokit.graphql response to our typed structure
    const response = await octokit.graphql(query, variables) as T;
    return response;
  } catch (error) {
    // Handle GraphQL-specific errors
    if (error && typeof error === 'object' && 'response' in error) {
      const graphqlError = error as any;
      if (graphqlError.response?.data?.errors) {
        const errorMessages = graphqlError.response.data.errors
          .map((err: any) => err.message)
          .join(', ');
        throw new Error(`GraphQL errors: ${errorMessages}`);
      }
    }
    
    // Re-throw other errors as-is
    throw error;
  }
}

/**
 * Type-safe wrapper for GraphQL queries with validation
 * 
 * @param octokit - The Octokit instance
 * @param query - The GraphQL query string
 * @param variables - Variables for the query
 * @param validator - Optional validation function
 * @returns Promise with validated typed response data
 */
export async function validatedGraphQL<T>(
  octokit: Octokit,
  query: string,
  variables?: Record<string, any>,
  validator?: (data: any) => data is T
): Promise<T> {
  const result = await typedGraphQL<T>(octokit, query, variables);
  
  if (validator && !validator(result)) {
    throw new Error('GraphQL response failed validation');
  }
  
  return result;
}

/**
 * Helper to create type-safe parameter interfaces
 * This ensures handler function parameters are properly typed
 */
export function createTypedHandler<TParams, TResult>(
  handler: (params: TParams) => Promise<TResult>
): (args: unknown) => Promise<TResult> {
  return async (args: unknown) => {
    // In a production environment, you might want to add runtime validation here
    return handler(args as TParams);
  };
}

/**
 * Utility for paginated GraphQL queries
 * 
 * @param octokit - The Octokit instance
 * @param baseQuery - The base GraphQL query template
 * @param variables - Base variables for the query
 * @param pageSize - Number of items per page
 * @param maxPages - Maximum number of pages to fetch
 * @returns Array of all fetched items
 */
export async function paginatedGraphQL<T extends { pageInfo: { hasNextPage: boolean; endCursor: string | null } }>(
  octokit: Octokit,
  baseQuery: string,
  variables: Record<string, any> = {},
  pageSize: number = 25,
  maxPages: number = 10
): Promise<T[]> {
  const results: T[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;
  let pageCount = 0;

  while (hasNextPage && pageCount < maxPages) {
    const queryVariables: Record<string, any> = {
      ...variables,
      first: pageSize,
      after: cursor,
    };

    const result = await typedGraphQL<T>(octokit, baseQuery, queryVariables);
    results.push(result);

    hasNextPage = result.pageInfo.hasNextPage;
    cursor = result.pageInfo.endCursor;
    pageCount++;
  }

  return results;
}

/**
 * Create a safe property accessor for nested GraphQL responses
 * 
 * @param obj - The object to access
 * @param path - Array of property names to traverse
 * @param defaultValue - Default value if path doesn't exist
 * @returns The value at the path or default value
 */
export function safeAccess<T>(
  obj: any,
  path: string[],
  defaultValue: T
): T {
  let current = obj;
  for (const key of path) {
    if (current == null || typeof current !== 'object') {
      return defaultValue;
    }
    current = current[key];
  }
  return current ?? defaultValue;
}

/**
 * Validates that a response contains expected fields
 * 
 * @param response - The response to validate
 * @param requiredFields - Array of required field paths
 * @returns True if all fields are present
 */
export function validateResponseFields(
  response: any,
  requiredFields: string[][]
): boolean {
  return requiredFields.every(path => {
    let current = response;
    for (const key of path) {
      if (current == null || typeof current !== 'object') {
        return false;
      }
      current = current[key];
    }
    return current !== undefined;
  });
}

/**
 * Transform GraphQL error to a user-friendly message
 * 
 * @param error - The error from GraphQL operation
 * @returns User-friendly error message
 */
export function formatGraphQLError(error: any): string {
  if (error?.response?.data?.errors) {
    const errors = error.response.data.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      return errors.map(err => err.message || 'Unknown GraphQL error').join('; ');
    }
  }
  
  if (error?.message) {
    return error.message;
  }
  
  return 'An unknown error occurred while executing GraphQL query';
}