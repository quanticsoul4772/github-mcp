import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';
import {
  ListIssuesParams,
  CreateIssueParams,
  UpdateIssueParams,
  CreateIssueCommentParams,
  SearchIssuesParams
} from '../tool-types.js';

interface GetIssueParams {
  owner: string;
  repo: string;
  issue_number: number;
}

interface GetIssueCommentsParams {
  owner: string;
  repo: string;
  issue_number: number;
  page?: number;
  perPage?: number;
}

interface SearchIssuesWithRepoParams extends SearchIssuesParams {
  owner?: string;
  repo?: string;
}

export function createIssueTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // Get issue details tool
  tools.push({
    tool: {
      name: 'get_issue',
      description: 'Get details of a specific GitHub issue',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'The owner of the repository',
          },
          repo: {
            type: 'string',
            description: 'The name of the repository',
          },
          issue_number: {
            type: 'number',
            description: 'The number of the issue',
          },
        },
        required: ['owner', 'repo', 'issue_number'],
      },
    },
    handler: async (args: GetIssueParams) => {
      const { data } = await octokit.issues.get({
        owner: args.owner,
        repo: args.repo,
        issue_number: args.issue_number,
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
        labels: data.labels.map((label) => 
          typeof label === 'string' ? label : label.name
        ),
        assignees: data.assignees?.map((user) => ({
          login: user.login,
          type: user.type,
        })),
        milestone: data.milestone ? {
          title: data.milestone.title,
          number: data.milestone.number,
          state: data.milestone.state,
        } : null,
        comments: data.comments,
        created_at: data.created_at,
        updated_at: data.updated_at,
        closed_at: data.closed_at,
        html_url: data.html_url,
      };
    },
  });

  // List issues tool
  tools.push({
    tool: {
      name: 'list_issues',
      description: 'List issues in a GitHub repository',
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
          labels: {
            type: 'array',
            description: 'Filter by labels',
            items: { type: 'string' },
          },
          sort: {
            type: 'string',
            description: 'Sort order',
            enum: ['created', 'updated', 'comments'],
          },
          direction: {
            type: 'string',
            description: 'Sort direction',
            enum: ['asc', 'desc'],
          },
          since: {
            type: 'string',
            description: 'Filter by date (ISO 8601 timestamp)',
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
    handler: async (args: ListIssuesParams) => {
      const { data } = await octokit.issues.listForRepo({
        owner: args.owner,
        repo: args.repo,
        state: args.state,
        labels: args.labels?.join(','),
        sort: args.sort,
        direction: args.direction,
        since: args.since,
        page: args.page,
        per_page: args.perPage,
      });

      return data.map((issue) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        user: {
          login: issue.user?.login,
          type: issue.user?.type,
        },
        labels: issue.labels.map((label) => 
          typeof label === 'string' ? label : label.name
        ),
        assignees: issue.assignees?.map((user) => ({
          login: user.login,
        })),
        comments: issue.comments,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        html_url: issue.html_url,
        pull_request: issue.pull_request ? true : false,
      }));
    },
  });

  // List issue comments tool
  tools.push({
    tool: {
      name: 'list_issue_comments',
      description: 'Get comments on a GitHub issue',
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
          issue_number: {
            type: 'number',
            description: 'Issue number',
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
        required: ['owner', 'repo', 'issue_number'],
      },
    },
    handler: async (args: GetIssueCommentsParams) => {
      const { data } = await octokit.issues.listComments({
        owner: args.owner,
        repo: args.repo,
        issue_number: args.issue_number,
        page: args.page,
        per_page: args.perPage,
      });

      return data.map((comment) => ({
        id: comment.id,
        body: comment.body,
        user: {
          login: comment.user?.login,
          type: comment.user?.type,
        },
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        html_url: comment.html_url,
      }));
    },
  });

  // Search issues tool
  tools.push({
    tool: {
      name: 'search_issues',
      description: 'Search for GitHub issues and pull requests',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query using GitHub issues search syntax',
          },
          sort: {
            type: 'string',
            description: 'Sort field by number of matches',
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
    handler: async (args: SearchIssuesWithRepoParams) => {
      let query = args.query;
      
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
        items: data.items.map((item) => ({
          number: item.number,
          title: item.title,
          state: item.state,
          user: {
            login: item.user?.login,
          },
          labels: item.labels.map((label) => label.name),
          assignees: item.assignees?.map((user) => ({
            login: user.login,
          })),
          comments: item.comments,
          created_at: item.created_at,
          updated_at: item.updated_at,
          html_url: item.html_url,
          pull_request: item.pull_request ? true : false,
          repository_url: item.repository_url,
        })),
      };
    },
  });

  // Add write operations if not in read-only mode
  if (!readOnly) {
    // Create issue tool
    tools.push({
      tool: {
        name: 'create_issue',
        description: 'Create a new GitHub issue',
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
              description: 'Issue title',
            },
            body: {
              type: 'string',
              description: 'Issue body content',
            },
            assignees: {
              type: 'array',
              description: 'Usernames to assign to this issue',
              items: { type: 'string' },
            },
            milestone: {
              type: 'number',
              description: 'Milestone number',
            },
            labels: {
              type: 'array',
              description: 'Labels to apply to this issue',
              items: { type: 'string' },
            },
          },
          required: ['owner', 'repo', 'title'],
        },
      },
      handler: async (args: CreateIssueParams) => {
        const { data } = await octokit.issues.create({
          owner: args.owner,
          repo: args.repo,
          title: args.title,
          body: args.body,
          assignees: args.assignees,
          milestone: args.milestone,
          labels: args.labels,
        });

        return {
          number: data.number,
          title: data.title,
          state: data.state,
          body: data.body,
          html_url: data.html_url,
          user: {
            login: data.user?.login,
          },
          created_at: data.created_at,
        };
      },
    });

    // Update issue tool
    tools.push({
      tool: {
        name: 'update_issue',
        description: 'Update an existing GitHub issue',
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
            issue_number: {
              type: 'number',
              description: 'Issue number to update',
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
            labels: {
              type: 'array',
              description: 'New labels',
              items: { type: 'string' },
            },
            assignees: {
              type: 'array',
              description: 'New assignees',
              items: { type: 'string' },
            },
            milestone: {
              type: 'number',
              description: 'New milestone number',
            },
          },
          required: ['owner', 'repo', 'issue_number'],
        },
      },
      handler: async (args: UpdateIssueParams) => {
        const { data } = await octokit.issues.update({
          owner: args.owner,
          repo: args.repo,
          issue_number: args.issue_number,
          title: args.title,
          body: args.body,
          state: args.state,
          labels: args.labels,
          assignees: args.assignees,
          milestone: args.milestone,
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

    // Create issue comment tool
    tools.push({
      tool: {
        name: 'create_issue_comment',
        description: 'Add a comment to a GitHub issue',
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
            issue_number: {
              type: 'number',
              description: 'Issue number to comment on',
            },
            body: {
              type: 'string',
              description: 'Comment content',
            },
          },
          required: ['owner', 'repo', 'issue_number', 'body'],
        },
      },
      handler: async (args: CreateIssueCommentParams) => {
        const { data } = await octokit.issues.createComment({
          owner: args.owner,
          repo: args.repo,
          issue_number: args.issue_number,
          body: args.body,
        });

        return {
          id: data.id,
          body: data.body,
          user: {
            login: data.user?.login,
          },
          created_at: data.created_at,
          html_url: data.html_url,
        };
      },
    });

    // Update issue comment tool
    tools.push({
      tool: {
        name: 'update_issue_comment',
        description: 'Update an existing issue comment',
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
            comment_id: {
              type: 'number',
              description: 'Comment ID to update',
            },
            body: {
              type: 'string',
              description: 'New comment content',
            },
          },
          required: ['owner', 'repo', 'comment_id', 'body'],
        },
      },
      handler: async (args: any) => {
        const { data } = await octokit.issues.updateComment({
          owner: args.owner,
          repo: args.repo,
          comment_id: args.comment_id,
          body: args.body,
        });

        return {
          id: data.id,
          body: data.body,
          user: {
            login: data.user?.login,
          },
          updated_at: data.updated_at,
          html_url: data.html_url,
        };
      },
    });

    // Delete issue comment tool
    tools.push({
      tool: {
        name: 'delete_issue_comment',
        description: 'Delete an issue comment',
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
            comment_id: {
              type: 'number',
              description: 'Comment ID to delete',
            },
          },
          required: ['owner', 'repo', 'comment_id'],
        },
      },
      handler: async (args: any) => {
        await octokit.issues.deleteComment({
          owner: args.owner,
          repo: args.repo,
          comment_id: args.comment_id,
        });

        return {
          success: true,
          message: `Comment ${args.comment_id} deleted successfully`,
        };
      },
    });

    // Add issue labels tool
    tools.push({
      tool: {
        name: 'add_issue_labels',
        description: 'Add labels to an issue',
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
            issue_number: {
              type: 'number',
              description: 'Issue number',
            },
            labels: {
              type: 'array',
              description: 'Labels to add',
              items: { type: 'string' },
            },
          },
          required: ['owner', 'repo', 'issue_number', 'labels'],
        },
      },
      handler: async (args: any) => {
        const { data } = await octokit.issues.addLabels({
          owner: args.owner,
          repo: args.repo,
          issue_number: args.issue_number,
          labels: args.labels,
        });

        return data.map((label) => ({
          name: label.name,
          color: label.color,
          description: label.description,
        }));
      },
    });

    // Remove issue label tool
    tools.push({
      tool: {
        name: 'remove_issue_label',
        description: 'Remove a label from an issue',
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
            issue_number: {
              type: 'number',
              description: 'Issue number',
            },
            name: {
              type: 'string',
              description: 'Label name to remove',
            },
          },
          required: ['owner', 'repo', 'issue_number', 'name'],
        },
      },
      handler: async (args: any) => {
        await octokit.issues.removeLabel({
          owner: args.owner,
          repo: args.repo,
          issue_number: args.issue_number,
          name: args.name,
        });

        return {
          success: true,
          message: `Label '${args.name}' removed from issue ${args.issue_number}`,
        };
      },
    });

    // Lock issue tool
    tools.push({
      tool: {
        name: 'lock_issue',
        description: 'Lock an issue',
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
            issue_number: {
              type: 'number',
              description: 'Issue number',
            },
            lock_reason: {
              type: 'string',
              description: 'Reason for locking',
              enum: ['off-topic', 'too heated', 'resolved', 'spam'],
            },
          },
          required: ['owner', 'repo', 'issue_number'],
        },
      },
      handler: async (args: any) => {
        await octokit.issues.lock({
          owner: args.owner,
          repo: args.repo,
          issue_number: args.issue_number,
          lock_reason: args.lock_reason,
        });

        return {
          success: true,
          message: `Issue ${args.issue_number} locked successfully`,
        };
      },
    });

    // Unlock issue tool
    tools.push({
      tool: {
        name: 'unlock_issue',
        description: 'Unlock an issue',
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
            issue_number: {
              type: 'number',
              description: 'Issue number',
            },
          },
          required: ['owner', 'repo', 'issue_number'],
        },
      },
      handler: async (args: any) => {
        await octokit.issues.unlock({
          owner: args.owner,
          repo: args.repo,
          issue_number: args.issue_number,
        });

        return {
          success: true,
          message: `Issue ${args.issue_number} unlocked successfully`,
        };
      },
    });
  }

  return tools;
}
