/**
 * Cache Management and Statistics Tools
 * Provides comprehensive cache monitoring, management, and debugging capabilities
 */

import { ToolConfig } from '../types.js';
import { OptimizedAPIClient } from '../optimized-api-client.js';

export function createCacheManagementTools(optimizedClient: OptimizedAPIClient): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // Get comprehensive cache metrics tool
  tools.push({
    tool: {
      name: 'get_cache_metrics',
      description: 'Get comprehensive cache performance metrics and statistics',
      inputSchema: {
        type: 'object',
        properties: {
          includeDetails: {
            type: 'boolean',
            description: 'Include detailed per-query statistics',
            default: false,
          },
        },
      },
    },
    handler: async (args: unknown) => {
      const params = args as { includeDetails?: boolean };
      const metrics = optimizedClient.getMetrics();

      const result: any = {
        timestamp: new Date().toISOString(),
        rest_cache: metrics.cache,
        graphql_cache: metrics.graphqlCache,
        deduplication: metrics.deduplication,
        performance: metrics.performance,
      };

      // Add detailed GraphQL cache statistics if requested
      if (params.includeDetails) {
        const graphqlStats = optimizedClient.getGraphQLCacheStats();
        if (graphqlStats) {
          result.graphql_cache_details = graphqlStats;
        }
      }

      return result;
    },
  });

  // Get GraphQL cache statistics tool
  tools.push({
    tool: {
      name: 'get_graphql_cache_stats',
      description: 'Get detailed GraphQL cache statistics and performance analysis',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    handler: async () => {
      const stats = optimizedClient.getGraphQLCacheStats();

      if (!stats) {
        return {
          message: 'GraphQL caching is not enabled or no statistics available',
          enabled: false,
        };
      }

      return {
        enabled: true,
        timestamp: new Date().toISOString(),
        ...stats,
      };
    },
  });

  // Clear cache tool
  tools.push({
    tool: {
      name: 'clear_cache',
      description: 'Clear all caches or specific cache types',
      inputSchema: {
        type: 'object',
        properties: {
          cacheType: {
            type: 'string',
            description: 'Type of cache to clear',
            enum: ['all', 'rest', 'graphql'],
            default: 'all',
          },
          pattern: {
            type: 'string',
            description: 'Optional regex pattern to match cache keys for selective clearing',
          },
        },
      },
    },
    handler: async (args: unknown) => {
      const params = args as { cacheType?: string; pattern?: string };
      const cacheType = params.cacheType || 'all';
      let clearedEntries = 0;

      if (params.pattern) {
        const pattern = new RegExp(params.pattern, 'i');

        if (cacheType === 'all' || cacheType === 'rest') {
          clearedEntries += optimizedClient.invalidateCache(pattern);
        }

        if (cacheType === 'all' || cacheType === 'graphql') {
          clearedEntries += optimizedClient.invalidateGraphQLCache(pattern);
        }

        return {
          message: `Cleared ${clearedEntries} cache entries matching pattern: ${params.pattern}`,
          cacheType,
          pattern: params.pattern,
          clearedEntries,
        };
      } else {
        // Clear all caches
        if (cacheType === 'all') {
          optimizedClient.clearAll();
          return {
            message: 'All caches cleared successfully',
            cacheType: 'all',
          };
        } else if (cacheType === 'rest') {
          optimizedClient.invalidateCache(/.*/);
          return {
            message: 'REST API cache cleared successfully',
            cacheType: 'rest',
          };
        } else if (cacheType === 'graphql') {
          optimizedClient.invalidateGraphQLCache(/.*/);
          return {
            message: 'GraphQL cache cleared successfully',
            cacheType: 'graphql',
          };
        }
      }

      // Default return if no conditions match
      return {
        message: 'No cache cleared',
        cacheType,
      };
    },
  });

  // Cache health check tool
  tools.push({
    tool: {
      name: 'cache_health_check',
      description: 'Perform cache health check and return recommendations',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    handler: async () => {
      const metrics = optimizedClient.getMetrics();
      const graphqlStats = optimizedClient.getGraphQLCacheStats();

      const recommendations: string[] = [];
      let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';

      // Analyze REST cache
      if (metrics.cache) {
        const restHitRate =
          metrics.cache.hits + metrics.cache.misses > 0
            ? (metrics.cache.hits / (metrics.cache.hits + metrics.cache.misses)) * 100
            : 0;

        if (restHitRate < 30) {
          overallHealth = 'warning';
          recommendations.push(
            'REST cache hit rate is low (<30%). Consider adjusting TTL values or cache size.'
          );
        }

        if (metrics.cache.evictions > metrics.cache.hits * 0.1) {
          overallHealth = 'warning';
          recommendations.push('High eviction rate detected. Consider increasing cache size.');
        }
      }

      // Analyze GraphQL cache
      if (graphqlStats && graphqlStats.general) {
        const graphqlHitRate = graphqlStats.cacheEfficiency.overall;

        if (graphqlHitRate < 40) {
          overallHealth = 'warning';
          recommendations.push(
            'GraphQL cache hit rate is low (<40%). Review query patterns and TTL configuration.'
          );
        }

        // Check for queries with very low hit rates
        const lowHitRateQueries = Object.entries(graphqlStats.cacheEfficiency.byQuery)
          .filter(([, hitRate]) => (hitRate as number) < 20)
          .map(([query]) => query);

        if (lowHitRateQueries.length > 0) {
          recommendations.push(`Queries with low hit rates: ${lowHitRateQueries.join(', ')}`);
        }
      }

      if (recommendations.length === 0) {
        recommendations.push('Cache performance looks good! No immediate optimizations needed.');
      }

      return {
        timestamp: new Date().toISOString(),
        overallHealth,
        recommendations,
        summary: {
          restCache: metrics.cache
            ? {
                hitRate:
                  metrics.cache.hits + metrics.cache.misses > 0
                    ? Math.round(
                        (metrics.cache.hits / (metrics.cache.hits + metrics.cache.misses)) * 100
                      )
                    : 0,
                size: metrics.cache.size,
                evictions: metrics.cache.evictions,
              }
            : null,
          graphqlCache: graphqlStats
            ? {
                hitRate: Math.round(graphqlStats.cacheEfficiency.overall),
                size: graphqlStats.memorySummary.entries,
                estimatedMemory: graphqlStats.memorySummary.estimatedSize,
              }
            : null,
        },
      };
    },
  });

  // Cache warmup tool
  tools.push({
    tool: {
      name: 'warmup_cache',
      description: 'Warm up cache with common queries for better performance',
      inputSchema: {
        type: 'object',
        properties: {
          repositories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                owner: { type: 'string' },
                repo: { type: 'string' },
              },
              required: ['owner', 'repo'],
            },
            description: 'List of repositories to warm up cache for',
          },
          queryTypes: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['insights', 'contributors', 'discussions', 'categories'],
            },
            description: 'Types of queries to warm up',
            default: ['insights', 'contributors'],
          },
        },
      },
    },
    handler: async (args: unknown) => {
      const params = args as {
        repositories?: Array<{ owner: string; repo: string }>;
        queryTypes?: string[];
      };
      if (!params.repositories || params.repositories.length === 0) {
        return {
          message: 'No repositories specified for cache warmup',
          warmedQueries: 0,
        };
      }

      const queryTypes = params.queryTypes || ['insights', 'contributors'];
      let warmedQueries = 0;
      const results: Array<{ repo: string; queryType: string; success: boolean; error?: string }> =
        [];

      for (const { owner, repo } of params.repositories) {
        for (const queryType of queryTypes) {
          try {
            switch (queryType) {
              case 'insights':
                await optimizedClient.graphql(
                  `
                  query GetRepositoryInsights($owner: String!, $repo: String!) {
                    repository(owner: $owner, name: $repo) {
                      name stargazerCount forkCount
                      watchers { totalCount }
                      issues { totalCount }
                      pullRequests { totalCount }
                      languages(first: 5, orderBy: {field: SIZE, direction: DESC}) {
                        edges { size node { name } }
                      }
                    }
                  }
                `,
                  { owner, repo },
                  { operation: 'cache_warmup_insights' }
                );
                break;

              case 'contributors':
                await optimizedClient.graphql(
                  `
                  query GetContributorStats($owner: String!, $repo: String!) {
                    repository(owner: $owner, name: $repo) {
                      collaborators(first: 10, affiliation: ALL) {
                        totalCount
                        nodes { login name }
                      }
                    }
                  }
                `,
                  { owner, repo },
                  { operation: 'cache_warmup_contributors' }
                );
                break;

              case 'discussions':
                await optimizedClient.graphql(
                  `
                  query ListDiscussions($owner: String!, $repo: String!) {
                    repository(owner: $owner, name: $repo) {
                      discussions(first: 10) {
                        totalCount
                        nodes { id title }
                      }
                    }
                  }
                `,
                  { owner, repo },
                  { operation: 'cache_warmup_discussions' }
                );
                break;

              case 'categories':
                await optimizedClient.graphql(
                  `
                  query ListDiscussionCategories($owner: String!, $repo: String!) {
                    repository(owner: $owner, name: $repo) {
                      discussionCategories(first: 10) {
                        nodes { id name }
                      }
                    }
                  }
                `,
                  { owner, repo },
                  { operation: 'cache_warmup_categories' }
                );
                break;
            }

            results.push({ repo: `${owner}/${repo}`, queryType, success: true });
            warmedQueries++;
          } catch (error: any) {
            results.push({
              repo: `${owner}/${repo}`,
              queryType,
              success: false,
              error: error.message,
            });
          }
        }
      }

      return {
        message: `Cache warmup completed. Warmed ${warmedQueries} queries.`,
        warmedQueries,
        totalAttempts: params.repositories.length * queryTypes.length,
        results,
      };
    },
  });

  return tools;
}
