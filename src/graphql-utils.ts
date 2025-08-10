/**
 * GraphQL utilities for easy integration with caching
 * Provides helper functions to migrate existing GraphQL calls to cached versions
 */

import { OptimizedAPIClient } from './optimized-api-client.js';
import { Octokit } from '@octokit/rest';

/**
 * Cached GraphQL execution helper
 * Wraps OptimizedAPIClient.graphql for easy migration from direct octokit.graphql calls
 */
export async function cachedGraphQL<T>(
  client: OptimizedAPIClient | Octokit,
  query: string,
  variables: Record<string, any> = {},
  options: {
    ttl?: number;
    skipCache?: boolean;
    operation?: string;
  } = {}
): Promise<T> {
  // If client is OptimizedAPIClient, use cached GraphQL
  if (client && typeof (client as any).graphql === 'function' && 'getMetrics' in client) {
    return (client as OptimizedAPIClient).graphql<T>(query, variables, options);
  }
  
  // Fallback to direct octokit.graphql for backward compatibility
  return (client as Octokit).graphql(query, variables) as Promise<T>;
}

/**
 * Enhanced GraphQL execution with automatic cache invalidation for mutations
 */
export async function smartGraphQL<T>(
  client: OptimizedAPIClient | Octokit,
  query: string,
  variables: Record<string, any> = {},
  options: {
    ttl?: number;
    skipCache?: boolean;
    operation?: string;
    isMutation?: boolean;
  } = {}
): Promise<T> {
  const result = await cachedGraphQL<T>(client, query, variables, options);
  
  // If this was a mutation and we have an OptimizedAPIClient, invalidate related cache entries
  if (options.isMutation && client && 'invalidateGraphQLCacheForMutation' in client) {
    (client as OptimizedAPIClient).invalidateGraphQLCacheForMutation(query, variables);
  }
  
  return result;
}

/**
 * Batch GraphQL queries with caching support
 */
export async function batchCachedGraphQL<T>(
  client: OptimizedAPIClient | Octokit,
  queries: Array<{
    query: string;
    variables?: Record<string, any>;
    options?: { ttl?: number; skipCache?: boolean; operation?: string };
  }>
): Promise<T[]> {
  const promises = queries.map(({ query, variables = {}, options = {} }) =>
    cachedGraphQL<T>(client, query, variables, options)
  );
  
  return Promise.all(promises);
}

/**
 * GraphQL query TTL configuration helpers
 * Provides easy access to recommended TTL values for different query types
 */
export const GraphQLTTL = {
  // Repository data (changes infrequently)
  REPOSITORY_INSIGHTS: 60 * 60 * 1000, // 1 hour
  REPOSITORY_INFO: 60 * 60 * 1000, // 1 hour
  LANGUAGES: 4 * 60 * 60 * 1000, // 4 hours
  
  // Contributor data (moderate frequency changes)
  CONTRIBUTORS: 6 * 60 * 60 * 1000, // 6 hours
  COMMIT_ACTIVITY: 30 * 60 * 1000, // 30 minutes
  
  // Discussion data
  DISCUSSION_CATEGORIES: 2 * 60 * 60 * 1000, // 2 hours
  DISCUSSIONS_LIST: 30 * 60 * 1000, // 30 minutes
  DISCUSSION_DETAIL: 30 * 60 * 1000, // 30 minutes
  DISCUSSION_COMMENTS: 15 * 60 * 1000, // 15 minutes
  
  // Search results (short-lived)
  SEARCH_RESULTS: 15 * 60 * 1000, // 15 minutes
  
  // Project management
  PROJECTS: 30 * 60 * 1000, // 30 minutes
  MILESTONES: 30 * 60 * 1000, // 30 minutes
  
  // Default
  DEFAULT: 5 * 60 * 1000, // 5 minutes
} as const;

/**
 * Helper to extract query name for better cache organization
 */
export function getQueryOperation(query: string): string {
  // Try to extract operation name from query
  const patterns = [
    /(?:query|mutation)\s+(\w+)/i,
    /(\w+)\s*\(/,
    /{\s*(\w+)/
  ];
  
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return 'unknown_operation';
}

/**
 * Migration helper for existing GraphQL tools
 * Provides a drop-in replacement for octokit.graphql calls
 */
export function createGraphQLWrapper(client: OptimizedAPIClient | Octokit) {
  return {
    /**
     * Execute a GraphQL query with automatic caching
     */
    query: <T>(query: string, variables?: Record<string, any>, ttl?: number) =>
      cachedGraphQL<T>(client, query, variables || {}, { ttl, operation: getQueryOperation(query) }),
    
    /**
     * Execute a GraphQL mutation with cache invalidation
     */
    mutate: <T>(mutation: string, variables?: Record<string, any>) =>
      smartGraphQL<T>(client, mutation, variables || {}, { 
        isMutation: true,
        skipCache: true, // Don't cache mutations
        operation: getQueryOperation(mutation)
      }),
    
    /**
     * Execute a GraphQL query with custom options
     */
    execute: <T>(query: string, variables?: Record<string, any>, options?: {
      ttl?: number;
      skipCache?: boolean;
      operation?: string;
      isMutation?: boolean;
    }) => smartGraphQL<T>(client, query, variables || {}, options || {}),
    
    /**
     * Get the underlying client (for direct access when needed)
     */
    getClient: () => client,
  };
}

/**
 * Type-safe GraphQL query builder helpers
 */
export const GraphQLQueries = {
  /**
   * Repository insights query with proper typing
   */
  repositoryInsights: (owner: string, repo: string) => ({
    query: `
      query GetRepositoryInsights($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          name
          description
          stargazerCount
          forkCount
          watchers { totalCount }
          issues { totalCount }
          pullRequests { totalCount }
          releases { totalCount }
          languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
            edges {
              size
              node { name color }
            }
          }
          collaborators { totalCount }
          repositoryTopics(first: 20) {
            nodes { topic { name } }
          }
          licenseInfo { name spdxId }
          createdAt updatedAt pushedAt diskUsage
          isArchived isDisabled isFork isTemplate visibility
        }
      }
    `,
    variables: { owner, repo },
    operation: 'GetRepositoryInsights',
    ttl: GraphQLTTL.REPOSITORY_INSIGHTS
  }),
  
  /**
   * Discussion list query
   */
  discussionsList: (owner: string, repo: string, first: number = 25, after?: string, categoryId?: string) => ({
    query: `
      query ListDiscussions($owner: String!, $repo: String!, $first: Int!, $after: String, $categoryId: ID) {
        repository(owner: $owner, name: $repo) {
          discussions(first: $first, after: $after, categoryId: $categoryId) {
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes {
              id number title body createdAt updatedAt
              author { login }
              category { id name slug }
              comments { totalCount }
              upvoteCount url
            }
          }
        }
      }
    `,
    variables: { owner, repo, first, after, categoryId },
    operation: 'ListDiscussions',
    ttl: GraphQLTTL.DISCUSSIONS_LIST
  }),
  
  /**
   * Contributor stats query
   */
  contributorStats: (owner: string, repo: string, first: number = 25) => ({
    query: `
      query GetContributorStats($owner: String!, $repo: String!, $first: Int!) {
        repository(owner: $owner, name: $repo) {
          collaborators(first: $first, affiliation: ALL) {
            totalCount
            nodes {
              login name email avatarUrl url company location bio
              contributionsCollection {
                totalCommitContributions
                totalIssueContributions  
                totalPullRequestContributions
                totalPullRequestReviewContributions
              }
            }
          }
          defaultBranchRef {
            target {
              ... on Commit {
                history(first: 100) {
                  totalCount
                  nodes {
                    author { user { login } }
                    committedDate additions deletions
                  }
                }
              }
            }
          }
        }
      }
    `,
    variables: { owner, repo, first },
    operation: 'GetContributorStats', 
    ttl: GraphQLTTL.CONTRIBUTORS
  })
};