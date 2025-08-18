/**
 * Shared utilities for GitHub MCP Server
 * Reduces code duplication across tool modules
 */

import { components } from '@octokit/openapi-types';
import { formatErrorResponse, normalizeError } from './errors.js';

// Common GitHub entity types
export type SimpleUser = components['schemas']['simple-user'];
export type Repository = components['schemas']['repository'];
export type Issue = components['schemas']['issue'];
export type PullRequest = components['schemas']['pull-request'];

/**
 * Standard pagination parameters
 */
export interface PaginationParams {
  page?: number;
  perPage?: number;
}

/**
 * Standard repository parameters
 */
export interface RepoParams {
  owner: string;
  repo: string;
}

/**
 * Extract pagination params with defaults
 */
export function extractPagination(params: PaginationParams): {
  page: number | undefined;
  per_page: number | undefined;
} {
  return {
    page: params.page,
    per_page: params.perPage,
  };
}

/**
 * Map a simple user object to a consistent format
 */
export function mapUser(user: SimpleUser | null | undefined): any {
  if (!user) return null;

  return {
    login: user.login,
    id: user.id,
    avatar_url: user.avatar_url,
    html_url: user.html_url,
    type: user.type,
  };
}

/**
 * Map an array of users to consistent format
 */
export function mapUsers(users: SimpleUser[]): any[] {
  return users.map(mapUser).filter(Boolean);
}

/**
 * Map repository object to essential fields
 */
export function mapRepository(repo: Repository): any {
  return {
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    owner: mapUser(repo.owner),
    private: repo.private,
    description: repo.description,
    fork: repo.fork,
    created_at: repo.created_at,
    updated_at: repo.updated_at,
    pushed_at: repo.pushed_at,
    size: repo.size,
    stargazers_count: repo.stargazers_count,
    watchers_count: repo.watchers_count,
    language: repo.language,
    forks_count: repo.forks_count,
    open_issues_count: repo.open_issues_count,
    default_branch: repo.default_branch,
    archived: repo.archived,
    disabled: repo.disabled,
    html_url: repo.html_url,
    clone_url: repo.clone_url,
    ssh_url: repo.ssh_url,
  };
}

/**
 * Map issue object to essential fields
 */
export function mapIssue(issue: Issue): any {
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    user: mapUser(issue.user),
    state: issue.state,
    locked: issue.locked,
    assignee: mapUser(issue.assignee),
    assignees: mapUsers(issue.assignees || []),
    milestone: issue.milestone,
    comments: issue.comments,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    closed_at: issue.closed_at,
    body: issue.body,
    labels: issue.labels,
    html_url: issue.html_url,
  };
}

/**
 * Map pull request object to essential fields
 */
export function mapPullRequest(pr: PullRequest): any {
  return {
    id: pr.id,
    number: pr.number,
    state: pr.state,
    locked: pr.locked,
    title: pr.title,
    user: mapUser(pr.user),
    body: pr.body,
    created_at: pr.created_at,
    updated_at: pr.updated_at,
    closed_at: pr.closed_at,
    merged_at: pr.merged_at,
    merge_commit_sha: pr.merge_commit_sha,
    assignee: mapUser(pr.assignee),
    assignees: mapUsers(pr.assignees || []),
    requested_reviewers: mapUsers(pr.requested_reviewers || []),
    labels: pr.labels,
    milestone: pr.milestone,
    draft: pr.draft,
    commits: pr.commits,
    additions: pr.additions,
    deletions: pr.deletions,
    changed_files: pr.changed_files,
    html_url: pr.html_url,
    diff_url: pr.diff_url,
    patch_url: pr.patch_url,
    mergeable: pr.mergeable,
    mergeable_state: pr.mergeable_state,
    merged: pr.merged,
    comments: pr.comments,
    review_comments: pr.review_comments,
    maintainer_can_modify: pr.maintainer_can_modify,
    head: pr.head
      ? {
          label: pr.head.label,
          ref: pr.head.ref,
          sha: pr.head.sha,
          user: mapUser(pr.head.user),
        }
      : undefined,
    base: pr.base
      ? {
          label: pr.base.label,
          ref: pr.base.ref,
          sha: pr.base.sha,
          user: mapUser(pr.base.user),
        }
      : undefined,
  };
}

/**
 * Standard error handler for tool operations
 */
export async function handleToolError(
  operation: string,
  error: any,
  context?: Record<string, any>
): Promise<never> {
  const normalizedError = normalizeError(error, operation, context);
  throw normalizedError;
}

/**
 * Check if operation should be blocked in read-only mode
 */
export function checkReadOnly(readOnly: boolean, operation: string): void {
  if (readOnly) {
    throw new Error(`Operation '${operation}' is not allowed in read-only mode`);
  }
}

/**
 * Convert base64 content to UTF-8
 */
export function decodeBase64Content(content: string): string {
  return Buffer.from(content, 'base64').toString('utf-8');
}

/**
 * Convert UTF-8 content to base64
 */
export function encodeBase64Content(content: string): string {
  return Buffer.from(content).toString('base64');
}

/**
 * Parse comma-separated string into array
 */
export function parseCommaSeparated(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

/**
 * Format file size for human readability
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Extract error message from various error types
 */
export function extractErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.response?.data) return JSON.stringify(error.response.data);
  return 'An unknown error occurred';
}

/**
 * Check if error is a 404 Not Found
 */
export function isNotFoundError(error: any): boolean {
  return error?.status === 404 || error?.response?.status === 404;
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: any): boolean {
  return (
    error?.status === 429 ||
    error?.response?.status === 429 ||
    error?.response?.headers?.['x-ratelimit-remaining'] === '0'
  );
}

/**
 * Create a delay promise for rate limiting
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse GitHub API Link header for pagination
 */
export function parseLinkHeader(linkHeader: string | undefined): {
  next?: number;
  prev?: number;
  first?: number;
  last?: number;
} {
  if (!linkHeader) return {};

  const links: any = {};
  const parts = linkHeader.split(',');

  for (const part of parts) {
    const match = part.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="(\w+)"/);
    if (match) {
      links[match[2]] = parseInt(match[1], 10);
    }
  }

  return links;
}
