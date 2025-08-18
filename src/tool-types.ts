/**
 * Comprehensive type definitions for all tool handlers
 * Replaces 'any' types with proper TypeScript interfaces
 */

import { components } from '@octokit/openapi-types';

// Re-export commonly used GitHub types
export type GitHubRepository = components['schemas']['repository'];
export type GitHubUser = components['schemas']['simple-user'];
export type GitHubIssue = components['schemas']['issue'];
export type GitHubPullRequest = components['schemas']['pull-request'];
export type GitHubWorkflow = components['schemas']['workflow'];
export type GitHubWorkflowRun = components['schemas']['workflow-run'];

// Repository Tools Parameters
export interface GetFileContentsParams {
  owner: string;
  repo: string;
  path?: string;
  ref?: string;
}

export interface ListBranchesParams {
  owner: string;
  repo: string;
  page?: number;
  perPage?: number;
}

export interface ListCommitsParams {
  owner: string;
  repo: string;
  sha?: string;
  author?: string;
  page?: number;
  perPage?: number;
}

export interface CreateRepoParams {
  name: string;
  description?: string;
  private?: boolean;
  autoInit?: boolean;
}

export interface CreateOrUpdateFileParams {
  owner: string;
  repo: string;
  path: string;
  message: string;
  content: string;
  branch: string;
  sha?: string;
}

export interface DeleteFileParams {
  owner: string;
  repo: string;
  path: string;
  message: string;
  branch: string;
  sha: string;
}

export interface PushFilesParams {
  owner: string;
  repo: string;
  branch: string;
  message: string;
  files: Array<{
    path: string;
    content: string;
  }>;
}

export interface ListUserRepositoriesParams {
  visibility?: 'all' | 'public' | 'private';
  affiliation?: string;
  type?: string;
  sort?: string;
  direction?: string;
  page?: number;
  perPage?: number;
}

export interface GetRepositoryParams {
  owner: string;
  repo: string;
}

export interface CreateBranchParams {
  owner: string;
  repo: string;
  branch: string;
  from_branch?: string;
}

export interface ForkRepositoryParams {
  owner: string;
  repo: string;
  organization?: string;
}

// Optimized Repository Tools Parameters
export interface OptimizedGetFileContentsParams {
  owner: string;
  repo: string;
  path?: string;
  ref?: string;
  skipCache?: boolean;
}

export interface OptimizedGetRepositoryParams {
  owner: string;
  repo: string;
  skipCache?: boolean;
}

export interface OptimizedListBranchesParams {
  owner: string;
  repo: string;
  maxPages?: number;
}

export interface OptimizedListIssuesParams {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  labels?: string;
  since?: string;
  maxPages?: number;
  perPage?: number;
}

export interface OptimizedListPullRequestsParams {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  sort?: string;
  direction?: 'asc' | 'desc';
  maxPages?: number;
  perPage?: number;
}

// Issue Tools Parameters
export interface ListIssuesParams {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  assignee?: string;
  labels?: string;
  sort?: 'created' | 'updated' | 'comments';
  direction?: 'asc' | 'desc';
  since?: string;
  page?: number;
  perPage?: number;
}

export interface CreateIssueParams {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  assignees?: string[];
  labels?: string[];
  milestone?: number;
}

export interface UpdateIssueParams {
  owner: string;
  repo: string;
  issue_number: number;
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  milestone?: number | null;
  assignees?: string[];
  labels?: string[];
}

export interface CreateIssueCommentParams {
  owner: string;
  repo: string;
  issue_number: number;
  body: string;
}

export interface UpdateIssueCommentParams {
  owner: string;
  repo: string;
  comment_id: number;
  body: string;
}

export interface DeleteIssueCommentParams {
  owner: string;
  repo: string;
  comment_id: number;
}

export interface AddLabelsToIssueParams {
  owner: string;
  repo: string;
  issue_number: number;
  labels: string[];
}

export interface RemoveLabelFromIssueParams {
  owner: string;
  repo: string;
  issue_number: number;
  name: string;
}

export interface LockIssueParams {
  owner: string;
  repo: string;
  issue_number: number;
  lock_reason?: 'off-topic' | 'too heated' | 'resolved' | 'spam';
}

export interface UnlockIssueParams {
  owner: string;
  repo: string;
  issue_number: number;
}

// Pull Request Tools Parameters
export interface ListPullRequestsParams {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  head?: string;
  base?: string;
  sort?: 'created' | 'updated' | 'popularity' | 'long-running';
  direction?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
}

export interface CreatePullRequestParams {
  owner: string;
  repo: string;
  title: string;
  head: string;
  base: string;
  body?: string;
  maintainer_can_modify?: boolean;
  draft?: boolean;
}

export interface UpdatePullRequestParams {
  owner: string;
  repo: string;
  pull_number: number;
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  base?: string;
  maintainer_can_modify?: boolean;
}

export interface MergePullRequestParams {
  owner: string;
  repo: string;
  pull_number: number;
  merge_method?: 'merge' | 'squash' | 'rebase';
  commit_title?: string;
  commit_message?: string;
}

export interface GetPullRequestDiffParams {
  owner: string;
  repo: string;
  pull_number: number;
}

export interface DismissPullRequestReviewParams {
  owner: string;
  repo: string;
  pull_number: number;
  review_id: number;
  message: string;
}

export interface CreatePullRequestReviewCommentParams {
  owner: string;
  repo: string;
  pull_number: number;
  body: string;
  commit_id: string;
  path: string;
  line: number;
  side?: 'LEFT' | 'RIGHT';
}

// Actions Tools Parameters
export interface ListWorkflowsParams {
  owner: string;
  repo: string;
  page?: number;
  perPage?: number;
}

export interface GetWorkflowParams {
  owner: string;
  repo: string;
  workflow_id: string | number;
}

export interface ListWorkflowRunsParams {
  owner: string;
  repo: string;
  workflow_id?: string | number;
  status?: 'queued' | 'in_progress' | 'completed';
  page?: number;
  perPage?: number;
}

export interface TriggerWorkflowParams {
  owner: string;
  repo: string;
  workflow_id: string | number;
  ref: string;
  inputs?: Record<string, string>;
}

export interface CancelWorkflowRunParams {
  owner: string;
  repo: string;
  run_id: number;
}

export interface RerunWorkflowParams {
  owner: string;
  repo: string;
  run_id: number;
}

export interface GetWorkflowRunLogsParams {
  owner: string;
  repo: string;
  run_id: number;
}

// Security Tools Parameters
export interface ListCodeScanningAlertsParams {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'dismissed' | 'fixed';
  page?: number;
  perPage?: number;
}

export interface GetCodeScanningAlertParams {
  owner: string;
  repo: string;
  alert_number: number;
}

export interface UpdateCodeScanningAlertParams {
  owner: string;
  repo: string;
  alert_number: number;
  state: 'open' | 'dismissed';
  dismissed_reason?: 'false positive' | "won't fix" | 'used in tests' | null;
  dismissed_comment?: string;
}

export interface UploadSarifParams {
  owner: string;
  repo: string;
  sarif: string | object;
  ref?: string;
  commit_sha: string;
  tool_name?: string;
}

// User Tools Parameters
export interface GetUserParams {
  username: string;
}

export interface UpdateUserParams {
  name?: string;
  email?: string;
  blog?: string;
  company?: string;
  location?: string;
  hireable?: boolean;
  bio?: string;
}

export interface ListUserReposParams {
  username: string;
  type?: 'all' | 'owner' | 'member';
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  page?: number;
  perPage?: number;
}

// Organization Tools Parameters
export interface GetOrgParams {
  org: string;
}

export interface ListOrgMembersParams {
  org: string;
  filter?: '2fa_disabled' | 'all';
  role?: 'all' | 'admin' | 'member';
  page?: number;
  perPage?: number;
}

export interface ListOrgReposParams {
  org: string;
  type?: 'all' | 'public' | 'private' | 'forks' | 'sources' | 'member';
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  page?: number;
  perPage?: number;
}

// Notification Tools Parameters
export interface ListNotificationsParams {
  all?: boolean;
  participating?: boolean;
  since?: string;
  before?: string;
  page?: number;
  perPage?: number;
}

export interface MarkNotificationAsReadParams {
  thread_id: string;
}

export interface GetThreadSubscriptionParams {
  thread_id: string;
}

export interface SetThreadSubscriptionParams {
  thread_id: string;
  subscribed: boolean;
  ignored?: boolean;
}

// Search Tools Parameters
export interface SearchCodeParams {
  q: string;
  sort?: 'indexed' | 'author-date' | 'committer-date' | 'created' | 'updated';
  order?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
  repository_id?: number;
}

export interface SearchReposParams {
  q: string;
  sort?: 'stars' | 'forks' | 'help-wanted-issues' | 'updated';
  order?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
}

export interface SearchIssuesParams {
  q: string;
  sort?:
    | 'comments'
    | 'reactions'
    | 'reactions-+1'
    | 'reactions--1'
    | 'reactions-smile'
    | 'reactions-thinking_face'
    | 'reactions-heart'
    | 'reactions-tada'
    | 'interactions'
    | 'created'
    | 'updated';
  order?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
}

export interface SearchIssuesWithRepoParams extends SearchIssuesParams {
  owner?: string;
  repo?: string;
  query: string;
}

export interface SearchUsersParams {
  q: string;
  sort?: 'followers' | 'repositories' | 'joined';
  order?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
}

// Repository Insights Parameters
export interface GetRepositoryInsightsParams {
  owner: string;
  repo: string;
  since?: string;
}

export interface GetRepositoryContributorsParams {
  owner: string;
  repo: string;
  first?: number;
}

export interface GetCodeMetricsParams {
  owner: string;
  repo: string;
  branch?: string;
  since?: string;
  until?: string;
}

// Advanced Search Parameters
export interface AdvancedCodeSearchParams {
  query: string;
  language?: string;
  filename?: string;
  extension?: string;
  path?: string;
  size?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface AdvancedIssueSearchParams {
  query: string;
  repository?: string;
  state?: 'open' | 'closed';
  author?: string;
  assignee?: string;
  labels?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface AdvancedPullRequestSearchParams {
  query: string;
  repository?: string;
  state?: 'open' | 'closed' | 'merged';
  author?: string;
  assignee?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

// Project Management Parameters
export interface GetProjectInsightsParams {
  owner: string;
  repo: string;
  project_number: number;
  time_period?: 'week' | 'month' | 'quarter';
}

export interface BulkUpdateIssuesParams {
  owner: string;
  repo: string;
  issue_numbers: number[];
  updates: {
    state?: 'open' | 'closed';
    assignees?: string[];
    labels?: string[];
    milestone?: number | null;
  };
}

export interface ProjectBoardAnalyticsParams {
  owner: string;
  repo: string;
  project_number?: number;
  start_date?: string;
  end_date?: string;
}

// Batch Operations Parameters
export interface BatchProcessRepositoriesParams {
  repositories: Array<{
    owner: string;
    repo: string;
  }>;
  operation: 'sync' | 'analyze' | 'update';
  options?: Record<string, any>;
}

export interface BulkUpdatePullRequestsParams {
  owner: string;
  repo: string;
  pull_numbers: number[];
  updates: {
    state?: 'open' | 'closed';
    assignees?: string[];
    labels?: string[];
  };
}

export interface BatchOperationStatusParams {
  operation_id: string;
}

// Type guards
export function isGetFileContentsParams(params: unknown): params is GetFileContentsParams {
  return (
    typeof params === 'object' &&
    params !== null &&
    'owner' in params &&
    'repo' in params &&
    typeof (params as GetFileContentsParams).owner === 'string' &&
    typeof (params as GetFileContentsParams).repo === 'string'
  );
}

export function isCreateIssueParams(params: unknown): params is CreateIssueParams {
  return (
    typeof params === 'object' &&
    params !== null &&
    'owner' in params &&
    'repo' in params &&
    'title' in params &&
    typeof (params as CreateIssueParams).owner === 'string' &&
    typeof (params as CreateIssueParams).repo === 'string' &&
    typeof (params as CreateIssueParams).title === 'string'
  );
}

export function isCreatePullRequestParams(params: unknown): params is CreatePullRequestParams {
  return (
    typeof params === 'object' &&
    params !== null &&
    'owner' in params &&
    'repo' in params &&
    'title' in params &&
    'head' in params &&
    'base' in params &&
    typeof (params as CreatePullRequestParams).owner === 'string' &&
    typeof (params as CreatePullRequestParams).repo === 'string' &&
    typeof (params as CreatePullRequestParams).title === 'string' &&
    typeof (params as CreatePullRequestParams).head === 'string' &&
    typeof (params as CreatePullRequestParams).base === 'string'
  );
}

// Union type for all tool parameters
export type ToolParams =
  | GetFileContentsParams
  | ListBranchesParams
  | ListCommitsParams
  | CreateRepoParams
  | CreateOrUpdateFileParams
  | DeleteFileParams
  | PushFilesParams
  | ListUserRepositoriesParams
  | GetRepositoryParams
  | CreateBranchParams
  | ForkRepositoryParams
  | OptimizedGetFileContentsParams
  | OptimizedGetRepositoryParams
  | OptimizedListBranchesParams
  | OptimizedListIssuesParams
  | OptimizedListPullRequestsParams
  | ListIssuesParams
  | CreateIssueParams
  | UpdateIssueParams
  | CreateIssueCommentParams
  | UpdateIssueCommentParams
  | DeleteIssueCommentParams
  | AddLabelsToIssueParams
  | RemoveLabelFromIssueParams
  | LockIssueParams
  | UnlockIssueParams
  | ListPullRequestsParams
  | CreatePullRequestParams
  | UpdatePullRequestParams
  | MergePullRequestParams
  | GetPullRequestDiffParams
  | DismissPullRequestReviewParams
  | CreatePullRequestReviewCommentParams
  | ListWorkflowsParams
  | GetWorkflowParams
  | ListWorkflowRunsParams
  | TriggerWorkflowParams
  | CancelWorkflowRunParams
  | RerunWorkflowParams
  | GetWorkflowRunLogsParams
  | ListCodeScanningAlertsParams
  | GetCodeScanningAlertParams
  | UpdateCodeScanningAlertParams
  | UploadSarifParams
  | GetUserParams
  | UpdateUserParams
  | ListUserReposParams
  | GetOrgParams
  | ListOrgMembersParams
  | ListOrgReposParams
  | ListNotificationsParams
  | MarkNotificationAsReadParams
  | GetThreadSubscriptionParams
  | SetThreadSubscriptionParams
  | SearchCodeParams
  | SearchReposParams
  | SearchIssuesParams
  | SearchUsersParams
  | GetRepositoryInsightsParams
  | GetRepositoryContributorsParams
  | GetCodeMetricsParams
  | AdvancedCodeSearchParams
  | AdvancedIssueSearchParams
  | AdvancedPullRequestSearchParams
  | GetProjectInsightsParams
  | BulkUpdateIssuesParams
  | ProjectBoardAnalyticsParams
  | BatchProcessRepositoriesParams
  | BulkUpdatePullRequestsParams
  | BatchOperationStatusParams;
