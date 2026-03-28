import { z } from 'zod';
import { ToolConfig } from '../../types.js';
import { IIssueService } from '../../foundation/interfaces.js';
import { BaseToolHandler } from '../../foundation/base-tool-handler.js';
import { ErrorHandler } from '../../foundation/error-handler.js';
import { createTypeSafeHandler } from '../../utils/type-safety.js';

interface CreateIssueParams {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}

// Zod schema for validation
const CreateIssueSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  title: z.string().min(1, 'Title is required'),
  body: z.string().optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  milestone: z.number().int().min(1).optional(),
});

interface CreateIssueResult {
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
}

class CreateIssueHandler extends BaseToolHandler<CreateIssueParams, CreateIssueResult> {
  constructor(
    octokit: any, // Keep for compatibility - will be removed in full refactor
    private readonly issueService: IIssueService
  ) {
    super(octokit);
  }

  protected validateInput(params: CreateIssueParams): void {
    if (!params.owner || typeof params.owner !== 'string') {
      throw ErrorHandler.createValidationError('owner', 'Owner is required and must be a string');
    }
    if (!params.repo || typeof params.repo !== 'string') {
      throw ErrorHandler.createValidationError(
        'repo',
        'Repository name is required and must be a string'
      );
    }
    if (!params.title || typeof params.title !== 'string') {
      throw ErrorHandler.createValidationError('title', 'Title is required and must be a string');
    }
  }

  protected async executeOperation(params: CreateIssueParams): Promise<CreateIssueResult> {
    return ErrorHandler.withErrorHandling(async () => {
      const data = await this.issueService.createIssue(params.owner, params.repo, {
        title: params.title,
        body: params.body,
        labels: params.labels,
        assignees: params.assignees,
        milestone: params.milestone,
      });

      return {
        number: data.number,
        title: data.title,
        state: data.state,
        html_url: data.html_url,
        created_at: data.created_at,
      };
    }, 'Create issue');
  }
}

export function createCreateIssueTool(octokit: any, issueService: IIssueService): ToolConfig {
  const handler = new CreateIssueHandler(octokit, issueService);

  return {
    tool: {
      name: 'create_issue',
      description: 'Create a new issue in a GitHub repository',
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
          title: {
            type: 'string',
            description: 'The title of the issue',
          },
          body: {
            type: 'string',
            description: 'The body content of the issue',
          },
          labels: {
            type: 'array',
            description: 'Labels to apply to the issue',
            items: { type: 'string' },
          },
          assignees: {
            type: 'array',
            description: 'Usernames to assign to the issue',
            items: { type: 'string' },
          },
          milestone: {
            type: 'number',
            description: 'Milestone number to associate with the issue',
          },
        },
        required: ['owner', 'repo', 'title'],
      },
    },
    handler: createTypeSafeHandler(
      CreateIssueSchema,
      async (params: CreateIssueParams) => handler.handle(params),
      'create_issue'
    ),
  };
}
