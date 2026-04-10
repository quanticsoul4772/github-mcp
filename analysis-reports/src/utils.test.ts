/**
 * Tests for shared utilities (src/utils.ts)
 */
import { describe, it, expect, vi } from 'vitest';
import {
  extractPagination,
  mapUser,
  mapUsers,
  mapRepository,
  mapIssue,
  mapPullRequest,
  checkReadOnly,
  handleToolError,
  decodeBase64Content,
  encodeBase64Content,
  parseCommaSeparated,
  formatFileSize,
  extractErrorMessage,
  isNotFoundError,
  isRateLimitError,
  delay,
  parseLinkHeader,
} from './utils.js';

describe('Utils', () => {

  // ============================================================================
  // extractPagination
  // ============================================================================

  describe('extractPagination', () => {
    it('should extract pagination params', () => {
      const result = extractPagination({ page: 2, perPage: 50 });
      expect(result).toEqual({ page: 2, per_page: 50 });
    });

    it('should handle undefined values', () => {
      const result = extractPagination({});
      expect(result).toEqual({ page: undefined, per_page: undefined });
    });
  });

  // ============================================================================
  // mapUser
  // ============================================================================

  describe('mapUser', () => {
    it('should map a user object', () => {
      const user: any = {
        login: 'octocat',
        id: 1,
        avatar_url: 'https://avatars.githubusercontent.com/u/1',
        html_url: 'https://github.com/octocat',
        type: 'User',
        node_id: 'U_1',
        gravatar_id: '',
        url: 'https://api.github.com/users/octocat',
        site_admin: false,
      };
      const result = mapUser(user);
      expect(result.login).toBe('octocat');
      expect(result.type).toBe('User');
    });

    it('should return null for null input', () => {
      expect(mapUser(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(mapUser(undefined)).toBeNull();
    });
  });

  // ============================================================================
  // mapUsers
  // ============================================================================

  describe('mapUsers', () => {
    it('should map an array of users', () => {
      const users: any[] = [
        { login: 'user1', id: 1, avatar_url: '', html_url: '', type: 'User', node_id: '', gravatar_id: '', url: '', site_admin: false },
        { login: 'user2', id: 2, avatar_url: '', html_url: '', type: 'User', node_id: '', gravatar_id: '', url: '', site_admin: false },
      ];
      const result = mapUsers(users);
      expect(result).toHaveLength(2);
      expect(result[0].login).toBe('user1');
    });

    it('should return empty array for empty input', () => {
      expect(mapUsers([])).toEqual([]);
    });
  });

  // ============================================================================
  // mapRepository
  // ============================================================================

  describe('mapRepository', () => {
    it('should map a repository object', () => {
      const repo: any = {
        id: 123,
        name: 'my-repo',
        full_name: 'owner/my-repo',
        owner: { login: 'owner', id: 1, avatar_url: '', html_url: '', type: 'User', node_id: '', gravatar_id: '', url: '', site_admin: false },
        private: false,
        description: 'Test repo',
        fork: false,
        created_at: '2020-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        pushed_at: '2024-01-15T00:00:00Z',
        size: 1024,
        stargazers_count: 100,
        watchers_count: 100,
        language: 'TypeScript',
        forks_count: 10,
        open_issues_count: 5,
        default_branch: 'main',
        archived: false,
        disabled: false,
        html_url: 'https://github.com/owner/my-repo',
        clone_url: 'https://github.com/owner/my-repo.git',
        ssh_url: 'git@github.com:owner/my-repo.git',
      };
      const result = mapRepository(repo);
      expect(result.name).toBe('my-repo');
      expect(result.language).toBe('TypeScript');
      expect(result.owner.login).toBe('owner');
    });
  });

  // ============================================================================
  // mapIssue
  // ============================================================================

  describe('mapIssue', () => {
    const makeIssue = (overrides = {}): any => ({
      id: 1,
      number: 42,
      title: 'Test issue',
      user: { login: 'user1', id: 1, avatar_url: '', html_url: '', type: 'User', node_id: '', gravatar_id: '', url: '', site_admin: false },
      state: 'open',
      locked: false,
      assignee: null,
      assignees: [],
      milestone: null,
      comments: 3,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      closed_at: null,
      body: 'Issue body',
      labels: [],
      html_url: 'https://github.com/owner/repo/issues/42',
      ...overrides,
    });

    it('should map an issue', () => {
      const result = mapIssue(makeIssue());
      expect(result.number).toBe(42);
      expect(result.title).toBe('Test issue');
      expect(result.state).toBe('open');
      expect(result.user.login).toBe('user1');
    });

    it('should handle null user and assignee', () => {
      const result = mapIssue(makeIssue({ user: null, assignee: null }));
      expect(result.user).toBeNull();
      expect(result.assignee).toBeNull();
    });

    it('should handle undefined assignees (|| [] branch)', () => {
      const result = mapIssue(makeIssue({ assignees: undefined }));
      expect(result.assignees).toEqual([]);
    });
  });

  // ============================================================================
  // mapPullRequest
  // ============================================================================

  describe('mapPullRequest', () => {
    const makePR = (overrides = {}): any => ({
      id: 1,
      number: 10,
      state: 'open',
      locked: false,
      title: 'Test PR',
      user: { login: 'pruser', id: 1, avatar_url: '', html_url: '', type: 'User', node_id: '', gravatar_id: '', url: '', site_admin: false },
      body: 'PR body',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      closed_at: null,
      merged_at: null,
      merge_commit_sha: null,
      assignee: null,
      assignees: [],
      requested_reviewers: [],
      labels: [],
      milestone: null,
      draft: false,
      commits: 2,
      additions: 50,
      deletions: 10,
      changed_files: 3,
      html_url: 'https://github.com/owner/repo/pull/10',
      diff_url: 'https://github.com/owner/repo/pull/10.diff',
      patch_url: 'https://github.com/owner/repo/pull/10.patch',
      mergeable: true,
      mergeable_state: 'clean',
      merged: false,
      comments: 1,
      review_comments: 2,
      maintainer_can_modify: true,
      head: { label: 'owner:feature', ref: 'feature', sha: 'abc123', user: null },
      base: { label: 'owner:main', ref: 'main', sha: 'def456', user: null },
      ...overrides,
    });

    it('should map a pull request', () => {
      const result = mapPullRequest(makePR());
      expect(result.number).toBe(10);
      expect(result.title).toBe('Test PR');
      expect(result.additions).toBe(50);
      expect(result.head.ref).toBe('feature');
      expect(result.base.ref).toBe('main');
    });

    it('should handle null head/base', () => {
      const result = mapPullRequest(makePR({ head: null, base: null }));
      expect(result.head).toBeUndefined();
      expect(result.base).toBeUndefined();
    });

    it('should handle undefined assignees and requested_reviewers (|| [] branches)', () => {
      const result = mapPullRequest(makePR({ assignees: undefined, requested_reviewers: undefined }));
      expect(result.assignees).toEqual([]);
      expect(result.requested_reviewers).toEqual([]);
    });
  });

  // ============================================================================
  // checkReadOnly
  // ============================================================================

  describe('checkReadOnly', () => {
    it('should throw when readOnly is true', () => {
      expect(() => checkReadOnly(true, 'create_issue')).toThrow("Operation 'create_issue' is not allowed in read-only mode");
    });

    it('should not throw when readOnly is false', () => {
      expect(() => checkReadOnly(false, 'create_issue')).not.toThrow();
    });
  });

  // ============================================================================
  // handleToolError
  // ============================================================================

  describe('handleToolError', () => {
    it('should normalize and rethrow the error', async () => {
      const rawError = { status: 404, message: 'Not Found' };
      await expect(handleToolError('get-repo', rawError)).rejects.toBeDefined();
    });

    it('should propagate generic errors', async () => {
      const err = new Error('something broke');
      await expect(handleToolError('op', err)).rejects.toThrow('something broke');
    });
  });

  // ============================================================================
  // Base64 utilities
  // ============================================================================

  describe('decodeBase64Content', () => {
    it('should decode base64 to string', () => {
      const encoded = Buffer.from('hello world').toString('base64');
      expect(decodeBase64Content(encoded)).toBe('hello world');
    });
  });

  describe('encodeBase64Content', () => {
    it('should encode string to base64', () => {
      const result = encodeBase64Content('hello world');
      expect(Buffer.from(result, 'base64').toString('utf-8')).toBe('hello world');
    });

    it('should be reversible with decode', () => {
      const original = 'TypeScript code: const x = 1;';
      expect(decodeBase64Content(encodeBase64Content(original))).toBe(original);
    });
  });

  // ============================================================================
  // parseCommaSeparated
  // ============================================================================

  describe('parseCommaSeparated', () => {
    it('should split comma-separated string', () => {
      expect(parseCommaSeparated('a,b,c')).toEqual(['a', 'b', 'c']);
    });

    it('should trim whitespace', () => {
      expect(parseCommaSeparated('a, b , c')).toEqual(['a', 'b', 'c']);
    });

    it('should return empty array for undefined', () => {
      expect(parseCommaSeparated(undefined)).toEqual([]);
    });

    it('should filter empty parts', () => {
      expect(parseCommaSeparated('a,,b')).toEqual(['a', 'b']);
    });
  });

  // ============================================================================
  // formatFileSize
  // ============================================================================

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500.00 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(2048)).toBe('2.00 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1.00 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1.00 GB');
    });
  });

  // ============================================================================
  // extractErrorMessage
  // ============================================================================

  describe('extractErrorMessage', () => {
    it('should return string as-is', () => {
      expect(extractErrorMessage('simple error')).toBe('simple error');
    });

    it('should extract message property', () => {
      expect(extractErrorMessage({ message: 'error message' })).toBe('error message');
    });

    it('should extract nested response.data.message', () => {
      expect(extractErrorMessage({ response: { data: { message: 'API error' } } })).toBe('API error');
    });

    it('should stringify response.data when no message', () => {
      const result = extractErrorMessage({ response: { data: { code: 42 } } });
      expect(result).toBe('{"code":42}');
    });

    it('should return unknown error for other types', () => {
      expect(extractErrorMessage(null)).toBe('An unknown error occurred');
      expect(extractErrorMessage(undefined)).toBe('An unknown error occurred');
    });
  });

  // ============================================================================
  // isNotFoundError
  // ============================================================================

  describe('isNotFoundError', () => {
    it('should return true for status 404', () => {
      expect(isNotFoundError({ status: 404 })).toBe(true);
    });

    it('should return true for response.status 404', () => {
      expect(isNotFoundError({ response: { status: 404 } })).toBe(true);
    });

    it('should return false for other status codes', () => {
      expect(isNotFoundError({ status: 500 })).toBe(false);
    });

    it('should return false for null', () => {
      expect(isNotFoundError(null)).toBe(false);
    });
  });

  // ============================================================================
  // isRateLimitError
  // ============================================================================

  describe('isRateLimitError', () => {
    it('should return true for status 429', () => {
      expect(isRateLimitError({ status: 429 })).toBe(true);
    });

    it('should return true for response.status 429', () => {
      expect(isRateLimitError({ response: { status: 429, headers: {} } })).toBe(true);
    });

    it('should return true for x-ratelimit-remaining: 0 header', () => {
      expect(isRateLimitError({ response: { headers: { 'x-ratelimit-remaining': '0' } } })).toBe(true);
    });

    it('should return false for normal requests', () => {
      expect(isRateLimitError({ status: 200 })).toBe(false);
    });
  });

  // ============================================================================
  // delay
  // ============================================================================

  describe('delay', () => {
    it('should resolve after the given time', async () => {
      vi.useFakeTimers();
      const promise = delay(100);
      vi.advanceTimersByTime(100);
      await promise;
      vi.useRealTimers();
    });
  });

  // ============================================================================
  // parseLinkHeader
  // ============================================================================

  describe('parseLinkHeader', () => {
    it('should parse next page', () => {
      const header = '<https://api.github.com/repos?page=2>; rel="next", <https://api.github.com/repos?page=5>; rel="last"';
      const result = parseLinkHeader(header);
      expect(result.next).toBe(2);
      expect(result.last).toBe(5);
    });

    it('should parse prev page', () => {
      const header = '<https://api.github.com/repos?page=1>; rel="prev", <https://api.github.com/repos?page=3>; rel="next"';
      const result = parseLinkHeader(header);
      expect(result.prev).toBe(1);
      expect(result.next).toBe(3);
    });

    it('should return empty object for undefined', () => {
      expect(parseLinkHeader(undefined)).toEqual({});
    });

    it('should return empty object for unmatched header', () => {
      expect(parseLinkHeader('no match here')).toEqual({});
    });
  });
});
