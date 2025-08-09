import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Available GitHub toolsets that can be enabled/disabled
 * 
 * - context: User context tools (get_me)
 * - repos: Repository management tools
 * - issues: Issue management tools
 * - pull_requests: Pull request tools
 * - actions: GitHub Actions tools
 * - code_security: Code scanning and security tools
 * - users: User management tools
 * - orgs: Organization tools
 * - notifications: Notification management
 * - discussions: Discussion tools
 * - dependabot: Dependabot alerts and settings
 * - secret_protection: Secret scanning tools
 * - graphql_insights: GraphQL-powered repository insights and analytics
 * - advanced_search: GraphQL-powered advanced search operations
 * - project_management: GraphQL-powered project management tools
 * - batch_operations: GraphQL batch query operations
 * - experiments: Experimental features
 */
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
  | 'graphql_insights'
  | 'advanced_search'
  | 'project_management'
  | 'batch_operations'
  | 'experiments';

/**
 * Configuration object for MCP tools
 * 
 * @template TParams - Type for tool input parameters
 * @template TResult - Type for tool result
 */
export interface ToolConfig<TParams = any, TResult = any> {
  /** MCP tool definition with name, description, and input schema */
  tool: Tool;
  /** Handler function that processes tool requests */
  handler: (args: TParams) => Promise<TResult>;
}

/**
 * Standard GitHub API error structure
 */
export interface GitHubError {
  /** HTTP status code */
  status: number;
  /** Error message */
  message: string;
  /** URL to relevant GitHub API documentation */
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
