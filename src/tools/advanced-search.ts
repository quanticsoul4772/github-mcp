import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';
import {
  validateGraphQLInput,
  validateGraphQLVariableValue,
  CrossRepoSearchSchema,
  AdvancedRepoSearchSchema,
  SearchWithRelationshipsSchema,
  GraphQLValidationError
} from '../graphql-validation.js';
import { withErrorHandling } from '../errors.js';

/**
 * Creates advanced search tools using GraphQL API for enhanced search capabilities.
 * 
 * These tools provide sophisticated search functionality that leverages GraphQL's
 * ability to fetch nested relationships and contextual data in single queries,
 * offering performance and feature advantages over REST-based search.
 * 
 * @param octokit - Configured Octokit instance with GraphQL support
 * @param readOnly - Whether to exclude write operations (all search tools are read-only)
 * @returns Array of advanced search tool configurations
 * 
 * @example
 * ```typescript
 * const tools = createAdvancedSearchTools(octokit, true);
 * // Returns tools: search_across_repos, advanced_code_search, etc.
 * ```
 * 
 * @see https://docs.github.com/en/graphql/reference/queries#search
 */
export function createAdvancedSearchTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // Cross-repository search tool
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
    handler: async (args: any) => {
      // Validate and sanitize input parameters
      const validatedArgs = validateGraphQLInput(CrossRepoSearchSchema, args, 'search_across_repos');
      
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
      return withErrorHandling(
        'search_across_repos',
        async () => {
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
            searchQuery: args.query,
            type: args.type,
            first: args.first || 25,
            after: args.after,
          });

      // Validate GraphQL variables before execution
      const variables = {
        searchQuery: validateGraphQLVariableValue(validatedArgs.query, 'searchQuery'),
        type: validateGraphQLVariableValue(validatedArgs.type, 'type'),
        first: validateGraphQLVariableValue(validatedArgs.first || 25, 'first'),
        after: validatedArgs.after ? validateGraphQLVariableValue(validatedArgs.after, 'after') : undefined,
      };
      
      const result: any = await octokit.graphql(query, variables);
      const result: any = await (octokit as any).graphqlWithComplexity(query, {
        searchQuery: args.query,
        type: args.type,
        first: args.first || 25,
        after: args.after,
      });
          if (!result.search) {
            throw new Error('Search query returned no results');
          }

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
        { tool: 'search_across_repos', query: args.query, type: args.type }
      );
    },
  });

  // Complex repository search with filters
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
            description: 'Filter by star count (e.g., ">100", "10..50")',
          },
          forks: {
            type: 'string',
            description: 'Filter by fork count (e.g., ">10", "1..20")',
          },
          size: {
            type: 'string',
            description: 'Filter by repository size in KB (e.g., "<1000")',
          },
          created: {
            type: 'string',
            description: 'Filter by creation date (e.g., ">2020-01-01")',
          },
          pushed: {
            type: 'string',
            description: 'Filter by last push date (e.g., ">2023-01-01")',
          },
          license: {
            type: 'string',
            description: 'Filter by license (e.g., "mit", "apache-2.0")',
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
    handler: async (args: any) => {
      // Validate and sanitize input parameters
      const validatedArgs = validateGraphQLInput(AdvancedRepoSearchSchema, args, 'search_repositories_advanced');
      
      // Build search query with filters
      let searchQuery = validatedArgs.query;
      
      if (validatedArgs.language) searchQuery += ` language:${validatedArgs.language}`;
      if (validatedArgs.stars) searchQuery += ` stars:${validatedArgs.stars}`;
      if (validatedArgs.forks) searchQuery += ` forks:${validatedArgs.forks}`;
      if (validatedArgs.size) searchQuery += ` size:${validatedArgs.size}`;
      if (validatedArgs.created) searchQuery += ` created:${validatedArgs.created}`;
      if (validatedArgs.pushed) searchQuery += ` pushed:${validatedArgs.pushed}`;
      if (validatedArgs.license) searchQuery += ` license:${validatedArgs.license}`;
      if (validatedArgs.topics) {
        for (const topic of validatedArgs.topics) {
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
      return withErrorHandling(
        'search_repositories_advanced',
        async () => {
          // Build search query with filters
          let searchQuery = args.query;
          
          if (args.language) searchQuery += ` language:${args.language}`;
          if (args.stars) searchQuery += ` stars:${args.stars}`;
          if (args.forks) searchQuery += ` forks:${args.forks}`;
          if (args.size) searchQuery += ` size:${args.size}`;
          if (args.created) searchQuery += ` created:${args.created}`;
          if (args.pushed) searchQuery += ` pushed:${args.pushed}`;
          if (args.license) searchQuery += ` license:${args.license}`;
          if (args.topics) {
            for (const topic of args.topics) {
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
                  }
                }
                ${validatedArgs.includeMetrics ? `
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
                    repositoryTopics(first: 20) {
                      nodes {
                        topic {
                          name
                        }
                      }
                    }
                    ${args.includeMetrics ? `
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

      // Validate GraphQL variables before execution
      const variables = {
        searchQuery: validateGraphQLVariableValue(searchQuery, 'searchQuery'),
        first: validateGraphQLVariableValue(validatedArgs.first || 25, 'first'),
      };
      
      const result: any = await octokit.graphql(baseQuery, variables);

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
            ...(validatedArgs.includeMetrics && {
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
      const result: any = await (octokit as any).graphqlWithComplexity(baseQuery, {
        searchQuery,
        first: args.first || 25,
      });
          const result: any = await octokit.graphql(baseQuery, {
            searchQuery,
            first: args.first || 25,
          });

          if (!result.search) {
            throw new Error('Advanced repository search returned no results');
          }

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
                ...(args.includeMetrics && {
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
        { tool: 'search_repositories_advanced', query: args.query, filters: { language: args.language, stars: args.stars } }
      );
    },
  });

  // Multi-entity search with relationships
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
    handler: async (args: any) => {
      // Validate and sanitize input parameters
      const validatedArgs = validateGraphQLInput(SearchWithRelationshipsSchema, args, 'search_with_relationships');
      
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
                ${validatedArgs.includeRepositories ? `
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
                ${validatedArgs.includeGists ? `
                gists(first: 10) {
                  totalCount
                  nodes {
      return withErrorHandling(
        'search_with_relationships',
        async () => {
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
                    ${args.includeRepositories ? `
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
                    ${args.includeGists ? `
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
                    ${args.includeFollowers ? `
                    followers {
                      totalCount
                    }
                    following {
                      totalCount
                    }
                    ` : ''}
                  }
                }
                ` : ''}
                ${validatedArgs.includeFollowers ? `
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
                ${validatedArgs.includeRepositories ? `
                repositories(first: $repoLimit, orderBy: {field: STARGAZERS, direction: DESC}) {
                  totalCount
                  nodes {
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
                    ${args.includeRepositories ? `
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
            searchQuery: args.query,
            entityType: args.entityType,
            first: args.first || 10,
            repoLimit: args.repositoryLimit || 10,
          });

      // Validate GraphQL variables before execution
      const variables = {
        searchQuery: validateGraphQLVariableValue(validatedArgs.query, 'searchQuery'),
        entityType: validateGraphQLVariableValue(validatedArgs.entityType, 'entityType'),
        first: validateGraphQLVariableValue(validatedArgs.first || 10, 'first'),
        repoLimit: validateGraphQLVariableValue(validatedArgs.repositoryLimit || 10, 'repoLimit'),
      };
      
      const result: any = await octokit.graphql(query, variables);
      const result: any = await (octokit as any).graphqlWithComplexity(query, {
        searchQuery: args.query,
        entityType: args.entityType,
        first: args.first || 10,
        repoLimit: args.repositoryLimit || 10,
      });
          if (!result.search) {
            throw new Error('Entity search with relationships returned no results');
          }

          return {
            totalCount: result.search.userCount,
            pageInfo: result.search.pageInfo,
            entities: result.search.nodes,
          };
        },
        { tool: 'search_with_relationships', entityType: args.entityType, query: args.query }
      );
    },
  });

  return tools;
}