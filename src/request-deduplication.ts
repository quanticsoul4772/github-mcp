/**
 * Request deduplication system
 * Prevents duplicate API calls by batching identical requests
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

interface RequestOptions {
  maxPendingTime?: number; // Maximum time to keep pending requests (ms)
  enableMetrics?: boolean;
}

interface DeduplicationMetrics {
  totalRequests: number;
  deduplicatedRequests: number;
  pendingRequests: number;
}

export class RequestDeduplicator {
  private pendingRequests: Map<string, PendingRequest<any>>;
  private metrics: DeduplicationMetrics;
  private readonly maxPendingTime: number;
  private readonly enableMetrics: boolean;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(options: RequestOptions = {}) {
    this.pendingRequests = new Map();
    this.maxPendingTime = options.maxPendingTime || 5 * 1000; // 5 seconds default
    this.enableMetrics = options.enableMetrics || false;
    this.metrics = {
      totalRequests: 0,
      deduplicatedRequests: 0,
      pendingRequests: 0,
    };

    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.maxPendingTime);
  }

  /**
   * Generate a unique key for the request
   */
  private generateKey(operation: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        if (params[key] !== undefined && params[key] !== null) {
          acc[key] = params[key];
        }
        return acc;
      }, {} as Record<string, any>);
    
    return `${operation}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Execute request with deduplication
   */
  async deduplicate<T>(
    operation: string,
    params: Record<string, any>,
    executor: () => Promise<T>
  ): Promise<T> {
    const key = this.generateKey(operation, params);

    if (this.enableMetrics) {
      this.metrics.totalRequests++;
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(key);
    if (pending) {
      if (this.enableMetrics) {
        this.metrics.deduplicatedRequests++;
      }
      return pending.promise as Promise<T>;
    }

    // Execute new request
    const promise = executor().finally(() => {
      // Remove from pending requests when completed
      this.pendingRequests.delete(key);
      if (this.enableMetrics) {
        this.metrics.pendingRequests = this.pendingRequests.size;
      }
    });

    // Store pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    });

    if (this.enableMetrics) {
      this.metrics.pendingRequests = this.pendingRequests.size;
    }

    return promise;
  }

  /**
   * Clean up expired pending requests
   */
  private cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.maxPendingTime) {
        expired.push(key);
      }
    }

    for (const key of expired) {
      this.pendingRequests.delete(key);
    }

    if (this.enableMetrics) {
      this.metrics.pendingRequests = this.pendingRequests.size;
    }
  }

  /**
   * Get deduplication metrics
   */
  getMetrics(): DeduplicationMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pendingRequests.clear();
    if (this.enableMetrics) {
      this.metrics.pendingRequests = 0;
    }
  }

  /**
   * Get current pending request count
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

/**
 * Global request deduplicator instance
 */
export const globalDeduplicator = new RequestDeduplicator({
  maxPendingTime: 5 * 1000, // 5 seconds
  enableMetrics: true,
});