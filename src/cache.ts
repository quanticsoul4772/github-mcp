/**
 * Cache implementation for GitHub API responses
 * Reduces API calls and improves performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheOptions {
  defaultTTL?: number; // Default time-to-live in milliseconds
  maxSize?: number; // Maximum number of entries in cache
  enableMetrics?: boolean; // Track cache hits/misses
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

export class GitHubAPICache {
  private cache: Map<string, CacheEntry<any>>;
  private readonly defaultTTL: number;
  private readonly maxSize: number;
  private readonly enableMetrics: boolean;
  private metrics: CacheMetrics;
  private accessOrder: string[]; // For LRU eviction

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize || 1000;
    this.enableMetrics = options.enableMetrics || false;
    this.accessOrder = [];
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
    };
  }

  /**
   * Generate cache key from operation and parameters
   */
  private generateKey(operation: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce(
        (acc, key) => {
          if (params[key] !== undefined && params[key] !== null) {
            acc[key] = params[key];
          }
          return acc;
        },
        {} as Record<string, any>
      );

    return `${operation}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Get data from cache or fetch using provided function
   */
  async get<T>(
    operation: string,
    params: Record<string, any>,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const key = this.generateKey(operation, params);
    const entry = this.cache.get(key);

    // Check if entry exists and is still valid
    if (entry && this.isValid(entry)) {
      this.updateAccessOrder(key);
      if (this.enableMetrics) {
        this.metrics.hits++;
      }
      return entry.data as T;
    }

    // Cache miss - fetch data
    if (this.enableMetrics) {
      this.metrics.misses++;
    }

    try {
      const data = await fetcher();
      this.set(key, data, ttl || this.defaultTTL);
      return data;
    } catch (error) {
      // On error, return stale data if available
      if (entry) {
        return entry.data as T;
      }
      throw error;
    }
  }

  /**
   * Set data in cache
   */
  private set<T>(key: string, data: T, ttl: number): void {
    // Check if we need to evict entries
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    this.updateAccessOrder(key);
    if (this.enableMetrics) {
      this.metrics.size = this.cache.size;
    }
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid(entry: CacheEntry<any>): boolean {
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
   * Invalidate cache entries matching a pattern
   */
  invalidate(pattern: string | RegExp): number {
    let count = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
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
   * Clear specific cache entry
   */
  delete(operation: string, params: Record<string, any>): boolean {
    const key = this.generateKey(operation, params);
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
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    if (this.enableMetrics) {
      this.metrics.size = 0;
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
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
}

/**
 * Cache configuration for different GitHub operations
 */
export const CACHE_CONFIG = {
  // Repository data - cache for 10 minutes
  'repos.get': 10 * 60 * 1000,
  'repos.listBranches': 5 * 60 * 1000,
  'repos.listTags': 10 * 60 * 1000,

  // User data - cache for 30 minutes
  'users.get': 30 * 60 * 1000,
  'users.getAuthenticated': 30 * 60 * 1000,

  // Organization data - cache for 15 minutes
  'orgs.get': 15 * 60 * 1000,
  'orgs.listMembers': 10 * 60 * 1000,

  // File contents - cache for 5 minutes
  'repos.getContent': 5 * 60 * 1000,

  // Don't cache write operations or dynamic data
  'issues.create': 0,
  'pulls.create': 0,
  'repos.createOrUpdateFileContents': 0,
  'actions.listWorkflowRuns': 30 * 1000, // 30 seconds for dynamic data
};
