/**
 * Type Safety Utilities for Tool Handlers
 * 
 * This module provides runtime validation and type safety for tool handlers,
 * converting JSON schemas to Zod schemas for proper validation.
 */

import { z } from 'zod';

/**
 * Error thrown when parameter validation fails
 */
export class ParameterValidationError extends Error {
  constructor(
    public readonly errors: z.ZodError,
    public readonly toolName: string
  ) {
    super(`Parameter validation failed for tool '${toolName}': ${errors.message}`);
    this.name = 'ParameterValidationError';
  }
}

/**
 * Creates a type-safe handler wrapper that validates parameters at runtime
 * 
 * @param schema - Zod schema for parameter validation
 * @param handler - The actual handler function
 * @param toolName - Name of the tool for error reporting
 * @returns A wrapped handler with runtime validation
 */
export function createTypeSafeHandler<T>(
  schema: z.ZodSchema<T>,
  handler: (params: T) => Promise<any>,
  toolName: string
) {
  return async (args: unknown): Promise<any> => {
    try {
      // Validate and parse the parameters
      const validatedParams = schema.parse(args);
      
      // Call the handler with validated, typed parameters
      return await handler(validatedParams);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ParameterValidationError(error, toolName);
      }
      throw error;
    }
  };
}

/**
 * Converts a JSON Schema object to a Zod schema
 * This provides a bridge between existing JSON schemas and Zod validation
 */
export function jsonSchemaToZod(jsonSchema: any): z.ZodSchema<any> {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return z.unknown();
  }

  switch (jsonSchema.type) {
    case 'string':
      let stringSchema = z.string();
      if (jsonSchema.enum) {
        return z.enum(jsonSchema.enum);
      }
      if (jsonSchema.minLength !== undefined) {
        stringSchema = stringSchema.min(jsonSchema.minLength);
      }
      if (jsonSchema.maxLength !== undefined) {
        stringSchema = stringSchema.max(jsonSchema.maxLength);
      }
      if (jsonSchema.pattern) {
        stringSchema = stringSchema.regex(new RegExp(jsonSchema.pattern));
      }
      return stringSchema;

    case 'number':
    case 'integer':
      let numberSchema = jsonSchema.type === 'integer' ? z.number().int() : z.number();
      if (jsonSchema.minimum !== undefined) {
        numberSchema = numberSchema.min(jsonSchema.minimum);
      }
      if (jsonSchema.maximum !== undefined) {
        numberSchema = numberSchema.max(jsonSchema.maximum);
      }
      return numberSchema;

    case 'boolean':
      return z.boolean();

    case 'array':
      let arraySchema = z.array(
        jsonSchema.items ? jsonSchemaToZod(jsonSchema.items) : z.unknown()
      );
      if (jsonSchema.minItems !== undefined) {
        arraySchema = arraySchema.min(jsonSchema.minItems);
      }
      if (jsonSchema.maxItems !== undefined) {
        arraySchema = arraySchema.max(jsonSchema.maxItems);
      }
      return arraySchema;

    case 'object':
      if (!jsonSchema.properties) {
        return z.record(z.string(), z.unknown());
      }

      const shape: Record<string, z.ZodSchema<any>> = {};
      for (const [key, propSchema] of Object.entries(jsonSchema.properties)) {
        shape[key] = jsonSchemaToZod(propSchema);
      }

      let objectSchema = z.object(shape);

      // Handle required fields
      if (jsonSchema.required && Array.isArray(jsonSchema.required)) {
        // Zod objects are strict by default, so we need to make optional fields optional
        const requiredFields = new Set(jsonSchema.required);
        const newShape: Record<string, z.ZodSchema<any>> = {};
        
        for (const [key, schema] of Object.entries(shape)) {
          newShape[key] = requiredFields.has(key) ? schema : schema.optional();
        }
        
        objectSchema = z.object(newShape);
      } else {
        // If no required fields specified, make all optional
        const newShape: Record<string, z.ZodSchema<any>> = {};
        for (const [key, schema] of Object.entries(shape)) {
          newShape[key] = schema.optional();
        }
        objectSchema = z.object(newShape);
      }

      return objectSchema;

    default:
      return z.unknown();
  }
}

/**
 * Common parameter schemas for GitHub API operations
 */
export const CommonSchemas = {
  // Repository identification
  repository: z.object({
    owner: z.string().min(1, 'Owner is required'),
    repo: z.string().min(1, 'Repository name is required'),
  }),

  // Pagination parameters
  pagination: z.object({
    page: z.number().int().min(1).optional(),
    per_page: z.number().int().min(1).max(100).optional(),
  }),

  // Issue/PR number
  issueNumber: z.object({
    issue_number: z.number().int().min(1, 'Issue number must be positive'),
  }),

  // Pull request number
  pullNumber: z.object({
    pull_number: z.number().int().min(1, 'Pull request number must be positive'),
  }),

  // User identification
  username: z.object({
    username: z.string().min(1, 'Username is required'),
  }),

  // Organization identification
  org: z.object({
    org: z.string().min(1, 'Organization name is required'),
  }),

  // Search query
  searchQuery: z.object({
    q: z.string().min(1, 'Search query is required'),
  }),

  // File path
  filePath: z.object({
    path: z.string().min(1, 'File path is required'),
  }),

  // Branch/ref name
  ref: z.object({
    ref: z.string().min(1, 'Reference name is required'),
  }),

  // Comment ID
  commentId: z.object({
    comment_id: z.number().int().min(1, 'Comment ID must be positive'),
  }),

  // Labels array
  labels: z.object({
    labels: z.array(z.string()).optional(),
  }),

  // State filter
  state: z.object({
    state: z.enum(['open', 'closed', 'all']).optional(),
  }),

  // Sort options
  sort: z.object({
    sort: z.string().optional(),
    direction: z.enum(['asc', 'desc']).optional(),
  }),
};

/**
 * Utility to combine multiple schemas into a single flat schema
 */
export function combineSchemas<T extends Record<string, z.ZodSchema<any>>>(
  schemas: T
): z.ZodSchema<any> {
  // Extract all properties from the schemas and combine them into a single object schema
  const combinedShape: Record<string, z.ZodSchema<any>> = {};
  
  for (const schema of Object.values(schemas)) {
    if (schema instanceof z.ZodObject) {
      // Access the shape property correctly
      const shape = (schema as any).shape;
      Object.assign(combinedShape, shape);
    }
  }
  
  return z.object(combinedShape);
}

/**
 * Pre-built schemas for common GitHub operations
 */
export const GitHubSchemas = {
  // Get issue parameters
  getIssue: z.object({
    owner: z.string().min(1, 'Owner is required'),
    repo: z.string().min(1, 'Repository name is required'),
    issue_number: z.number().int().min(1, 'Issue number must be positive'),
  }),

  // List issues parameters
  listIssues: z.object({
    owner: z.string().min(1, 'Owner is required'),
    repo: z.string().min(1, 'Repository name is required'),
    page: z.number().int().min(1).optional(),
    per_page: z.number().int().min(1).max(100).optional(),
    state: z.enum(['open', 'closed', 'all']).optional(),
    labels: z.array(z.string()).optional(),
    sort: z.string().optional(),
    direction: z.enum(['asc', 'desc']).optional(),
  }),

  // Create issue parameters
  createIssue: z.object({
    owner: z.string().min(1, 'Owner is required'),
    repo: z.string().min(1, 'Repository name is required'),
    title: z.string().min(1, 'Issue title is required'),
    body: z.string().optional(),
    assignees: z.array(z.string()).optional(),
    milestone: z.number().int().optional(),
    labels: z.array(z.string()).optional(),
  }),

  // Update issue parameters
  updateIssue: z.object({
    owner: z.string().min(1, 'Owner is required'),
    repo: z.string().min(1, 'Repository name is required'),
    issue_number: z.number().int().min(1, 'Issue number must be positive'),
    title: z.string().optional(),
    body: z.string().optional(),
    state: z.enum(['open', 'closed']).optional(),
    assignees: z.array(z.string()).optional(),
    milestone: z.number().int().nullable().optional(),
    labels: z.array(z.string()).optional(),
  }),

  // Get pull request parameters
  getPullRequest: z.object({
    owner: z.string().min(1, 'Owner is required'),
    repo: z.string().min(1, 'Repository name is required'),
    pull_number: z.number().int().min(1, 'Pull request number must be positive'),
  }),

  // List pull requests parameters
  listPullRequests: z.object({
    owner: z.string().min(1, 'Owner is required'),
    repo: z.string().min(1, 'Repository name is required'),
    page: z.number().int().min(1).optional(),
    per_page: z.number().int().min(1).max(100).optional(),
    state: z.enum(['open', 'closed', 'all']).optional(),
    sort: z.enum(['created', 'updated', 'popularity', 'long-running']).optional(),
    direction: z.enum(['asc', 'desc']).optional(),
  }),

  // Create pull request parameters
  createPullRequest: z.object({
    owner: z.string().min(1, 'Owner is required'),
    repo: z.string().min(1, 'Repository name is required'),
    title: z.string().min(1, 'Pull request title is required'),
    head: z.string().min(1, 'Head branch is required'),
    base: z.string().min(1, 'Base branch is required'),
    body: z.string().optional(),
    maintainer_can_modify: z.boolean().optional(),
    draft: z.boolean().optional(),
  }),

  // Get user parameters
  getUser: z.object({
    username: z.string().min(1, 'Username is required'),
  }),

  // Search repositories parameters
  searchRepositories: z.object({
    q: z.string().min(1, 'Search query is required'),
    page: z.number().int().min(1).optional(),
    per_page: z.number().int().min(1).max(100).optional(),
    sort: z.enum(['stars', 'forks', 'help-wanted-issues', 'updated']).optional(),
    order: z.enum(['desc', 'asc']).optional(),
  }),

  // Get repository parameters
  getRepository: z.object({
    owner: z.string().min(1, 'Owner is required'),
    repo: z.string().min(1, 'Repository name is required'),
  }),

  // List user repositories parameters
  listUserRepositories: z.object({
    username: z.string().min(1, 'Username is required'),
    page: z.number().int().min(1).optional(),
    per_page: z.number().int().min(1).max(100).optional(),
    type: z.enum(['all', 'owner', 'member']).optional(),
    sort: z.enum(['created', 'updated', 'pushed', 'full_name']).optional(),
    direction: z.enum(['asc', 'desc']).optional(),
  }),
};

/**
 * Type-safe handler factory for common GitHub operations
 */
export class TypeSafeHandlerFactory {
  /**
   * Creates a type-safe handler for getting an issue
   */
  static createGetIssueHandler(
    handler: (params: z.infer<typeof GitHubSchemas.getIssue>) => Promise<any>
  ) {
    return createTypeSafeHandler(GitHubSchemas.getIssue, handler, 'get_issue');
  }

  /**
   * Creates a type-safe handler for listing issues
   */
  static createListIssuesHandler(
    handler: (params: z.infer<typeof GitHubSchemas.listIssues>) => Promise<any>
  ) {
    return createTypeSafeHandler(GitHubSchemas.listIssues, handler, 'list_issues');
  }

  /**
   * Creates a type-safe handler for creating an issue
   */
  static createCreateIssueHandler(
    handler: (params: z.infer<typeof GitHubSchemas.createIssue>) => Promise<any>
  ) {
    return createTypeSafeHandler(GitHubSchemas.createIssue, handler, 'create_issue');
  }

  /**
   * Creates a type-safe handler for updating an issue
   */
  static createUpdateIssueHandler(
    handler: (params: z.infer<typeof GitHubSchemas.updateIssue>) => Promise<any>
  ) {
    return createTypeSafeHandler(GitHubSchemas.updateIssue, handler, 'update_issue');
  }

  /**
   * Creates a type-safe handler for getting a pull request
   */
  static createGetPullRequestHandler(
    handler: (params: z.infer<typeof GitHubSchemas.getPullRequest>) => Promise<any>
  ) {
    return createTypeSafeHandler(GitHubSchemas.getPullRequest, handler, 'get_pull_request');
  }

  /**
   * Creates a type-safe handler for listing pull requests
   */
  static createListPullRequestsHandler(
    handler: (params: z.infer<typeof GitHubSchemas.listPullRequests>) => Promise<any>
  ) {
    return createTypeSafeHandler(GitHubSchemas.listPullRequests, handler, 'list_pull_requests');
  }

  /**
   * Creates a type-safe handler for creating a pull request
   */
  static createCreatePullRequestHandler(
    handler: (params: z.infer<typeof GitHubSchemas.createPullRequest>) => Promise<any>
  ) {
    return createTypeSafeHandler(GitHubSchemas.createPullRequest, handler, 'create_pull_request');
  }

  /**
   * Creates a type-safe handler for getting a user
   */
  static createGetUserHandler(
    handler: (params: z.infer<typeof GitHubSchemas.getUser>) => Promise<any>
  ) {
    return createTypeSafeHandler(GitHubSchemas.getUser, handler, 'get_user');
  }

  /**
   * Creates a type-safe handler for searching repositories
   */
  static createSearchRepositoriesHandler(
    handler: (params: z.infer<typeof GitHubSchemas.searchRepositories>) => Promise<any>
  ) {
    return createTypeSafeHandler(GitHubSchemas.searchRepositories, handler, 'search_repositories');
  }

  /**
   * Creates a type-safe handler for getting a repository
   */
  static createGetRepositoryHandler(
    handler: (params: z.infer<typeof GitHubSchemas.getRepository>) => Promise<any>
  ) {
    return createTypeSafeHandler(GitHubSchemas.getRepository, handler, 'get_repository');
  }

  /**
   * Creates a type-safe handler for listing user repositories
   */
  static createListUserRepositoriesHandler(
    handler: (params: z.infer<typeof GitHubSchemas.listUserRepositories>) => Promise<any>
  ) {
    return createTypeSafeHandler(GitHubSchemas.listUserRepositories, handler, 'list_user_repositories');
  }

  /**
   * Generic handler factory for custom schemas
   */
  static createCustomHandler<T>(
    schema: z.ZodSchema<T>,
    handler: (params: T) => Promise<any>,
    toolName: string
  ) {
    return createTypeSafeHandler(schema, handler, toolName);
  }
}

/**
 * Utility to validate parameters without creating a handler
 */
export function validateParameters<T>(
  schema: z.ZodSchema<T>,
  params: unknown,
  toolName: string
): T {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ParameterValidationError(error, toolName);
    }
    throw error;
  }
}