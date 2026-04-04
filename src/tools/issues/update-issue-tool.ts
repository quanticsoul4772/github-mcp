import { z } from 'zod';
import { ToolConfig } from '../../types.js';
import { IIssueService } from '../../foundation/interfaces.js';
import { BaseToolHandler } from '../../foundation/base-tool-handler.js';
import { ErrorHandler } from '../../foundation/error-handler.js';
import { createTypeSafeHandler } from '../../utils/type-safety.js';

interface UpdateIssueParams {
  owner: string;
  repo: string;
  issue_number: number;
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  labels?: string[];
  assignees?: string[];
  milestone?: number | null;
}

// Zod schema for validation
const UpdateIssueSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  issue_number: z.number().int().min(1, 'Issue number must be a positive integer'),
  title: z.string().min(1).optional(),
  body: z.string().optional(),
  state: z.enum(['open', 'closed']).optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  milestone: z.union([z.number().int().min(1), z.null()]).optional(),
});

interface UpdateIssueResult {
  number: number;
  title: string;
  state: string;
  body: string | null;
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
    state: string;
  } | null;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  html_url: string;
}

class UpdateIssueHandler extends BaseToolHandler<UpdateIssueParams, UpdateIssueResult> {
  constructor(
    octokit: any, // Keep for compatibility - will be removed in full refactor
    private readonly issueService: IIssueService
  ) {
    super(octokit);
  }

  protected validateInput(params: UpdateIssueParams): void {
    if (!params.owner || typeof params.owner !== 'string') {
      throw ErrorHandler.createValidationError('owner', 'Owner is required and must be a string');
    }
    if (!params.repo || typeof params.repo !== 'string') {
      throw ErrorHandler.createValidationError(
        'repo',
        'Repository name is required and must be a string'
      );
    }
    if (!Number.isInteger(params.issue_number) || params.issue_number <= 0) {
      throw ErrorHandler.createValidationError(
        'issue_number',
        'Issue number must be a positive integer'
      );
    }

    if (params.state && !['open', 'closed'].includes(params.state)) {
      throw ErrorHandler.createValidationError('state', 'State must be one of: open, closed');
    }
  }

  protected async executeOperation(params: UpdateIssueParams): Promise<UpdateIssueResult> {
    return ErrorHandler.withErrorHandling(async () => {
      const updateData: Record<string, any> = {};
      if (params.title !== undefined) updateData.title = params.title;
      if (params.body !== undefined) updateData.body = params.body;
      if (params.state !== undefined) updateData.state = params.state;
      if (params.labels !== undefined) updateData.labels = params.labels;
      if (params.assignees !== undefined) updateData.assignees = params.assignees;
      if (params.milestone !== undefined) updateData.milestone = params.milestone;

      const data = await this.issueService.updateIssue(
        params.owner,
        params.repo,
        params.issue_number,
        updateData
      );

      return {
        number: data.number,
        title: data.title,
        state: data.state,
        body: data.body,
        user: data.user
          ? {
              login: data.user.login,
              type: data.user.type,
            }
          : null,
        labels: (data.labels ?? []).map((label: any) =>
          typeof label === 'string' ? label : label?.name
        ),
        assignees:
          data.assignees?.map((user: any) => ({
            login: user.login,
            type: user.type,
          })) ?? [],
        milestone: data.milestone
          ? {
              title: data.milestone.title,
              number: data.milestone.number,
              state: data.milestone.state,
            }
          : null,
        comments: data.comments,
        created_at: data.created_at,
        updated_at: data.updated_at,
        closed_at: data.closed_at,
        html_url: data.html_url,
      };
    }, 'Update issue');
  }
}

export function createUpdateIssueTool(octokit: any, issueService: IIssueService): ToolConfig {
  const handler = new UpdateIssueHandler(octokit, issueService);

  return {
    tool: {
      name: 'update_issue',
      description: 'Update an existing issue in a GitHub repository',
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
            description: 'The number of the issue to update',
          },
          title: {
            type: 'string',
            description: 'Updated title of the issue',
          },
          body: {
            type: 'string',
            description: 'Updated body content of the issue',
          },
          state: {
            type: 'string',
            description: 'State of the issue',
            enum: ['open', 'closed'],
          },
          labels: {
            type: 'array',
            description: 'Labels to set on the issue (replaces existing labels)',
            items: { type: 'string' },
          },
          assignees: {
            type: 'array',
            description: 'Usernames to assign to the issue (replaces existing assignees)',
            items: { type: 'string' },
          },
          milestone: {
            type: 'number',
            description: 'Milestone number to associate with the issue (null to remove)',
          },
        },
        required: ['owner', 'repo', 'issue_number'],
      },
    },
    handler: createTypeSafeHandler(
      UpdateIssueSchema,
      async (params: UpdateIssueParams) => handler.handle(params),
      'update_issue'
    ),
  };
}
