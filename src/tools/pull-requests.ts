import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';

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
          pullNumber: {
            type: 'number',
            description: 'Pull request number',
          },
        },
        required: ['owner', 'repo', 'pullNumber'],
      },
    },
    handler: async (args: any) => {
      const { data } = await octokit.pulls.get({
        owner: args.owner,
        repo: args.repo,
        pull_number: args.pullNumber,
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
    handler: async (args: any) => {
      const { data } = await octokit.pulls.list({
        owner: args.owner,
        repo: args.repo,
        state: args.state,
        head: args.head,
        base: args.base,
        sort: args.sort,
        direction: args.direction,
        page: args.page,
        per_page: args.perPage,
      });

      return data.map((pr: any) => ({
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

  // Get pull request files tool
  tools.push({
    tool: {
      name: 'get_pull_request_files',
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
          pullNumber: {
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
    handler: async (args: any) => {
      const { data } = await octokit.pulls.listFiles({
        owner: args.owner,
        repo: args.repo,
        pull_number: args.pullNumber,
        page: args.page,
        per_page: args.perPage,
      });

      return data.map((file: any) => ({
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
          pullNumber: {
            type: 'number',
            description: 'Pull request number',
          },
        },
        required: ['owner', 'repo', 'pullNumber'],
      },
    },
    handler: async (args: any) => {
      const response = await octokit.pulls.get({
        owner: args.owner,
        repo: args.repo,
        pull_number: args.pullNumber,
        mediaType: {
          format: 'diff',
        },
      });

      return {
        diff: response.data,
      };
    },
  });

  // Get pull request comments tool
  tools.push({
    tool: {
      name: 'get_pull_request_comments',
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
          pullNumber: {
            type: 'number',
            description: 'Pull request number',
          },
        },
        required: ['owner', 'repo', 'pullNumber'],
      },
    },
    handler: async (args: any) => {
      const { data } = await octokit.pulls.listReviewComments({
        owner: args.owner,
        repo: args.repo,
        pull_number: args.pullNumber,
      });

      return data.map((comment: any) => ({
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

  // Get pull request reviews tool
  tools.push({
    tool: {
      name: 'get_pull_request_reviews',
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
          pullNumber: {
            type: 'number',
            description: 'Pull request number',
          },
        },
        required: ['owner', 'repo', 'pullNumber'],
      },
    },
    handler: async (args: any) => {
      const { data } = await octokit.pulls.listReviews({
        owner: args.owner,
        repo: args.repo,
        pull_number: args.pullNumber,
      });

      return data.map((review: any) => ({
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
          pullNumber: {
            type: 'number',
            description: 'Pull request number',
          },
        },
        required: ['owner', 'repo', 'pullNumber'],
      },
    },
    handler: async (args: any) => {
      // First get the PR to get the head SHA
      const { data: pr } = await octokit.pulls.get({
        owner: args.owner,
        repo: args.repo,
        pull_number: args.pullNumber,
      });

      // Get the combined status
      const { data: status } = await octokit.repos.getCombinedStatusForRef({
        owner: args.owner,
        repo: args.repo,
        ref: pr.head.sha,
      });

      return {
        state: status.state,
        statuses: status.statuses.map((s: any) => ({
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
    handler: async (args: any) => {
      let query = `is:pr ${args.query}`;
      
      // Add repo filter if provided
      if (args.owner && args.repo) {
        query = `repo:${args.owner}/${args.repo} ${query}`;
      }

      const { data } = await octokit.search.issuesAndPullRequests({
        q: query,
        sort: args.sort,
        order: args.order,
        page: args.page,
        per_page: args.perPage,
      });

      return {
        total_count: data.total_count,
        incomplete_results: data.incomplete_results,
        items: data.items.map((item: any) => ({
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
      handler: async (args: any) => {
        const { data } = await octokit.pulls.create({
          owner: args.owner,
          repo: args.repo,
          title: args.title,
          head: args.head,
          base: args.base,
          body: args.body,
          draft: args.draft,
          maintainer_can_modify: args.maintainer_can_modify,
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
            pullNumber: {
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
      handler: async (args: any) => {
        const { data } = await octokit.pulls.update({
          owner: args.owner,
          repo: args.repo,
          pull_number: args.pullNumber,
          title: args.title,
          body: args.body,
          state: args.state,
          base: args.base,
          maintainer_can_modify: args.maintainer_can_modify,
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
            pullNumber: {
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
      handler: async (args: any) => {
        const { data } = await octokit.pulls.merge({
          owner: args.owner,
          repo: args.repo,
          pull_number: args.pullNumber,
          commit_title: args.commit_title,
          commit_message: args.commit_message,
          merge_method: args.merge_method,
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
        name: 'create_and_submit_pull_request_review',
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
            pullNumber: {
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
      handler: async (args: any) => {
        const { data } = await octokit.pulls.createReview({
          owner: args.owner,
          repo: args.repo,
          pull_number: args.pullNumber,
          body: args.body,
          event: args.event,
          commit_id: args.commitID,
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
            pullNumber: {
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
      handler: async (args: any) => {
        const { data } = await octokit.pulls.updateBranch({
          owner: args.owner,
          repo: args.repo,
          pull_number: args.pullNumber,
          expected_head_sha: args.expectedHeadSha,
        });

        return {
          message: data.message,
          url: data.url,
        };
      },
    });
  }

  return tools;
}
