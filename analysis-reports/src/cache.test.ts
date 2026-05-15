/**
 * Tests for GitHubAPICache
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubAPICache } from './cache.js';

describe('GitHubAPICache', () => {
  let cache: GitHubAPICache;

  beforeEach(() => {
    cache = new GitHubAPICache({ defaultTTL: 60000, maxSize: 5, enableMetrics: true });
  });

  // ============================================================================
  // get (cache miss, hit, stale)
  // ============================================================================

  describe('get', () => {
    it('should call fetcher on cache miss and return value', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 42 });
      const result = await cache.get('repos.get', { owner: 'alice', repo: 'x' }, fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: 42 });
    });

    it('should return cached value on second call (cache hit)', async () => {
      const fetcher = vi.fn().mockResolvedValue('value');
      await cache.get('repos.get', { owner: 'alice' }, fetcher);
      await cache.get('repos.get', { owner: 'alice' }, fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('should cache key as deterministic regardless of param order', async () => {
      const fetcher1 = vi.fn().mockResolvedValue('v1');
      const fetcher2 = vi.fn().mockResolvedValue('v2');
      await cache.get('op', { b: 2, a: 1 }, fetcher1);
      await cache.get('op', { a: 1, b: 2 }, fetcher2);
      expect(fetcher2).not.toHaveBeenCalled();
    });

    it('should re-fetch after TTL expires', async () => {
      vi.useFakeTimers();
      const shortCache = new GitHubAPICache({ defaultTTL: 100, enableMetrics: false });
      const fetcher = vi.fn().mockResolvedValue('fresh');
      await shortCache.get('op', {}, fetcher);
      vi.advanceTimersByTime(200);
      await shortCache.get('op', {}, fetcher);
      expect(fetcher).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('should return stale data when fetcher throws and stale entry exists', async () => {
      vi.useFakeTimers();
      const shortCache = new GitHubAPICache({ defaultTTL: 100 });
      const fetcher = vi.fn()
        .mockResolvedValueOnce('stale-data')
        .mockRejectedValueOnce(new Error('network error'));
      await shortCache.get('op', {}, fetcher);
      vi.advanceTimersByTime(200);
      const result = await shortCache.get('op', {}, fetcher);
      expect(result).toBe('stale-data');
      vi.useRealTimers();
    });

    it('should rethrow when fetcher fails and no stale entry', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('network error'));
      await expect(cache.get('op', { id: 1 }, fetcher)).rejects.toThrow('network error');
    });

    it('should track hits and misses in metrics', async () => {
      const fetcher = vi.fn().mockResolvedValue('v');
      await cache.get('op', {}, fetcher); // miss
      await cache.get('op', {}, fetcher); // hit
      const m = cache.getMetrics();
      expect(m.hits).toBe(1);
      expect(m.misses).toBe(1);
    });
  });

  // ============================================================================
  // LRU eviction
  // ============================================================================

  describe('LRU eviction', () => {
    it('should evict least recently used entry when maxSize reached', async () => {
      const smallCache = new GitHubAPICache({ maxSize: 3, enableMetrics: true });
      for (let i = 0; i < 3; i++) {
        await smallCache.get(`op${i}`, {}, vi.fn().mockResolvedValue(i));
      }
      expect(smallCache.size()).toBe(3);
      // Access op1 to make op0 least recently used
      await smallCache.get('op1', {}, vi.fn().mockResolvedValue(1));
      // Add a 4th entry — should evict op0
      await smallCache.get('op3', {}, vi.fn().mockResolvedValue(3));
      expect(smallCache.size()).toBe(3);
      const m = smallCache.getMetrics();
      expect(m.evictions).toBe(1);
    });
  });

  // ============================================================================
  // invalidate
  // ============================================================================

  describe('invalidate', () => {
    it('should invalidate matching entries by string pattern', async () => {
      await cache.get('repos.get', { r: 'a' }, vi.fn().mockResolvedValue(1));
      await cache.get('repos.get', { r: 'b' }, vi.fn().mockResolvedValue(2));
      await cache.get('issues.list', {}, vi.fn().mockResolvedValue(3));
      const count = cache.invalidate('repos');
      expect(count).toBe(2);
      expect(cache.size()).toBe(1);
    });

    it('should invalidate by RegExp', async () => {
      await cache.get('repos.get', { r: 'x' }, vi.fn().mockResolvedValue(1));
      await cache.get('issues.list', {}, vi.fn().mockResolvedValue(2));
      const count = cache.invalidate(/^repos/);
      expect(count).toBe(1);
    });

    it('should return 0 when no entries match', async () => {
      await cache.get('repos.get', {}, vi.fn().mockResolvedValue(1));
      expect(cache.invalidate('nothing-matches')).toBe(0);
    });
  });

  // ============================================================================
  // delete
  // ============================================================================

  describe('delete', () => {
    it('should remove a specific entry', async () => {
      await cache.get('repos.get', { owner: 'alice' }, vi.fn().mockResolvedValue(1));
      expect(cache.size()).toBe(1);
      const deleted = cache.delete('repos.get', { owner: 'alice' });
      expect(deleted).toBe(true);
      expect(cache.size()).toBe(0);
    });

    it('should return false when entry does not exist', () => {
      expect(cache.delete('nonexistent', {})).toBe(false);
    });
  });

  // ============================================================================
  // clear
  // ============================================================================

  describe('clear', () => {
    it('should remove all entries', async () => {
      await cache.get('op1', {}, vi.fn().mockResolvedValue(1));
      await cache.get('op2', {}, vi.fn().mockResolvedValue(2));
      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  // ============================================================================
  // cleanup
  // ============================================================================

  describe('cleanup', () => {
    it('should remove expired entries and return count', async () => {
      vi.useFakeTimers();
      const shortCache = new GitHubAPICache({ defaultTTL: 100, enableMetrics: true });
      await shortCache.get('op1', {}, vi.fn().mockResolvedValue(1));
      await shortCache.get('op2', {}, vi.fn().mockResolvedValue(2));
      vi.advanceTimersByTime(200);
      const removed = shortCache.cleanup();
      expect(removed).toBe(2);
      expect(shortCache.size()).toBe(0);
      vi.useRealTimers();
    });

    it('should not remove entries that are still valid', async () => {
      await cache.get('op1', {}, vi.fn().mockResolvedValue(1));
      const removed = cache.cleanup();
      expect(removed).toBe(0);
      expect(cache.size()).toBe(1);
    });
  });

  // ============================================================================
  // size / getMetrics
  // ============================================================================

  describe('size and getMetrics', () => {
    it('should return 0 for empty cache', () => {
      expect(cache.size()).toBe(0);
    });

    it('should return correct size after adds', async () => {
      await cache.get('op1', {}, vi.fn().mockResolvedValue(1));
      await cache.get('op2', {}, vi.fn().mockResolvedValue(2));
      expect(cache.size()).toBe(2);
    });

    it('should return metrics snapshot', () => {
      const m = cache.getMetrics();
      expect(m).toHaveProperty('hits');
      expect(m).toHaveProperty('misses');
      expect(m).toHaveProperty('evictions');
    });
  });
});
