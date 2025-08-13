import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';
import {
  ListPullRequestsParams,
  CreatePullRequestParams,
  UpdatePullRequestParams,
  MergePullRequestParams,
  GetPullRequestDiffParams,
  DismissPullRequestReviewParams,
  CreatePullRequestReviewCommentParams
} from '../tool-types.js';

interface GetPullRequestParams {
  owner: string;
  repo: string;
  pull_number: number;
  expected_head_sha?: string;
}

interface GetPullRequestCommitsParams {
  owner: string;
  repo: string;
  pull_number: number;
  page?: number;
  perPage?: number;
  sort?: "created" | "updated" | "popularity" | "long-running";
  direction?: "asc" | "desc";
}

interface GetPullRequestFilesParams {
  owner: string;
  repo: string;
  pull_number: number;
  page?: number;
  perPage?: number;
  sort?: "created" | "updated" | "popularity" | "long-running";
  direction?: "asc" | "desc";
}

interface GetPullRequestReviewsParams {
  owner: string;
  repo: string;
  pull_number: number;
  page?: number;
  perPage?: number;
  sort?: "created" | "updated" | "popularity" | "long-running";
  direction?: "asc" | "desc";
}

interface CreatePullRequestReviewParams {
  owner: string;
  repo: string;
  pull_number: number;
  body?: string;
  event?: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  comments?: Array<{
    path: string;
    line?: number;
    body: string;
  }>;
  commitID?: string;
}

interface AddPullRequestCommentParams {
  owner: string;
  repo: string;
  pull_number: number;
  body: string;
}

interface RequestPullRequestReviewersParams {
  owner: string;
  repo: string;
  pull_number: number;
  reviewers?: string[];
  team_reviewers?: string[];
}

export function createPullRequestTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // Get pull request details tool
  tools.push({
    tool: {
      name: 'get_pull_request',
      description: 'Get details of a specific pull request',
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
          pull_number: {
            type: 'number',
            description: 'Pull request number',
          },
        },
        required: ['owner', 'repo', 'pullNumber'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as GetPullRequestParams;
      const { data } = await octokit.pulls.get({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.pull_number,
      });

      return {
        number: data.number,
        title: data.title,
        state: data.state,
        body: data.body,
        user: {
          login: data.user?.login,
          type: data.user?.type,
        },
        head: {
          ref: data.head.ref,
          sha: data.head.sha,
          label: data.head.label,
        },
        base: {
          ref: data.base.ref,
          sha: data.base.sha,
          label: data.base.label,
        },
        merged: data.merged,
        mergeable: data.mergeable,
        mergeable_state: data.mergeable_state,
        merged_by: data.merged_by ? {
          login: data.merged_by.login,
        } : null,
        commits: data.commits,
        additions: data.additions,
        deletions: data.deletions,
        changed_files: data.changed_files,
        comments: data.comments,
        review_comments: data.review_comments,
        created_at: data.created_at,
        updated_at: data.updated_at,
        closed_at: data.closed_at,
        merged_at: data.merged_at,
        html_url: data.html_url,
        diff_url: data.diff_url,
        patch_url: data.patch_url,
      };
    },
  });

  // List pull requests tool
  tools.push({
    tool: {
      name: 'list_pull_requests',
      description: 'List pull requests in a repository',
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
          state: {
            type: 'string',
            description: 'Filter by state',
            enum: ['open', 'closed', 'all'],
          },
          head: {
            type: 'string',
            description: 'Filter by head user/org and branch',
          },
          base: {
            type: 'string',
            description: 'Filter by base branch',
          },
          sort: {
            type: 'string',
            description: 'Sort by',
            enum: ['created', 'updated', 'popularity', 'long-running'],
          },
          direction: {
            type: 'string',
            description: 'Sort direction',
            enum: ['asc', 'desc'],
          },
          page: {
            type: 'number',
            description: 'Page number for pagination (min 1)',
            minimum: 1,
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
    handler: async (args: unknown) => {
      const params = args as ListPullRequestsParams;
      const { data } = await octokit.pulls.list({
        owner: params.owner,
        repo: params.repo,
        state: params.state as any,
        head: params.head,
        base: params.base,
        sort: params.sort as any,
        direction: params.direction as any,
        page: params.page,
        per_page: params.perPage,
      });

      return data.map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        user: {
          login: pr.user?.login,
        },
        head: {
          ref: pr.head.ref,
          label: pr.head.label,
        },
        base: {
          ref: pr.base.ref,
          label: pr.base.label,
        },
        draft: pr.draft,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        html_url: pr.html_url,
      }));
    },
  });

  // List pull request files tool
  tools.push({
    tool: {
      name: 'list_pull_request_files',
      description: 'Get files changed in a pull request',
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
          pull_number: {
            type: 'number',
            description: 'Pull request number',
          },
          page: {
            type: 'number',
            description: 'Page number for pagination (min 1)',
            minimum: 1,
          },
          perPage: {
            type: 'number',
            description: 'Results per page for pagination (min 1, max 100)',
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['owner', 'repo', 'pullNumber'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as GetPullRequestFilesParams;
      const { data } = await octokit.pulls.listFiles({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.pull_number,
        page: params.page,
        per_page: params.perPage,
      });

      return data.map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
        sha: file.sha,
        blob_url: file.blob_url,
        raw_url: file.raw_url,
        contents_url: file.contents_url,
      }));
    },
  });

  // Get pull request diff tool
  tools.push({
    tool: {
      name: 'get_pull_request_diff',
      description: 'Get the diff of a pull request',
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
          pull_number: {
            type: 'number',
            description: 'Pull request number',
          },
        },
        required: ['owner', 'repo', 'pullNumber'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as GetPullRequestDiffParams;
      const response = await octokit.pulls.get({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.pull_number,
        mediaType: {
          format: 'diff',
        },
      });

      return {
        diff: response.data,
      };
    },
  });

  // List pull request comments tool
  tools.push({
    tool: {
      name: 'list_pull_request_comments',
      description: 'Get review comments on a pull request',
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
          pull_number: {
            type: 'number',
            description: 'Pull request number',
          },
        },
        required: ['owner', 'repo', 'pullNumber'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as GetPullRequestParams;
      const { data } = await octokit.pulls.listReviewComments({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.pull_number,
      });

      return data.map((comment) => ({
        id: comment.id,
        body: comment.body,
        path: comment.path,
        line: comment.line,
        side: comment.side,
        start_line: comment.start_line,
        start_side: comment.start_side,
        user: {
          login: comment.user?.login,
        },
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        html_url: comment.html_url,
      }));
    },
  });

  // List pull request reviews tool
  tools.push({
    tool: {
      name: 'list_pull_request_reviews',
      description: 'Get reviews on a pull request',
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
          pull_number: {
            type: 'number',
            description: 'Pull request number',
          },
        },
        required: ['owner', 'repo', 'pullNumber'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as GetPullRequestReviewsParams;
      const { data } = await octokit.pulls.listReviews({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.pull_number,
      });

      return data.map((review) => ({
        id: review.id,
        user: {
          login: review.user?.login,
        },
        body: review.body,
        state: review.state,
        submitted_at: review.submitted_at,
        html_url: review.html_url,
      }));
    },
  });

  // Get pull request status checks tool
  tools.push({
    tool: {
      name: 'get_pull_request_status',
      description: 'Get status checks for a pull request',
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
          pull_number: {
            type: 'number',
            description: 'Pull request number',
          },
        },
        required: ['owner', 'repo', 'pullNumber'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as GetPullRequestParams;
      // First get the PR to get the head SHA
      const { data: pr } = await octokit.pulls.get({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.pull_number,
      });

      // Get the combined status
      const { data: status } = await octokit.repos.getCombinedStatusForRef({
        owner: params.owner,
        repo: params.repo,
        ref: pr.head.sha,
      });

      return {
        state: status.state,
        statuses: status.statuses.map((s) => ({
          state: s.state,
          description: s.description,
          context: s.context,
          target_url: s.target_url,
          created_at: s.created_at,
          updated_at: s.updated_at,
        })),
        sha: status.sha,
        total_count: status.total_count,
      };
    },
  });

  // Search pull requests tool
  tools.push({
    tool: {
      name: 'search_pull_requests',
      description: 'Search for pull requests',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query using GitHub pull request search syntax',
          },
          sort: {
            type: 'string',
            description: 'Sort field',
            enum: ['comments', 'reactions', 'reactions-+1', 'reactions--1', 'reactions-smile', 'reactions-thinking_face', 'reactions-heart', 'reactions-tada', 'interactions', 'created', 'updated'],
          },
          order: {
            type: 'string',
            description: 'Sort order',
            enum: ['asc', 'desc'],
          },
          owner: {
            type: 'string',
            description: 'Optional repository owner',
          },
          repo: {
            type: 'string',
            description: 'Optional repository name',
          },
          page: {
            type: 'number',
            description: 'Page number for pagination (min 1)',
            minimum: 1,
          },
          perPage: {
            type: 'number',
            description: 'Results per page for pagination (min 1, max 100)',
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['query'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as any;
      let query = `is:pr ${params.query}`;
      
      // Add repo filter if provided
      if (params.owner && params.repo) {
        query = `repo:${params.owner}/${params.repo} ${query}`;
      }

      const { data } = await octokit.search.issuesAndPullRequests({
        q: query,
        sort: params.sort as any,
        order: params.order as any,
        page: params.page,
        per_page: params.perPage,
      });

      return {
        total_count: data.total_count,
        incomplete_results: data.incomplete_results,
        items: data.items.map((item) => ({
          number: item.number,
          title: item.title,
          state: item.state,
          user: {
            login: item.user?.login,
          },
          created_at: item.created_at,
          updated_at: item.updated_at,
          html_url: item.html_url,
          repository_url: item.repository_url,
        })),
      };
    },
  });

  // Add write operations if not in read-only mode
  if (!readOnly) {
    // Create pull request tool
    tools.push({
      tool: {
        name: 'create_pull_request',
        description: 'Create a new pull request',
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
              description: 'PR title',
            },
            head: {
              type: 'string',
              description: 'Branch containing changes',
            },
            base: {
              type: 'string',
              description: 'Branch to merge into',
            },
            body: {
              type: 'string',
              description: 'PR description',
            },
            draft: {
              type: 'boolean',
              description: 'Create as draft PR',
            },
            maintainer_can_modify: {
              type: 'boolean',
              description: 'Allow maintainer edits',
            },
          },
          required: ['owner', 'repo', 'title', 'head', 'base'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as CreatePullRequestParams;
        const { data } = await octokit.pulls.create({
          owner: params.owner,
          repo: params.repo,
          title: params.title,
          head: params.head,
          base: params.base,
          body: params.body,
          draft: params.draft,
          maintainer_can_modify: params.maintainer_can_modify,
        });

        return {
          number: data.number,
          title: data.title,
          state: data.state,
          html_url: data.html_url,
          head: {
            ref: data.head.ref,
            label: data.head.label,
          },
          base: {
            ref: data.base.ref,
            label: data.base.label,
          },
          created_at: data.created_at,
        };
      },
    });

    // Update pull request tool
    tools.push({
      tool: {
        name: 'update_pull_request',
        description: 'Update an existing pull request',
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
            pull_number: {
              type: 'number',
              description: 'Pull request number to update',
            },
            title: {
              type: 'string',
              description: 'New title',
            },
            body: {
              type: 'string',
              description: 'New description',
            },
            state: {
              type: 'string',
              description: 'New state',
              enum: ['open', 'closed'],
            },
            base: {
              type: 'string',
              description: 'New base branch name',
            },
            maintainer_can_modify: {
              type: 'boolean',
              description: 'Allow maintainer edits',
            },
          },
          required: ['owner', 'repo', 'pullNumber'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as UpdatePullRequestParams;
        const { data } = await octokit.pulls.update({
          owner: params.owner,
          repo: params.repo,
          pull_number: params.pull_number,
          title: params.title,
          body: params.body,
          state: params.state as any,
          base: params.base,
          maintainer_can_modify: params.maintainer_can_modify,
        });

        return {
          number: data.number,
          title: data.title,
          state: data.state,
          body: data.body,
          html_url: data.html_url,
          updated_at: data.updated_at,
        };
      },
    });

    // Merge pull request tool
    tools.push({
      tool: {
        name: 'merge_pull_request',
        description: 'Merge a pull request',
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
            pull_number: {
              type: 'number',
              description: 'Pull request number',
            },
            commit_title: {
              type: 'string',
              description: 'Title for merge commit',
            },
            commit_message: {
              type: 'string',
              description: 'Extra detail for merge commit',
            },
            merge_method: {
              type: 'string',
              description: 'Merge method',
              enum: ['merge', 'squash', 'rebase'],
            },
          },
          required: ['owner', 'repo', 'pullNumber'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as MergePullRequestParams;
        const { data } = await octokit.pulls.merge({
          owner: params.owner,
          repo: params.repo,
          pull_number: params.pull_number,
          commit_title: params.commit_title,
          commit_message: params.commit_message,
          merge_method: params.merge_method,
        });

        return {
          merged: data.merged,
          message: data.message,
          sha: data.sha,
        };
      },
    });

    // Create pull request review tool
    tools.push({
      tool: {
        name: 'create_pull_request_review',
        description: 'Create and submit a pull request review',
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
            pull_number: {
              type: 'number',
              description: 'Pull request number',
            },
            body: {
              type: 'string',
              description: 'Review comment text',
            },
            event: {
              type: 'string',
              description: 'Review action to perform',
              enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'],
            },
            commitID: {
              type: 'string',
              description: 'SHA of commit to review',
            },
          },
          required: ['owner', 'repo', 'pullNumber', 'body', 'event'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as CreatePullRequestReviewParams;
        const { data } = await octokit.pulls.createReview({
          owner: params.owner,
          repo: params.repo,
          pull_number: params.pull_number,
          body: params.body,
          event: params.event as any,
          commit_id: params.commitID,
        });

        return {
          id: data.id,
          body: data.body,
          state: data.state,
          user: {
            login: data.user?.login,
          },
          submitted_at: data.submitted_at,
          html_url: data.html_url,
        };
      },
    });

    // Update pull request branch tool
    tools.push({
      tool: {
        name: 'update_pull_request_branch',
        description: 'Update a pull request branch with the latest changes from base branch',
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
            pull_number: {
              type: 'number',
              description: 'Pull request number',
            },
            expectedHeadSha: {
              type: 'string',
              description: 'The expected SHA of the pull request\'s HEAD ref',
            },
          },
          required: ['owner', 'repo', 'pullNumber'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as GetPullRequestParams;
        const { data } = await octokit.pulls.updateBranch({
          owner: params.owner,
          repo: params.repo,
          pull_number: params.pull_number,
          expected_head_sha: params.expected_head_sha,
        });

        return {
          message: data.message,
          url: data.url,
        };
      },
    });

    // Dismiss pull request review tool
    tools.push({
      tool: {
        name: 'dismiss_pull_request_review',
        description: 'Dismiss a pull request review',
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
            pull_number: {
              type: 'number',
              description: 'Pull request number',
            },
            review_id: {
              type: 'number',
              description: 'Review ID to dismiss',
            },
            message: {
              type: 'string',
              description: 'Dismissal message',
            },
          },
          required: ['owner', 'repo', 'pullNumber', 'review_id', 'message'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as DismissPullRequestReviewParams;
        const { data } = await octokit.pulls.dismissReview({
          owner: params.owner,
          repo: params.repo,
          pull_number: params.pull_number,
          review_id: params.review_id,
          message: params.message,
        });

        return {
          id: data.id,
          state: data.state,
          user: {
            login: data.user?.login,
          },
          body: data.body,
          submitted_at: data.submitted_at,
          html_url: data.html_url,
        };
      },
    });

    // Create pull request review comment tool
    tools.push({
      tool: {
        name: 'create_pull_request_review_comment',
        description: 'Create a review comment on a pull request',
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
            pull_number: {
              type: 'number',
              description: 'Pull request number',
            },
            body: {
              type: 'string',
              description: 'Comment body',
            },
            commit_id: {
              type: 'string',
              description: 'SHA of the commit to comment on',
            },
            path: {
              type: 'string',
              description: 'Relative path of the file to comment on',
            },
            line: {
              type: 'number',
              description: 'Line number in the diff to comment on',
            },
            side: {
              type: 'string',
              description: 'Side of the diff',
              enum: ['LEFT', 'RIGHT'],
            },
          },
          required: ['owner', 'repo', 'pullNumber', 'body', 'commit_id', 'path', 'line'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as CreatePullRequestReviewCommentParams;
        const { data } = await octokit.pulls.createReviewComment({
          owner: params.owner,
          repo: params.repo,
          pull_number: params.pull_number,
          body: params.body,
          commit_id: params.commit_id,
          path: params.path,
          line: params.line,
          side: params.side,
        });

        return {
          id: data.id,
          body: data.body,
          path: data.path,
          line: data.line,
          side: data.side,
          user: {
            login: data.user?.login,
          },
          created_at: data.created_at,
          html_url: data.html_url,
        };
      },
    });
  }

  return tools;
}
