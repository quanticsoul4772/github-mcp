/**
 * Optimized API client wrapper with integrated performance optimizations
 * Combines caching, deduplication, performance monitoring, and pagination
 */

import { Octokit } from '@octokit/rest';
import { GitHubAPICache, CACHE_CONFIG, type CacheMetrics } from './cache.js';
import { GraphQLCache, type GraphQLCacheMetrics } from './graphql-cache.js';
import { RequestDeduplicator, type DeduplicationMetrics } from './request-deduplication.js';
import { PerformanceMonitor, type AggregatedMetrics, type SystemMetrics } from './performance-monitor.js';
import { PaginationHandler } from './pagination-handler.js';

export type { CacheMetrics, DeduplicationMetrics, AggregatedMetrics, SystemMetrics, GraphQLCacheMetrics };

export interface GraphQLDetailedStats {
  general: GraphQLCacheMetrics;
  topQueries: Array<{ query: string; hits: number; misses: number; hitRate: number; avgResponseTime: number }>;
  cacheEfficiency: { overall: number; byQuery: Record<string, number> };
  memorySummary: { entries: number; estimatedSize: string };
}

interface OptimizedClientOptions {
  octokit: Octokit;
  enableCache?: boolean;
  enableGraphQLCache?: boolean;
  enableDeduplication?: boolean;
  enablePerformanceMonitoring?: boolean;
  cacheOptions?: {
    defaultTTL?: number;
    maxSize?: number;
    enableMetrics?: boolean;
  };
  graphqlCacheOptions?: {
    defaultTTL?: number;
    maxSize?: number;
    enableMetrics?: boolean;
  };
}

export class OptimizedAPIClient {
  private octokit: Octokit;
  private cache?: GitHubAPICache;
  private graphqlCache?: GraphQLCache;
  private deduplicator?: RequestDeduplicator;
  private performanceMonitor?: PerformanceMonitor;
  private paginationHandler: PaginationHandler;
  private readonly enableCache: boolean;
  private readonly enableGraphQLCache: boolean;
  private readonly enableDeduplication: boolean;
  private readonly enablePerformanceMonitoring: boolean;

  constructor(options: OptimizedClientOptions) {
    this.octokit = options.octokit;
    this.enableCache = options.enableCache ?? true;
    this.enableGraphQLCache = options.enableGraphQLCache ?? true;
    this.enableDeduplication = options.enableDeduplication ?? true;
    this.enablePerformanceMonitoring = options.enablePerformanceMonitoring ?? true;

    // Initialize optimization components
    if (this.enableCache) {
      this.cache = new GitHubAPICache({
        defaultTTL: 5 * 60 * 1000, // 5 minutes
        maxSize: 1000,
        enableMetrics: true,
        ...options.cacheOptions,
      });
    }

    if (this.enableGraphQLCache) {
      this.graphqlCache = new GraphQLCache({
        defaultTTL: 5 * 60 * 1000, // 5 minutes
        maxSize: 500, // Smaller cache for GraphQL as responses can be larger
        enableMetrics: true,
        ...options.graphqlCacheOptions,
      });
    }

    if (this.enableDeduplication) {
      this.deduplicator = new RequestDeduplicator({
        maxPendingTime: 5 * 1000,
        enableMetrics: true,
      });
    }

    if (this.enablePerformanceMonitoring) {
      this.performanceMonitor = new PerformanceMonitor({
        maxMetrics: 2000,
        thresholds: {
          slowQueryThreshold: 2000,
          highMemoryThreshold: 200 * 1024 * 1024,
          errorRateThreshold: 15,
        },
      });
    }

    this.paginationHandler = new PaginationHandler();
  }

  /**
   * Get the underlying Octokit instance
   */
  getOctokit(): Octokit {
    return this.octokit;
  }

  /**
   * Execute an optimized API call with all performance features
   */
  async call<T>(
    operation: string,
    params: Record<string, any>,
    apiCall: () => Promise<T>,
    options: {
      cacheTTL?: number;
      skipCache?: boolean;
      skipDeduplication?: boolean;
    } = {}
  ): Promise<T> {
    const executor = async (): Promise<T> => {
      // Apply request deduplication if enabled
      if (this.enableDeduplication && !options.skipDeduplication && this.deduplicator) {
        return this.deduplicator.deduplicate(operation, params, apiCall);
      }
      
      return apiCall();
    };

    const cachedExecutor = async (): Promise<T> => {
      // Apply caching if enabled
      if (this.enableCache && !options.skipCache && this.cache) {
        const cacheTTL = options.cacheTTL ?? CACHE_CONFIG[operation as keyof typeof CACHE_CONFIG] ?? 5 * 60 * 1000;
        
        // Skip caching for write operations
        if (cacheTTL === 0) {
          return executor();
        }
        
        return this.cache.get(operation, params, executor, cacheTTL);
      }
      
      return executor();
    };

    // Apply performance monitoring if enabled
    if (this.enablePerformanceMonitoring && this.performanceMonitor) {
      return this.performanceMonitor.measure(operation, cachedExecutor);
    }

    return cachedExecutor();
  }

  /**
   * Optimized repository file content retrieval
   */
  async getFileContents(
    owner: string,
    repo: string,
    path: string = '',
    ref?: string
  ): Promise<any> {
    return this.call(
      'repos.getContent',
      { owner, repo, path, ref },
      async () => {
        const { data } = await this.octokit.repos.getContent({
          owner,
          repo,
          path,
          ref,
        });
        return data;
      }
    );
  }

  /**
   * Optimized repository information retrieval
   */
  async getRepository(owner: string, repo: string): Promise<any> {
    return this.call(
      'repos.get',
      { owner, repo },
      async () => {
        const { data } = await this.octokit.repos.get({ owner, repo });
        return data;
      }
    );
  }

  /**
   * Optimized user information retrieval
   */
  async getUser(username?: string): Promise<any> {
    const operation = username ? 'users.get' : 'users.getAuthenticated';
    const params = username ? { username } : {};
    
    return this.call(
      operation,
      params,
      async () => {
        if (username) {
          const { data } = await this.octokit.users.getByUsername({ username });
          return data;
        } else {
          const { data } = await this.octokit.users.getAuthenticated();
          return data;
        }
      }
    );
  }

  /**
   * Optimized issue listing with smart pagination
   */
  async listIssues(
    owner: string,
    repo: string,
    options: {
      state?: 'open' | 'closed' | 'all';
      maxPages?: number;
      perPage?: number;
      labels?: string;
      assignee?: string;
      since?: string;
    } = {}
  ): Promise<any[]> {
    const { state = 'open', maxPages = 5, perPage = 100, ...otherOptions } = options;
    const params = { owner, repo, state, per_page: perPage, ...otherOptions };
    
    // For single page requests, use optimized call
    if (maxPages === 1) {
      return this.call(
        'issues.listForRepo',
        params,
        async () => {
          const { data } = await this.octokit.issues.listForRepo(params);
          return data;
        }
      );
    }

    // For multi-page requests, use smart pagination without caching individual pages
    const fetcher = this.paginationHandler.createGitHubFetcher(
      (fetchParams) => this.octokit.issues.listForRepo(fetchParams),
      { owner, repo, state, ...otherOptions }
    );

    return this.paginationHandler.paginateSmart(fetcher, { maxPages, perPage });
  }

  /**
   * Optimized pull request listing with smart pagination
   */
  async listPullRequests(
    owner: string,
    repo: string,
    options: {
      state?: 'open' | 'closed' | 'all';
      maxPages?: number;
      perPage?: number;
      sort?: 'created' | 'updated' | 'popularity';
      direction?: 'asc' | 'desc';
    } = {}
  ): Promise<any[]> {
    const { state = 'open', maxPages = 5, perPage = 100, ...otherOptions } = options;
    
    // For single page requests, use optimized call
    if (maxPages === 1) {
      const params = { owner, repo, state, per_page: perPage, ...otherOptions };
      return this.call(
        'pulls.list',
        params,
        async () => {
          const { data } = await this.octokit.pulls.list(params);
          return data;
        }
      );
    }

    // For multi-page requests, use smart pagination
    const fetcher = this.paginationHandler.createGitHubFetcher(
      (params) => this.octokit.pulls.list(params),
      { owner, repo, state, ...otherOptions }
    );

    return this.paginationHandler.paginateSmart(fetcher, { maxPages, perPage });
  }

  /**
   * Optimized branch listing
   */
  async listBranches(owner: string, repo: string, maxPages: number = 3): Promise<any[]> {
    const params = { owner, repo, per_page: 100 };
    
    if (maxPages === 1) {
      return this.call(
        'repos.listBranches',
        params,
        async () => {
          const { data } = await this.octokit.repos.listBranches(params);
          return data;
        }
      );
    }

    const fetcher = this.paginationHandler.createGitHubFetcher(
      (fetchParams) => this.octokit.repos.listBranches(fetchParams),
      { owner, repo }
    );

    return this.paginationHandler.paginateSmart(fetcher, { maxPages, perPage: 100 });
  }

  /**
   * Optimized workflow runs listing
   */
  async listWorkflowRuns(params: any): Promise<{ data: unknown[]; headers?: any; }> {
    const fetchParams = {
      owner: params.owner,
      repo: params.repo,
      workflow_id: params.workflow_id,
      actor: params.actor,
      branch: params.branch,
      event: params.event,
      status: params.status as any,
      created: params.created,
      exclude_pull_requests: params.exclude_pull_requests,
      check_suite_id: params.check_suite_id,
      head_sha: params.head_sha,
      per_page: params.per_page || 30,
      page: params.page || 1
    };
    
    const response = await this.octokit.actions.listWorkflowRuns(fetchParams);
    return { data: response.data.workflow_runs, headers: response.headers };
  }

  /**
   * Batch operations for multiple API calls
   */
  async batchCall<T>(
    calls: Array<{
      operation: string;
      params: Record<string, any>;
      apiCall: () => Promise<T>;
      options?: { cacheTTL?: number; skipCache?: boolean };
    }>,
    concurrency: number = 5
  ): Promise<Array<{ success: boolean; data?: T; error?: Error; operation: string }>> {
    const { batchExecute } = await import('./batch-operations.js');
    
    return batchExecute(
      calls,
      async (call) => {
        return this.call(call.operation, call.params, call.apiCall, call.options);
      },
      { concurrency }
    ).then(results => 
      results.map(result => ({
        ...result,
        operation: result.input.operation,
      }))
    );
  }

  /**
   * Execute an optimized GraphQL query with caching and performance monitoring
   */
  async graphql<T>(
    query: string,
    variables: Record<string, any> = {},
    options: {
      ttl?: number;
      skipCache?: boolean;
      skipDeduplication?: boolean;
      operation?: string;
    } = {}
  ): Promise<T> {
    const fetcher = async (): Promise<T> => {
      const sortedVars = Object.keys(variables || {})
        .sort()
        .reduce((acc, k) => { acc[k] = (variables as any)[k]; return acc; }, {} as Record<string, any>);
      const dedupeKey = `graphql:${this.hashQuery(query)}:${JSON.stringify(sortedVars)}`;
      if (this.enableDeduplication && !options.skipDeduplication && this.deduplicator) {
        const deduplicatedCall = async () => this.octokit.graphql(query, variables) as Promise<T>;
        return this.deduplicator.deduplicate(dedupeKey, sortedVars, deduplicatedCall);
      }
      
      return this.octokit.graphql(query, variables) as Promise<T>;
    };

    // Use GraphQL cache if enabled
    if (this.enableGraphQLCache && !options.skipCache && this.graphqlCache) {
      const cachedExecutor = async (): Promise<T> => {
        return this.graphqlCache!.get(
          query,
          variables,
          fetcher,
          {
            ttl: options.ttl,
            skipCache: options.skipCache,
            operation: options.operation,
          }
        );
      };

      // Apply performance monitoring if enabled
      if (this.enablePerformanceMonitoring && this.performanceMonitor) {
        const operationName = options.operation || 'graphql';
        return this.performanceMonitor.measure(operationName, cachedExecutor);
      }

      return cachedExecutor();
    }

    // Apply performance monitoring if enabled (fallback)
    if (this.enablePerformanceMonitoring && this.performanceMonitor) {
      const operationName = options.operation || 'graphql';
      return this.performanceMonitor.measure(operationName, fetcher);
    }

    return fetcher();
  }

  /**
   * Invalidate GraphQL cache after mutations
   */
  invalidateGraphQLCacheForMutation(mutation: string, variables: Record<string, any> = {}): number {
    if (!this.graphqlCache) return 0;
    return this.graphqlCache.invalidateForMutation(mutation, variables);
  }

  /**
   * Simple hash function for query deduplication
   */
  private hashQuery(query: string): string {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    let hash = 0;
    
    for (let i = 0; i < normalizedQuery.length; i++) {
      const char = normalizedQuery.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return hash.toString(36);
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidateCache(pattern: string | RegExp): number {
    if (!this.cache) return 0;
    return this.cache.invalidate(pattern);
  }

  /**
   * Invalidate GraphQL cache entries matching pattern
   */
  invalidateGraphQLCache(pattern: string | RegExp): number {
    if (!this.graphqlCache) return 0;
    return this.graphqlCache.invalidate(pattern);
  }

  /**
   * Get performance metrics
   */
  getMetrics(): any {
    return {
      cache: this.cache?.getMetrics(),
      graphqlCache: this.graphqlCache?.getMetrics(),
      deduplication: this.deduplicator?.getMetrics(),
      performance: this.performanceMonitor?.getSystemMetrics(),
      aggregatedPerformance: this.performanceMonitor?.getAggregatedMetrics(),
    };
  }

  /**
   * Get comprehensive GraphQL cache statistics
   */
  getGraphQLCacheStats(): GraphQLDetailedStats | null {
    return this.graphqlCache?.getDetailedStats() || null;
  }

  /**
   * Generate performance report
   */
  getPerformanceReport(): string {
    if (!this.performanceMonitor) {
      return 'Performance monitoring is disabled';
    }
    
    return this.performanceMonitor.generateReport();
  }

  /**
   * Clear cache only
   */
  clearCache(): void {
    this.cache?.clear();
  }

  /**
   * Clear all caches and metrics
   */
  clearAll(): void {
    this.cache?.clear();
    this.graphqlCache?.clear();
    this.deduplicator?.clear();
    this.performanceMonitor?.clear();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.deduplicator?.destroy();
    this.clearAll();
  }

  /**
   * Get the underlying Octokit instance for direct access if needed
   */
  getRawClient(): Octokit {
    return this.octokit;
  }
}