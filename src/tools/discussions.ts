import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';
import { GraphQLPaginationHandler, GraphQLPaginationOptions, GraphQLPaginationUtils } from '../graphql-pagination-handler.js';
import { OptimizedAPIClient } from '../optimized-api-client.js';
import { cachedGraphQL, smartGraphQL, GraphQLTTL } from '../graphql-utils.js';
import { typedGraphQL, createTypedHandler } from '../graphql-utils.js';
import {
  ListDiscussionsResponse,
  GetDiscussionResponse,
  GetDiscussionCommentsResponse,
  ListDiscussionCategoriesResponse,
  SearchDiscussionsResponse,
  CreateDiscussionResponse,
  AddDiscussionCommentResponse,
  UpdateDiscussionResponse,
  SimpleRepositoryResponse
} from '../graphql-types.js';

interface ListDiscussionsParams {
  owner: string;
  repo: string;
  category?: string;
  after?: string;
  perPage?: number;
  autoPage?: boolean;
  maxPages?: number;
  maxItems?: number;
}

interface GetDiscussionParams {
  owner: string;
  repo: string;
  discussionNumber: number;
}

interface GetDiscussionCommentsParams {
  owner: string;
  repo: string;
  discussionNumber: number;
  after?: string;
  perPage?: number;
  autoPage?: boolean;
  maxPages?: number;
  maxItems?: number;
}

interface ListDiscussionCategoriesParams {
  owner: string;
  repo: string;
}

interface SearchDiscussionsParams {
  query: string;
  owner?: string;
  repo?: string;
  first?: number;
}

interface CreateDiscussionParams {
  owner: string;
  repo: string;
  title: string;
  body: string;
  categoryId: string;
}

interface AddDiscussionCommentParams {
  discussionId: string;
  body: string;
  replyToId?: string;
}

interface UpdateDiscussionParams {
  discussionId: string;
  title?: string;
  body?: string;
  categoryId?: string;
}

interface DeleteDiscussionParams {
  discussionId: string;
}

export function createDiscussionTools(
  client: Octokit | OptimizedAPIClient, 
  readOnly: boolean
): ToolConfig[] {
/**
 * Creates GitHub Discussion tools using GraphQL API.
 * 
 * GitHub Discussions are only available through GraphQL and provide community
 * conversation features around repositories. These tools offer comprehensive
 * discussion management including creation, querying, and moderation.
 * 
 * @param octokit - Configured Octokit instance with GraphQL support
 * @param readOnly - Whether to exclude write operations (create, update, delete)
 * @returns Array of discussion tool configurations
 * 
 * @example
 * ```typescript
 * const tools = createDiscussionTools(octokit, false);
 * // Returns tools: list_discussions, get_discussion, search_discussions, etc.
 * ```
 */
export function createDiscussionTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];
  const paginationHandler = new GraphQLPaginationHandler(octokit);

  // Note: GitHub Discussions are accessed through GraphQL API
  // These are simplified implementations - full GraphQL support would be more complex

  // List discussions tool
  tools.push({
    tool: {
      name: 'list_discussions',
      description: 'List discussions in a repository (requires GraphQL)',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          category: {
            type: 'string',
            description: 'Optional filter by discussion category ID',
          },
          after: {
            type: 'string',
            description: 'Cursor for pagination',
          },
          perPage: {
            type: 'number',
            description: 'Results per page for pagination (min 1, max 100)',
            minimum: 1,
            maximum: 100,
          },
          autoPage: {
            type: 'boolean',
            description: 'Automatically paginate through all results',
          },
          maxPages: {
            type: 'number',
            description: 'Maximum number of pages to fetch (default 10)',
            minimum: 1,
          },
          maxItems: {
            type: 'number',
            description: 'Maximum number of items to fetch across all pages',
            minimum: 1,
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as ListDiscussionsParams;
    handler: async (args: ListDiscussionsParams) => {
      try {
        GraphQLPaginationUtils.validatePaginationParams(args);
      } catch (error) {
        throw new Error(`Invalid pagination parameters: ${error.message}`);
      }

      const queryBuilder = paginationHandler.createDiscussionsQuery(
        args.owner,
        args.repo,
        args.category
      );

      const paginationOptions: GraphQLPaginationOptions = {
        first: args.perPage,
        after: args.after,
        autoPage: args.autoPage,
        maxPages: args.maxPages,
        maxItems: args.maxItems,
      };

      const result = await paginationHandler.paginate(queryBuilder, paginationOptions);
    handler: createTypedHandler<ListDiscussionsParams, any>(async (args: ListDiscussionsParams) => {
      const query = `
        query($owner: String!, $repo: String!, $first: Int!, $after: String, $categoryId: ID) {
          repository(owner: $owner, name: $repo) {
            discussions(first: $first, after: $after, categoryId: $categoryId) {
              totalCount
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                number
                title
                body
                createdAt
                updatedAt
                author {
                  login
                }
                category {
                  id
                  name
                  slug
                }
                comments {
                  totalCount
                }
                upvoteCount
                url
              }
            }
          }
        }
      `;

      const result: any = await octokit.graphql(query, {
        owner: params.owner,
        repo: params.repo,
        first: params.perPage || 25,
        after: params.after,
        categoryId: params.category,
      const result: any = await cachedGraphQL(client, query, {
      const result = await typedGraphQL<ListDiscussionsResponse>(octokit, query, {
      const result: any = await (octokit as any).graphqlWithComplexity(query, {
        owner: args.owner,
        repo: args.repo,
        first: args.perPage || 25,
        after: args.after,
        categoryId: args.category,
      }, {
        ttl: GraphQLTTL.DISCUSSIONS_LIST,
        operation: 'list_discussions'
      });

      return {
        total_count: result.totalCount,
        has_next_page: result.hasMore,
        end_cursor: result.nextCursor,
        page_info: result.pageInfo,
        discussions: result.data,
      };
    }),
  });

  // Get discussion tool
  tools.push({
    tool: {
      name: 'get_discussion',
      description: 'Get a specific discussion',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          discussionNumber: {
            type: 'number',
            description: 'Discussion number',
          },
        },
        required: ['owner', 'repo', 'discussionNumber'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as GetDiscussionParams;
    handler: createTypedHandler<GetDiscussionParams, any>(async (args: GetDiscussionParams) => {
      const query = `
        query($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            discussion(number: $number) {
              id
              number
              title
              body
              bodyHTML
              createdAt
              updatedAt
              author {
                login
                avatarUrl
              }
              category {
                id
                name
                slug
                description
              }
              comments(first: 10) {
                totalCount
                nodes {
                  id
                  body
                  createdAt
                  author {
                    login
                  }
                }
              }
              upvoteCount
              viewerHasUpvoted
              viewerCanUpvote
              viewerCanDelete
              viewerCanUpdate
              url
            }
          }
        }
      `;

      const result: any = await octokit.graphql(query, {
        owner: params.owner,
        repo: params.repo,
        number: params.discussionNumber,
      const result: any = await cachedGraphQL(client, query, {
      const result = await typedGraphQL<GetDiscussionResponse>(octokit, query, {
      const result: any = await (octokit as any).graphqlWithComplexity(query, {
        owner: args.owner,
        repo: args.repo,
        number: args.discussionNumber,
      }, {
        ttl: GraphQLTTL.DISCUSSION_DETAIL,
        operation: 'get_discussion'
      });

      return result.repository.discussion;
    }),
  });

  // Get discussion comments tool
  tools.push({
    tool: {
      name: 'get_discussion_comments',
      description: 'Get comments on a discussion',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          discussionNumber: {
            type: 'number',
            description: 'Discussion number',
          },
          after: {
            type: 'string',
            description: 'Cursor for pagination',
          },
          perPage: {
            type: 'number',
            description: 'Results per page for pagination (min 1, max 100)',
            minimum: 1,
            maximum: 100,
          },
          autoPage: {
            type: 'boolean',
            description: 'Automatically paginate through all results',
          },
          maxPages: {
            type: 'number',
            description: 'Maximum number of pages to fetch (default 10)',
            minimum: 1,
          },
          maxItems: {
            type: 'number',
            description: 'Maximum number of items to fetch across all pages',
            minimum: 1,
          },
        },
        required: ['owner', 'repo', 'discussionNumber'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as GetDiscussionCommentsParams;
      const query = `
        query($owner: String!, $repo: String!, $number: Int!, $first: Int!, $after: String) {
          repository(owner: $owner, name: $repo) {
            discussion(number: $number) {
              comments(first: $first, after: $after) {
                totalCount
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  id
                  body
                  bodyHTML
                  createdAt
                  updatedAt
                  author {
                    login
                    avatarUrl
                  }
                  upvoteCount
                  viewerHasUpvoted
                  viewerCanUpvote
                  viewerCanDelete
                  viewerCanUpdate
                  replies(first: 5) {
                    totalCount
                    nodes {
                      id
                      body
                      createdAt
                      author {
                        login
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const result: any = await octokit.graphql(query, {
        owner: params.owner,
        repo: params.repo,
        number: params.discussionNumber,
        first: params.perPage || 25,
        after: params.after,
    handler: async (args: GetDiscussionCommentsParams) => {
      try {
        GraphQLPaginationUtils.validatePaginationParams(args);
      } catch (error) {
        throw new Error(`Invalid pagination parameters: ${error.message}`);
      }

      const queryBuilder = paginationHandler.createDiscussionCommentsQuery(
        args.owner,
        args.repo,
        args.discussionNumber
      );

      const paginationOptions: GraphQLPaginationOptions = {
        first: args.perPage,
        after: args.after,
        autoPage: args.autoPage,
        maxPages: args.maxPages,
        maxItems: args.maxItems,
      };

      const result = await paginationHandler.paginate(queryBuilder, paginationOptions);
      const result: any = await cachedGraphQL(client, query, {
      const result: any = await (octokit as any).graphqlWithComplexity(query, {
        owner: args.owner,
        repo: args.repo,
        number: args.discussionNumber,
        first: args.perPage || 25,
        after: args.after,
      }, {
        ttl: GraphQLTTL.DISCUSSION_COMMENTS,
        operation: 'get_discussion_comments'
      });

      return {
        total_count: result.totalCount,
        has_next_page: result.hasMore,
        end_cursor: result.nextCursor,
        page_info: result.pageInfo,
        comments: result.data,
      };
    },
  });

  // List discussion categories tool
  tools.push({
    tool: {
      name: 'list_discussion_categories',
      description: 'List discussion categories in a repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as ListDiscussionCategoriesParams;
      const query = `
        query($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            discussionCategories(first: 100) {
              totalCount
              nodes {
                id
                name
                slug
                description
                emoji
                createdAt
                updatedAt
                isAnswerable
              }
            }
          }
        }
      `;

      const result: any = await octokit.graphql(query, {
        owner: params.owner,
        repo: params.repo,
      const result: any = await cachedGraphQL(client, query, {
      const result: any = await (octokit as any).graphqlWithComplexity(query, {
        owner: args.owner,
        repo: args.repo,
      }, {
        ttl: GraphQLTTL.DISCUSSION_CATEGORIES,
        operation: 'list_discussion_categories'
      });

      return {
        total_count: result.repository.discussionCategories.totalCount,
        categories: result.repository.discussionCategories.nodes,
      };
    },
  });

  // Search discussions tool
  tools.push({
    tool: {
      name: 'search_discussions',
      description: 'Search for discussions',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          owner: {
            type: 'string',
            description: 'Repository owner (optional)',
          },
          repo: {
            type: 'string',
            description: 'Repository name (optional)',
          },
          first: {
            type: 'number',
            description: 'Number of results to return',
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['query'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as SearchDiscussionsParams;
      let searchQuery = params.query;
      if (params.owner && params.repo) {
        searchQuery = `repo:${params.owner}/${params.repo} ${searchQuery}`;
      }

      const query = `
        query($searchQuery: String!, $first: Int!) {
          search(query: $searchQuery, type: DISCUSSION, first: $first) {
            discussionCount
            nodes {
              ... on Discussion {
                id
                number
                title
                body
                createdAt
                updatedAt
                author {
                  login
                }
                repository {
                  name
                  owner {
                    login
                  }
                }
                url
              }
            }
          }
        }
      `;

      const result: any = await cachedGraphQL(client, query, {
      const result: any = await (octokit as any).graphqlWithComplexity(query, {
        searchQuery,
        first: params.first || 25,
        first: args.first || 25,
      }, {
        ttl: GraphQLTTL.SEARCH_RESULTS,
        operation: 'search_discussions'
      });

      return {
        total_count: result.search.discussionCount,
        discussions: result.search.nodes,
      };
    },
  });

  // Add write operations if not in read-only mode
  if (!readOnly) {
    // Create discussion tool
    tools.push({
      tool: {
        name: 'create_discussion',
        description: 'Create a new discussion',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            title: {
              type: 'string',
              description: 'Discussion title',
            },
            body: {
              type: 'string',
              description: 'Discussion body',
            },
            categoryId: {
              type: 'string',
              description: 'Category ID for the discussion',
            },
          },
          required: ['owner', 'repo', 'title', 'body', 'categoryId'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as CreateDiscussionParams;
        // First get the repository ID
        const repoQuery = `
          query($owner: String!, $repo: String!) {
            repository(owner: $owner, name: $repo) {
              id
            }
          }
        `;

        const repoResult: any = await octokit.graphql(repoQuery, {
          owner: params.owner,
          repo: params.repo,
        const repoResult: any = await cachedGraphQL(client, repoQuery, {
        const repoResult: any = await (octokit as any).graphqlWithComplexity(repoQuery, {
          owner: args.owner,
          repo: args.repo,
        }, {
          ttl: GraphQLTTL.REPOSITORY_INFO,
          operation: 'get_repository_id'
        });

        const mutation = `
          mutation($repositoryId: ID!, $title: String!, $body: String!, $categoryId: ID!) {
            createDiscussion(input: {
              repositoryId: $repositoryId,
              title: $title,
              body: $body,
              categoryId: $categoryId
            }) {
              discussion {
                id
                number
                title
                body
                createdAt
                author {
                  login
                }
                category {
                  name
                }
                url
              }
            }
          }
        `;

        const result: any = await smartGraphQL(client, mutation, {
        const result: any = await (octokit as any).graphqlWithComplexity(mutation, {
          repositoryId: repoResult.repository.id,
          title: params.title,
          body: params.body,
          categoryId: params.categoryId,
          title: args.title,
          body: args.body,
          categoryId: args.categoryId,
        }, {
          isMutation: true,
          operation: 'create_discussion'
        });

        return result.createDiscussion.discussion;
      },
    });

    // Add discussion comment tool
    tools.push({
      tool: {
        name: 'add_discussion_comment',
        description: 'Add a comment to a discussion',
        inputSchema: {
          type: 'object',
          properties: {
            discussionId: {
              type: 'string',
              description: 'The ID of the discussion',
            },
            body: {
              type: 'string',
              description: 'Comment body',
            },
            replyToId: {
              type: 'string',
              description: 'Optional ID of comment to reply to',
            },
          },
          required: ['discussionId', 'body'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as AddDiscussionCommentParams;
        const mutation = `
          mutation($discussionId: ID!, $body: String!, $replyToId: ID) {
            addDiscussionComment(input: {
              discussionId: $discussionId,
              body: $body,
              replyToId: $replyToId
            }) {
              comment {
                id
                body
                createdAt
                author {
                  login
                }
              }
            }
          }
        `;

        const result: any = await octokit.graphql(mutation, {
          discussionId: params.discussionId,
          body: params.body,
          replyToId: params.replyToId,
        const result: any = await smartGraphQL(client, mutation, {
        const result: any = await (octokit as any).graphqlWithComplexity(mutation, {
          discussionId: args.discussionId,
          body: args.body,
          replyToId: args.replyToId,
        }, {
          isMutation: true,
          operation: 'add_discussion_comment'
        });

        return result.addDiscussionComment.comment;
      },
    });

    // Update discussion tool
    tools.push({
      tool: {
        name: 'update_discussion',
        description: 'Update a discussion',
        inputSchema: {
          type: 'object',
          properties: {
            discussionId: {
              type: 'string',
              description: 'The ID of the discussion',
            },
            title: {
              type: 'string',
              description: 'New title',
            },
            body: {
              type: 'string',
              description: 'New body',
            },
            categoryId: {
              type: 'string',
              description: 'New category ID',
            },
          },
          required: ['discussionId'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as UpdateDiscussionParams;
        const mutation = `
          mutation($discussionId: ID!, $title: String, $body: String, $categoryId: ID) {
            updateDiscussion(input: {
              discussionId: $discussionId,
              title: $title,
              body: $body,
              categoryId: $categoryId
            }) {
              discussion {
                id
                number
                title
                body
                updatedAt
                category {
                  name
                }
              }
            }
          }
        `;

        const result: any = await octokit.graphql(mutation, {
          discussionId: params.discussionId,
          title: params.title,
          body: params.body,
          categoryId: params.categoryId,
        const result: any = await smartGraphQL(client, mutation, {
        const result: any = await (octokit as any).graphqlWithComplexity(mutation, {
          discussionId: args.discussionId,
          title: args.title,
          body: args.body,
          categoryId: args.categoryId,
        }, {
          isMutation: true,
          operation: 'update_discussion'
        });

        return result.updateDiscussion.discussion;
      },
    });

    // Delete discussion tool
    tools.push({
      tool: {
        name: 'delete_discussion',
        description: 'Delete a discussion',
        inputSchema: {
          type: 'object',
          properties: {
            discussionId: {
              type: 'string',
              description: 'The ID of the discussion to delete',
            },
          },
          required: ['discussionId'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as DeleteDiscussionParams;
        const mutation = `
          mutation($discussionId: ID!) {
            deleteDiscussion(input: {
              id: $discussionId
            }) {
              clientMutationId
            }
          }
        `;

        await octokit.graphql(mutation, {
          discussionId: params.discussionId,
        await smartGraphQL(client, mutation, {
        await (octokit as any).graphqlWithComplexity(mutation, {
          discussionId: args.discussionId,
        }, {
          isMutation: true,
          operation: 'delete_discussion'
        });

        return {
          success: true,
          message: 'Discussion deleted successfully',
        };
      },
    });
  }

  return tools;
}
