import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';
import { withErrorHandling } from '../errors.js';

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
    handler: async (args: any) => {
      return withErrorHandling(
        'batch_query_repositories',
        async () => {
          // Build dynamic GraphQL query for multiple repositories
          const repositoryQueries = args.repositories.map((repo: any, index: number) => {
            const alias = repo.alias || `repo${index}`;
            return `
              ${alias}: repository(owner: "${repo.owner}", name: "${repo.repo}") {
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
                ${args.includeLanguages ? `
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
                ` : ''}
                ${args.includeContributors ? `
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
                ` : ''}
                ${args.includeIssuesSummary ? `
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
                ` : ''}
                ${args.includeRecentCommits ? `
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
                ` : ''}
                repositoryTopics(first: 10) {
                  nodes {
                    topic {
                      name
                    }
                  }
                }
              }
            `;
          }).join('\n');

          const query = `
            query BatchRepositoryQuery {
              ${repositoryQueries}
            }
          `;

          const result: any = await octokit.graphql(query);
          if (!result) {
            throw new Error('Batch repository query returned no results');
          }

          // Process results
          const repositories = Object.keys(result).map(key => {
            const repo = result[key];
            if (!repo) return null;

      const result: any = await (octokit as any).graphqlWithComplexity(query);
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

            if (args.includeLanguages && repo.languages) {
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

            if (args.includeContributors && repo.collaborators) {
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

            if (args.includeIssuesSummary) {
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

            if (args.includeRecentCommits && repo.defaultBranchRef?.target?.history) {
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
            totalQueried: args.repositories.length,
            successful: repositories.length,
            failed: args.repositories.length - repositories.length,
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
        { tool: 'batch_query_repositories', totalRepositories: args.repositories.length }
      );
    },
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
    handler: async (args: any) => {
      return withErrorHandling(
        'batch_query_users',
        async () => {
          // Build dynamic GraphQL query for multiple users
          const userQueries = args.usernames.map((username: string, index: number) => `
            user${index}: user(login: "${username}") {
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
              ${args.includeFollowers ? `
              followers {
                totalCount
              }
              following {
                totalCount
              }
              ` : ''}
              ${args.includeRepositories ? `
              repositories(first: ${args.repositoryLimit || 5}, orderBy: {field: STARGAZERS, direction: DESC}) {
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
            }
            org${index}: organization(login: "${username}") {
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
              ${args.includeRepositories ? `
              repositories(first: ${args.repositoryLimit || 5}, orderBy: {field: STARGAZERS, direction: DESC}) {
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
            }
          `).join('\n');

          const query = `
            query BatchUserQuery {
              ${userQueries}
            }
          `;

      const result: any = await (octokit as any).graphqlWithComplexity(query);
          const result: any = await octokit.graphql(query);
          if (!result) {
            throw new Error('Batch user query returned no results');
          }

          // Process results - combine user and organization results
          const entities = [];
          for (let i = 0; i < args.usernames.length; i++) {
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
                login: args.usernames[i],
                error: 'User or organization not found',
              });
            }
          }

          return {
            totalQueried: args.usernames.length,
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
        { tool: 'batch_query_users', totalUsernames: args.usernames.length }
      );
    },
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
    handler: async (args: any) => {
      return withErrorHandling(
        'batch_graphql_query',
        async () => {
          // Build the combined query with all variables
          const allVariables: any = {};
          const queryFragments = [];

          for (let i = 0; i < args.queries.length; i++) {
            const queryDef = args.queries[i];
            queryFragments.push(`${queryDef.alias}: ${queryDef.query}`);
            
            // Add variables with prefixed names to avoid conflicts
            if (queryDef.variables) {
              for (const [key, value] of Object.entries(queryDef.variables)) {
                allVariables[`${queryDef.alias}_${key}`] = value;
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

          const result: any = await octokit.graphql(fullQuery, allVariables);
          if (!result) {
            throw new Error('Batch GraphQL query returned no results');
          }
          
          return {
            successful: true,
            totalQueries: args.queries.length,
            results: result,
            executedQuery: fullQuery,
            variables: allVariables,
          };
        },
        { tool: 'batch_graphql_query', totalQueries: args.queries.length }
      );

      try {
        const result: any = await (octokit as any).graphqlWithComplexity(fullQuery, allVariables);
        
        return {
          successful: true,
          totalQueries: args.queries.length,
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
  });

  return tools;
}