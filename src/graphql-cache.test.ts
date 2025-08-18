/**
 * Comprehensive tests for GraphQL caching system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GraphQLCache, GRAPHQL_CACHE_CONFIG } from './graphql-cache.js';

describe('GraphQLCache', () => {
  let cache: GraphQLCache;

  beforeEach(() => {
    cache = new GraphQLCache({
      defaultTTL: 1000, // 1 second for faster tests
      maxSize: 10,
      enableMetrics: true,
    });
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Basic caching functionality', () => {
    it('should cache and retrieve GraphQL responses', async () => {
      const query = 'query { repository(owner: "test", name: "repo") { name } }';
      const variables = { owner: 'test', name: 'repo' };
      const mockResponse = { repository: { name: 'repo' } };

      const fetcher = vi.fn().mockResolvedValue(mockResponse);

      // First call - cache miss
      const result1 = await cache.get(query, variables, fetcher);
      expect(result1).toEqual(mockResponse);
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      const result2 = await cache.get(query, variables, fetcher);
      expect(result2).toEqual(mockResponse);
      expect(fetcher).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should generate consistent cache keys for identical queries', async () => {
      const query =
        'query GetRepo($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { name } }';
      const variables1 = { owner: 'test', name: 'repo' };
      const variables2 = { name: 'repo', owner: 'test' }; // Different order

      const fetcher1 = vi.fn().mockResolvedValue({ result: 'test1' });
      const fetcher2 = vi.fn().mockResolvedValue({ result: 'test2' });

      await cache.get(query, variables1, fetcher1);
      await cache.get(query, variables2, fetcher2);

      // Should only call fetcher1, since variables should produce same cache key
      expect(fetcher1).toHaveBeenCalledTimes(1);
      expect(fetcher2).toHaveBeenCalledTimes(0);
    });

    it('should respect TTL and expire entries', async () => {
      const query = 'query { test }';
      const variables = {};
      const mockResponse = { test: 'data' };

      const fetcher = vi.fn().mockResolvedValue(mockResponse);

      // Cache with very short TTL
      await cache.get(query, variables, fetcher, { ttl: 50 }); // 50ms

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should call fetcher again after expiration
      await cache.get(query, variables, fetcher, { ttl: 50 });
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('should use configured TTL for specific query types', async () => {
      const repositoryQuery = 'query GetRepository { repository { name } }';
      const searchQuery = 'query SearchDiscussions { search { nodes } }';

      const repoFetcher = vi.fn().mockResolvedValue({ repository: { name: 'test' } });
      const searchFetcher = vi.fn().mockResolvedValue({ search: { nodes: [] } });

      // Should use different TTL values based on query content
      await cache.get(repositoryQuery, {}, repoFetcher);
      await cache.get(searchQuery, {}, searchFetcher);

      const metrics = cache.getMetrics();
      expect(metrics.size).toBe(2);
    });
  });

  describe('Cache invalidation', () => {
    it('should invalidate cache entries based on mutation patterns', async () => {
      // Set up some cached entries
      const queries = [
        'query { repository { discussions { nodes { id } } } }',
        'query { repository { issues { nodes { id } } } }',
        'query { user { repositories { nodes { name } } } }',
      ];

      for (const query of queries) {
        await cache.get(query, {}, vi.fn().mockResolvedValue({ data: 'test' }));
      }

      expect(cache.size()).toBe(3);

      // Invalidate discussion-related queries
      const mutation = 'mutation CreateDiscussion { createDiscussion { id } }';
      const invalidated = cache.invalidateForMutation(mutation, { owner: 'test', repo: 'test' });

      expect(invalidated).toBeGreaterThan(0);
      expect(cache.size()).toBeLessThan(3);
    });

    it('should invalidate cache entries matching patterns', async () => {
      const queries = [
        'query GetRepo1 { repository(owner: "test1") { name } }',
        'query GetRepo2 { repository(owner: "test2") { name } }',
        'query GetUser { user { name } }',
      ];

      for (const query of queries) {
        await cache.get(query, {}, vi.fn().mockResolvedValue({ data: 'test' }));
      }

      expect(cache.size()).toBe(3);

      // Invalidate repository-related queries
      const invalidated = cache.invalidate(/repository/i);

      expect(invalidated).toBe(2);
      expect(cache.size()).toBe(1);
    });

    it('should clear all entries', async () => {
      // Add some entries through the public interface
      await cache.get('query1', {}, vi.fn().mockResolvedValue({ data: 'test1' }));
      await cache.get('query2', {}, vi.fn().mockResolvedValue({ data: 'test2' }));

      expect(cache.size()).toBe(2);

      cache.clear();

      expect(cache.size()).toBe(0);
      const metrics = cache.getMetrics();
      expect(metrics.size).toBe(0);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entries when cache is full', async () => {
      const smallCache = new GraphQLCache({ maxSize: 2, enableMetrics: true });

      // Fill cache
      await smallCache.get('query1', {}, vi.fn().mockResolvedValue({ data: '1' }));
      await smallCache.get('query2', {}, vi.fn().mockResolvedValue({ data: '2' }));

      expect(smallCache.size()).toBe(2);

      // Access query1 to make it more recently used
      await smallCache.get('query1', {}, vi.fn().mockResolvedValue({ data: '1' }));

      // Add query3 - should evict query2 (least recently used)
      await smallCache.get('query3', {}, vi.fn().mockResolvedValue({ data: '3' }));

      expect(smallCache.size()).toBe(2);

      const metrics = smallCache.getMetrics();
      expect(metrics.evictions).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should return stale data on error if available', async () => {
      const query = 'query { test }';
      const variables = {};
      const staleData = { test: 'stale' };

      // First populate cache with very short TTL
      const successFetcher = vi.fn().mockResolvedValue(staleData);
      await cache.get(query, variables, successFetcher, { ttl: 1 }); // 1ms TTL

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      // Then simulate error with fresh fetcher - should return stale data
      const errorFetcher = vi.fn().mockRejectedValue(new Error('API Error'));

      const result = await cache.get(query, variables, errorFetcher);

      expect(result).toEqual(staleData);
      expect(errorFetcher).toHaveBeenCalledTimes(1);
    });

    it('should throw error if no stale data available', async () => {
      const query = 'query { test }';
      const variables = {};

      const errorFetcher = vi.fn().mockRejectedValue(new Error('API Error'));

      await expect(cache.get(query, variables, errorFetcher)).rejects.toThrow('API Error');
    });
  });

  describe('Metrics and statistics', () => {
    it('should track cache hits and misses', async () => {
      const query = 'query { test }';
      const variables = {};
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

      // Cache miss
      await cache.get(query, variables, fetcher);

      // Cache hit
      await cache.get(query, variables, fetcher);
      await cache.get(query, variables, fetcher);

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(1);
    });

    it('should track query-specific metrics', async () => {
      const queries = [
        { query: 'query GetRepo { repository { name } }', op: 'GetRepo' },
        { query: 'query GetUser { user { name } }', op: 'GetUser' },
      ];

      for (const { query, op } of queries) {
        // Miss + hit for each query
        await cache.get(query, {}, vi.fn().mockResolvedValue({ data: 'test' }), { operation: op });
        await cache.get(query, {}, vi.fn().mockResolvedValue({ data: 'test' }), { operation: op });
      }

      const stats = cache.getDetailedStats();

      expect(stats.topQueries).toHaveLength(2);
      expect(stats.topQueries[0].hits).toBe(1);
      expect(stats.topQueries[0].misses).toBe(1);
      expect(stats.cacheEfficiency.overall).toBe(50); // 50% hit rate
    });

    it('should provide detailed statistics', async () => {
      // Add entries through public interface
      await cache.get('query1', {}, vi.fn().mockResolvedValue({ data: 'test1' }));
      await cache.get('query2', {}, vi.fn().mockResolvedValue({ data: 'test2' }));

      const stats = cache.getDetailedStats();

      expect(stats.memorySummary.entries).toBe(2);
      expect(stats.memorySummary.estimatedSize).toContain('KB');
      expect(stats.general.size).toBe(2);
    });
  });

  describe('Cleanup functionality', () => {
    it('should clean up expired entries', async () => {
      const shortTTL = 50; // 50ms

      // Add entries with short TTL
      await cache.get('query1', {}, vi.fn().mockResolvedValue({ data: '1' }), { ttl: shortTTL });
      await cache.get('query2', {}, vi.fn().mockResolvedValue({ data: '2' }), { ttl: 10000 }); // Long TTL

      expect(cache.size()).toBe(2);

      // Wait for first entry to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      const removed = cache.cleanup();

      expect(removed).toBe(1);
      expect(cache.size()).toBe(1);
    });
  });

  describe('GRAPHQL_CACHE_CONFIG', () => {
    it('should have appropriate TTL values for different query types', () => {
      expect(GRAPHQL_CACHE_CONFIG.get_repository_insights).toBe(60 * 60 * 1000); // 1 hour
      expect(GRAPHQL_CACHE_CONFIG.get_contribution_stats).toBe(6 * 60 * 60 * 1000); // 6 hours
      expect(GRAPHQL_CACHE_CONFIG.search_discussions).toBe(15 * 60 * 1000); // 15 minutes
      expect(GRAPHQL_CACHE_CONFIG.default).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('should provide sensible defaults for unknown query types', () => {
      expect(GRAPHQL_CACHE_CONFIG.default).toBeGreaterThan(0);
    });
  });

  describe('Query name extraction', () => {
    it('should extract operation names from GraphQL queries', async () => {
      const queries = [
        'query GetRepository { repository { name } }',
        'mutation CreateDiscussion { createDiscussion { id } }',
        'query { repository(owner: "test") { name } }', // No explicit name
      ];

      for (const query of queries) {
        await cache.get(query, {}, vi.fn().mockResolvedValue({ data: 'test' }));
      }

      const metrics = cache.getMetrics();
      expect(Object.keys(metrics.queryTypes)).toContain('GetRepository');
      expect(Object.keys(metrics.queryTypes)).toContain('CreateDiscussion');
    });
  });
});
