/**
 * Tests for GitHubRateLimiter and ResponseSizeLimiter
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubRateLimiter, ResponseSizeLimiter, createRateLimitedOctokit } from './rate-limiter.js';

describe('GitHubRateLimiter', () => {
  let rateLimiter: GitHubRateLimiter;

  beforeEach(() => {
    rateLimiter = new GitHubRateLimiter();
  });

  describe('getStatus', () => {
    it('should return default status', () => {
      const status = rateLimiter.getStatus();
      expect(status.core.limit).toBe(5000);
      expect(status.core.remaining).toBe(5000);
      expect(status.search.limit).toBe(30);
      expect(status.graphql.limit).toBe(5000);
      expect(status.queueLength).toBe(0);
      expect(status.graphqlInsights.queriesInLastHour).toBe(0);
      expect(status.graphqlInsights.averagePointsPerQuery).toBe(0);
    });
  });

  describe('wrapRequest', () => {
    it('should execute request and return result', async () => {
      const fn = vi.fn().mockResolvedValue({ status: 200, data: { id: 1 } });
      const result = await rateLimiter.wrapRequest(fn);
      expect(result).toEqual({ status: 200, data: { id: 1 } });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should update rate limit from response headers', async () => {
      const fn = vi.fn().mockResolvedValue({
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4990',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
        },
        data: 'ok',
      });
      await rateLimiter.wrapRequest(fn, 'core');
      const status = rateLimiter.getStatus();
      expect(status.core.remaining).toBe(4990);
    });

    it('should propagate errors from request', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('API error'));
      await expect(rateLimiter.wrapRequest(fn)).rejects.toThrow('API error');
    });

    it('should use search resource', async () => {
      const fn = vi.fn().mockResolvedValue({ data: [] });
      const result = await rateLimiter.wrapRequest(fn, 'search');
      expect(result).toEqual({ data: [] });
    });
  });

  describe('waitForReset', () => {
    it('should return immediately when reset time is in the past', async () => {
      // Default reset is new Date() so it's effectively in the past
      const start = Date.now();
      await rateLimiter.waitForReset('core');
      expect(Date.now() - start).toBeLessThan(100);
    });
  });

  describe('wrapGraphQLRequest', () => {
    it('should execute graphql request and return result', async () => {
      const fn = vi.fn().mockResolvedValue({
        data: { viewer: { login: 'test' } },
        headers: {},
      });
      const result = await rateLimiter.wrapGraphQLRequest(fn, 'query { viewer { login } }');
      expect((result as any).data.viewer.login).toBe('test');
    });
  });

  describe('getStatus with query history', () => {
    it('should compute averagePointsPerQuery when history is non-empty', () => {
      const graphql = (rateLimiter as any).graphql;
      const now = new Date();
      graphql.queryHistory = [
        { points: 10, query: 'q1', timestamp: now },
        { points: 20, query: 'q2', timestamp: now },
      ];

      const status = rateLimiter.getStatus();
      // averagePointsPerQuery = round((10+20)/2) = 15
      expect(status.graphqlInsights.averagePointsPerQuery).toBe(15);
      expect(status.graphqlInsights.queriesInLastHour).toBe(2);
      expect(Array.isArray(status.graphqlInsights.topComplexQueries)).toBe(true);
    });
  });

  describe('getGraphQLStatus', () => {
    it('should return graphql status with defaults', () => {
      const status = (rateLimiter as any).getGraphQLStatus();
      expect(status.pointsRemaining).toBe(5000);
      expect(status.isApproachingLimit).toBe(false);
      expect(status.recommendedDelay).toBe(0);
    });

    it('should compute recommendedDelay when approaching limit with query history', () => {
      const graphql = (rateLimiter as any).graphql;
      // Set remaining below 20% of limit (5000 * 0.2 = 1000)
      graphql.remaining = 500;
      graphql.reset = new Date(Date.now() + 60000); // reset in 1 minute
      graphql.queryHistory = [
        { points: 50, query: 'q1', timestamp: new Date() },
        { points: 50, query: 'q2', timestamp: new Date() },
      ];

      const status = (rateLimiter as any).getGraphQLStatus();
      expect(status.isApproachingLimit).toBe(true);
      expect(status.recommendedDelay).toBeGreaterThanOrEqual(0);
      expect(status.pointsRemaining).toBe(500);
    });
  });

  describe('canExecuteGraphQLQuery', () => {
    it('should allow execution when points available', () => {
      const result = rateLimiter.canExecuteGraphQLQuery('{ viewer { login } }');
      expect(result.canExecute).toBe(true);
      expect(result.estimatedPoints).toBeGreaterThanOrEqual(1);
    });

    it('should block execution when rate limit is exhausted', () => {
      const graphql = (rateLimiter as any).graphql;
      graphql.remaining = 0;
      graphql.reset = new Date(Date.now() + 60000);

      const result = rateLimiter.canExecuteGraphQLQuery('{ viewer { login } }');
      expect(result.canExecute).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.estimatedPoints).toBeGreaterThanOrEqual(1);
    });

    it('should pass variables to complexity calculation', () => {
      const result = rateLimiter.canExecuteGraphQLQuery(
        'query GetIssues($limit: Int!) { repository(owner:"x", name:"y") { issues(first: $limit) { nodes { title } } } }',
        { limit: 50 }
      );
      expect(typeof result.canExecute).toBe('boolean');
    });
  });

  describe('waitForReset with future reset', () => {
    it('should wait when reset time is in the future', async () => {
      vi.useFakeTimers();
      const graphql = (rateLimiter as any).graphql;
      // Set reset 100ms in the future
      graphql.reset = new Date(Date.now() + 100);
      (rateLimiter as any).graphql = graphql;

      const waitPromise = rateLimiter.waitForReset('graphql');
      vi.advanceTimersByTime(200);
      await waitPromise;
      vi.useRealTimers();
    });
  });
});

describe('createRateLimitedOctokit', () => {
  it('should return octokit and rateLimiter', () => {
    const { octokit, rateLimiter } = createRateLimitedOctokit('test-token');
    expect(octokit).toBeDefined();
    expect(rateLimiter).toBeInstanceOf(GitHubRateLimiter);
    expect(typeof (octokit as any).graphqlWithComplexity).toBe('function');
  });

  it('graphqlWithComplexity should execute query when points available', async () => {
    const { octokit, rateLimiter } = createRateLimitedOctokit('test-token');
    const mockResult = { repository: { name: 'test' } };
    // Mock the underlying octokit.graphql
    vi.spyOn(octokit as any, 'graphql').mockResolvedValue(mockResult);
    // Mock canExecuteGraphQLQuery to allow execution
    vi.spyOn(rateLimiter, 'canExecuteGraphQLQuery').mockReturnValue({
      canExecute: true,
      estimatedPoints: 10,
    });
    // Mock wrapGraphQLRequest to pass through
    vi.spyOn(rateLimiter, 'wrapGraphQLRequest').mockImplementation(async (fn) => fn());

    const result = await (octokit as any).graphqlWithComplexity('{ repository { name } }');
    expect(result).toEqual(mockResult);
  });

  it('graphqlWithComplexity should throw when query blocked', async () => {
    const { octokit, rateLimiter } = createRateLimitedOctokit('test-token');
    vi.spyOn(rateLimiter, 'canExecuteGraphQLQuery').mockReturnValue({
      canExecute: false,
      reason: 'rate limit exceeded',
      estimatedPoints: 500,
      waitTime: 30000,
    });

    await expect(
      (octokit as any).graphqlWithComplexity('{ repository { name } }')
    ).rejects.toThrow('GraphQL query blocked');
  });

  it('graphqlWithComplexity should handle blocked query without waitTime', async () => {
    const { octokit, rateLimiter } = createRateLimitedOctokit('test-token');
    vi.spyOn(rateLimiter, 'canExecuteGraphQLQuery').mockReturnValue({
      canExecute: false,
      reason: 'too complex',
      estimatedPoints: 1000,
    });

    await expect(
      (octokit as any).graphqlWithComplexity('{ expensive { query } }')
    ).rejects.toThrow('unknown');
  });
});

describe('ResponseSizeLimiter', () => {
  describe('limitResponseSize - arrays', () => {
    it('should return small arrays unchanged', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = ResponseSizeLimiter.limitResponseSize(data);
      expect(result.truncated).toBe(false);
      expect(result.data).toEqual(data);
    });

    it('should truncate arrays exceeding maxItems', () => {
      const data = Array.from({ length: 1100 }, (_, i) => ({ id: i }));
      const result = ResponseSizeLimiter.limitResponseSize(data);
      expect(result.truncated).toBe(true);
      expect((result.data as any[]).length).toBe(1000);
    });

    it('should truncate arrays exceeding maxSizeBytes via binary search', () => {
      // Create large strings in array to exceed size limit
      const bigItem = { data: 'x'.repeat(10000) };
      const data = Array.from({ length: 50 }, () => bigItem);
      const result = ResponseSizeLimiter.limitResponseSize(data, 100 * 1024, 1000); // 100KB limit
      expect(result.truncated).toBe(true);
      expect((result.data as any[]).length).toBeLessThan(50);
    });
  });

  describe('limitResponseSize - objects', () => {
    it('should return small objects unchanged', () => {
      const data = { name: 'test', value: 42 };
      const result = ResponseSizeLimiter.limitResponseSize(data);
      expect(result.truncated).toBe(false);
      expect(result.data).toEqual(data);
    });

    it('should truncate large string fields in objects', () => {
      const data = { field: 'x'.repeat(100000) };
      const result = ResponseSizeLimiter.limitResponseSize(data, 1000); // 1KB limit
      expect(result.truncated).toBe(true);
    });

    it('should return data unchanged on JSON serialization error', () => {
      // Create a circular reference that JSON.stringify will throw on
      const data: any = { a: 1 };
      data.circular = data;
      const result = ResponseSizeLimiter.limitResponseSize(data);
      expect(result.truncated).toBe(false);
      expect(result.data).toBe(data);
    });

    it('should handle nested arrays and primitives in truncated objects (lines 599, 607)', () => {
      // Create a large object that triggers truncateObjectStrings
      // with nested arrays and number/boolean fields to cover lines 599 and 607
      const data = {
        longField: 'x'.repeat(2000), // > 1000 chars - triggers string truncation
        numbers: [1, 2, 3, 4, 5],   // array - triggers line 599
        active: true,                 // boolean primitive - triggers line 607
        count: 42,                    // number primitive - triggers line 607
      };
      const result = ResponseSizeLimiter.limitResponseSize(data, 100); // very small limit
      expect(result.truncated).toBe(true);
    });
  });

  describe('limitResponseSize - non-object types', () => {
    it('should handle string data', () => {
      const data = 'hello world';
      const result = ResponseSizeLimiter.limitResponseSize(data);
      expect(result.data).toBe('hello world');
    });

    it('should handle null data', () => {
      const result = ResponseSizeLimiter.limitResponseSize(null);
      expect(result.truncated).toBe(false);
    });
  });
});
