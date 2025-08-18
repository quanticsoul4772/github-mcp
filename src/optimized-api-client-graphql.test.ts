/**
 * Tests for OptimizedAPIClient GraphQL functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OptimizedAPIClient } from './optimized-api-client.js';
import { createMockOctokit } from './__tests__/mocks/octokit.js';

describe('OptimizedAPIClient GraphQL Features', () => {
  let mockOctokit: any;
  let optimizedClient: OptimizedAPIClient;

  beforeEach(() => {
    mockOctokit = createMockOctokit();
    optimizedClient = new OptimizedAPIClient({
      octokit: mockOctokit,
      enableCache: true,
      enableGraphQLCache: true,
      enableDeduplication: true,
      enablePerformanceMonitoring: true,
    });
  });

  describe('GraphQL caching', () => {
    it('should cache GraphQL responses', async () => {
      const query =
        'query GetRepo($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { name } }';
      const variables = { owner: 'test', repo: 'test-repo' };
      const mockResponse = { repository: { name: 'test-repo' } };

      mockOctokit.graphql.mockResolvedValue(mockResponse);

      // First call
      const result1 = await optimizedClient.graphql(query, variables);

      // Second call - should use cache
      const result2 = await optimizedClient.graphql(query, variables);

      expect(result1).toEqual(mockResponse);
      expect(result2).toEqual(mockResponse);
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(1);
    });

    it('should use custom TTL when provided', async () => {
      const query = 'query GetRepo { repository { name } }';
      const mockResponse = { repository: { name: 'test' } };

      mockOctokit.graphql.mockResolvedValue(mockResponse);

      await optimizedClient.graphql(query, {}, { ttl: 100 });

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      await optimizedClient.graphql(query, {}, { ttl: 100 });

      // Should have been called twice due to expiration
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(2);
    });

    it('should skip cache when requested', async () => {
      const query = 'query GetRepo { repository { name } }';
      const mockResponse = { repository: { name: 'test' } };

      mockOctokit.graphql.mockResolvedValue(mockResponse);

      // Both calls should skip cache
      await optimizedClient.graphql(query, {}, { skipCache: true });
      await optimizedClient.graphql(query, {}, { skipCache: true });

      expect(mockOctokit.graphql).toHaveBeenCalledTimes(2);
    });

    it('should integrate with performance monitoring', async () => {
      const query = 'query GetRepo { repository { name } }';
      const mockResponse = { repository: { name: 'test' } };

      mockOctokit.graphql.mockResolvedValue(mockResponse);

      await optimizedClient.graphql(query, {}, { operation: 'test_operation' });

      const metrics = optimizedClient.getMetrics();
      expect(metrics.performance).toBeDefined();
    });
  });

  describe('Cache invalidation', () => {
    it('should invalidate GraphQL cache for mutations', async () => {
      // First populate cache
      const readQuery = 'query GetDiscussion { repository { discussion { title } } }';
      mockOctokit.graphql.mockResolvedValue({ repository: { discussion: { title: 'Test' } } });

      await optimizedClient.graphql(readQuery);
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(1);

      // Perform mutation - should invalidate related cache
      const mutation = 'mutation CreateDiscussion { createDiscussion { id } }';
      const invalidated = optimizedClient.invalidateGraphQLCacheForMutation(mutation, {
        owner: 'test',
        repo: 'test',
      });

      expect(invalidated).toBeGreaterThanOrEqual(0);

      // Subsequent read should hit API again (cache invalidated)
      await optimizedClient.graphql(readQuery);
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache by pattern', () => {
      const invalidated = optimizedClient.invalidateGraphQLCache(/discussion/i);
      expect(typeof invalidated).toBe('number');
    });
  });

  describe('Request deduplication', () => {
    it('should deduplicate concurrent GraphQL requests', async () => {
      const query = 'query GetRepo { repository { name } }';
      const mockResponse = { repository: { name: 'test' } };

      mockOctokit.graphql.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockResponse), 100))
      );

      // Start multiple concurrent requests
      const promises = [
        optimizedClient.graphql(query),
        optimizedClient.graphql(query),
        optimizedClient.graphql(query),
      ];

      const results = await Promise.all(promises);

      // All should return same result
      results.forEach(result => expect(result).toEqual(mockResponse));

      // But API should only be called once due to deduplication
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(1);
    });

    it('should skip deduplication when requested', async () => {
      const query = 'query GetRepo { repository { name } }';
      const mockResponse = { repository: { name: 'test' } };

      mockOctokit.graphql.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockResponse), 50))
      );

      // Start concurrent requests with deduplication disabled
      const promises = [
        optimizedClient.graphql(query, {}, { skipDeduplication: true, skipCache: true }),
        optimizedClient.graphql(query, {}, { skipDeduplication: true, skipCache: true }),
      ];

      await Promise.all(promises);

      // Should call API multiple times
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(2);
    });
  });

  describe('Metrics and monitoring', () => {
    it('should provide comprehensive metrics including GraphQL cache', async () => {
      const query = 'query GetRepo { repository { name } }';
      mockOctokit.graphql.mockResolvedValue({ repository: { name: 'test' } });

      // Generate some cache activity
      await optimizedClient.graphql(query); // miss
      await optimizedClient.graphql(query); // hit

      const metrics = optimizedClient.getMetrics();

      expect(metrics).toHaveProperty('cache');
      expect(metrics).toHaveProperty('graphqlCache');
      expect(metrics).toHaveProperty('deduplication');
      expect(metrics).toHaveProperty('performance');
    });

    it('should provide detailed GraphQL cache statistics', async () => {
      const query = 'query GetRepo { repository { name } }';
      mockOctokit.graphql.mockResolvedValue({ repository: { name: 'test' } });

      await optimizedClient.graphql(query, {}, { operation: 'test_query' });

      const stats = optimizedClient.getGraphQLCacheStats();

      expect(stats).toHaveProperty('general');
      expect(stats).toHaveProperty('topQueries');
      expect(stats).toHaveProperty('cacheEfficiency');
      expect(stats).toHaveProperty('memorySummary');
    });
  });

  describe('Error handling', () => {
    it('should handle GraphQL errors gracefully', async () => {
      const query = 'query GetRepo { repository { name } }';
      const error = new Error('GraphQL Error');

      mockOctokit.graphql.mockRejectedValue(error);

      await expect(optimizedClient.graphql(query)).rejects.toThrow('GraphQL Error');
    });

    it('should return stale cache data on error if available', async () => {
      const query = 'query GetRepo { repository { name } }';
      const cachedResponse = { repository: { name: 'cached' } };

      // First call succeeds and populates cache
      mockOctokit.graphql.mockResolvedValueOnce(cachedResponse);
      await optimizedClient.graphql(query);

      // Second call fails but should return cached data
      mockOctokit.graphql.mockRejectedValueOnce(new Error('Network error'));

      const result = await optimizedClient.graphql(query);
      expect(result).toEqual(cachedResponse);
    });
  });

  describe('Disabled features', () => {
    it('should work with GraphQL caching disabled', async () => {
      const clientWithoutGraphQLCache = new OptimizedAPIClient({
        octokit: mockOctokit,
        enableGraphQLCache: false,
      });

      const query = 'query GetRepo { repository { name } }';
      const mockResponse = { repository: { name: 'test' } };

      mockOctokit.graphql.mockResolvedValue(mockResponse);

      // Two calls should both hit the API
      await clientWithoutGraphQLCache.graphql(query);
      await clientWithoutGraphQLCache.graphql(query);

      expect(mockOctokit.graphql).toHaveBeenCalledTimes(2);
    });

    it('should work with all optimizations disabled', async () => {
      const basicClient = new OptimizedAPIClient({
        octokit: mockOctokit,
        enableCache: false,
        enableGraphQLCache: false,
        enableDeduplication: false,
        enablePerformanceMonitoring: false,
      });

      const query = 'query GetRepo { repository { name } }';
      const mockResponse = { repository: { name: 'test' } };

      mockOctokit.graphql.mockResolvedValue(mockResponse);

      const result = await basicClient.graphql(query);
      expect(result).toEqual(mockResponse);
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(1);
    });
  });

  describe('Clear operations', () => {
    it('should clear all caches including GraphQL', async () => {
      const query = 'query GetRepo { repository { name } }';
      mockOctokit.graphql.mockResolvedValue({ repository: { name: 'test' } });

      // Populate caches
      await optimizedClient.graphql(query);

      // Clear everything
      optimizedClient.clearAll();

      // Verify cache is empty by checking if next call hits API
      await optimizedClient.graphql(query);

      expect(mockOctokit.graphql).toHaveBeenCalledTimes(2); // Initial + after clear
    });
  });
});
