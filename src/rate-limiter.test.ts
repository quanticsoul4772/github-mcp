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

  describe('getGraphQLStatus', () => {
    it('should return graphql status with defaults', () => {
      const status = (rateLimiter as any).getGraphQLStatus();
      expect(status.pointsRemaining).toBe(5000);
      expect(status.isApproachingLimit).toBe(false);
      expect(status.recommendedDelay).toBe(0);
    });
  });

  describe('canExecuteGraphQLQuery', () => {
    it('should allow execution when points available', () => {
      const result = rateLimiter.canExecuteGraphQLQuery('{ viewer { login } }');
      expect(result.canExecute).toBe(true);
      expect(result.estimatedPoints).toBeGreaterThanOrEqual(1);
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
