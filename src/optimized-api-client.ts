/**
 * Optimized API client wrapper with integrated performance optimizations
 * Combines caching, deduplication, performance monitoring, and pagination
 */

import { Octokit } from '@octokit/rest';
import { GitHubAPICache, CACHE_CONFIG } from './cache.js';
import { RequestDeduplicator } from './request-deduplication.js';
import { PerformanceMonitor } from './performance-monitor.js';
import { PaginationHandler } from './pagination-handler.js';

interface OptimizedClientOptions {
  octokit: Octokit;
  enableCache?: boolean;
  enableDeduplication?: boolean;
  enablePerformanceMonitoring?: boolean;
  cacheOptions?: {
    defaultTTL?: number;
    maxSize?: number;
    enableMetrics?: boolean;
  };
}

export class OptimizedAPIClient {
  private octokit: Octokit;
  private cache?: GitHubAPICache;
  private deduplicator?: RequestDeduplicator;
  private performanceMonitor?: PerformanceMonitor;
  private paginationHandler: PaginationHandler;
  private readonly enableCache: boolean;
  private readonly enableDeduplication: boolean;
  private readonly enablePerformanceMonitoring: boolean;

  constructor(options: OptimizedClientOptions) {
    this.octokit = options.octokit;
    this.enableCache = options.enableCache ?? true;
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
  async listWorkflowRuns(
    owner: string,
    repo: string,
    workflowId: string | number,
    options: {
      branch?: string;
      event?: string;
      status?: string;
      maxPages?: number;
    } = {}
  ): Promise<any[]> {
    const { maxPages = 3, ...otherOptions } = options;
    const params = { owner, repo, workflow_id: workflowId, per_page: 100, ...otherOptions };

    // Dynamic data - use shorter cache TTL
    return this.call(
      'actions.listWorkflowRuns',
      params,
      async () => {
        if (maxPages === 1) {
          const { data } = await this.octokit.actions.listWorkflowRuns(params);
          return data.workflow_runs;
        }

        const fetcher = this.paginationHandler.createGitHubFetcher(
          (fetchParams) => this.octokit.actions.listWorkflowRuns(fetchParams),
          { owner, repo, workflow_id: workflowId, ...otherOptions }
        );

        const results = await this.paginationHandler.paginateSmart(fetcher, { maxPages, perPage: 100 });
        return results;
      },
      { cacheTTL: 30 * 1000 } // 30 seconds for dynamic data
    );
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
   * Invalidate cache entries matching pattern
   */
  invalidateCache(pattern: string | RegExp): number {
    if (!this.cache) return 0;
    return this.cache.invalidate(pattern);
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      cache: this.cache?.getMetrics(),
      deduplication: this.deduplicator?.getMetrics(),
      performance: this.performanceMonitor?.getSystemMetrics(),
      aggregatedPerformance: this.performanceMonitor?.getAggregatedMetrics(),
    };
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
   * Clear all caches and metrics
   */
  clearAll(): void {
    this.cache?.clear();
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