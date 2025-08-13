import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import { ToolConfig } from '../types.js';
import { createTypeSafeHandler } from '../utils/type-safety.js';

// Type definitions for batch operations
interface RepositoryRef {
  owner: string;
  repo: string;
  alias?: string | undefined;
}

interface BatchQueryRepositoriesParams {
  repositories: RepositoryRef[];
  includeLanguages?: boolean | undefined;
  includeContributors?: boolean | undefined;
  includeIssuesSummary?: boolean | undefined;
  includeRecentCommits?: boolean | undefined;
}

interface BatchQueryUsersParams {
  usernames: string[];
  includeRepositories?: boolean | undefined;
  includeFollowers?: boolean | undefined;
  repositoryLimit?: number | undefined;
}

interface GraphQLQueryDef {
  alias: string;
  query: string;
  variables?: Record<string, any> | undefined;
}

interface BatchGraphQLQueryParams {
  queries: GraphQLQueryDef[];
}

// Zod schemas for validation with security improvements
const RepositoryRefSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  alias: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Alias must start with a letter and contain only letters, numbers, and underscores').optional(),
}) satisfies z.ZodType<RepositoryRef>;

const BatchQueryRepositoriesSchema = z.object({
  repositories: z.array(RepositoryRefSchema).min(1, 'At least one repository is required').max(10, 'Maximum 10 repositories allowed'),
  includeLanguages: z.boolean().optional(),
  includeContributors: z.boolean().optional(),
  includeIssuesSummary: z.boolean().optional(),
  includeRecentCommits: z.boolean().optional(),
});

const BatchQueryUsersSchema = z.object({
  usernames: z.array(z.string().min(1, 'Username cannot be empty')).min(1, 'At least one username is required').max(10, 'Maximum 10 usernames allowed'),
  includeRepositories: z.boolean().optional(),
  includeFollowers: z.boolean().optional(),
  repositoryLimit: z.number().int().min(1).max(10).optional(),
});

const GraphQLQueryDefSchema = z.object({
  alias: z.string().min(1, 'Alias is required').regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Alias must start with a letter and contain only letters, numbers, and underscores'),
  query: z.string().min(1, 'Query is required'),
  variables: z.record(z.any()).optional(),
}) satisfies z.ZodType<GraphQLQueryDef>;

const BatchGraphQLQuerySchema = z.object({
  queries: z.array(GraphQLQueryDefSchema).min(1, 'At least one query is required').max(10, 'Maximum 10 queries allowed'),
});

export function createBatchOperationsTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // Batch query multiple repositories
  tools.push({
    tool: {
      name: 'batch_query_repositories',
      description: 'Query multiple repositories in a single GraphQL request for improved performance',
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
        // Build dynamic GraphQL query for multiple repositories using variables for security
        const variables: Record<string, any> = {};
        const repositoryQueries = params.repositories.map((repo: RepositoryRef, index: number) => {
          const alias = repo.alias || `repo${index}`;
          const ownerVar = `owner${index}`;
          const repoVar = `repo${index}`;
          
          // Store variables securely
          variables[ownerVar] = repo.owner;
          variables[repoVar] = repo.repo;
          
          // Build query fragment with variables
          let queryFragment = `
            ${alias}: repository(owner: $${ownerVar}, name: $${repoVar}) {
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
              }`;

          if (params.includeLanguages) {
            queryFragment += `
              languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
                edges {
                  size
                  node {
                    name
                    color
                  }
                }
                totalSize
              }`;
          }

          if (params.includeContributors) {
            queryFragment += `
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
              }`;
          }

          if (params.includeIssuesSummary) {
            queryFragment += `
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
              }`;
          }

          if (params.includeRecentCommits) {
            queryFragment += `
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
              }`;
          }

          queryFragment += `
              repositoryTopics(first: 10) {
                nodes {
                  topic {
                    name
                  }
                }
              }
            }`;

          return queryFragment;
        }).join('\n');

        // Build variable declarations for the query
        const variableDeclarations = Object.keys(variables).map(key => `$${key}: String!`).join(', ');
        
        const query = `
          query BatchRepositoryQuery(${variableDeclarations}) {
            ${repositoryQueries}
          }
        `;

        const result: any = await octokit.graphql(query, variables);

        // Process results
        const repositories = Object.keys(result).map(key => {
          const repo = result[key];
          if (!repo) return null;

          const processed: any = {
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
            topics: repo.repositoryTopics.nodes.map((node: any) => node.topic.name),
            dates: {
              created: repo.createdAt,
              updated: repo.updatedAt,
              pushed: repo.pushedAt,
            },
          };

          if (params.includeLanguages && repo.languages) {
            processed.languages = {
              totalSize: repo.languages.totalSize,
              breakdown: repo.languages.edges.map((edge: any) => ({
                name: edge.node.name,
                color: edge.node.color,
                size: edge.size,
                percentage: Math.round((edge.size / repo.languages.totalSize) * 100 * 100) / 100,
              })),
            };
          }

          if (params.includeContributors && repo.collaborators) {
            processed.contributors = {
              totalCount: repo.collaborators.totalCount,
              top: repo.collaborators.nodes.map((contributor: any) => ({
                login: contributor.login,
                name: contributor.name,
                avatarUrl: contributor.avatarUrl,
                commits: contributor.contributionsCollection.totalCommitContributions,
              })),
            };
          }

          if (params.includeIssuesSummary) {
            processed.issues = {
              total: repo.issues?.totalCount || 0,
              open: repo.openIssues?.totalCount || 0,
              closed: (repo.issues?.totalCount || 0) - (repo.openIssues?.totalCount || 0),
            };
            processed.pullRequests = {
              total: repo.pullRequests?.totalCount || 0,
              open: repo.openPullRequests?.totalCount || 0,
              closed: (repo.pullRequests?.totalCount || 0) - (repo.openPullRequests?.totalCount || 0),
            };
          }

          if (params.includeRecentCommits && repo.defaultBranchRef?.target?.history) {
            processed.recentCommits = {
              branch: repo.defaultBranchRef.name,
              commits: repo.defaultBranchRef.target.history.nodes.map((commit: any) => ({
                date: commit.committedDate,
                message: commit.messageHeadline,
                author: commit.author?.user?.login,
                additions: commit.additions,
                deletions: commit.deletions,
              })),
            };
          }

          return processed;
        }).filter(Boolean);

        return {
          totalQueried: params.repositories.length,
          successful: repositories.length,
          failed: params.repositories.length - repositories.length,
          repositories,
          summary: {
            totalStars: repositories.reduce((sum: number, repo: any) => sum + (repo.statistics?.stars || 0), 0),
            totalForks: repositories.reduce((sum: number, repo: any) => sum + (repo.statistics?.forks || 0), 0),
            languages: [...new Set(repositories.flatMap((repo: any) => 
              repo.languages?.breakdown?.map((lang: any) => lang.name) || 
              (repo.primaryLanguage ? [repo.primaryLanguage.name] : [])
            ))],
            licenses: [...new Set(repositories.map((repo: any) => repo.license?.name).filter(Boolean))],
          },
        };
      },
      'batch_query_repositories'
    ),
  });

  // Batch user/organization information
  tools.push({
    tool: {
      name: 'batch_query_users',
      description: 'Query multiple users or organizations in a single request',
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
        // Build dynamic GraphQL query for multiple users using variables for security
        const variables: Record<string, any> = {};
        const userQueries = params.usernames.map((username: string, index: number) => {
          const userVar = `username${index}`;
          variables[userVar] = username;
          
          let queryFragment = `
          user${index}: user(login: $${userVar}) {
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
            updatedAt`;

          if (params.includeFollowers) {
            queryFragment += `
            followers {
              totalCount
            }
            following {
              totalCount
            }`;
          }

          if (params.includeRepositories) {
            queryFragment += `
            repositories(first: ${params.repositoryLimit || 5}, orderBy: {field: STARGAZERS, direction: DESC}) {
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
            }`;
          }

          queryFragment += `
          }
          org${index}: organization(login: $${userVar}) {
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
            }`;

          if (params.includeRepositories) {
            queryFragment += `
            repositories(first: ${params.repositoryLimit || 5}, orderBy: {field: STARGAZERS, direction: DESC}) {
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
            }`;
          }

          queryFragment += `
          }`;

          return queryFragment;
        }).join('\n');

        // Build variable declarations for the query
        const variableDeclarations = Object.keys(variables).map(key => `$${key}: String!`).join(', ');
        
        const query = `
          query BatchUserQuery(${variableDeclarations}) {
            ${userQueries}
          }
        `;

        const result: any = await octokit.graphql(query, variables);

        // Process results - combine user and organization results
        const entities = [];
        for (let i = 0; i < params.usernames.length; i++) {
          const user = result[`user${i}`];
          const org = result[`org${i}`];
          
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
              totalMembers: org.membersWithRole?.totalCount,
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
            totalRepositories: entities.reduce((sum: number, entity: any) => 
              sum + (entity.totalRepositories || 0), 0),
            topLanguages: [...new Set(entities.flatMap((entity: any) => 
              entity.repositories?.map((repo: any) => repo.primaryLanguage?.name).filter(Boolean) || []
            ))],
          },
        };
      },
      'batch_query_users'
    ),
  });

  // Generic batch GraphQL query builder
  tools.push({
    tool: {
      name: 'batch_graphql_query',
      description: 'Execute a custom batch GraphQL query with multiple operations',
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
        // Build the combined query with all variables
        const allVariables: any = {};
        const queryFragments = [];

        for (let i = 0; i < params.queries.length; i++) {
          const queryDef = params.queries[i];
          if (queryDef) {
            queryFragments.push(`${queryDef.alias}: ${queryDef.query}`);
            
            // Add variables with prefixed names to avoid conflicts
            if (queryDef.variables) {
              for (const [key, value] of Object.entries(queryDef.variables)) {
                allVariables[`${queryDef.alias}_${key}`] = value;
              }
            }
          }
        }

        // Build variable declarations for the query
        const variableDeclarations = Object.keys(allVariables).map(key => {
          const value = allVariables[key];
          let type = 'String';
          if (typeof value === 'number') type = 'Int';
          if (typeof value === 'boolean') type = 'Boolean';
          return `$${key}: ${type}`;
        }).join(', ');

        const fullQuery = `
          query BatchQuery${variableDeclarations ? `(${variableDeclarations})` : ''} {
            ${queryFragments.join('\n')}
          }
        `;

        try {
          const result: any = await octokit.graphql(fullQuery, allVariables);
          
          return {
            successful: true,
            totalQueries: params.queries.length,
            results: result,
            executedQuery: fullQuery,
            variables: allVariables,
          };
        } catch (error: any) {
          console.error('Batch GraphQL operation failed:', error); // Log for debugging
          return {
            successful: false,
            error: 'Batch operation failed',
            executedQuery: fullQuery,
            variables: allVariables,
          };
        }
      },
      'batch_graphql_query'
    ),
  });

  return tools;
}