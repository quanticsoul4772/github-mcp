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

// Issue Tools Parameters
export interface ListIssuesParams {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  assignee?: string;
  labels?: string;
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
  assignees?: string[];
  labels?: string[];
}

export interface CreateIssueCommentParams {
  owner: string;
  repo: string;
  issue_number: number;
  body: string;
}

// Pull Request Tools Parameters
export interface ListPullRequestsParams {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  head?: string;
  base?: string;
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
  draft?: boolean;
}

export interface UpdatePullRequestParams {
  owner: string;
  repo: string;
  pullNumber: number;
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
}

export interface MergePullRequestParams {
  owner: string;
  repo: string;
  pullNumber: number;
  merge_method?: 'merge' | 'squash' | 'rebase';
  commit_title?: string;
  commit_message?: string;
}

export interface GetPullRequestDiffParams {
  owner: string;
  repo: string;
  pullNumber: number;
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
  dismissed_reason?: 'false positive' | 'won\'t fix' | 'used in tests' | null;
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
  sort?: 'indexed';
  order?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
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
  sort?: 'comments' | 'reactions' | 'reactions-+1' | 'reactions--1' | 'reactions-smile' | 'reactions-thinking_face' | 'reactions-heart' | 'reactions-tada' | 'interactions' | 'created' | 'updated';
  order?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
}

export interface SearchUsersParams {
  q: string;
  sort?: 'followers' | 'repositories' | 'joined';
  order?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
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
  | ListIssuesParams
  | CreateIssueParams
  | UpdateIssueParams
  | CreateIssueCommentParams
  | ListPullRequestsParams
  | CreatePullRequestParams
  | UpdatePullRequestParams
  | MergePullRequestParams
  | GetPullRequestDiffParams
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
  | SearchUsersParams;