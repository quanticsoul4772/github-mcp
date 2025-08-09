import { ToolConfig } from '../../types.js';
import { IIssueService } from '../../foundation/interfaces.js';
import { BaseToolHandler } from '../../foundation/base-tool-handler.js';
import { ErrorHandler } from '../../foundation/error-handler.js';

interface ListIssuesParams {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  labels?: string[];
  sort?: 'created' | 'updated' | 'comments';
  direction?: 'asc' | 'desc';
  assignee?: string;
  milestone?: string | number;
  per_page?: number;
  page?: number;
}

interface IssueListItem {
  number: number;
  title: string;
  state: string;
  user: {
    login: string;
    type: string;
  } | null;
  labels: string[];
  assignees: Array<{
    login: string;
    type: string;
  }>;
  milestone: {
    title: string;
    number: number;
  } | null;
  comments: number;
  created_at: string;
  updated_at: string;
  html_url: string;
}

class ListIssuesHandler extends BaseToolHandler<ListIssuesParams, IssueListItem[]> {
  constructor(
    octokit: any, // Keep for compatibility - will be removed in full refactor
    private readonly issueService: IIssueService
  ) {
    super(octokit);
  }

  protected validateInput(params: ListIssuesParams): void {
    if (!params.owner || typeof params.owner !== 'string') {
      throw ErrorHandler.createValidationError('owner', 'Owner is required and must be a string');
    }
    if (!params.repo || typeof params.repo !== 'string') {
      throw ErrorHandler.createValidationError('repo', 'Repository name is required and must be a string');
    }

    if (params.state && !['open', 'closed', 'all'].includes(params.state)) {
      throw ErrorHandler.createValidationError('state', 'State must be one of: open, closed, all');
    }

    if (params.sort && !['created', 'updated', 'comments'].includes(params.sort)) {
      throw ErrorHandler.createValidationError('sort', 'Sort must be one of: created, updated, comments');
    }

    if (params.direction && !['asc', 'desc'].includes(params.direction)) {
      throw ErrorHandler.createValidationError('direction', 'Direction must be one of: asc, desc');
    }

    if (params.per_page && (!Number.isInteger(params.per_page) || params.per_page < 1 || params.per_page > 100)) {
      throw ErrorHandler.createValidationError('per_page', 'Per page must be an integer between 1 and 100');
    }

    if (params.page && (!Number.isInteger(params.page) || params.page < 1)) {
      throw ErrorHandler.createValidationError('page', 'Page must be a positive integer');
    }
  }

  protected async executeOperation(params: ListIssuesParams): Promise<IssueListItem[]> {
    return ErrorHandler.withErrorHandling(async () => {
      const issues = await this.issueService.listIssues(params.owner, params.repo, {
        state: params.state,
        labels: params.labels,
        sort: params.sort,
        direction: params.direction,
        assignee: params.assignee,
        milestone: params.milestone,
        per_page: params.per_page,
        page: params.page,
      });

      return issues.map((issue: any) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        user: issue.user ? {
          login: issue.user.login,
          type: issue.user.type,
        } : null,
        labels: issue.labels.map((label: any) => 
          typeof label === 'string' ? label : label.name
        ),
        assignees: issue.assignees?.map((user: any) => ({
          login: user.login,
          type: user.type,
        })) || [],
        milestone: issue.milestone ? {
          title: issue.milestone.title,
          number: issue.milestone.number,
        } : null,
        comments: issue.comments,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        html_url: issue.html_url,
      }));
    }, 'List issues');
  }
}

export function createListIssuesTool(octokit: any, issueService: IIssueService): ToolConfig {
  const handler = new ListIssuesHandler(octokit, issueService);

  return {
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
          assignee: {
            type: 'string',
            description: 'Filter by assignee username',
          },
          milestone: {
            oneOf: [
              { type: 'string' },
              { type: 'number' },
            ],
            description: 'Filter by milestone number or title',
          },
          per_page: {
            type: 'number',
            description: 'Results per page (1-100)',
            minimum: 1,
            maximum: 100,
          },
          page: {
            type: 'number',
            description: 'Page number',
            minimum: 1,
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: any) => handler.handle(args),
  };
}