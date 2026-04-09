import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import { ToolConfig } from '../types.js';
import { createTypeSafeHandler } from '../utils/type-safety.js';
import { withErrorHandling } from '../errors.js';

// Extended Octokit type that may have graphqlWithComplexity from rate-limiter
type OctokitWithComplexity = Octokit & {
  graphqlWithComplexity?: (query: string, variables?: Record<string, unknown>) => Promise<unknown>;
};

// Type definitions for batch operations
interface RepositoryRef {
  owner: string;
  repo: string;
  alias?: string;
}

interface BatchQueryRepositoriesParams {
  repositories: RepositoryRef[];
  includeLanguages?: boolean;
  includeContributors?: boolean;
  includeIssuesSummary?: boolean;
  includeRecentCommits?: boolean;
}

interface BatchQueryUsersParams {
  usernames: string[];
  includeRepositories?: boolean;
  includeFollowers?: boolean;
  repositoryLimit?: number;
}

interface GraphQLQueryDef {
  alias: string;
  query: string;
  variables?: Record<string, unknown>;
}

interface BatchGraphQLQueryParams {
  queries: GraphQLQueryDef[];
}

// GraphQL response types for batch repository queries
interface BatchRepoNode {
  id: string;
  name: string;
  nameWithOwner: string;
  description: string | null;
  url: string;
  stargazerCount: number;
  forkCount: number;
  watchers: { totalCount: number };
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  primaryLanguage: { name: string; color: string } | null;
  licenseInfo: { name: string; spdxId: string } | null;
  languages?: {
    totalSize: number;
    edges: Array<{ size: number; node: { name: string; color: string } }>;
  };
  collaborators?: {
    totalCount: number;
    nodes: Array<{
      login: string;
      name: string | null;
      avatarUrl: string;
      contributionsCollection: { totalCommitContributions: number };
    }>;
  };
  issues?: { totalCount: number };
  openIssues?: { totalCount: number };
  pullRequests?: { totalCount: number };
  openPullRequests?: { totalCount: number };
  defaultBranchRef?: {
    name: string;
    target: {
      history: {
        nodes: Array<{
          committedDate: string;
          messageHeadline: string;
          author: { user: { login: string } | null };
          additions: number;
          deletions: number;
        }>;
      };
    };
  };
  repositoryTopics: { nodes: Array<{ topic: { name: string } }> };
}

interface ProcessedRepo {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  statistics: { stars: number; forks: number; watchers: number };
  primaryLanguage: { name: string; color: string } | null;
  license: { name: string; spdxId: string } | null;
  topics: string[];
  dates: { created: string; updated: string; pushed: string };
  languages?: { totalSize: number; breakdown: Array<{ name: string; color: string; size: number; percentage: number }> };
  contributors?: { totalCount: number; top: Array<{ login: string; name: string | null; avatarUrl: string; commits: number }> };
  issues?: { total: number; open: number; closed: number };
  pullRequests?: { total: number; open: number; closed: number };
  recentCommits?: { branch: string; commits: Array<{ date: string; message: string; author: string | undefined; additions: number; deletions: number }> };
}

// GraphQL response types for batch user queries
interface BatchUserNode {
  id: string;
  login: string;
  name: string | null;
  email: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  url: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
  followers?: { totalCount: number };
  following?: { totalCount: number };
  repositories?: {
    totalCount: number;
    nodes: Array<{
      name: string;
      nameWithOwner: string;
      description: string | null;
      url: string;
      stargazerCount: number;
      forkCount: number;
      primaryLanguage: { name: string; color: string } | null;
      createdAt: string;
      updatedAt: string;
    }>;
  };
}

interface BatchOrgNode {
  id: string;
  login: string;
  name: string | null;
  email: string | null;
  description: string | null;
  location: string | null;
  url: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
  membersWithRole?: { totalCount: number };
  repositories?: BatchUserNode['repositories'];
}

interface BatchEntityRepo {
  name: string;
  nameWithOwner: string;
  description: string | null;
  url: string;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: { name: string; color: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface BatchEntity {
  type?: 'user' | 'organization';
  login: string;
  error?: string;
  totalRepositories?: number;
  totalMembers?: number;
  repositories?: BatchEntityRepo[];
  [key: string]: unknown;
}

// Zod schemas for validation
const RepositoryRefSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  alias: z.string().optional(),
});

const BatchQueryRepositoriesSchema = z.object({
  repositories: z
    .array(RepositoryRefSchema)
    .min(1, 'At least one repository is required')
    .max(10, 'Maximum 10 repositories allowed'),
  includeLanguages: z.boolean().optional(),
  includeContributors: z.boolean().optional(),
  includeIssuesSummary: z.boolean().optional(),
  includeRecentCommits: z.boolean().optional(),
});

const BatchQueryUsersSchema = z.object({
  usernames: z
    .array(z.string().min(1, 'Username cannot be empty'))
    .min(1, 'At least one username is required')
    .max(10, 'Maximum 10 usernames allowed'),
  includeRepositories: z.boolean().optional(),
  includeFollowers: z.boolean().optional(),
  repositoryLimit: z.number().int().min(1).max(10).optional(),
});

const GraphQLQueryDefSchema = z.object({
  alias: z.string().min(1, 'Alias is required'),
  query: z.string().min(1, 'Query is required'),
  variables: z.record(z.string(), z.unknown()).optional(),
});

const BatchGraphQLQuerySchema = z.object({
  queries: z
    .array(GraphQLQueryDefSchema)
    .min(1, 'At least one query is required')
    .max(10, 'Maximum 10 queries allowed'),
});

export function createBatchOperationsTools(octokit: Octokit, _readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // Batch query multiple repositories
  tools.push({
    tool: {
      name: 'batch_query_repositories',
      description:
        'Fetch stars, forks, languages, contributors, and commits for 1-10 repositories in a single GraphQL request. Returns aggregated results keyed by repository alias. Does NOT return file contents, workflow runs, or real-time commit metadata. Use when you need basic stats across multiple repos without making individual API calls per repo.',
      inputSchema: {
        type: 'object',
        properties: {
          repositories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                owner: { type: 'string' },
                repo: { type: 'string' },
                alias: { type: 'string', description: 'Optional alias for the query result' },
              },
              required: ['owner', 'repo'],
            },
            description: 'List of repositories to query (max 10)',
            maxItems: 10,
          },
          includeLanguages: {
            type: 'boolean',
            description: 'Include language statistics',
          },
          includeContributors: {
            type: 'boolean',
            description: 'Include contributor information',
          },
          includeIssuesSummary: {
            type: 'boolean',
            description: 'Include issues and PRs summary',
          },
          includeRecentCommits: {
            type: 'boolean',
            description: 'Include recent commit information',
          },
        },
        required: ['repositories'],
      },
    },
    handler: createTypeSafeHandler(
      BatchQueryRepositoriesSchema,
      async (params: BatchQueryRepositoriesParams) => {
        return withErrorHandling(
          'batch_query_repositories',
          async () => {
            // Build dynamic GraphQL query for multiple repositories
            const repositoryQueries = params.repositories
              .map((repo: RepositoryRef, index: number) => {
                const alias = repo.alias ?? `repo${index}`;
                return `
                ${alias}: repository(owner: \"${repo.owner}\", name: \"${repo.repo}\") {
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
                  primaryLanguage {
                    name
                    color
                  }
                  licenseInfo {
                    name
                    spdxId
                  }
                  ${
                    params.includeLanguages
                      ? `
                  languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
                    edges {
                      size
                      node {
                        name
                        color
                      }
                    }
                    totalSize
                  }
                  `
                      : ''
                  }
                  ${
                    params.includeContributors
                      ? `
                  collaborators(first: 10) {
                    totalCount
                    nodes {
                      login
                      name
                      avatarUrl
                      contributionsCollection {
                        totalCommitContributions
                      }
                    }
                  }
                  `
                      : ''
                  }
                  ${
                    params.includeIssuesSummary
                      ? `
                  issues {
                    totalCount
                  }
                  openIssues: issues(states: OPEN) {
                    totalCount
                  }
                  pullRequests {
                    totalCount
                  }
                  openPullRequests: pullRequests(states: OPEN) {
                    totalCount
                  }
                  `
                      : ''
                  }
                  ${
                    params.includeRecentCommits
                      ? `
                  defaultBranchRef {
                    name
                    target {
                      ... on Commit {
                        history(first: 5) {
                          nodes {
                            committedDate
                            messageHeadline
                            author {
                              user {
                                login
                              }
                            }
                            additions
                            deletions
                          }
                        }
                      }
                    }
                  }
                  `
                      : ''
                  }
                  repositoryTopics(first: 10) {
                    nodes {
                      topic {
                        name
                      }
                    }
                  }
                }
              `;
              })
              .join(
                '\
'
              );

            const query = `
              query BatchRepositoryQuery {
                ${repositoryQueries}
              }
            `;

            const extOctokit = octokit as OctokitWithComplexity;
            const result = (extOctokit.graphqlWithComplexity
              ? await extOctokit.graphqlWithComplexity(query)
              : await octokit.graphql(query)) as Record<string, BatchRepoNode | null>;

            if (!result) {
              throw new Error('Batch repository query returned no results');
            }

            // Process results
            const repositories: ProcessedRepo[] = Object.keys(result)
              .map(key => {
                const repo = result[key];
                if (!repo) return null;

                const processed: ProcessedRepo = {
                  id: repo.id,
                  name: repo.name,
                  fullName: repo.nameWithOwner,
                  description: repo.description,
                  url: repo.url,
                  statistics: {
                    stars: repo.stargazerCount,
                    forks: repo.forkCount,
                    watchers: repo.watchers.totalCount,
                  },
                  primaryLanguage: repo.primaryLanguage,
                  license: repo.licenseInfo,
                  topics: repo.repositoryTopics.nodes.map((node) => node.topic.name),
                  dates: {
                    created: repo.createdAt,
                    updated: repo.updatedAt,
                    pushed: repo.pushedAt,
                  },
                };

                if (params.includeLanguages && repo.languages) {
                  processed.languages = {
                    totalSize: repo.languages.totalSize,
                    breakdown: repo.languages.edges.map((edge) => ({
                      name: edge.node.name,
                      color: edge.node.color,
                      size: edge.size,
                      percentage:
                        Math.round((edge.size / repo.languages!.totalSize) * 100 * 100) / 100,
                    })),
                  };
                }

                if (params.includeContributors && repo.collaborators) {
                  processed.contributors = {
                    totalCount: repo.collaborators.totalCount,
                    top: repo.collaborators.nodes.map((contributor) => ({
                      login: contributor.login,
                      name: contributor.name,
                      avatarUrl: contributor.avatarUrl,
                      commits: contributor.contributionsCollection.totalCommitContributions,
                    })),
                  };
                }

                if (params.includeIssuesSummary) {
                  processed.issues = {
                    total: repo.issues?.totalCount ?? 0,
                    open: repo.openIssues?.totalCount ?? 0,
                    closed: (repo.issues?.totalCount ?? 0) - (repo.openIssues?.totalCount ?? 0),
                  };
                  processed.pullRequests = {
                    total: repo.pullRequests?.totalCount ?? 0,
                    open: repo.openPullRequests?.totalCount ?? 0,
                    closed:
                      (repo.pullRequests?.totalCount ?? 0) -
                      (repo.openPullRequests?.totalCount ?? 0),
                  };
                }

                if (params.includeRecentCommits && repo.defaultBranchRef?.target?.history) {
                  processed.recentCommits = {
                    branch: repo.defaultBranchRef.name,
                    commits: repo.defaultBranchRef.target.history.nodes.map((commit) => ({
                      date: commit.committedDate,
                      message: commit.messageHeadline,
                      author: commit.author?.user?.login,
                      additions: commit.additions,
                      deletions: commit.deletions,
                    })),
                  };
                }

                return processed;
              })
              .filter((r): r is ProcessedRepo => r !== null);

            return {
              totalQueried: params.repositories.length,
              successful: repositories.length,
              failed: params.repositories.length - repositories.length,
              repositories,
              summary: {
                totalStars: repositories.reduce(
                  (sum: number, repo: ProcessedRepo) => sum + (repo.statistics?.stars ?? 0),
                  0
                ),
                totalForks: repositories.reduce(
                  (sum: number, repo: ProcessedRepo) => sum + (repo.statistics?.forks ?? 0),
                  0
                ),
                languages: [
                  ...new Set(
                    repositories.flatMap(
                      (repo: ProcessedRepo) =>
                        repo.languages?.breakdown?.map((lang) => lang.name) ??
                        (repo.primaryLanguage ? [repo.primaryLanguage.name] : [])
                    )
                  ),
                ],
                licenses: [
                  ...new Set(repositories.map((repo: ProcessedRepo) => repo.license?.name).filter(Boolean)),
                ],
              },
            };
          },
          { tool: 'batch_query_repositories', totalRepositories: params.repositories.length }
        );
      },
      'batch_query_repositories'
    ),
  });

  // Batch user/organization information
  tools.push({
    tool: {
      name: 'batch_query_users',
      description: 'Fetch public profiles for up to 10 users or organizations in one request, optionally including top repositories by stars. Returns entity type, bio, follower counts, and up to 5 repos per user. Does NOT return private org data, membership status, or email. Use get_org for full organization details.',
      inputSchema: {
        type: 'object',
        properties: {
          usernames: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of usernames to query (max 10)',
            maxItems: 10,
          },
          includeRepositories: {
            type: 'boolean',
            description: 'Include top repositories for each user',
          },
          includeFollowers: {
            type: 'boolean',
            description: 'Include follower/following counts',
          },
          repositoryLimit: {
            type: 'number',
            description: 'Number of top repositories to include per user (max 10)',
            minimum: 1,
            maximum: 10,
          },
        },
        required: ['usernames'],
      },
    },
    handler: createTypeSafeHandler(
      BatchQueryUsersSchema,
      async (params: BatchQueryUsersParams) => {
        return withErrorHandling(
          'batch_query_users',
          async () => {
            // Build dynamic GraphQL query for multiple users
            const userQueries = params.usernames
              .map(
                (username: string, index: number) => `
              user${index}: user(login: \"${username}\") {
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
                ${
                  params.includeFollowers
                    ? `
                followers {
                  totalCount
                }
                following {
                  totalCount
                }
                `
                    : ''
                }
                ${
                  params.includeRepositories
                    ? `
                repositories(first: ${params.repositoryLimit ?? 5}, orderBy: {field: STARGAZERS, direction: DESC}) {
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
                `
                    : ''
                }
              }
              org${index}: organization(login: \"${username}\") {
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
                membersWithRole {
                  totalCount
                }
                ${
                  params.includeRepositories
                    ? `
                repositories(first: ${params.repositoryLimit ?? 5}, orderBy: {field: STARGAZERS, direction: DESC}) {
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
                `
                    : ''
                }
              }
            `
              )
              .join(
                '\
'
              );

            const query = `
              query BatchUserQuery {
                ${userQueries}
              }
            `;

            const extOctokit = octokit as OctokitWithComplexity;
            const result = (extOctokit.graphqlWithComplexity
              ? await extOctokit.graphqlWithComplexity(query)
              : await octokit.graphql(query)) as Record<string, BatchUserNode | BatchOrgNode | null>;

            if (!result) {
              throw new Error('Batch user query returned no results');
            }

            // Process results - combine user and organization results
            const entities: BatchEntity[] = [];
            for (let i = 0; i < params.usernames.length; i++) {
              const user = result[`user${i}`] as BatchUserNode | null;
              const org = result[`org${i}`] as BatchOrgNode | null;

              if (user) {
                entities.push({
                  ...user,
                  type: 'user',
                  totalRepositories: user.repositories?.totalCount,
                  repositories: user.repositories?.nodes,
                });
              } else if (org) {
                entities.push({
                  ...org,
                  type: 'organization',
                  totalMembers: (org as BatchOrgNode).membersWithRole?.totalCount,
                  totalRepositories: org.repositories?.totalCount,
                  repositories: org.repositories?.nodes,
                });
              } else {
                entities.push({
                  login: params.usernames[i],
                  error: 'User or organization not found',
                });
              }
            }

            return {
              totalQueried: params.usernames.length,
              found: entities.filter(e => !e.error).length,
              notFound: entities.filter(e => e.error).length,
              entities,
              summary: {
                totalUsers: entities.filter(e => e.type === 'user').length,
                totalOrganizations: entities.filter(e => e.type === 'organization').length,
                totalRepositories: entities.reduce(
                  (sum: number, entity: BatchEntity) => sum + (entity.totalRepositories ?? 0),
                  0
                ),
                topLanguages: [
                  ...new Set(
                    entities.flatMap(
                      (entity: BatchEntity) =>
                        entity.repositories
                          ?.map((repo) => repo.primaryLanguage?.name)
                          .filter(Boolean) ?? []
                    )
                  ),
                ],
              },
            };
          },
          { tool: 'batch_query_users', totalUsernames: params.usernames.length }
        );
      },
      'batch_query_users'
    ),
  });

  // Generic batch GraphQL query builder
  tools.push({
    tool: {
      name: 'batch_graphql_query',
      description: 'Execute up to 10 custom GraphQL query fragments with automatic variable namespacing to prevent conflicts. Each query requires alias, query string, and optional variables. Returns raw GraphQL results keyed by alias. Does NOT validate query complexity or handle pagination — caller is responsible for query optimization. Deeply nested queries can hit GitHub GraphQL complexity limits.',
      inputSchema: {
        type: 'object',
        properties: {
          queries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                alias: {
                  type: 'string',
                  description: 'Alias for this query result',
                },
                query: {
                  type: 'string',
                  description: 'GraphQL query fragment (without query wrapper)',
                },
                variables: {
                  type: 'object',
                  description: 'Variables for this specific query',
                },
              },
              required: ['alias', 'query'],
            },
            description: 'List of queries to batch together (max 10)',
            maxItems: 10,
          },
        },
        required: ['queries'],
      },
    },
    handler: createTypeSafeHandler(
      BatchGraphQLQuerySchema,
      async (params: BatchGraphQLQueryParams) => {
        return withErrorHandling(
          'batch_graphql_query',
          async () => {
            // Build the combined query with all variables
            const allVariables: Record<string, unknown> = {};
            const queryFragments = [];

            for (let i = 0; i < params.queries.length; i++) {
              const queryDef = params.queries[i];
              queryFragments.push(`${queryDef.alias}: ${queryDef.query}`);

              // Add variables with prefixed names to avoid conflicts
              if (queryDef.variables) {
                for (const [key, value] of Object.entries(queryDef.variables)) {
                  allVariables[`${queryDef.alias}_${key}`] = value;
                }
              }
            }

            // Build variable declarations for the query
            const variableDeclarations = Object.keys(allVariables)
              .map(key => {
                const value = allVariables[key];
                let type = 'String';
                if (typeof value === 'number') type = 'Int';
                if (typeof value === 'boolean') type = 'Boolean';
                return `$${key}: ${type}`;
              })
              .join(', ');

            const fullQuery = `
              query BatchQuery${variableDeclarations ? `(${variableDeclarations})` : ''} {
                ${queryFragments.join(
                  '\
'
                )}
              }
            `;

            try {
              const extOctokit = octokit as OctokitWithComplexity;
              const result = (extOctokit.graphqlWithComplexity
                ? await extOctokit.graphqlWithComplexity(fullQuery, allVariables)
                : await octokit.graphql(fullQuery, allVariables)) as Record<string, unknown>;

              if (!result) {
                throw new Error('Batch GraphQL query returned no results');
              }

              return {
                successful: true,
                totalQueries: params.queries.length,
                results: result,
                executedQuery: fullQuery,
                variables: allVariables,
              };
            } catch (error: unknown) {
              console.error('Batch GraphQL operation failed:', error); // Log for debugging
              return {
                successful: false,
                error: 'Batch operation failed',
                executedQuery: fullQuery,
                variables: allVariables,
              };
            }
          },
          { tool: 'batch_graphql_query', totalQueries: params.queries.length }
        );
      },
      'batch_graphql_query'
    ),
  });

  return tools;
}
