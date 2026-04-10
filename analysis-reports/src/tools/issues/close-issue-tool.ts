import { z } from 'zod';
import { ToolConfig } from '../../types.js';
import { IIssueService } from '../../foundation/interfaces.js';
import { BaseToolHandler } from '../../foundation/base-tool-handler.js';
import { ErrorHandler } from '../../foundation/error-handler.js';
import { createTypeSafeHandler } from '../../utils/type-safety.js';

interface CloseIssueParams {
  owner: string;
  repo: string;
  issue_number: number;
  state_reason?: 'completed' | 'not_planned';
}

// Zod schema for validation
const CloseIssueSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  issue_number: z.number().int().min(1, 'Issue number must be a positive integer'),
  state_reason: z.enum(['completed', 'not_planned']).optional(),
});

interface CloseIssueResult {
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

class CloseIssueHandler extends BaseToolHandler<CloseIssueParams, CloseIssueResult> {
  constructor(
    octokit: any, // Keep for compatibility - will be removed in full refactor
    private readonly issueService: IIssueService
  ) {
    super(octokit);
  }

  protected validateInput(params: CloseIssueParams): void {
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

    if (params.state_reason && !['completed', 'not_planned'].includes(params.state_reason)) {
      throw ErrorHandler.createValidationError(
        'state_reason',
        'State reason must be one of: completed, not_planned'
      );
    }
  }

  protected async executeOperation(params: CloseIssueParams): Promise<CloseIssueResult> {
    return ErrorHandler.withErrorHandling(async () => {
      const updateData: Record<string, unknown> = {
        state: 'closed',
      };
      if (params.state_reason !== undefined) {
        updateData.state_reason = params.state_reason;
      }

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
        labels: (data.labels ?? []).map((label: string | { name?: string }) =>
          typeof label === 'string' ? label : label?.name
        ),
        assignees:
          data.assignees?.map((user: { login: string; type: string }) => ({
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
    }, 'Close issue');
  }
}

export function createCloseIssueTool(octokit: any, issueService: IIssueService): ToolConfig {
  const handler = new CloseIssueHandler(octokit, issueService);

  return {
    tool: {
      name: 'close_issue',
      description: 'Close an issue in a GitHub repository',
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
            description: 'The number of the issue to close',
          },
          state_reason: {
            type: 'string',
            description: 'The reason for closing the issue',
            enum: ['completed', 'not_planned'],
          },
        },
        required: ['owner', 'repo', 'issue_number'],
      },
    },
    handler: createTypeSafeHandler(
      CloseIssueSchema,
      async (params: CloseIssueParams) => handler.handle(params),
      'close_issue'
    ),
  };
}
