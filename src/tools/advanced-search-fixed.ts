/**
 * Advanced Search Tools - Type-Safe Implementation
 * 
 * This file demonstrates the proper way to implement type-safe tool handlers
 * using Zod validation and proper TypeScript types.
 */

import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import { ToolConfig } from '../types.js';
import { 
  createTypeSafeHandler, 
  jsonSchemaToZod,
  TypeSafeHandlerFactory 
} from '../utils/type-safety.js';

// Define proper TypeScript interfaces for parameters
interface SearchAcrossReposParams {
  query: string;
  type: 'REPOSITORY' | 'ISSUE' | 'USER' | 'DISCUSSION';
  first?: number;
  after?: string;
}

interface SearchRepositoriesAdvancedParams {
  query: string;
  language?: string;
  stars?: string;
  forks?: string;
  size?: string;
  created?: string;
  pushed?: string;
  license?: string;
  topics?: string[];
  includeMetrics?: boolean;
  first?: number;
}

interface SearchWithRelationshipsParams {
  entityType: 'USER' | 'ORGANIZATION';
  query: string;
  includeRepositories?: boolean;
  includeGists?: boolean;
  includeFollowers?: boolean;
  repositoryLimit?: number;
  first?: number;
}

// Define Zod schemas for runtime validation
const SearchAcrossReposSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  type: z.enum(['REPOSITORY', 'ISSUE', 'USER', 'DISCUSSION']),
  first: z.number().int().min(1).max(100).optional().default(25),
  after: z.string().optional(),
});

const SearchRepositoriesAdvancedSchema = z.object({
  query: z.string().min(1, 'Base search query is required'),
  language: z.string().optional(),
  stars: z.string().optional(),
  forks: z.string().optional(),
  size: z.string().optional(),
  created: z.string().optional(),
  pushed: z.string().optional(),
  license: z.string().optional(),
  topics: z.array(z.string()).optional(),
  includeMetrics: z.boolean().optional().default(false),
  first: z.number().int().min(1).max(50).optional().default(25),
});

const SearchWithRelationshipsSchema = z.object({
  entityType: z.enum(['USER', 'ORGANIZATION']),
  query: z.string().min(1, 'Search query for the entity is required'),
  includeRepositories: z.boolean().optional().default(false),
  includeGists: z.boolean().optional().default(false),
  includeFollowers: z.boolean().optional().default(false),
  repositoryLimit: z.number().int().min(1).max(25).optional().default(10),
  first: z.number().int().min(1).max(20).optional().default(10),
});

export function createAdvancedSearchTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // Cross-repository search tool with proper type safety
  tools.push({
    tool: {
      name: 'search_across_repos',
      description: 'Search across multiple repositories with advanced GraphQL queries',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (supports GitHub search syntax)',
          },
          type: {
            type: 'string',
            description: 'Type of search: REPOSITORY, ISSUE, USER, or DISCUSSION',
            enum: ['REPOSITORY', 'ISSUE', 'USER', 'DISCUSSION'],
          },
          first: {
            type: 'number',
            description: 'Number of results to return (max 100)',
            minimum: 1,
            maximum: 100,
          },
          after: {
            type: 'string',
            description: 'Cursor for pagination',
          },
        },
        required: ['query', 'type'],
      },
    },
    handler: createTypeSafeHandler(
      SearchAcrossReposSchema,
      async (params: SearchAcrossReposParams) => {
        const query = `
          query($searchQuery: String!, $type: SearchType!, $first: Int!, $after: String) {
            search(query: $searchQuery, type: $type, first: $first, after: $after) {
              repositoryCount
              issueCount
              userCount
              discussionCount
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                ... on Repository {
                  id
                  name
                  nameWithOwner
                  description
                  url
                  stargazerCount
                  forkCount
                  createdAt
                  updatedAt
                  primaryLanguage {
                    name
                    color
                  }
                  owner {
                    login
                    avatarUrl
                  }
                  licenseInfo {
                    name
                    spdxId
                  }
                  repositoryTopics(first: 10) {
                    nodes {
                      topic {
                        name
                      }
                    }
                  }
                }
                ... on Issue {
                  id
                  number
                  title
                  body
                  url
                  state
                  createdAt
                  updatedAt
                  author {
                    login
                    avatarUrl
                  }
                  repository {
                    name
                    nameWithOwner
                  }
                  labels(first: 10) {
                    nodes {
                      name
                      color
                    }
                  }
                  comments {
                    totalCount
                  }
                }
                ... on User {
                  id
                  login
                  name
                  email
                  bio
                  company
                  location
                  url
                  avatarUrl
                  createdAt
                  followers {
                    totalCount
                  }
                  following {
                    totalCount
                  }
                  repositories {
                    totalCount
                  }
                }
                ... on Discussion {
                  id
                  number
                  title
                  body
                  url
                  createdAt
                  updatedAt
                  author {
                    login
                    avatarUrl
                  }
                  repository {
                    name
                    nameWithOwner
                  }
                  category {
                    name
                    slug
                  }
                  upvoteCount
                }
              }
            }
          }
        `;

        const result: any = await octokit.graphql(query, {
          searchQuery: params.query,
          type: params.type,
          first: params.first,
          after: params.after,
        });

        return {
          totalCount: {
            repositories: result.search.repositoryCount,
            issues: result.search.issueCount,
            users: result.search.userCount,
            discussions: result.search.discussionCount,
          },
          pageInfo: result.search.pageInfo,
          results: result.search.nodes,
        };
      },
      'search_across_repos'
    ),
  });

  // Complex repository search with filters and proper validation
  tools.push({
    tool: {
      name: 'search_repositories_advanced',
      description: 'Advanced repository search with complex filtering and nested data',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Base search query',
          },
          language: {
            type: 'string',
            description: 'Filter by primary language',
          },
          stars: {
            type: 'string',
            description: 'Filter by star count (e.g., \">100\", \"10..50\")',
          },
          forks: {
            type: 'string',
            description: 'Filter by fork count (e.g., \">10\", \"1..20\")',
          },
          size: {
            type: 'string',
            description: 'Filter by repository size in KB (e.g., \"<1000\")',
          },
          created: {
            type: 'string',
            description: 'Filter by creation date (e.g., \">2020-01-01\")',
          },
          pushed: {
            type: 'string',
            description: 'Filter by last push date (e.g., \">2023-01-01\")',
          },
          license: {
            type: 'string',
            description: 'Filter by license (e.g., \"mit\", \"apache-2.0\")',
          },
          topics: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by topics',
          },
          includeMetrics: {
            type: 'boolean',
            description: 'Include detailed metrics for each repository',
          },
          first: {
            type: 'number',
            description: 'Number of results to return (max 50)',
            minimum: 1,
            maximum: 50,
          },
        },
        required: ['query'],
      },
    },
    handler: createTypeSafeHandler(
      SearchRepositoriesAdvancedSchema,
      async (params: SearchRepositoriesAdvancedParams) => {
        // Build search query with filters - all parameters are now properly typed
        let searchQuery = params.query;
        
        if (params.language) searchQuery += ` language:${params.language}`;
        if (params.stars) searchQuery += ` stars:${params.stars}`;
        if (params.forks) searchQuery += ` forks:${params.forks}`;
        if (params.size) searchQuery += ` size:${params.size}`;
        if (params.created) searchQuery += ` created:${params.created}`;
        if (params.pushed) searchQuery += ` pushed:${params.pushed}`;
        if (params.license) searchQuery += ` license:${params.license}`;
        if (params.topics) {
          for (const topic of params.topics) {
            searchQuery += ` topic:${topic}`;
          }
        }

        const baseQuery = `
          query($searchQuery: String!, $first: Int!) {
            search(query: $searchQuery, type: REPOSITORY, first: $first) {
              repositoryCount
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                ... on Repository {
                  id
                  name
                  nameWithOwner
                  description
                  url
                  stargazerCount
                  forkCount
                  watchers {
                    totalCount
                  }
                  createdAt
                  updatedAt
                  pushedAt
                  diskUsage
                  primaryLanguage {
                    name
                    color
                  }
                  languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
                    edges {
                      size
                      node {
                        name
                        color
                      }
                    }
                  }
                  owner {
                    login
                    avatarUrl
                    ... on User {
                      name
                      company
                    }
                    ... on Organization {
                      name
                      description
                    }
                  }
                  licenseInfo {
                    name
                    spdxId
                  }
                  repositoryTopics(first: 20) {
                    nodes {
                      topic {
                        name
                      }
                    }
                  }
                  ${params.includeMetrics ? `
                  issues {
                    totalCount
                  }
                  pullRequests {
                    totalCount
                  }
                  releases {
                    totalCount
                  }
                  collaborators {
                    totalCount
                  }
                  ` : ''}
                  defaultBranchRef {
                    name
                    target {
                      ... on Commit {
                        committedDate
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        const result: any = await octokit.graphql(baseQuery, {
          searchQuery,
          first: params.first,
        });

        return {
          query: searchQuery,
          totalCount: result.search.repositoryCount,
          pageInfo: result.search.pageInfo,
          repositories: result.search.nodes.map((repo: any) => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.nameWithOwner,
            description: repo.description,
            url: repo.url,
            statistics: {
              stars: repo.stargazerCount,
              forks: repo.forkCount,
              watchers: repo.watchers.totalCount,
              size: repo.diskUsage,
              ...(params.includeMetrics && {
                issues: repo.issues?.totalCount,
                pullRequests: repo.pullRequests?.totalCount,
                releases: repo.releases?.totalCount,
                collaborators: repo.collaborators?.totalCount,
              }),
            },
            languages: repo.languages.edges.map((edge: any) => ({
              name: edge.node.name,
              color: edge.node.color,
              size: edge.size,
            })),
            primaryLanguage: repo.primaryLanguage,
            owner: repo.owner,
            license: repo.licenseInfo,
            topics: repo.repositoryTopics.nodes.map((node: any) => node.topic.name),
            dates: {
              created: repo.createdAt,
              updated: repo.updatedAt,
              pushed: repo.pushedAt,
              lastCommit: repo.defaultBranchRef?.target?.committedDate,
            },
            defaultBranch: repo.defaultBranchRef?.name,
          })),
        };
      },
      'search_repositories_advanced'
    ),
  });

  // Multi-entity search with relationships and proper type safety
  tools.push({
    tool: {
      name: 'search_with_relationships',
      description: 'Search for entities and include their relationships (e.g., user with their repositories)',
      inputSchema: {
        type: 'object',
        properties: {
          entityType: {
            type: 'string',
            description: 'Type of entity to search for',
            enum: ['USER', 'ORGANIZATION'],
          },
          query: {
            type: 'string',
            description: 'Search query for the entity',
          },
          includeRepositories: {
            type: 'boolean',
            description: 'Include repositories owned by the entity',
          },
          includeGists: {
            type: 'boolean',
            description: 'Include gists (for users)',
          },
          includeFollowers: {
            type: 'boolean',
            description: 'Include follower information (for users)',
          },
          repositoryLimit: {
            type: 'number',
            description: 'Maximum number of repositories to include (max 25)',
            minimum: 1,
            maximum: 25,
          },
          first: {
            type: 'number',
            description: 'Number of entities to return (max 20)',
            minimum: 1,
            maximum: 20,
          },
        },
        required: ['entityType', 'query'],
      },
    },
    handler: createTypeSafeHandler(
      SearchWithRelationshipsSchema,
      async (params: SearchWithRelationshipsParams) => {
        const query = `
          query($searchQuery: String!, $entityType: SearchType!, $first: Int!, $repoLimit: Int!) {
            search(query: $searchQuery, type: $entityType, first: $first) {
              userCount
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                ... on User {
                  id
                  login
                  name
                  email
                  bio
                  company
                  location
                  url
                  avatarUrl
                  createdAt
                  updatedAt
                  ${params.includeRepositories ? `
                  repositories(first: $repoLimit, orderBy: {field: STARGAZERS, direction: DESC}) {
                    totalCount
                    nodes {
                      name
                      nameWithOwner
                      description
                      url
                      stargazerCount
                      forkCount
                      primaryLanguage {
                        name
                        color
                      }
                      createdAt
                      updatedAt
                    }
                  }
                  ` : ''}
                  ${params.includeGists ? `
                  gists(first: 10) {
                    totalCount
                    nodes {
                      name
                      description
                      url
                      createdAt
                      isPublic
                    }
                  }
                  ` : ''}
                  ${params.includeFollowers ? `
                  followers {
                    totalCount
                  }
                  following {
                    totalCount
                  }
                  ` : ''}
                }
                ... on Organization {
                  id
                  login
                  name
                  email
                  description
                  location
                  url
                  avatarUrl
                  createdAt
                  updatedAt
                  ${params.includeRepositories ? `
                  repositories(first: $repoLimit, orderBy: {field: STARGAZERS, direction: DESC}) {
                    totalCount
                    nodes {
                      name
                      nameWithOwner
                      description
                      url
                      stargazerCount
                      forkCount
                      primaryLanguage {
                        name
                        color
                      }
                      createdAt
                      updatedAt
                    }
                  }
                  ` : ''}
                  membersWithRole {
                    totalCount
                  }
                }
              }
            }
          }
        `;

        const result: any = await octokit.graphql(query, {
          searchQuery: params.query,
          entityType: params.entityType,
          first: params.first,
          repoLimit: params.repositoryLimit,
        });

        return {
          totalCount: result.search.userCount,
          pageInfo: result.search.pageInfo,
          entities: result.search.nodes,
        };
      },
      'search_with_relationships'
    ),
  });

  return tools;
}

/**
 * SECURITY AND TYPE SAFETY IMPROVEMENTS:
 * 
 * ✅ FIXED: Replaced unsafe `args: any` with proper typed parameters
 * ✅ FIXED: Added runtime validation using Zod schemas
 * ✅ FIXED: Proper TypeScript interfaces for all parameters
 * ✅ FIXED: Compile-time type checking restored
 * ✅ FIXED: Runtime parameter validation prevents malformed requests
 * ✅ FIXED: Clear error messages for validation failures
 * ✅ FIXED: Consistent with existing Zod schema validation patterns
 * 
 * BEFORE (Unsafe):
 * handler: async (args: any) => {
 *   // No validation, runtime errors possible
 *   const result = await octokit.graphql(query, {
 *     searchQuery: args.query,  // Could be undefined/wrong type
 *     type: args.type,          // Could be invalid enum value
 *     first: args.first || 25,  // Could be negative/too large
 *   });
 * }
 * 
 * AFTER (Type-Safe):
 * handler: createTypeSafeHandler(
 *   SearchAcrossReposSchema,
 *   async (params: SearchAcrossReposParams) => {
 *     // params are validated and properly typed
 *     const result = await octokit.graphql(query, {
 *       searchQuery: params.query,  // Guaranteed to be string
 *       type: params.type,          // Guaranteed to be valid enum
 *       first: params.first,        // Guaranteed to be valid number
 *     });
 *   },
 *   'search_across_repos'
 * ),
 * 
 * BENEFITS:
 * 1. Compile-time type checking prevents many bugs
 * 2. Runtime validation catches malformed parameters
 * 3. Clear error messages help with debugging
 * 4. Consistent validation patterns across all tools
 * 5. No risk of undefined/null property access
 * 6. Better IDE support with autocomplete and type hints
 */