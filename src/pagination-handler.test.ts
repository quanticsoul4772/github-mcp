/**
 * Tests for PaginationHandler and GitHubPaginationUtils
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaginationHandler, globalPaginationHandler, GitHubPaginationUtils } from './pagination-handler.js';

// Helper to build a mock fetcher from pages
const makeFetcher = (pages: any[][], options: { totalCount?: number; headers?: any } = {}) => {
  return vi.fn(async (page: number, _perPage: number) => {
    const idx = page - 1;
    const data = idx < pages.length ? pages[idx] : [];
    return {
      data,
      hasNext: idx < pages.length - 1,
      nextPage: idx < pages.length - 1 ? page + 1 : undefined,
      totalCount: options.totalCount,
    };
  });
};

describe('PaginationHandler', () => {
  let handler: PaginationHandler;

  beforeEach(() => {
    handler = new PaginationHandler();
  });

  // ============================================================================
  // paginateAll
  // ============================================================================

  describe('paginateAll', () => {
    it('should yield all items across multiple pages', async () => {
      const fetcher = makeFetcher([[1, 2], [3, 4], [5]]);
      const results: number[] = [];
      for await (const item of handler.paginateAll(fetcher)) {
        results.push(item);
      }
      expect(results).toEqual([1, 2, 3, 4, 5]);
    });

    it('should stop after maxPages', async () => {
      const fetcher = makeFetcher([[1, 2], [3, 4], [5, 6]]);
      const results: number[] = [];
      for await (const item of handler.paginateAll(fetcher, { maxPages: 2 })) {
        results.push(item);
      }
      expect(results).toEqual([1, 2, 3, 4]);
    });

    it('should stop after maxItems', async () => {
      const fetcher = makeFetcher([[1, 2, 3], [4, 5, 6]]);
      const results: number[] = [];
      for await (const item of handler.paginateAll(fetcher, { maxItems: 4 })) {
        results.push(item);
      }
      expect(results).toEqual([1, 2, 3, 4]);
    });

    it('should stop when hasNext is false', async () => {
      const fetcher = makeFetcher([[1, 2, 3]]);
      const results: number[] = [];
      for await (const item of handler.paginateAll(fetcher)) {
        results.push(item);
      }
      expect(results).toEqual([1, 2, 3]);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('should call onProgress callback', async () => {
      const fetcher = makeFetcher([[1, 2], [3, 4]], { totalCount: 4 });
      const onProgress = vi.fn();
      const results: number[] = [];
      for await (const item of handler.paginateAll(fetcher, { onProgress })) {
        results.push(item);
      }
      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledWith(2, 4);
      expect(onProgress).toHaveBeenCalledWith(4, 4);
    });

    it('should break on fetcher error', async () => {
      const fetcher = vi.fn()
        .mockResolvedValueOnce({ data: [1, 2], hasNext: true })
        .mockRejectedValueOnce(new Error('API error'));
      const results: number[] = [];
      for await (const item of handler.paginateAll(fetcher)) {
        results.push(item as number);
      }
      expect(results).toEqual([1, 2]);
    });

    it('should handle rate limit backoff (remaining < 100)', async () => {
      vi.useFakeTimers();
      const resetAt = new Date(Date.now() + 1000);
      const fetcher = vi.fn()
        .mockResolvedValueOnce({
          data: [1],
          hasNext: true,
          rateLimit: { remaining: 50, resetAt },
        })
        .mockResolvedValueOnce({ data: [2], hasNext: false });

      const promise = (async () => {
        const results: number[] = [];
        for await (const item of handler.paginateAll(fetcher)) {
          results.push(item as number);
        }
        return results;
      })();

      // advance timers to allow setTimeout in paginateAll to resolve
      await vi.runAllTimersAsync();
      const results = await promise;
      expect(results).toEqual([1, 2]);
      vi.useRealTimers();
    });

    it('should NOT back off when rateLimit is absent', async () => {
      const fetcher = makeFetcher([[1], [2]]);
      const results: number[] = [];
      for await (const item of handler.paginateAll(fetcher)) {
        results.push(item);
      }
      expect(results).toEqual([1, 2]);
    });

    it('should treat maxItems=0 as no limit (falsy value ignored)', async () => {
      const fetcher = makeFetcher([[1, 2, 3]]);
      const results: number[] = [];
      for await (const item of handler.paginateAll(fetcher, { maxItems: 0 })) {
        results.push(item);
      }
      // 0 is falsy, so the source treats it as "no limit" — all items yielded
      expect(results).toEqual([1, 2, 3]);
    });

    it('should stop mid-page when maxItems hit during yield', async () => {
      // maxItems hit inside the inner for loop (line `if (maxItems && totalYielded >= maxItems) return`)
      const fetcher = makeFetcher([[1, 2, 3, 4, 5]]);
      const results: number[] = [];
      for await (const item of handler.paginateAll(fetcher, { maxItems: 3 })) {
        results.push(item);
      }
      expect(results).toEqual([1, 2, 3]);
    });
  });

  // ============================================================================
  // collectAll
  // ============================================================================

  describe('collectAll', () => {
    it('should collect all items into array', async () => {
      const fetcher = makeFetcher([[1, 2], [3, 4]]);
      const result = await handler.collectAll(fetcher);
      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('should return empty array when no pages', async () => {
      const fetcher = makeFetcher([[]]);
      const result = await handler.collectAll(fetcher);
      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // paginateConcurrent
  // ============================================================================

  describe('paginateConcurrent', () => {
    it('should return empty array when first page has no data', async () => {
      const fetcher = makeFetcher([[]]);
      const result = await handler.paginateConcurrent(fetcher);
      expect(result).toEqual([]);
    });

    it('should return first page only when hasNext is false', async () => {
      const fetcher = makeFetcher([[1, 2, 3]]);
      const result = await handler.paginateConcurrent(fetcher);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should return first page only when maxPages=1', async () => {
      const fetcher = makeFetcher([[1, 2], [3, 4]]);
      const result = await handler.paginateConcurrent(fetcher, { maxPages: 1 });
      expect(result).toEqual([1, 2]);
    });

    it('should fetch remaining pages concurrently', async () => {
      const fetcher = makeFetcher([[1, 2], [3, 4], [5, 6]], { totalCount: 6 });
      const result = await handler.paginateConcurrent(fetcher, { perPage: 2, maxPages: 3 });
      expect(result.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should call onProgress callback', async () => {
      const onProgress = vi.fn();
      const fetcher = makeFetcher([[1, 2], [3, 4]], { totalCount: 4 });
      await handler.paginateConcurrent(fetcher, { perPage: 2, maxPages: 2, onProgress });
      expect(onProgress).toHaveBeenCalled();
    });

    it('should handle page fetch errors gracefully', async () => {
      const fetcher = vi.fn()
        .mockResolvedValueOnce({ data: [1, 2], hasNext: true, totalCount: 4 })
        .mockRejectedValueOnce(new Error('page 2 failed'));
      const result = await handler.paginateConcurrent(fetcher, { perPage: 2, maxPages: 2 });
      // Page 1 data + empty result from failed page 2
      expect(result).toContain(1);
      expect(result).toContain(2);
    });
  });

  // ============================================================================
  // paginateSmart
  // ============================================================================

  describe('paginateSmart', () => {
    it('should use concurrent pagination when maxPages <= 10', async () => {
      const fetcher = makeFetcher([[1, 2], [3, 4]]);
      const spy = vi.spyOn(handler, 'paginateConcurrent');
      await handler.paginateSmart(fetcher, { maxPages: 5 });
      expect(spy).toHaveBeenCalled();
    });

    it('should use collectAll when concurrent=false', async () => {
      const fetcher = makeFetcher([[1, 2], [3, 4]]);
      const spy = vi.spyOn(handler, 'collectAll');
      await handler.paginateSmart(fetcher, { concurrent: false });
      expect(spy).toHaveBeenCalled();
    });

    it('should use collectAll when maxPages > 10', async () => {
      const fetcher = makeFetcher([[1, 2]]);
      const spy = vi.spyOn(handler, 'collectAll');
      await handler.paginateSmart(fetcher, { maxPages: 15 });
      expect(spy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // processBatched
  // ============================================================================

  describe('processBatched', () => {
    it('should process all items through processor in batches', async () => {
      const fetcher = makeFetcher([[1, 2, 3], [4, 5]]);
      const processor = vi.fn(async (items: number[]) => items.map(x => x * 2));
      const result = await handler.processBatched(fetcher, processor, { batchSize: 3 });
      expect(result.sort((a, b) => a - b)).toEqual([2, 4, 6, 8, 10]);
    });

    it('should process remaining items after last full batch', async () => {
      const fetcher = makeFetcher([[1, 2, 3, 4, 5]]);
      const processor = vi.fn(async (items: number[]) => items);
      // batchSize=2 → batches of [1,2], [3,4], remainder [5]
      const result = await handler.processBatched(fetcher, processor, { batchSize: 2 });
      expect(processor).toHaveBeenCalledTimes(3); // 2 full + 1 remainder
      expect(result.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  // ============================================================================
  // createGitHubFetcher
  // ============================================================================

  describe('createGitHubFetcher', () => {
    it('should return paginated response from API call', async () => {
      const apiCall = vi.fn().mockResolvedValue({
        data: [{ id: 1 }, { id: 2 }],
        headers: { link: '<url>; rel="next"', 'x-total-count': '10' },
      });
      const fetcher = handler.createGitHubFetcher(apiCall, { owner: 'test', repo: 'repo' });
      const result = await fetcher(1, 30);
      expect(result.data).toHaveLength(2);
      expect(result.hasNext).toBe(true);
      expect(result.totalCount).toBe(10);
      expect(result.nextPage).toBe(2);
    });

    it('should parse rate limit headers', async () => {
      const resetTs = Math.floor(Date.now() / 1000) + 3600;
      const apiCall = vi.fn().mockResolvedValue({
        data: [],
        headers: {
          link: '',
          'x-ratelimit-remaining': '500',
          'x-ratelimit-reset': String(resetTs),
        },
      });
      const fetcher = handler.createGitHubFetcher(apiCall);
      const result = await fetcher(1, 30);
      expect(result.rateLimit?.remaining).toBe(500);
      expect(result.rateLimit?.resetAt).toBeInstanceOf(Date);
    });

    it('should set hasNext=false when no link header', async () => {
      const apiCall = vi.fn().mockResolvedValue({
        data: [{ id: 1 }],
        headers: {},
      });
      const fetcher = handler.createGitHubFetcher(apiCall);
      const result = await fetcher(1, 30);
      expect(result.hasNext).toBe(false);
      expect(result.nextPage).toBeUndefined();
    });

    it('should pass base params to API call', async () => {
      const apiCall = vi.fn().mockResolvedValue({ data: [], headers: {} });
      const fetcher = handler.createGitHubFetcher(apiCall, { owner: 'me', repo: 'myrepo', state: 'open' });
      await fetcher(2, 50);
      expect(apiCall).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'me', repo: 'myrepo', state: 'open', page: 2, per_page: 50 })
      );
    });
  });

  // ============================================================================
  // createCachedFetcher
  // ============================================================================

  describe('createCachedFetcher', () => {
    it('should cache responses and not call original for cached hits', async () => {
      const original = vi.fn().mockResolvedValue({ data: [1, 2], hasNext: false });
      const cache = new Map<string, any>();
      const fetcher = handler.createCachedFetcher(original, cache, 60000);

      const first = await fetcher(1, 30);
      const second = await fetcher(1, 30);

      expect(original).toHaveBeenCalledTimes(1);
      expect(first).toEqual(second);
    });

    it('should call original when cache entry is expired', async () => {
      const original = vi.fn().mockResolvedValue({ data: [1], hasNext: false });
      const cache = new Map<string, any>();
      // pre-populate with expired entry
      cache.set('1:30', { data: { data: [99], hasNext: false }, timestamp: Date.now() - 10000 });
      const fetcher = handler.createCachedFetcher(original, cache, 5000); // 5s TTL
      const result = await fetcher(1, 30);
      expect(original).toHaveBeenCalledTimes(1);
      expect(result.data).toEqual([1]);
    });
  });

  // ============================================================================
  // globalPaginationHandler
  // ============================================================================

  it('globalPaginationHandler should be a PaginationHandler instance', () => {
    expect(globalPaginationHandler).toBeInstanceOf(PaginationHandler);
  });
});

// ============================================================================
// GitHubPaginationUtils
// ============================================================================

describe('GitHubPaginationUtils', () => {
  const makeOctokit = (data: any[]) => ({
    issues: {
      listForRepo: vi.fn().mockResolvedValue({ data, headers: {} }),
    },
    pulls: {
      list: vi.fn().mockResolvedValue({ data, headers: {} }),
    },
    repos: {
      listCommits: vi.fn().mockResolvedValue({ data, headers: {} }),
    },
  });

  it('getAllIssues should return paginated issues', async () => {
    const octokit = makeOctokit([{ id: 1 }, { id: 2 }]);
    const result = await GitHubPaginationUtils.getAllIssues(octokit, 'owner', 'repo');
    expect(result).toHaveLength(2);
    expect(octokit.issues.listForRepo).toHaveBeenCalled();
  });

  it('getAllPullRequests should return paginated PRs', async () => {
    const octokit = makeOctokit([{ number: 10 }]);
    const result = await GitHubPaginationUtils.getAllPullRequests(octokit, 'owner', 'repo');
    expect(result).toHaveLength(1);
    expect(octokit.pulls.list).toHaveBeenCalled();
  });

  it('getAllCommits should return paginated commits', async () => {
    const octokit = makeOctokit([{ sha: 'abc' }, { sha: 'def' }]);
    const result = await GitHubPaginationUtils.getAllCommits(octokit, 'owner', 'repo');
    expect(result).toHaveLength(2);
    expect(octokit.repos.listCommits).toHaveBeenCalled();
  });

  it('getAllIssues should pass custom state option', async () => {
    const octokit = makeOctokit([]);
    await GitHubPaginationUtils.getAllIssues(octokit, 'owner', 'repo', { state: 'closed' });
    expect(octokit.issues.listForRepo).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'closed' })
    );
  });

  it('getAllCommits should pass sha/since/until options', async () => {
    const octokit = makeOctokit([]);
    await GitHubPaginationUtils.getAllCommits(octokit, 'owner', 'repo', {
      sha: 'main',
      since: '2024-01-01',
      until: '2024-12-31',
    });
    expect(octokit.repos.listCommits).toHaveBeenCalledWith(
      expect.objectContaining({ sha: 'main', since: '2024-01-01', until: '2024-12-31' })
    );
  });
});
