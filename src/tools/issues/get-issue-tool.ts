import { z } from 'zod';
import { ToolConfig } from '../../types.js';
import { IIssueService } from '../../foundation/interfaces.js';
import { BaseToolHandler } from '../../foundation/base-tool-handler.js';
import { ErrorHandler } from '../../foundation/error-handler.js';
import { createTypeSafeHandler } from '../../utils/type-safety.js';

interface GetIssueParams {
  owner: string;
  repo: string;
  issue_number: number;
}

// Zod schema for validation
const GetIssueSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  issue_number: z.number().int().min(1, 'Issue number must be a positive integer'),
});

interface GetIssueResult {
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

class GetIssueHandler extends BaseToolHandler<GetIssueParams, GetIssueResult> {
  constructor(
    octokit: any, // Keep for compatibility - will be removed in full refactor
    private readonly issueService: IIssueService
  ) {
    super(octokit);
  }

  protected validateInput(params: GetIssueParams): void {
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
  }

  protected async executeOperation(params: GetIssueParams): Promise<GetIssueResult> {
    return ErrorHandler.withErrorHandling(async () => {
      const data = await this.issueService.getIssue(params.owner, params.repo, params.issue_number);

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
          })) || [],
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
    }, 'Get issue');
  }
}

export function createGetIssueTool(octokit: any, issueService: IIssueService): ToolConfig {
  const handler = new GetIssueHandler(octokit, issueService);

  return {
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
    handler: createTypeSafeHandler(
      GetIssueSchema,
      async (params: GetIssueParams) => handler.handle(params),
      'get_issue'
    ),
  };
}
