import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';

export function createDiscussionTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

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
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: any) => {
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
        owner: args.owner,
        repo: args.repo,
        first: args.perPage || 25,
        after: args.after,
        categoryId: args.category,
      });

      return {
        total_count: result.repository.discussions.totalCount,
        has_next_page: result.repository.discussions.pageInfo.hasNextPage,
        end_cursor: result.repository.discussions.pageInfo.endCursor,
        discussions: result.repository.discussions.nodes,
      };
    },
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
    handler: async (args: any) => {
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
        owner: args.owner,
        repo: args.repo,
        number: args.discussionNumber,
      });

      return result.repository.discussion;
    },
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
        },
        required: ['owner', 'repo', 'discussionNumber'],
      },
    },
    handler: async (args: any) => {
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
        owner: args.owner,
        repo: args.repo,
        number: args.discussionNumber,
        first: args.perPage || 25,
        after: args.after,
      });

      return {
        total_count: result.repository.discussion.comments.totalCount,
        has_next_page: result.repository.discussion.comments.pageInfo.hasNextPage,
        end_cursor: result.repository.discussion.comments.pageInfo.endCursor,
        comments: result.repository.discussion.comments.nodes,
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
    handler: async (args: any) => {
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
        owner: args.owner,
        repo: args.repo,
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
    handler: async (args: any) => {
      let searchQuery = args.query;
      if (args.owner && args.repo) {
        searchQuery = `repo:${args.owner}/${args.repo} ${searchQuery}`;
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

      const result: any = await octokit.graphql(query, {
        searchQuery,
        first: args.first || 25,
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
      handler: async (args: any) => {
        // First get the repository ID
        const repoQuery = `
          query($owner: String!, $repo: String!) {
            repository(owner: $owner, name: $repo) {
              id
            }
          }
        `;

        const repoResult: any = await octokit.graphql(repoQuery, {
          owner: args.owner,
          repo: args.repo,
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

        const result: any = await octokit.graphql(mutation, {
          repositoryId: repoResult.repository.id,
          title: args.title,
          body: args.body,
          categoryId: args.categoryId,
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
      handler: async (args: any) => {
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
          discussionId: args.discussionId,
          body: args.body,
          replyToId: args.replyToId,
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
      handler: async (args: any) => {
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
          discussionId: args.discussionId,
          title: args.title,
          body: args.body,
          categoryId: args.categoryId,
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
      handler: async (args: any) => {
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
          discussionId: args.discussionId,
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
