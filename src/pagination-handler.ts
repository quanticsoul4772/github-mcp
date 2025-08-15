/**
 * Advanced pagination handling for GitHub API responses
 * Provides efficient data streaming and automatic pagination
 */

import { logger } from './logger.js';

interface PaginationOptions {
  perPage?: number;
  maxPages?: number;
  maxItems?: number;
  concurrent?: boolean;
  concurrency?: number;
  onProgress?: (current: number, total?: number) => void;
}

interface PaginatedResponse<T> {
  data: T[];
  hasNext: boolean;
  nextPage?: number;
  totalCount?: number;
  rateLimit?: {
    remaining: number;
    resetAt: Date;
  };
}

export class PaginationHandler {
  private readonly defaultPerPage: number = 100;
  private readonly defaultMaxPages: number = 10;
  private readonly defaultConcurrency: number = 3;

  /**
   * Auto-paginate through all results using async generator
   */
  async *paginateAll<T>(
    fetcher: (page: number, perPage: number) => Promise<PaginatedResponse<T>>,
    options: PaginationOptions = {}
  ): AsyncGenerator<T, void, unknown> {
    const {
      perPage = this.defaultPerPage,
      maxPages = this.defaultMaxPages,
      maxItems,
      onProgress,
    } = options;

    let page = 1;
    let totalYielded = 0;
    let hasNext = true;

    while (hasNext && page <= maxPages) {
      if (maxItems && totalYielded >= maxItems) {
        break;
      }

      try {
        const response = await fetcher(page, perPage);
        
        for (const item of response.data) {
          if (maxItems && totalYielded >= maxItems) {
            return;
          }
          
          yield item;
          totalYielded++;
        }

        hasNext = response.hasNext;
        page++;

        if (onProgress) {
          onProgress(totalYielded, response.totalCount);
        }

        // Respect rate limiting with capped backoff
        if (response.rateLimit && response.rateLimit.remaining < 100) {
          const untilResetMs = Math.max(0, response.rateLimit.resetAt.getTime() - Date.now());
          // Cap backoff to a reasonable upper limit (e.g., 5 seconds) to avoid stalling
          const backoffMs = Math.min(untilResetMs, 5000);
          if (backoffMs > 0) {
            logger.warn(`Rate limit low (${response.rateLimit.remaining}), backing off for ${backoffMs}ms`, { remaining: response.rateLimit.remaining, backoffMs });
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        }
      } catch (error) {
        logger.error(`Error fetching page ${page}`, { page }, error instanceof Error ? error : new Error(String(error)));
        break;
      }
    }
  }

  /**
   * Collect all paginated results into an array
   */
  async collectAll<T>(
    fetcher: (page: number, perPage: number) => Promise<PaginatedResponse<T>>,
    options: PaginationOptions = {}
  ): Promise<T[]> {
    const results: T[] = [];
    
    for await (const item of this.paginateAll(fetcher, options)) {
      results.push(item);
    }
    
    return results;
  }

  /**
   * Concurrent pagination - fetch multiple pages in parallel
   */
  async paginateConcurrent<T>(
    fetcher: (page: number, perPage: number) => Promise<PaginatedResponse<T>>,
    options: PaginationOptions = {}
  ): Promise<T[]> {
    const {
      perPage = this.defaultPerPage,
      maxPages = this.defaultMaxPages,
      concurrency = this.defaultConcurrency,
      onProgress,
    } = options;

    // First, get the first page to determine total pages
    const firstPage = await fetcher(1, perPage);
    if (!firstPage.data.length) {
      return [];
    }

    const results: T[] = [...firstPage.data];
    if (!firstPage.hasNext || maxPages === 1) {
      return results;
    }

    // Calculate remaining pages to fetch
    const remainingPages = Math.min(maxPages - 1, firstPage.totalCount ? 
      Math.ceil(firstPage.totalCount / perPage) - 1 : maxPages - 1);

    if (remainingPages <= 0) {
      return results;
    }

    // Create batches of pages to fetch concurrently
    const pagesToFetch = Array.from({ length: remainingPages }, (_, i) => i + 2);
    const batches: number[][] = [];
    
    for (let i = 0; i < pagesToFetch.length; i += concurrency) {
      batches.push(pagesToFetch.slice(i, i + concurrency));
    }

    // Fetch each batch concurrently
    for (const batch of batches) {
      const batchPromises = batch.map(page => 
        fetcher(page, perPage).catch(error => {
          logger.error(`Error fetching page ${page}`, { page }, error);
          return { data: [], hasNext: false };
        })
      );

      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        results.push(...result.data);
      }

      if (onProgress) {
        onProgress(results.length, firstPage.totalCount);
      }

      // Add small delay between batches to avoid overwhelming the API
      if (batch !== batches[batches.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Smart pagination - automatically choose best strategy
   */
  async paginateSmart<T>(
    fetcher: (page: number, perPage: number) => Promise<PaginatedResponse<T>>,
    options: PaginationOptions = {}
  ): Promise<T[]> {
    const {
      maxPages = this.defaultMaxPages,
      concurrent = true,
    } = options;

    // Use concurrent pagination for smaller datasets
    if (concurrent && maxPages <= 10) {
      return this.paginateConcurrent(fetcher, options);
    }

    // Use streaming pagination for larger datasets
    return this.collectAll(fetcher, options);
  }

  /**
   * Create a GitHub API-compatible fetcher function
   */
  createGitHubFetcher<T>(
    apiCall: (params: any) => Promise<{ data: T[]; headers?: any }>,
    baseParams: Record<string, any> = {}
  ): (page: number, perPage: number) => Promise<PaginatedResponse<T>> {
    return async (page: number, perPage: number): Promise<PaginatedResponse<T>> => {
      const params = {
        ...baseParams,
        page,
        per_page: perPage,
      };

      const response = await apiCall(params);
      const data = response.data;
      const headers = response.headers || {};

      // Parse GitHub pagination headers
      const linkHeader = headers.link || '';
      const hasNext = linkHeader.includes('rel="next"');
      
      // Try to extract total count from headers if available
      const totalCountHeader = headers['x-total-count'];
      const totalCount = totalCountHeader ? parseInt(totalCountHeader, 10) : undefined;

      // Parse rate limit headers
      let rateLimit;
      if (headers['x-ratelimit-remaining'] && headers['x-ratelimit-reset']) {
        rateLimit = {
          remaining: parseInt(headers['x-ratelimit-remaining'], 10),
          resetAt: new Date(parseInt(headers['x-ratelimit-reset'], 10) * 1000),
        };
      }

      return {
        data,
        hasNext,
        nextPage: hasNext ? page + 1 : undefined,
        totalCount,
        rateLimit,
      };
    };
  }

  /**
   * Batch process paginated results with processing function
   */
  async processBatched<TInput, TOutput>(
    fetcher: (page: number, perPage: number) => Promise<PaginatedResponse<TInput>>,
    processor: (items: TInput[]) => Promise<TOutput[]> | TOutput[],
    options: PaginationOptions & { batchSize?: number } = {}
  ): Promise<TOutput[]> {
    const { batchSize = 50 } = options;
    const results: TOutput[] = [];
    const batch: TInput[] = [];

    for await (const item of this.paginateAll(fetcher, options)) {
      batch.push(item);

      if (batch.length >= batchSize) {
        const processed = await processor([...batch]);
        results.push(...processed);
        batch.length = 0; // Clear batch
      }
    }

    // Process remaining items
    if (batch.length > 0) {
      const processed = await processor(batch);
      results.push(...processed);
    }

    return results;
  }

  /**
   * Create a cached paginated fetcher
   */
  createCachedFetcher<T>(
    originalFetcher: (page: number, perPage: number) => Promise<PaginatedResponse<T>>,
    cache: Map<string, { data: PaginatedResponse<T>; timestamp: number }>,
    ttl: number = 5 * 60 * 1000 // 5 minutes
  ): (page: number, perPage: number) => Promise<PaginatedResponse<T>> {
    return async (page: number, perPage: number): Promise<PaginatedResponse<T>> => {
      const key = `${page}:${perPage}`;
      const cached = cache.get(key);
      
      if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data;
      }

      const data = await originalFetcher(page, perPage);
      cache.set(key, { data, timestamp: Date.now() });
      
      return data;
    };
  }
}

/**
 * Global pagination handler instance
 */
export const globalPaginationHandler = new PaginationHandler();

/**
 * Utility functions for common GitHub API pagination patterns
 */
export const GitHubPaginationUtils = {
  /**
   * Paginate through repository issues
   */
  async getAllIssues(
    octokit: any,
    owner: string,
    repo: string,
    options: PaginationOptions & { state?: 'open' | 'closed' | 'all' } = {}
  ) {
    const { state = 'open', ...paginationOptions } = options;
    const fetcher = globalPaginationHandler.createGitHubFetcher(
      (params) => octokit.issues.listForRepo(params),
      { owner, repo, state }
    );
    
    return globalPaginationHandler.paginateSmart(fetcher, paginationOptions);
  },

  /**
   * Paginate through repository pull requests
   */
  async getAllPullRequests(
    octokit: any,
    owner: string,
    repo: string,
    options: PaginationOptions & { state?: 'open' | 'closed' | 'all' } = {}
  ) {
    const { state = 'open', ...paginationOptions } = options;
    const fetcher = globalPaginationHandler.createGitHubFetcher(
      (params) => octokit.pulls.list(params),
      { owner, repo, state }
    );
    
    return globalPaginationHandler.paginateSmart(fetcher, paginationOptions);
  },

  /**
   * Paginate through repository commits
   */
  async getAllCommits(
    octokit: any,
    owner: string,
    repo: string,
    options: PaginationOptions & { sha?: string; since?: string; until?: string } = {}
  ) {
    const { sha, since, until, ...paginationOptions } = options;
    const fetcher = globalPaginationHandler.createGitHubFetcher(
      (params) => octokit.repos.listCommits(params),
      { owner, repo, sha, since, until }
    );
    
    return globalPaginationHandler.paginateSmart(fetcher, paginationOptions);
  },
};
