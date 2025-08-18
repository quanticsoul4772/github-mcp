/**
 * Enhanced GraphQL Response Caching System
 * Provides intelligent caching for GraphQL queries with configurable TTL
 * and cache invalidation strategies
 */

import { GitHubAPICache } from './cache.js';

interface GraphQLCacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  queryHash: string;
  variables: Record<string, any>;
  query?: string; // Store original query for invalidation matching
}

interface GraphQLCacheOptions {
  defaultTTL?: number;
  maxSize?: number;
  enableMetrics?: boolean;
}

export interface GraphQLCacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  queryTypes: Record<string, { hits: number; misses: number; avgResponseTime: number }>;
}

/**
 * GraphQL-specific cache configuration with optimized TTL values
 * Based on data volatility and usage patterns
 */
export const GRAPHQL_CACHE_CONFIG = {
  // Repository insights - data changes infrequently
  get_repository_insights: 60 * 60 * 1000, // 1 hour
  repository: 60 * 60 * 1000, // 1 hour

  // Contributor statistics - can be cached for longer periods
  get_contribution_stats: 6 * 60 * 60 * 1000, // 6 hours
  collaborators: 6 * 60 * 60 * 1000, // 6 hours

  // Language statistics - rarely change
  languages: 4 * 60 * 60 * 1000, // 4 hours

  // Commit activity - changes frequently but patterns are stable
  get_commit_activity: 30 * 60 * 1000, // 30 minutes
  commit_history: 30 * 60 * 1000, // 30 minutes

  // Search results - short-lived cache for pagination
  search_discussions: 15 * 60 * 1000, // 15 minutes
  search: 15 * 60 * 1000, // 15 minutes

  // Discussion categories - structure rarely changes
  list_discussion_categories: 2 * 60 * 60 * 1000, // 2 hours
  discussionCategories: 2 * 60 * 60 * 1000, // 2 hours

  // Discussion lists - moderate caching
  list_discussions: 30 * 60 * 1000, // 30 minutes
  discussions: 30 * 60 * 1000, // 30 minutes

  // Individual discussions - can cache for reasonable time
  get_discussion: 30 * 60 * 1000, // 30 minutes
  discussion: 30 * 60 * 1000, // 30 minutes

  // Discussion comments - moderate volatility
  get_discussion_comments: 15 * 60 * 1000, // 15 minutes
  discussion_comments: 15 * 60 * 1000, // 15 minutes

  // Project management - structure changes infrequently
  projects: 30 * 60 * 1000, // 30 minutes
  milestones: 30 * 60 * 1000, // 30 minutes

  // Batch operations - depends on query type
  batch_issues: 15 * 60 * 1000, // 15 minutes
  batch_repositories: 60 * 60 * 1000, // 1 hour

  // Default for unknown queries
  default: 5 * 60 * 1000, // 5 minutes
};

export class GraphQLCache {
  private cache: Map<string, GraphQLCacheEntry<any>>;
  private readonly defaultTTL: number;
  private readonly maxSize: number;
  private readonly enableMetrics: boolean;
  private metrics: GraphQLCacheMetrics;
  private accessOrder: string[]; // For LRU eviction

  constructor(options: GraphQLCacheOptions = {}) {
    this.cache = new Map();
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize || 1000;
    this.enableMetrics = options.enableMetrics ?? true;
    this.accessOrder = [];
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      queryTypes: {},
    };
  }

  /**
   * Generate cache key from GraphQL query and variables
   * Uses query hash and sorted variables for consistent keys
   */
  private generateKey(query: string, variables: Record<string, any> = {}): string {
    // Extract query name/operation for better key identification
    const queryName = this.extractQueryName(query) || 'unknown';

    // Create a deterministic hash of the query
    const queryHash = this.hashQuery(query);

    // Sort variables to ensure consistent key generation
    const sortedVariables = Object.keys(variables)
      .sort()
      .reduce(
        (acc, key) => {
          if (variables[key] !== undefined && variables[key] !== null) {
            acc[key] = variables[key];
          }
          return acc;
        },
        {} as Record<string, any>
      );

    return `gql:${queryName}:${queryHash}:${JSON.stringify(sortedVariables)}`;
  }

  /**
   * Extract query name from GraphQL query string
   */
  private extractQueryName(query: string): string | null {
    // Only extract explicit operation names: "query Name" or "mutation Name"
    const opMatch = query.match(/^\s*(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/i);
    if (opMatch && opMatch[1]) {
      return opMatch[1];
    }
    return null;
  }

  /**
   * Simple hash function for GraphQL queries
   */
  private hashQuery(query: string): string {
    // Remove whitespace and normalize query for consistent hashing
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    let hash = 0;

    for (let i = 0; i < normalizedQuery.length; i++) {
      const char = normalizedQuery.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return hash.toString(36);
  }

  /**
   * Determine appropriate TTL for a GraphQL query
   */
  private getTTLForQuery(query: string, customTTL?: number): number {
    if (customTTL !== undefined) {
      return customTTL;
    }

    const queryName = this.extractQueryName(query);
    if (queryName) {
      // Check for exact matches first
      if (GRAPHQL_CACHE_CONFIG[queryName as keyof typeof GRAPHQL_CACHE_CONFIG]) {
        return GRAPHQL_CACHE_CONFIG[queryName as keyof typeof GRAPHQL_CACHE_CONFIG];
      }

      // Check for partial matches in query content
      for (const [key, ttl] of Object.entries(GRAPHQL_CACHE_CONFIG)) {
        if (
          query.toLowerCase().includes(key.toLowerCase()) ||
          queryName.toLowerCase().includes(key.toLowerCase())
        ) {
          return ttl;
        }
      }
    }

    return GRAPHQL_CACHE_CONFIG.default;
  }

  /**
   * Get data from cache or execute GraphQL query
   */
  async get<T>(
    query: string,
    variables: Record<string, any> = {},
    fetcher: () => Promise<T>,
    options: {
      ttl?: number;
      skipCache?: boolean;
      operation?: string;
    } = {}
  ): Promise<T> {
    const key = this.generateKey(query, variables);
    const queryName = this.extractQueryName(query) || options.operation || 'unknown';
    const startTime = Date.now();

    // Initialize metrics for this query type
    if (this.enableMetrics && !this.metrics.queryTypes[queryName]) {
      this.metrics.queryTypes[queryName] = {
        hits: 0,
        misses: 0,
        avgResponseTime: 0,
      };
    }

    // Skip cache if requested
    if (options.skipCache) {
      return this.executeAndCache(
        key,
        query,
        variables,
        fetcher,
        options.ttl,
        queryName,
        startTime
      );
    }

    const entry = this.cache.get(key);

    // Check if entry exists and is still valid
    if (entry && this.isValid(entry)) {
      this.updateAccessOrder(key);
      if (this.enableMetrics) {
        this.metrics.hits++;
        this.metrics.queryTypes[queryName].hits++;
      }
      return entry.data as T;
    }

    // Cache miss - fetch and cache data
    return this.executeAndCache(key, query, variables, fetcher, options.ttl, queryName, startTime);
  }

  /**
   * Execute fetcher and cache the result
   */
  private async executeAndCache<T>(
    key: string,
    query: string,
    variables: Record<string, any>,
    fetcher: () => Promise<T>,
    customTTL?: number,
    queryName?: string,
    startTime?: number
  ): Promise<T> {
    const actualStartTime = startTime || Date.now();

    if (this.enableMetrics) {
      this.metrics.misses++;
      if (queryName && this.metrics.queryTypes[queryName]) {
        this.metrics.queryTypes[queryName].misses++;
      }
    }

    try {
      const data = await fetcher();
      const responseTime = Date.now() - actualStartTime;

      // Update average response time
      if (this.enableMetrics && queryName && this.metrics.queryTypes[queryName]) {
        const queryMetrics = this.metrics.queryTypes[queryName];
        const totalRequests = queryMetrics.hits + queryMetrics.misses;
        queryMetrics.avgResponseTime =
          (queryMetrics.avgResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
      }

      // Cache the successful result
      const ttl = this.getTTLForQuery(query, customTTL);
      this.set(key, data, ttl, query, variables);

      return data;
    } catch (error) {
      // On error, return stale data if available (graceful degradation)
      const entry = this.cache.get(key);
      if (entry) {
        console.warn('GraphQL query failed, returning stale cached data:', error);
        return entry.data as T;
      }
      throw error;
    }
  }

  /**
   * Set data in cache
   */
  private set<T>(
    key: string,
    data: T,
    ttl: number,
    query: string,
    variables: Record<string, any>
  ): void {
    // Check if we need to evict entries
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const queryHash = this.hashQuery(query);

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      queryHash,
      variables,
      query,
    });

    this.updateAccessOrder(key);
    if (this.enableMetrics) {
      this.metrics.size = this.cache.size;
    }
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid(entry: GraphQLCacheEntry<any>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length > 0) {
      const keyToEvict = this.accessOrder.shift()!;
      this.cache.delete(keyToEvict);
      if (this.enableMetrics) {
        this.metrics.evictions++;
        this.metrics.size = this.cache.size;
      }
    }
  }

  /**
   * Invalidate cache entries based on write operations
   * Uses intelligent patterns to invalidate related cached data
   */
  invalidateForMutation(mutation: string, variables: Record<string, any> = {}): number {
    let count = 0;
    const op = this.extractQueryName(mutation)?.toLowerCase() || '';
    const affectedOps: Record<string, true> = {};

    // Map common mutations to affected query operation prefixes
    const opMap: Record<string, string[]> = {
      create_discussion: [
        'list_discussions',
        'get_discussion',
        'discussion',
        'discussion_comments',
      ],
      creatediscussion: [
        'list_discussions',
        'get_discussion',
        'getdiscussion',
        'discussion',
        'discussion_comments',
      ],
      add_discussion_comment: ['get_discussion', 'discussion_comments'],
      update_discussion: ['get_discussion', 'discussion', 'discussion_comments'],
      delete_discussion: ['list_discussions', 'get_discussion', 'discussion'],
      create_issue: ['issues', 'repository'],
      update_issue: ['issues'],
      create_pull_request: ['pull', 'repository'],
      update_pull_request: ['pull'],
    };

    (opMap[op] || []).forEach(name => (affectedOps[name] = true));

    const repoPattern =
      variables.owner && variables.repo
        ? new RegExp(`${variables.owner}\\W+${variables.repo}`, 'i')
        : null;

    for (const key of this.cache.keys()) {
      // key format: gql:${queryName}:${hash}:${sortedVariables}
      const parts = key.split(':');
      const keyOp = parts[1]?.toLowerCase();
      const entry = this.cache.get(key);
      let invalidate = false;

      if (keyOp && affectedOps[keyOp]) {
        invalidate = true;
      } else if (repoPattern && repoPattern.test(key)) {
        invalidate = true;
      } else if (entry?.query) {
        // Check if the actual query contains related keywords
        const queryLower = entry.query.toLowerCase();
        for (const affectedOp of Object.keys(affectedOps)) {
          if (queryLower.includes(affectedOp)) {
            invalidate = true;
            break;
          }
        }
      }

      if (invalidate) {
        this.cache.delete(key);
        const idx = this.accessOrder.indexOf(key);
        if (idx > -1) this.accessOrder.splice(idx, 1);
        count++;
      }
    }

    if (this.enableMetrics) {
      this.metrics.size = this.cache.size;
    }

    return count;
  }

  /**
   * Clear specific cache entry
   */
  delete(query: string, variables: Record<string, any> = {}): boolean {
    const key = this.generateKey(query, variables);
    const result = this.cache.delete(key);

    if (result) {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      if (this.enableMetrics) {
        this.metrics.size = this.cache.size;
      }
    }

    return result;
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidate(pattern: string | RegExp): number {
    let count = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      const entry = this.cache.get(key);
      // Check both the key and the actual query text
      if (regex.test(key) || (entry?.query && regex.test(entry.query))) {
        this.cache.delete(key);
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
          this.accessOrder.splice(index, 1);
        }
        count++;
      }
    }

    if (this.enableMetrics) {
      this.metrics.size = this.cache.size;
    }

    return count;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    if (this.enableMetrics) {
      this.metrics.size = 0;
      // Reset query type metrics
      for (const queryType in this.metrics.queryTypes) {
        this.metrics.queryTypes[queryType] = { hits: 0, misses: 0, avgResponseTime: 0 };
      }
    }
  }

  /**
   * Get comprehensive cache metrics
   */
  getMetrics(): GraphQLCacheMetrics {
    return {
      ...this.metrics,
      queryTypes: { ...this.metrics.queryTypes },
    };
  }

  /**
   * Get detailed cache statistics
   */
  getDetailedStats(): {
    general: GraphQLCacheMetrics;
    topQueries: Array<{
      query: string;
      hits: number;
      misses: number;
      hitRate: number;
      avgResponseTime: number;
    }>;
    cacheEfficiency: { overall: number; byQuery: Record<string, number> };
    memorySummary: { entries: number; estimatedSize: string };
  } {
    const metrics = this.getMetrics();

    // Calculate top performing queries
    const topQueries = Object.entries(metrics.queryTypes)
      .map(([query, stats]) => ({
        query,
        hits: stats.hits,
        misses: stats.misses,
        hitRate:
          stats.hits + stats.misses > 0 ? (stats.hits / (stats.hits + stats.misses)) * 100 : 0,
        avgResponseTime: stats.avgResponseTime,
      }))
      .sort((a, b) => b.hits + b.misses - (a.hits + a.misses))
      .slice(0, 10);

    // Calculate cache efficiency
    const overallHitRate =
      metrics.hits + metrics.misses > 0
        ? (metrics.hits / (metrics.hits + metrics.misses)) * 100
        : 0;

    const efficiencyByQuery = Object.entries(metrics.queryTypes).reduce(
      (acc, [query, stats]) => {
        const total = stats.hits + stats.misses;
        acc[query] = total > 0 ? (stats.hits / total) * 100 : 0;
        return acc;
      },
      {} as Record<string, number>
    );

    // Estimate memory usage (rough calculation)
    const estimatedSize = this.cache.size * 1024; // Rough estimate: 1KB per entry
    const sizeStr =
      estimatedSize > 1024 * 1024
        ? `${(estimatedSize / (1024 * 1024)).toFixed(2)} MB`
        : `${(estimatedSize / 1024).toFixed(2)} KB`;

    return {
      general: metrics,
      topQueries,
      cacheEfficiency: {
        overall: overallHitRate,
        byQuery: efficiencyByQuery,
      },
      memorySummary: {
        entries: this.cache.size,
        estimatedSize: sizeStr,
      },
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.cache.delete(key);
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
          this.accessOrder.splice(index, 1);
        }
        removed++;
      }
    }

    if (this.enableMetrics) {
      this.metrics.size = this.cache.size;
    }

    return removed;
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}
