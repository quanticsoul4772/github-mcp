/**
 * Tests for cache management tools
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCacheManagementTools } from './cache-management.js';
import { OptimizedAPIClient } from '../optimized-api-client.js';
import { createMockOctokit } from '../__tests__/mocks/octokit.js';

describe('Cache Management Tools', () => {
  let mockOptimizedClient: OptimizedAPIClient;
  let tools: any[];

  beforeEach(() => {
    const mockOctokit = createMockOctokit();
    mockOptimizedClient = new OptimizedAPIClient({
      octokit: mockOctokit as any,
      enableCache: true,
      enableGraphQLCache: true,
    });
    tools = createCacheManagementTools(mockOptimizedClient);
  });

  describe('Tool registration', () => {
    it('should register all cache management tools', () => {
      const toolNames = tools.map(tool => tool.tool.name);

      expect(toolNames).toContain('get_cache_metrics');
      expect(toolNames).toContain('get_graphql_cache_stats');
      expect(toolNames).toContain('clear_cache');
      expect(toolNames).toContain('cache_health_check');
      expect(toolNames).toContain('warmup_cache');

      expect(tools.length).toBe(5);
    });

    it('should have proper tool descriptions', () => {
      tools.forEach(tool => {
        expect(tool.tool.name).toBeTruthy();
        expect(tool.tool.description).toBeTruthy();
        expect(tool.tool.inputSchema).toBeTruthy();
        expect(typeof tool.handler).toBe('function');
      });
    });
  });

  describe('get_cache_metrics tool', () => {
    let getCacheMetricsTool: any;

    beforeEach(() => {
      getCacheMetricsTool = tools.find(tool => tool.tool.name === 'get_cache_metrics');
    });

    it('should return comprehensive cache metrics', async () => {
      const mockMetrics = {
        cache: { hits: 10, misses: 5 },
        graphqlCache: { hits: 8, misses: 2 },
        deduplication: { deduplicated: 3 },
        performance: { avgResponseTime: 150 },
      };

      vi.spyOn(mockOptimizedClient, 'getMetrics').mockReturnValue(mockMetrics);

      const result = await getCacheMetricsTool.handler({});

      expect(result).toHaveProperty('timestamp');
      expect(result.rest_cache).toEqual(mockMetrics.cache);
      expect(result.graphql_cache).toEqual(mockMetrics.graphqlCache);
      expect(result.deduplication).toEqual(mockMetrics.deduplication);
      expect(result.performance).toEqual(mockMetrics.performance);
    });

    it('should include detailed stats when requested', async () => {
      const mockMetrics = {
        cache: { hits: 10, misses: 5 },
        graphqlCache: { hits: 8, misses: 2 },
      };

      const mockDetailedStats = {
        general: { hits: 8, misses: 2, size: 5, evictions: 0, queryTypes: {} },
        topQueries: [
          { query: 'GetRepo', hits: 5, misses: 1, hitRate: 83.33, avgResponseTime: 150 },
        ],
        cacheEfficiency: { overall: 80, byQuery: {} },
        memorySummary: { entries: 5, estimatedSize: '2.5 KB' },
      };

      vi.spyOn(mockOptimizedClient, 'getMetrics').mockReturnValue(mockMetrics);
      vi.spyOn(mockOptimizedClient, 'getGraphQLCacheStats').mockReturnValue(mockDetailedStats);

      const result = await getCacheMetricsTool.handler({ includeDetails: true });

      expect(result).toHaveProperty('graphql_cache_details');
      expect(result.graphql_cache_details).toEqual(mockDetailedStats);
    });
  });

  describe('get_graphql_cache_stats tool', () => {
    let getGraphQLCacheStatsTool: any;

    beforeEach(() => {
      getGraphQLCacheStatsTool = tools.find(tool => tool.tool.name === 'get_graphql_cache_stats');
    });

    it('should return detailed GraphQL cache statistics', async () => {
      const mockStats = {
        general: { hits: 15, misses: 5, size: 8, evictions: 0, queryTypes: {} },
        topQueries: [
          { query: 'GetRepository', hits: 10, misses: 2, hitRate: 83.33, avgResponseTime: 200 },
          { query: 'ListDiscussions', hits: 5, misses: 3, hitRate: 62.5, avgResponseTime: 150 },
        ],
        cacheEfficiency: { overall: 75, byQuery: { GetRepository: 83.33 } },
        memorySummary: { entries: 8, estimatedSize: '4.2 KB' },
      };

      vi.spyOn(mockOptimizedClient, 'getGraphQLCacheStats').mockReturnValue(mockStats);

      const result = await getGraphQLCacheStatsTool.handler({});

      expect(result.enabled).toBe(true);
      expect(result).toHaveProperty('timestamp');
      expect(result.general).toEqual(mockStats.general);
      expect(result.topQueries).toEqual(mockStats.topQueries);
      expect(result.cacheEfficiency).toEqual(mockStats.cacheEfficiency);
      expect(result.memorySummary).toEqual(mockStats.memorySummary);
    });

    it('should handle disabled GraphQL caching', async () => {
      vi.spyOn(mockOptimizedClient, 'getGraphQLCacheStats').mockReturnValue(null);

      const result = await getGraphQLCacheStatsTool.handler({});

      expect(result.enabled).toBe(false);
      expect(result.message).toContain('not enabled');
    });
  });

  describe('clear_cache tool', () => {
    let clearCacheTool: any;

    beforeEach(() => {
      clearCacheTool = tools.find(tool => tool.tool.name === 'clear_cache');
    });

    it('should clear all caches by default', async () => {
      const clearAllSpy = vi.spyOn(mockOptimizedClient, 'clearAll');

      const result = await clearCacheTool.handler({});

      expect(clearAllSpy).toHaveBeenCalled();
      expect(result.message).toContain('All caches cleared');
      expect(result.cacheType).toBe('all');
    });

    it('should clear REST cache only', async () => {
      const invalidateCacheSpy = vi
        .spyOn(mockOptimizedClient, 'invalidateCache')
        .mockReturnValue(5);

      const result = await clearCacheTool.handler({ cacheType: 'rest' });

      expect(invalidateCacheSpy).toHaveBeenCalledWith(/.*/);
      expect(result.message).toContain('REST API cache cleared');
      expect(result.cacheType).toBe('rest');
    });

    it('should clear GraphQL cache only', async () => {
      const invalidateGraphQLCacheSpy = vi
        .spyOn(mockOptimizedClient, 'invalidateGraphQLCache')
        .mockReturnValue(3);

      const result = await clearCacheTool.handler({ cacheType: 'graphql' });

      expect(invalidateGraphQLCacheSpy).toHaveBeenCalledWith(/.*/);
      expect(result.message).toContain('GraphQL cache cleared');
      expect(result.cacheType).toBe('graphql');
    });

    it('should clear caches matching pattern', async () => {
      const pattern = 'repository.*discussion';
      const invalidateCacheSpy = vi
        .spyOn(mockOptimizedClient, 'invalidateCache')
        .mockReturnValue(2);
      const invalidateGraphQLCacheSpy = vi
        .spyOn(mockOptimizedClient, 'invalidateGraphQLCache')
        .mockReturnValue(3);

      const result = await clearCacheTool.handler({ pattern });

      expect(invalidateCacheSpy).toHaveBeenCalledWith(expect.any(RegExp));
      expect(invalidateGraphQLCacheSpy).toHaveBeenCalledWith(expect.any(RegExp));
      expect(result.clearedEntries).toBe(5);
      expect(result.pattern).toBe(pattern);
    });
  });

  describe('cache_health_check tool', () => {
    let cacheHealthCheckTool: any;

    beforeEach(() => {
      cacheHealthCheckTool = tools.find(tool => tool.tool.name === 'cache_health_check');
    });

    it('should report healthy cache performance', async () => {
      const mockMetrics = {
        cache: { hits: 80, misses: 20, evictions: 5, size: 100 },
      };

      const mockGraphQLStats = {
        general: { hits: 90, misses: 10, size: 50, evictions: 0, queryTypes: {} },
        topQueries: [],
        cacheEfficiency: { overall: 90, byQuery: { GetRepo: 95, ListDiscussions: 85 } },
        memorySummary: { entries: 50, estimatedSize: '2.5 MB' },
      };

      vi.spyOn(mockOptimizedClient, 'getMetrics').mockReturnValue(mockMetrics);
      vi.spyOn(mockOptimizedClient, 'getGraphQLCacheStats').mockReturnValue(mockGraphQLStats);

      const result = await cacheHealthCheckTool.handler({});

      expect(result.overallHealth).toBe('healthy');
      expect(result.recommendations[0]).toContain('Cache performance looks good');
      expect(result.summary.restCache.hitRate).toBe(80);
      expect(result.summary.graphqlCache.hitRate).toBe(90);
    });

    it('should detect low hit rate issues', async () => {
      const mockMetrics = {
        cache: { hits: 20, misses: 80, evictions: 5, size: 100 },
      };

      const mockGraphQLStats = {
        general: { hits: 20, misses: 80, size: 50, evictions: 0, queryTypes: {} },
        topQueries: [],
        cacheEfficiency: { overall: 25, byQuery: { BadQuery: 10, GoodQuery: 85 } },
        memorySummary: { entries: 50, estimatedSize: '2.5 MB' },
      };

      vi.spyOn(mockOptimizedClient, 'getMetrics').mockReturnValue(mockMetrics);
      vi.spyOn(mockOptimizedClient, 'getGraphQLCacheStats').mockReturnValue(mockGraphQLStats);

      const result = await cacheHealthCheckTool.handler({});

      expect(result.overallHealth).toBe('warning');
      expect(result.recommendations.some((r: string) => r.includes('hit rate is low'))).toBe(true);
      expect(result.recommendations.some((r: string) => r.includes('BadQuery'))).toBe(true);
    });

    it('should detect high eviction rate', async () => {
      const mockMetrics = {
        cache: { hits: 90, misses: 10, evictions: 15, size: 100 }, // High evictions
      };

      vi.spyOn(mockOptimizedClient, 'getMetrics').mockReturnValue(mockMetrics);
      vi.spyOn(mockOptimizedClient, 'getGraphQLCacheStats').mockReturnValue(null);

      const result = await cacheHealthCheckTool.handler({});

      expect(result.overallHealth).toBe('warning');
      expect(result.recommendations.some((r: string) => r.includes('eviction rate'))).toBe(true);
    });
  });

  describe('warmup_cache tool', () => {
    let warmupCacheTool: any;

    beforeEach(() => {
      warmupCacheTool = tools.find(tool => tool.tool.name === 'warmup_cache');
    });

    it('should warm up cache for specified repositories', async () => {
      const repositories = [
        { owner: 'test1', repo: 'repo1' },
        { owner: 'test2', repo: 'repo2' },
      ];

      const graphqlSpy = vi
        .spyOn(mockOptimizedClient, 'graphql')
        .mockResolvedValue({ repository: { name: 'test' } });

      const result = await warmupCacheTool.handler({
        repositories,
        queryTypes: ['insights', 'contributors'],
      });

      expect(result.warmedQueries).toBe(4); // 2 repos * 2 query types
      expect(result.totalAttempts).toBe(4);
      expect(graphqlSpy).toHaveBeenCalledTimes(4);

      // Verify all results were successful
      expect(result.results.every((r: any) => r.success)).toBe(true);
    });

    it('should handle API errors during warmup', async () => {
      const repositories = [{ owner: 'test', repo: 'repo' }];

      vi.spyOn(mockOptimizedClient, 'graphql')
        .mockResolvedValueOnce({ repository: { name: 'test' } }) // insights success
        .mockRejectedValueOnce(new Error('API Error')); // contributors fail

      const result = await warmupCacheTool.handler({
        repositories,
        queryTypes: ['insights', 'contributors'],
      });

      expect(result.warmedQueries).toBe(1);
      expect(result.totalAttempts).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toBe('API Error');
    });

    it('should return early if no repositories specified', async () => {
      const result = await warmupCacheTool.handler({ repositories: [] });

      expect(result.warmedQueries).toBe(0);
      expect(result.message).toContain('No repositories specified');
    });

    it('should use default query types if not specified', async () => {
      const repositories = [{ owner: 'test', repo: 'repo' }];

      const graphqlSpy = vi
        .spyOn(mockOptimizedClient, 'graphql')
        .mockResolvedValue({ repository: { name: 'test' } });

      const result = await warmupCacheTool.handler({ repositories });

      // Should use default query types: ['insights', 'contributors']
      expect(result.warmedQueries).toBe(2);
      expect(graphqlSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle all supported query types', async () => {
      const repositories = [{ owner: 'test', repo: 'repo' }];
      const queryTypes = ['insights', 'contributors', 'discussions', 'categories'];

      const graphqlSpy = vi
        .spyOn(mockOptimizedClient, 'graphql')
        .mockResolvedValue({ repository: { name: 'test' } });

      const result = await warmupCacheTool.handler({ repositories, queryTypes });

      expect(result.warmedQueries).toBe(4);
      expect(graphqlSpy).toHaveBeenCalledTimes(4);

      // Verify all query types were executed
      const calls = graphqlSpy.mock.calls;
      expect(calls.some(call => call[2]?.operation === 'cache_warmup_insights')).toBe(true);
      expect(calls.some(call => call[2]?.operation === 'cache_warmup_contributors')).toBe(true);
      expect(calls.some(call => call[2]?.operation === 'cache_warmup_discussions')).toBe(true);
      expect(calls.some(call => call[2]?.operation === 'cache_warmup_categories')).toBe(true);
    });
  });

  describe('Input validation', () => {
    it('should have proper input schemas for all tools', () => {
      tools.forEach(tool => {
        expect(tool.tool.inputSchema.type).toBe('object');
        expect(tool.tool.inputSchema.properties).toBeTruthy();
      });
    });

    it('should accept optional parameters correctly', async () => {
      const clearCacheTool = tools.find(tool => tool.tool.name === 'clear_cache');

      // Should work without any parameters
      vi.spyOn(mockOptimizedClient, 'clearAll');
      await expect(clearCacheTool.handler({})).resolves.toBeTruthy();
    });
  });
});
