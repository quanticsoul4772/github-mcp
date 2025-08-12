/**
 * Rate limiting implementation for GitHub API calls
 * Handles GitHub's rate limits with exponential backoff and request throttling
 */

import { Octokit } from '@octokit/rest';
import { RateLimitError, withRetry } from './errors.js';

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  resource: string;
}

interface RequestQueue {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  fn: () => Promise<any>;
  priority: number;
}

export class GitHubRateLimiter {
  private core: RateLimitInfo = { limit: 5000, remaining: 5000, reset: new Date(), resource: 'core' };
  private search: RateLimitInfo = { limit: 30, remaining: 30, reset: new Date(), resource: 'search' };
  private graphql: RateLimitInfo = { limit: 5000, remaining: 5000, reset: new Date(), resource: 'graphql' };
  
  private requestQueue: RequestQueue[] = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private minInterval = 100; // Minimum time between requests in ms

  /**
   * Update rate limit information from response headers
   */
  private updateRateLimit(headers: any, resource: string = 'core') {
    const limit = parseInt(headers['x-ratelimit-limit'] || '5000');
    const remaining = parseInt(headers['x-ratelimit-remaining'] || '5000');
    const reset = new Date(parseInt(headers['x-ratelimit-reset'] || '0') * 1000);

    switch (resource) {
      case 'search':
        this.search = { limit, remaining, reset, resource };
        break;
      case 'graphql':
        this.graphql = { limit, remaining, reset, resource };
        break;
      default:
        this.core = { limit, remaining, reset, resource };
    }
  }

  /**
   * Get rate limit info for a resource
   */
  private getRateLimitInfo(resource: string): RateLimitInfo {
    switch (resource) {
      case 'search':
        return this.search;
      case 'graphql':
        return this.graphql;
      default:
        return this.core;
    }
  }

  /**
   * Check if we should wait before making a request
   */
  private shouldThrottle(resource: string): { shouldWait: boolean; waitTime: number } {
    const rateLimitInfo = this.getRateLimitInfo(resource);
    const now = new Date();
    
    // If we're close to the rate limit, calculate wait time
    if (rateLimitInfo.remaining <= 10) {
      const waitTime = Math.max(0, rateLimitInfo.reset.getTime() - now.getTime());
      return { shouldWait: true, waitTime };
    }

    // Enforce minimum interval between requests
    const timeSinceLastRequest = now.getTime() - this.lastRequestTime;
    if (timeSinceLastRequest < this.minInterval) {
      return { shouldWait: true, waitTime: this.minInterval - timeSinceLastRequest };
    }

    return { shouldWait: false, waitTime: 0 };
  }

  /**
   * Process the request queue
   */
  private async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      // Sort by priority (higher number = higher priority)
      this.requestQueue.sort((a, b) => b.priority - a.priority);
      const request = this.requestQueue.shift()!;

      try {
        const result = await request.fn();
        request.resolve(result);
      } catch (error) {
        request.reject(error as Error);
      }

      // Small delay to prevent overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.isProcessingQueue = false;
  }

  /**
   * Wrap an Octokit request with rate limiting
   */
  async wrapRequest<T>(
    request: () => Promise<T>,
    resource: string = 'core',
    priority: number = 1
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedRequest = async (): Promise<T> => {
        const { shouldWait, waitTime } = this.shouldThrottle(resource);

        if (shouldWait && waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        try {
          this.lastRequestTime = Date.now();
          const result = await withRetry(
            request,
            {
              maxAttempts: 3,
              backoffMs: 1000,
              maxBackoffMs: 30000,
              onRetry: (attempt, error) => {
                console.error(`Retry attempt ${attempt} for GitHub API request:`, error.message);
              }
            }
          );

          // Extract rate limit headers if available
          if (result && typeof result === 'object' && 'headers' in result) {
            this.updateRateLimit((result as any).headers, resource);
          }

          return result;
        } catch (error) {
          // If it's a rate limit error, update our tracking
          if (error instanceof RateLimitError && error.resetTime) {
            const rateLimitInfo = this.getRateLimitInfo(resource);
            rateLimitInfo.remaining = 0;
            rateLimitInfo.reset = error.resetTime;
          }
          throw error;
        }
      };

      // Add to queue
      this.requestQueue.push({
        resolve,
        reject,
        fn: wrappedRequest,
        priority
      });

      // Process queue
      this.processQueue().catch(reject);
    });
  }

  /**
   * Get current rate limit status
   */
  getStatus(): {
    core: RateLimitInfo;
    search: RateLimitInfo;
    graphql: RateLimitInfo;
    queueLength: number;
  } {
    return {
      core: { ...this.core },
      search: { ...this.search },
      graphql: { ...this.graphql },
      queueLength: this.requestQueue.length
    };
  }

  /**
   * Wait for rate limit to reset
   */
  async waitForReset(resource: string = 'core'): Promise<void> {
    const rateLimitInfo = this.getRateLimitInfo(resource);
    const now = new Date();
    const waitTime = Math.max(0, rateLimitInfo.reset.getTime() - now.getTime());
    
    if (waitTime > 0) {
      console.log(`Waiting ${Math.ceil(waitTime / 1000)}s for ${resource} rate limit to reset`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

/**
 * Response size limiter
 */
export class ResponseSizeLimiter {
  private static readonly DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly DEFAULT_MAX_ITEMS = 1000; // Maximum items in array responses

  static limitResponseSize<T>(
    data: T,
    maxSizeBytes: number = ResponseSizeLimiter.DEFAULT_MAX_SIZE,
    maxItems: number = ResponseSizeLimiter.DEFAULT_MAX_ITEMS
  ): { data: T; truncated: boolean; originalSize?: number } {
    try {
      // Handle array responses
      if (Array.isArray(data)) {
        let truncated = false;
        let limitedData = data;

        // Limit number of items
        if (data.length > maxItems) {
          limitedData = data.slice(0, maxItems) as T;
          truncated = true;
        }

        // Check total size
        const jsonString = JSON.stringify(limitedData);
        const sizeBytes = Buffer.byteLength(jsonString, 'utf8');

        if (sizeBytes > maxSizeBytes) {
          // Binary search for the right number of items to fit within size limit
          let low = 0;
          let high = Array.isArray(limitedData) ? limitedData.length : maxItems;
          let bestFit = [];

          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const subset = Array.isArray(limitedData) ? limitedData.slice(0, mid) : [];
            const subsetSize = Buffer.byteLength(JSON.stringify(subset), 'utf8');

            if (subsetSize <= maxSizeBytes) {
              bestFit = subset;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }

          return {
            data: bestFit as T,
            truncated: true,
            originalSize: sizeBytes
          };
        }

        return {
          data: limitedData,
          truncated,
          originalSize: sizeBytes
        };
      }

      // Handle object responses
      const jsonString = JSON.stringify(data);
      const sizeBytes = Buffer.byteLength(jsonString, 'utf8');

      if (sizeBytes > maxSizeBytes) {
        // For objects, we'll truncate string fields that are too large
        const truncatedData = ResponseSizeLimiter.truncateObjectStrings(data, maxSizeBytes);
        return {
          data: truncatedData,
          truncated: true,
          originalSize: sizeBytes
        };
      }

      return {
        data,
        truncated: false,
        originalSize: sizeBytes
      };
    } catch (error) {
      console.error('Error limiting response size:', error);
      return { data, truncated: false };
    }
  }

  private static truncateObjectStrings<T>(obj: T, maxSize: number): T {
    const MAX_STRING_LENGTH = 1000; // Maximum length for individual string fields
    
    function truncateRecursive(value: any): any {
      if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
        return value.substring(0, MAX_STRING_LENGTH) + '... [truncated]';
      } else if (Array.isArray(value)) {
        return value.map(truncateRecursive);
      } else if (typeof value === 'object' && value !== null) {
        const result: any = {};
        for (const [key, val] of Object.entries(value)) {
          result[key] = truncateRecursive(val);
        }
        return result;
      }
      return value;
    }

    return truncateRecursive(obj);
  }
}

/**
 * Create a rate-limited Octokit instance
 */
export function createRateLimitedOctokit(token: string): {
  octokit: Octokit;
  rateLimiter: GitHubRateLimiter;
} {
  const rateLimiter = new GitHubRateLimiter();
  
  const octokit = new Octokit({
    auth: token,
    request: {
      // Add custom request hook to apply rate limiting
      hook: async (request: any, options: any) => {
        // Determine resource type from URL
        let resource = 'core';
        if (options.url?.includes('/search/')) {
          resource = 'search';
        } else if (options.url?.includes('graphql')) {
          resource = 'graphql';
        }

        // Wrap the request with rate limiting
        return await rateLimiter.wrapRequest(
          () => request(options),
          resource,
          1 // Default priority
        );
      }
    }
  });

  return { octokit, rateLimiter };
}