/**
 * GraphQL input validation utilities for GitHub MCP Server
 * Provides security-focused validation for GraphQL query inputs to prevent injection attacks
 */

import { z } from 'zod';
import { validateOwnerName, validateRepoName, sanitizeText } from './validation.js';

/**
 * Validates and sanitizes owner/repository format
 */
export const OwnerRepoSchema = z.object({
  owner: z.string()
    .min(1, 'Owner name is required')
    .max(39, 'Owner name must be 39 characters or less')
    .refine(validateOwnerName, 'Invalid owner name format'),
  repo: z.string()
    .min(1, 'Repository name is required')
    .max(100, 'Repository name must be 100 characters or less')
    .refine(validateRepoName, 'Invalid repository name format'),
});

/**
 * Validates ISO 8601 date strings
 */
export const ISO8601DateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/, 'Date must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)')
  .refine((date) => {
    try {
      const parsed = new Date(date);
      return !isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2100;
    } catch {
      return false;
    }
  }, 'Invalid date or date out of reasonable range (2000-2100)');

/**
 * Validates optional ISO 8601 date strings
 */
export const OptionalISO8601DateSchema = z.string()
  .optional()
  .refine((date) => !date || ISO8601DateSchema.safeParse(date).success, 'Date must be in ISO 8601 format if provided');

/**
 * Validates search query strings with sanitization
 */
export const SearchQuerySchema = z.string()
  .min(1, 'Search query cannot be empty')
  .max(1000, 'Search query must be 1000 characters or less')
  .transform((query) => sanitizeSearchQuery(query));

/**
 * Validates numeric pagination limits
 */
export const PaginationLimitSchema = z.number()
  .int('Must be an integer')
  .min(1, 'Must be at least 1')
  .max(100, 'Must be 100 or less');

/**
 * Validates repository list with size limits
 */
export const RepositoryListSchema = z.array(OwnerRepoSchema)
  .min(1, 'At least one repository is required')
  .max(10, 'Cannot query more than 10 repositories at once');

/**
 * Validates username array with size limits
 */
export const UsernameListSchema = z.array(
  z.string()
    .min(1, 'Username cannot be empty')
    .max(39, 'Username must be 39 characters or less')
    .refine(validateOwnerName, 'Invalid username format')
)
  .min(1, 'At least one username is required')
  .max(10, 'Cannot query more than 10 users at once');

/**
 * Validates label array with size limits
 */
export const LabelListSchema = z.array(
  z.string()
    .min(1, 'Label cannot be empty')
    .max(50, 'Label must be 50 characters or less')
    .transform((label) => sanitizeText(label, 50))
)
  .max(20, 'Cannot specify more than 20 labels');

/**
 * Validates topic array with size limits
 */
export const TopicListSchema = z.array(
  z.string()
    .min(1, 'Topic cannot be empty')
    .max(50, 'Topic must be 50 characters or less')
    .regex(/^[a-z0-9-]+$/, 'Topics can only contain lowercase letters, numbers, and hyphens')
)
  .max(20, 'Cannot specify more than 20 topics');

/**
 * Validates GitHub branch/ref names
 */
export const RefNameSchema = z.string()
  .min(1, 'Branch/ref name cannot be empty')
  .max(255, 'Branch/ref name must be 255 characters or less')
  .regex(/^[^~^:\\\s\t\n]+$/, 'Branch/ref name contains invalid characters')
  .refine(
    (ref) => !ref.startsWith('.') && !ref.startsWith('-') && !ref.endsWith('.lock') && !ref.includes('..') && !ref.includes('@{'),
    'Invalid branch/ref name format'
  );

/**
 * Validates GitHub search types
 */
export const SearchTypeSchema = z.enum(['REPOSITORY', 'ISSUE', 'USER', 'DISCUSSION'], {
  errorMap: () => ({ message: 'Search type must be one of: REPOSITORY, ISSUE, USER, DISCUSSION' })
});

/**
 * Validates GitHub issue/milestone states
 */
export const IssueStateSchema = z.enum(['OPEN', 'CLOSED'], {
  errorMap: () => ({ message: 'State must be either OPEN or CLOSED' })
});

/**
 * Validates milestone states
 */
export const MilestoneStateSchema = z.enum(['OPEN', 'CLOSED'], {
  errorMap: () => ({ message: 'Milestone state must be either OPEN or CLOSED' })
});

/**
 * Validates entity types for user/organization queries
 */
export const EntityTypeSchema = z.enum(['USER', 'ORGANIZATION'], {
  errorMap: () => ({ message: 'Entity type must be either USER or ORGANIZATION' })
});

/**
 * Validates star count filter strings (e.g., ">100", "10..50")
 */
export const StarFilterSchema = z.string()
  .regex(/^(>|>=|<|<=)?\d+$|^\d+\.\.\d+$/, 'Star filter must be in format: ">100", ">=10", "<50", "10..100", or just "50"')
  .transform((filter) => filter.replace(/[^\d.<>=.]/g, ''));

/**
 * Validates size filter strings for repository size
 */
export const SizeFilterSchema = z.string()
  .regex(/^(>|>=|<|<=)?\d+$|^\d+\.\.\d+$/, 'Size filter must be in format: ">1000", ">=100", "<500", "100..1000", or just "500"')
  .transform((filter) => filter.replace(/[^\d.<>=.]/g, ''));

/**
 * Validates date filter strings (e.g., ">2020-01-01")
 */
export const DateFilterSchema = z.string()
  .regex(/^(>|>=|<|<=)?\d{4}-\d{2}-\d{2}$/, 'Date filter must be in format: ">2020-01-01", ">=2020-01-01", "<2023-12-31", or just "2020-01-01"')
  .refine((dateFilter) => {
    const dateMatch = dateFilter.match(/\d{4}-\d{2}-\d{2}/);
    if (!dateMatch) return false;
    const date = new Date(dateMatch[0]);
    return !isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100;
  }, 'Invalid date in filter');

/**
 * Sanitizes search query strings to prevent GraphQL injection
 */
function sanitizeSearchQuery(query: string): string {
  // Remove null bytes and control characters
  let sanitized = query.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Escape potential GraphQL injection patterns
  sanitized = sanitized.replace(/[{}]/g, ''); // Remove curly braces that could inject GraphQL
  sanitized = sanitized.replace(/\$[a-zA-Z_][a-zA-Z0-9_]*/g, ''); // Remove variable references
  sanitized = sanitized.replace(/(query|mutation|subscription)\s*{/gi, ''); // Remove GraphQL keywords
  
  // Limit special characters that could be dangerous
  sanitized = sanitized.replace(/[`'"\\]/g, ''); // Remove quotes and backslashes
  
  return sanitized.trim();
}

/**
 * Validates repository insights tool parameters
 */
export const RepositoryInsightsSchema = z.object({
  owner: z.string().refine(validateOwnerName, 'Invalid owner name format'),
  repo: z.string().refine(validateRepoName, 'Invalid repository name format'),
  since: OptionalISO8601DateSchema,
});

/**
 * Validates contribution statistics parameters
 */
export const ContributionStatsSchema = z.object({
  owner: z.string().refine(validateOwnerName, 'Invalid owner name format'),
  repo: z.string().refine(validateRepoName, 'Invalid repository name format'),
  first: PaginationLimitSchema.optional(),
});

/**
 * Validates commit activity parameters
 */
export const CommitActivitySchema = z.object({
  owner: z.string().refine(validateOwnerName, 'Invalid owner name format'),
  repo: z.string().refine(validateRepoName, 'Invalid repository name format'),
  branch: RefNameSchema.optional(),
  since: OptionalISO8601DateSchema,
  until: OptionalISO8601DateSchema,
});

/**
 * Validates cross-repository search parameters
 */
export const CrossRepoSearchSchema = z.object({
  query: SearchQuerySchema,
  type: SearchTypeSchema,
  first: PaginationLimitSchema.optional(),
  after: z.string().optional(),
});

/**
 * Validates advanced repository search parameters
 */
export const AdvancedRepoSearchSchema = z.object({
  query: SearchQuerySchema,
  language: z.string().max(50).optional(),
  stars: StarFilterSchema.optional(),
  forks: StarFilterSchema.optional(),
  size: SizeFilterSchema.optional(),
  created: DateFilterSchema.optional(),
  pushed: DateFilterSchema.optional(),
  license: z.string().max(50).optional(),
  topics: TopicListSchema.optional(),
  includeMetrics: z.boolean().optional(),
  first: z.number().int().min(1).max(50).optional(),
});

/**
 * Validates search with relationships parameters
 */
export const SearchWithRelationshipsSchema = z.object({
  entityType: EntityTypeSchema,
  query: SearchQuerySchema,
  includeRepositories: z.boolean().optional(),
  includeGists: z.boolean().optional(),
  includeFollowers: z.boolean().optional(),
  repositoryLimit: z.number().int().min(1).max(25).optional(),
  first: z.number().int().min(1).max(20).optional(),
});

/**
 * Validates project boards parameters
 */
export const ProjectBoardsSchema = z.object({
  owner: z.string().refine(validateOwnerName, 'Invalid owner name format'),
  repo: z.string().refine(validateRepoName, 'Invalid repository name format').optional(),
  first: z.number().int().min(1).max(50).optional(),
});

/**
 * Validates milestones with issues parameters
 */
export const MilestonesWithIssuesSchema = z.object({
  owner: z.string().refine(validateOwnerName, 'Invalid owner name format'),
  repo: z.string().refine(validateRepoName, 'Invalid repository name format'),
  state: MilestoneStateSchema.optional(),
  first: z.number().int().min(1).max(25).optional(),
});

/**
 * Validates cross-repository project view parameters
 */
export const CrossRepoProjectViewSchema = z.object({
  repositories: RepositoryListSchema,
  labels: LabelListSchema.optional(),
  assignee: z.string().max(39).refine(validateOwnerName, 'Invalid assignee username format').optional(),
  state: IssueStateSchema.optional(),
  milestone: z.string().max(255).transform((milestone) => sanitizeText(milestone, 255)).optional(),
});

/**
 * Validates batch repository query parameters
 */
export const BatchRepositoryQuerySchema = z.object({
  repositories: z.array(
    z.object({
      owner: z.string().refine(validateOwnerName, 'Invalid owner name format'),
      repo: z.string().refine(validateRepoName, 'Invalid repository name format'),
      alias: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Alias must be a valid identifier').optional(),
    })
  ).min(1).max(10),
  includeLanguages: z.boolean().optional(),
  includeContributors: z.boolean().optional(),
  includeIssuesSummary: z.boolean().optional(),
  includeRecentCommits: z.boolean().optional(),
});

/**
 * Validates batch user query parameters
 */
export const BatchUserQuerySchema = z.object({
  usernames: UsernameListSchema,
  includeRepositories: z.boolean().optional(),
  includeFollowers: z.boolean().optional(),
  repositoryLimit: z.number().int().min(1).max(10).optional(),
});

/**
 * Validates batch GraphQL query parameters
 */
export const BatchGraphQLQuerySchema = z.object({
  queries: z.array(
    z.object({
      alias: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Alias must be a valid identifier'),
      query: z.string().min(1, 'Query cannot be empty').max(5000, 'Query too long'),
      variables: z.record(z.any()).optional(),
    })
  ).min(1).max(10),
});

/**
 * Creates a validation error with consistent format for GraphQL inputs
 */
export class GraphQLValidationError extends Error {
  public readonly field: string;
  public readonly code: string;

  constructor(field: string, message: string, code: string = 'VALIDATION_ERROR') {
    super(`GraphQL validation failed for ${field}: ${message}`);
    this.name = 'GraphQLValidationError';
    this.field = field;
    this.code = code;
  }
}

/**
 * Helper function to validate and sanitize GraphQL input parameters
 */
export function validateGraphQLInput<T>(schema: z.ZodSchema<T>, input: unknown, context: string): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
      throw new GraphQLValidationError(context, issues, 'INVALID_INPUT');
    }
    throw new GraphQLValidationError(context, 'Unknown validation error', 'VALIDATION_ERROR');
  }
}

/**
 * Validates that a string is safe for GraphQL variable substitution
 */
export function validateGraphQLVariableValue(value: any, variableName: string): any {
  if (typeof value === 'string') {
    // Check for potential GraphQL injection patterns
    if (value.includes('${') || value.includes('#{') || value.includes('{{')) {
      throw new GraphQLValidationError(variableName, 'String contains potential injection patterns', 'INJECTION_RISK');
    }
    // Sanitize the string
    return sanitizeText(value, 1000);
  }
  
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new GraphQLValidationError(variableName, 'Number must be finite', 'INVALID_NUMBER');
    }
    if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
      throw new GraphQLValidationError(variableName, 'Number out of safe range', 'NUMBER_OUT_OF_RANGE');
    }
    return value;
  }
  
  if (typeof value === 'boolean') {
    return value;
  }
  
  if (value === null || value === undefined) {
    return value;
  }
  
  if (Array.isArray(value)) {
    if (value.length > 100) {
      throw new GraphQLValidationError(variableName, 'Array too large (max 100 items)', 'ARRAY_TOO_LARGE');
    }
    return value.map((item, index) => validateGraphQLVariableValue(item, `${variableName}[${index}]`));
  }
  
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length > 50) {
      throw new GraphQLValidationError(variableName, 'Object has too many properties (max 50)', 'OBJECT_TOO_COMPLEX');
    }
    
    const result: any = {};
    for (const key of keys) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        throw new GraphQLValidationError(variableName, `Invalid property name: ${key}`, 'INVALID_PROPERTY_NAME');
      }
      result[key] = validateGraphQLVariableValue(value[key], `${variableName}.${key}`);
    }
    return result;
  }
  
  throw new GraphQLValidationError(variableName, `Unsupported variable type: ${typeof value}`, 'UNSUPPORTED_TYPE');
}