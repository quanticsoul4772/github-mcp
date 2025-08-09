import { Tool } from '@modelcontextprotocol/sdk/types.js';

export type GitHubToolset = 
  | 'context'
  | 'repos'
  | 'issues'
  | 'pull_requests'
  | 'actions'
  | 'code_security'
  | 'users'
  | 'orgs'
  | 'notifications'
  | 'discussions'
  | 'dependabot'
  | 'secret_protection'
  | 'experiments';

export interface ToolConfig<TParams = any, TResult = any> {
  tool: Tool;
  handler: (args: TParams) => Promise<TResult>;
}

export interface GitHubError {
  status: number;
  message: string;
  documentation_url?: string;
}


// Response types are now in tool-types.ts using @octokit/openapi-types
// Re-export commonly used types from tool-types.ts for backward compatibility
export type {
  GitHubRepository,
  GitHubUser,
  GitHubIssue,
  GitHubPullRequest,
  GitHubWorkflow,
  GitHubWorkflowRun,
} from './tool-types.js';
