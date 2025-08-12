/**
 * Rate limiting implementation for GitHub API calls
 * Handles GitHub's rate limits with exponential backoff and request throttling
 */

import { Octokit } from '@octokit/rest';
import { RateLimitError, withRetry } from './errors.js';
import { estimateGraphQLPoints, isQueryComplexitySafe, githubComplexityCalculator } from './graphql-complexity.js';

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  resource: string;
}

interface GraphQLRateLimitInfo extends RateLimitInfo {
  pointsUsed: number;
  estimatedPointsPerHour: number;
  queryHistory: Array<{
    timestamp: Date;
    points: number;
    query: string;
  }>;
}

interface RequestQueue {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  fn: () => Promise<any>;
  priority: number;
  resource?: string;
  estimatedPoints?: number;
  query?: string;
  variables?: Record<string, any>;
}

export class GitHubRateLimiter {
  private core: RateLimitInfo = { limit: 5000, remaining: 5000, reset: new Date(), resource: 'core' };
  private search: RateLimitInfo = { limit: 30, remaining: 30, reset: new Date(), resource: 'search' };
  private graphql: GraphQLRateLimitInfo = { 
    limit: 5000, 
    remaining: 5000, 
    reset: new Date(), 
    resource: 'graphql',
    pointsUsed: 0,
    estimatedPointsPerHour: 0,
    queryHistory: []
  };
  
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
        // Preserve GraphQL-specific tracking when updating from headers
        const currentGraphQL = this.graphql as GraphQLRateLimitInfo;
        this.graphql = { 
          ...currentGraphQL,
          limit, 
          remaining, 
          reset, 
          resource 
        };
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
   * Update GraphQL point tracking
   */
  private updateGraphQLPoints(points: number, query: string) {
    const now = new Date();
    const graphql = this.graphql as GraphQLRateLimitInfo;
  
    graphql.queryHistory.push({
      timestamp: now,
      points,
      query: query.length > 100 ? query.substring(0, 100) + '...' : query
    });
  
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    graphql.queryHistory = graphql.queryHistory.filter(h => h.timestamp > oneHourAgo);
  
    graphql.pointsUsed += points;
    graphql.estimatedPointsPerHour = graphql.queryHistory.reduce((sum, h) => sum + h.points, 0);
  
    // Do not override server-provided remaining; compute an advisory value instead.
    const estimatedRemaining = Math.max(0, graphql.limit - graphql.estimatedPointsPerHour);
    // Optionally store as a derived property for status reporting without mutating `remaining`
    // (cast to any to avoid changing interface footprint)
    (graphql as any).estimatedRemaining = estimatedRemaining;
  }

  /**
   * Check if we should wait before making a request (with GraphQL point awareness)
   */
  private shouldThrottle(resource: string, estimatedPoints: number = 1): { shouldWait: boolean; waitTime: number; reason?: string } {
    const rateLimitInfo = this.getRateLimitInfo(resource);
    const now = new Date();
    
    // Special handling for GraphQL point-based rate limiting
    if (resource === 'graphql') {
      const graphql = this.graphql as GraphQLRateLimitInfo;
      
      // Check if estimated points would exceed remaining points
      if (estimatedPoints > graphql.remaining) {
        const waitTime = Math.max(0, graphql.reset.getTime() - now.getTime());
        return { 
          shouldWait: true, 
          waitTime, 
          reason: `Query requires ${estimatedPoints} points but only ${graphql.remaining} remaining` 
        };
      }
      
      // Check if we're approaching the hourly limit based on our tracking
      const safetyBuffer = Math.max(100, graphql.limit * 0.1); // 10% safety buffer
      if (graphql.estimatedPointsPerHour + estimatedPoints > graphql.limit - safetyBuffer) {
        const waitTime = Math.max(0, graphql.reset.getTime() - now.getTime());
        return { 
          shouldWait: true, 
          waitTime,
          reason: `Approaching GraphQL rate limit (${graphql.estimatedPointsPerHour + estimatedPoints}/${graphql.limit})` 
        };
      }
    }
    
    // Standard rate limit checks
    if (rateLimitInfo.remaining <= 10) {
      const waitTime = Math.max(0, rateLimitInfo.reset.getTime() - now.getTime());
      return { shouldWait: true, waitTime, reason: 'Rate limit nearly exhausted' };
    }

    // Enforce minimum interval between requests
    const timeSinceLastRequest = now.getTime() - this.lastRequestTime;
    if (timeSinceLastRequest < this.minInterval) {
      return { shouldWait: true, waitTime: this.minInterval - timeSinceLastRequest, reason: 'Minimum interval enforcement' };
    }

    return { shouldWait: false, waitTime: 0 };
  }

  /**
   * Process the request queue (with GraphQL point awareness)
   */
  private async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      // Sort by priority, but consider GraphQL point requirements
      this.requestQueue.sort((a, b) => {
        // Higher priority first
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        // Among equal priority, prefer lower point cost queries
        return (a.estimatedPoints || 1) - (b.estimatedPoints || 1);
      });
      
      const request = this.requestQueue.shift()!;

      try {
        const result = await request.fn();
        request.resolve(result);
        
        // Update GraphQL points if this was a GraphQL request
        if (request.resource === 'graphql' && request.estimatedPoints && request.query) {
          this.updateGraphQLPoints(request.estimatedPoints, request.query);
        }
      } catch (error) {
        request.reject(error as Error);
      }

      // Small delay to prevent overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.isProcessingQueue = false;
  }

  /**
   * Wrap a GraphQL request with point-based rate limiting
   */
  async wrapGraphQLRequest<T>(
    request: () => Promise<T>,
    query: string,
    variables: Record<string, any> = {},
    priority: number = 1
  ): Promise<T> {
    // Calculate query complexity
    const complexity = githubComplexityCalculator.calculateQueryComplexity(query, variables);
    const estimatedPoints = complexity.estimatedPoints;
    
    // Log warnings if query is complex
    if (complexity.warnings.length > 0) {
      console.warn('GraphQL query complexity warnings:', complexity.warnings);
    }

    return new Promise((resolve, reject) => {
      const wrappedRequest = async (): Promise<T> => {
        const throttleCheck = this.shouldThrottle('graphql', estimatedPoints);

        if (throttleCheck.shouldWait && throttleCheck.waitTime > 0) {
          console.log(`GraphQL rate limit throttling: ${throttleCheck.reason}, waiting ${Math.ceil(throttleCheck.waitTime / 1000)}s`);
          await new Promise(resolve => setTimeout(resolve, throttleCheck.waitTime));
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
                console.error(`GraphQL retry attempt ${attempt}:`, error.message);
              }
            }
          );

          // Extract rate limit headers if available
          if (result && typeof result === 'object' && 'headers' in result) {
            this.updateRateLimit((result as any).headers, 'graphql');
          }

          // Update our point tracking
          this.updateGraphQLPoints(estimatedPoints, query);

          return result;
        } catch (error) {
          // If it's a rate limit error, update our tracking
          if (error instanceof RateLimitError && error.resetTime) {
            const graphql = this.graphql as GraphQLRateLimitInfo;
            graphql.remaining = 0;
            graphql.reset = error.resetTime;
          }
          throw error;
        }
      };

      // Add to queue with GraphQL-specific metadata
      this.requestQueue.push({
        resolve,
        reject,
        fn: wrappedRequest,
        priority,
        resource: 'graphql',
        estimatedPoints,
        query,
        variables
      });

      // Process queue
      this.processQueue().catch(reject);
    });
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
        const throttleCheck = this.shouldThrottle(resource);

        if (throttleCheck.shouldWait && throttleCheck.waitTime > 0) {
          if (throttleCheck.reason) {
            console.log(`Rate limit throttling (${resource}): ${throttleCheck.reason}, waiting ${Math.ceil(throttleCheck.waitTime / 1000)}s`);
          }
          await new Promise(resolve => setTimeout(resolve, throttleCheck.waitTime));
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
        priority,
        resource
      });

      // Process queue
      this.processQueue().catch(reject);
    });
  }

  /**
   * Get enhanced rate limit status with GraphQL point tracking
   */
  getStatus(): {
    core: RateLimitInfo;
    search: RateLimitInfo;
    graphql: GraphQLRateLimitInfo;
    queueLength: number;
    graphqlInsights: {
      averagePointsPerQuery: number;
      queriesInLastHour: number;
      topComplexQueries: Array<{ points: number; query: string; timestamp: Date }>;
    };
  } {
    const graphql = this.graphql as GraphQLRateLimitInfo;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentQueries = graphql.queryHistory.filter(h => h.timestamp > oneHourAgo);
    
    return {
      core: { ...this.core },
      search: { ...this.search },
      graphql: { ...graphql },
      queueLength: this.requestQueue.length,
      graphqlInsights: {
        averagePointsPerQuery: recentQueries.length > 0 
          ? Math.round(recentQueries.reduce((sum, q) => sum + q.points, 0) / recentQueries.length)
          : 0,
        queriesInLastHour: recentQueries.length,
        topComplexQueries: [...recentQueries]
          .sort((a, b) => b.points - a.points)
          .slice(0, 5)
          .map(q => ({
            points: q.points,
            query: q.query,
            timestamp: q.timestamp
          }))
      }
    };
  }

  /**
   * Get GraphQL-specific rate limit information
   */
  getGraphQLStatus(): {
    pointsRemaining: number;
    estimatedPointsUsed: number;
    resetTime: Date;
    recommendedDelay: number;
    isApproachingLimit: boolean;
  } {
    const graphql = this.graphql as GraphQLRateLimitInfo;
    const pointsRemaining = Math.max(0, graphql.remaining);
    const isApproachingLimit = pointsRemaining < (graphql.limit * 0.2); // Less than 20% remaining
    
    // Calculate recommended delay based on current usage rate
    let recommendedDelay = 0;
    if (isApproachingLimit && graphql.queryHistory.length > 0) {
      const recentQueries = graphql.queryHistory.slice(-10);
      const avgPointsPerQuery = recentQueries.reduce((sum, q) => sum + q.points, 0) / recentQueries.length;
      const timeToReset = Math.max(0, graphql.reset.getTime() - Date.now());
      recommendedDelay = Math.ceil(timeToReset / Math.max(1, Math.floor(pointsRemaining / avgPointsPerQuery)));
    }

    return {
      pointsRemaining,
      estimatedPointsUsed: graphql.estimatedPointsPerHour,
      resetTime: graphql.reset,
      recommendedDelay,
      isApproachingLimit
    };
  }

  /**
   * Check if a GraphQL query can be safely executed
   */
  canExecuteGraphQLQuery(query: string, variables: Record<string, any> = {}): {
    canExecute: boolean;
    estimatedPoints: number;
    reason?: string;
    waitTime?: number;
  } {
    const complexity = githubComplexityCalculator.calculateQueryComplexity(query, variables);
    const estimatedPoints = complexity.estimatedPoints;
    const throttleCheck = this.shouldThrottle('graphql', estimatedPoints);

    if (throttleCheck.shouldWait) {
      return {
        canExecute: false,
        estimatedPoints,
        reason: throttleCheck.reason,
        waitTime: throttleCheck.waitTime
      };
    }

    return {
      canExecute: true,
      estimatedPoints
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
 * Create a rate-limited Octokit instance with enhanced GraphQL support
 */
export function createRateLimitedOctokit(token: string): {
  octokit: Octokit & {
    graphqlWithComplexity: (query: string, variables?: Record<string, any>) => Promise<any>;
  };
  rateLimiter: GitHubRateLimiter;
} {
  const rateLimiter = new GitHubRateLimiter();
  
  const octokit = new Octokit({
    auth: token,
    request: {
      // Add custom request hook to apply rate limiting
      hook: async (request, options) => {
        // Determine resource type from URL
        let resource = 'core';
        if (options.url?.includes('/search/')) {
          resource = 'search';
        } else if (options.url?.includes('graphql')) {
          resource = 'graphql';
        }

        // For GraphQL requests, extract query from body for complexity analysis
        if (resource === 'graphql' && options.body) {
          let query = '';
          let variables = {};
          
          try {
            const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
            query = body.query || '';
            variables = body.variables || {};
          } catch (e) {
            // Fallback for parsing issues
            console.warn('Could not parse GraphQL request body for complexity analysis');
          }

          if (query) {
            // Use GraphQL-specific rate limiting
            return await rateLimiter.wrapGraphQLRequest(
              () => request(options),
              query,
              variables,
              1 // Default priority
            );
          }
        }

        // Use standard rate limiting for non-GraphQL requests
        return await rateLimiter.wrapRequest(
          () => request(options),
          resource,
          1 // Default priority
        );
      }
    }
  }) as Octokit & {
    graphqlWithComplexity: (query: string, variables?: Record<string, any>) => Promise<any>;
  };

  // Add enhanced GraphQL method with complexity checking
  octokit.graphqlWithComplexity = async (query: string, variables: Record<string, any> = {}) => {
    // Check query safety first
    const safetyCheck = rateLimiter.canExecuteGraphQLQuery(query, variables);
    
    if (!safetyCheck.canExecute) {
      throw new Error(
        `GraphQL query blocked: ${safetyCheck.reason}. ` +
        `Estimated points: ${safetyCheck.estimatedPoints}. ` +
        `Wait time: ${safetyCheck.waitTime ? Math.ceil(safetyCheck.waitTime / 1000) + 's' : 'unknown'}`
      );
    }

    // Execute with enhanced rate limiting
    return await rateLimiter.wrapGraphQLRequest(
      () => octokit.graphql(query, variables),
      query,
      variables,
      1
    );
  };

  return { octokit, rateLimiter };
}