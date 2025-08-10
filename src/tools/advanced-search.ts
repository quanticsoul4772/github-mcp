import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';

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

      const result: any = await (octokit as any).graphqlWithComplexity(query, {
        searchQuery: args.query,
        type: args.type,
        first: args.first || 25,
        after: args.after,
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

      const result: any = await (octokit as any).graphqlWithComplexity(baseQuery, {
        searchQuery,
        first: args.first || 25,
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

      const result: any = await (octokit as any).graphqlWithComplexity(query, {
        searchQuery: args.query,
        entityType: args.entityType,
        first: args.first || 10,
        repoLimit: args.repositoryLimit || 10,
      });

      return {
        totalCount: result.search.userCount,
        pageInfo: result.search.pageInfo,
        entities: result.search.nodes,
      };
    },
  });

  return tools;
}