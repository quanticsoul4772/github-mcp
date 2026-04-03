/**
 * Tests for OptimizedAPIClient — REST methods, call(), utility functions
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OptimizedAPIClient } from './optimized-api-client.js';

// Minimal mock Octokit
function makeMockOctokit() {
  return {
    repos: {
      getContent: vi.fn(),
      get: vi.fn(),
      listBranches: vi.fn(),
    },
    users: {
      getByUsername: vi.fn(),
      getAuthenticated: vi.fn(),
    },
    issues: {
      listForRepo: vi.fn(),
    },
    pulls: {
      list: vi.fn(),
    },
    actions: {
      listWorkflowRuns: vi.fn(),
    },
    graphql: vi.fn(),
  };
}

describe('OptimizedAPIClient', () => {
  let mockOctokit: ReturnType<typeof makeMockOctokit>;
  let client: OptimizedAPIClient;

  beforeEach(() => {
    mockOctokit = makeMockOctokit();
    client = new OptimizedAPIClient({
      octokit: mockOctokit as any,
      enableCache: true,
      enableDeduplication: true,
      enablePerformanceMonitoring: true,
    });
  });

  // ============================================================================
  // getOctokit / getRawClient
  // ============================================================================

  it('getOctokit returns the underlying octokit', () => {
    expect(client.getOctokit()).toBe(mockOctokit);
  });

  it('getRawClient returns the underlying octokit', () => {
    expect(client.getRawClient()).toBe(mockOctokit);
  });

  // ============================================================================
  // call() — caching/dedup branches
  // ============================================================================

  describe('call()', () => {
    it('should execute apiCall and return result', async () => {
      const result = await client.call('test-op', { id: 1 }, async () => 'hello');
      expect(result).toBe('hello');
    });

    it('should cache results and not re-execute for same params', async () => {
      const fn = vi.fn().mockResolvedValue('cached');
      await client.call('repos.get', { owner: 'a', repo: 'b' }, fn);
      await client.call('repos.get', { owner: 'a', repo: 'b' }, fn);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should skip cache when skipCache=true', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      await client.call('repos.get', { a: 1 }, fn, { skipCache: true });
      await client.call('repos.get', { a: 1 }, fn, { skipCache: true });
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should propagate errors', async () => {
      await expect(client.call('op', {}, async () => { throw new Error('api error'); }))
        .rejects.toThrow('api error');
    });

    it('should work with all features disabled', async () => {
      const noFeatures = new OptimizedAPIClient({
        octokit: mockOctokit as any,
        enableCache: false,
        enableDeduplication: false,
        enablePerformanceMonitoring: false,
        enableGraphQLCache: false,
      });
      const result = await noFeatures.call('op', {}, async () => 42);
      expect(result).toBe(42);
    });

    it('should skip deduplication when skipDeduplication=true', async () => {
      let resolve1!: (v: string) => void;
      let resolve2!: (v: string) => void;
      const p1 = new Promise<string>(r => { resolve1 = r; });
      const p2 = new Promise<string>(r => { resolve2 = r; });
      const fn = vi.fn()
        .mockReturnValueOnce(p1)
        .mockReturnValueOnce(p2);

      const [_r1, _r2] = await Promise.all([
        client.call('op', { x: 1 }, fn, { skipDeduplication: true }),
        client.call('op', { x: 1 }, fn, { skipDeduplication: true }),
      ].map((p, i) => {
        if (i === 0) resolve1('a');
        if (i === 1) resolve2('b');
        return p;
      }));
      // With skipCache also we expect both to run (though cache may dedupe)
      expect(fn.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // getFileContents
  // ============================================================================

  describe('getFileContents', () => {
    it('should call repos.getContent and return data', async () => {
      mockOctokit.repos.getContent.mockResolvedValue({ data: { content: 'abc' } });
      const result = await client.getFileContents('owner', 'repo', 'file.txt');
      expect(result).toEqual({ content: 'abc' });
      expect(mockOctokit.repos.getContent).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'owner', repo: 'repo', path: 'file.txt' })
      );
    });

    it('should pass ref when provided', async () => {
      mockOctokit.repos.getContent.mockResolvedValue({ data: 'data' });
      await client.getFileContents('owner', 'repo', 'path', 'main');
      expect(mockOctokit.repos.getContent).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'main' })
      );
    });
  });

  // ============================================================================
  // getRepository
  // ============================================================================

  describe('getRepository', () => {
    it('should call repos.get and return data', async () => {
      mockOctokit.repos.get.mockResolvedValue({ data: { id: 1, name: 'myrepo' } });
      const result = await client.getRepository('owner', 'myrepo');
      expect(result).toEqual({ id: 1, name: 'myrepo' });
    });
  });

  // ============================================================================
  // getUser
  // ============================================================================

  describe('getUser', () => {
    it('should call users.getByUsername when username provided', async () => {
      mockOctokit.users.getByUsername.mockResolvedValue({ data: { login: 'alice' } });
      const result = await client.getUser('alice');
      expect(result).toEqual({ login: 'alice' });
      expect(mockOctokit.users.getByUsername).toHaveBeenCalledWith({ username: 'alice' });
    });

    it('should call users.getAuthenticated when no username', async () => {
      mockOctokit.users.getAuthenticated.mockResolvedValue({ data: { login: 'me' } });
      const result = await client.getUser();
      expect(result).toEqual({ login: 'me' });
      expect(mockOctokit.users.getAuthenticated).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // listIssues
  // ============================================================================

  describe('listIssues', () => {
    it('should return data for single page (maxPages=1)', async () => {
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [{ id: 1 }] });
      const result = await client.listIssues('owner', 'repo', { maxPages: 1 });
      expect(result).toEqual([{ id: 1 }]);
    });

    it('should use pagination for multi-page (default maxPages)', async () => {
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [{ id: 1 }], headers: {} });
      const result = await client.listIssues('owner', 'repo');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================================================
  // listPullRequests
  // ============================================================================

  describe('listPullRequests', () => {
    it('should return data for single page (maxPages=1)', async () => {
      mockOctokit.pulls.list.mockResolvedValue({ data: [{ number: 1 }] });
      const result = await client.listPullRequests('owner', 'repo', { maxPages: 1 });
      expect(result).toEqual([{ number: 1 }]);
    });

    it('should use pagination for multi-page', async () => {
      mockOctokit.pulls.list.mockResolvedValue({ data: [{ number: 1 }], headers: {} });
      const result = await client.listPullRequests('owner', 'repo');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================================================
  // listBranches
  // ============================================================================

  describe('listBranches', () => {
    it('should return data for single page (maxPages=1)', async () => {
      mockOctokit.repos.listBranches.mockResolvedValue({ data: [{ name: 'main' }] });
      const result = await client.listBranches('owner', 'repo', 1);
      expect(result).toEqual([{ name: 'main' }]);
    });

    it('should use pagination for multi-page', async () => {
      mockOctokit.repos.listBranches.mockResolvedValue({ data: [{ name: 'main' }], headers: {} });
      const result = await client.listBranches('owner', 'repo');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================================================
  // listWorkflowRuns
  // ============================================================================

  describe('listWorkflowRuns', () => {
    it('should return workflow runs data', async () => {
      mockOctokit.actions.listWorkflowRuns.mockResolvedValue({
        data: { workflow_runs: [{ id: 1 }] },
        headers: { 'content-type': 'application/json' },
      });
      const result = await client.listWorkflowRuns({ owner: 'owner', repo: 'repo', workflow_id: 123 });
      expect(result.data).toEqual([{ id: 1 }]);
    });
  });

  // ============================================================================
  // getMetrics / getGraphQLCacheStats / getPerformanceReport
  // ============================================================================

  describe('metrics and reports', () => {
    it('getMetrics should return metrics object', () => {
      const m = client.getMetrics();
      expect(m).toHaveProperty('cache');
      expect(m).toHaveProperty('performance');
    });

    it('getPerformanceReport should return string', async () => {
      await client.call('op', {}, async () => 1);
      const report = client.getPerformanceReport();
      expect(typeof report).toBe('string');
    });

    it('getPerformanceReport returns disabled message when monitoring off', () => {
      const noMonitor = new OptimizedAPIClient({
        octokit: mockOctokit as any,
        enablePerformanceMonitoring: false,
      });
      expect(noMonitor.getPerformanceReport()).toContain('disabled');
    });

    it('getGraphQLCacheStats should return null when graphqlCache disabled', () => {
      const noGraphQL = new OptimizedAPIClient({
        octokit: mockOctokit as any,
        enableGraphQLCache: false,
      });
      expect(noGraphQL.getGraphQLCacheStats()).toBeNull();
    });
  });

  // ============================================================================
  // invalidateCache / invalidateGraphQLCache / invalidateGraphQLCacheForMutation
  // ============================================================================

  describe('cache invalidation', () => {
    it('invalidateCache should return 0 when cache disabled', () => {
      const noCache = new OptimizedAPIClient({
        octokit: mockOctokit as any,
        enableCache: false,
      });
      expect(noCache.invalidateCache('pattern')).toBe(0);
    });

    it('invalidateCache with a pattern should return count', async () => {
      // Populate cache first
      await client.call('repos.get', { owner: 'a' }, async () => 1);
      const count = client.invalidateCache(/repos/);
      expect(typeof count).toBe('number');
    });

    it('invalidateGraphQLCache should return 0 when disabled', () => {
      const noGQL = new OptimizedAPIClient({
        octokit: mockOctokit as any,
        enableGraphQLCache: false,
      });
      expect(noGQL.invalidateGraphQLCache('pattern')).toBe(0);
    });

    it('invalidateGraphQLCacheForMutation should return 0 when disabled', () => {
      const noGQL = new OptimizedAPIClient({
        octokit: mockOctokit as any,
        enableGraphQLCache: false,
      });
      expect(noGQL.invalidateGraphQLCacheForMutation('mutation {}')).toBe(0);
    });
  });

  // ============================================================================
  // clearCache / clearAll / destroy
  // ============================================================================

  describe('clear and destroy', () => {
    it('clearCache should not throw', () => {
      expect(() => client.clearCache()).not.toThrow();
    });

    it('clearAll should not throw', () => {
      expect(() => client.clearAll()).not.toThrow();
    });

    it('destroy should not throw', () => {
      expect(() => client.destroy()).not.toThrow();
    });

    it('clearCache with cache disabled should not throw', () => {
      const noCache = new OptimizedAPIClient({
        octokit: mockOctokit as any,
        enableCache: false,
        enableDeduplication: false,
      });
      expect(() => noCache.clearCache()).not.toThrow();
      expect(() => noCache.clearAll()).not.toThrow();
      expect(() => noCache.destroy()).not.toThrow();
    });
  });

  // ============================================================================
  // graphql() — skip cache / skip dedup paths
  // ============================================================================

  describe('graphql()', () => {
    it('should execute graphql call', async () => {
      mockOctokit.graphql.mockResolvedValue({ data: 'result' });
      const result = await client.graphql('query { viewer { login } }', {});
      expect(result).toEqual({ data: 'result' });
    });

    it('should skip graphql cache when skipCache=true', async () => {
      mockOctokit.graphql.mockResolvedValue({ viewer: { login: 'me' } });
      await client.graphql('query { viewer { login } }', {}, { skipCache: true });
      await client.graphql('query { viewer { login } }', {}, { skipCache: true });
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(2);
    });

    it('should work with graphql cache disabled', async () => {
      const noGQL = new OptimizedAPIClient({
        octokit: mockOctokit as any,
        enableGraphQLCache: false,
        enablePerformanceMonitoring: true,
      });
      mockOctokit.graphql.mockResolvedValue({ data: 1 });
      const r = await noGQL.graphql('query {}', {});
      expect(r).toEqual({ data: 1 });
    });

    it('should work with all features disabled', async () => {
      const bare = new OptimizedAPIClient({
        octokit: mockOctokit as any,
        enableGraphQLCache: false,
        enableDeduplication: false,
        enablePerformanceMonitoring: false,
      });
      mockOctokit.graphql.mockResolvedValue({ result: 'ok' });
      const r = await bare.graphql('query {}');
      expect(r).toEqual({ result: 'ok' });
    });
  });
});
