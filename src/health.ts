/**
 * Health check and monitoring endpoints for GitHub MCP Server
 * 
 * Provides health, readiness, metrics, and status endpoints
 * for monitoring and observability.
 */

import { metrics } from './metrics.js';
import { logger } from './logger.js';
import { Octokit } from '@octokit/rest';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
}

export interface ReadinessStatus {
  ready: boolean;
  timestamp: string;
  checks: {
    github: {
      status: 'ok' | 'error';
      message?: string;
      responseTime?: number;
    };
    memory: {
      status: 'ok' | 'warning' | 'critical';
      usage: NodeJS.MemoryUsage;
      usagePercent: number;
    };
    rateLimit: {
      status: 'ok' | 'warning' | 'critical';
      remaining: number;
      resetTime: number;
    };
  };
}

export interface DetailedStatus {
  health: HealthStatus;
  readiness: ReadinessStatus;
  metrics: {
    apiCalls: ReturnType<typeof metrics.getApiCallStats>;
    errors: ReturnType<typeof metrics.getErrorStats>;
    memory: NodeJS.MemoryUsage;
    rateLimit: ReturnType<typeof metrics.getRateLimitStatus>;
  };
  server: {
    name: string;
    version: string;
    uptime: number;
    startTime: string;
    nodeVersion: string;
    platform: string;
    arch: string;
  };
}

/**
 * Health monitoring service
 */
export class HealthMonitor {
  private static instance: HealthMonitor;
  private startTime: number;
  private readonly serverName: string;
  private readonly serverVersion: string;
  private octokit?: Octokit;

  private constructor() {
    this.startTime = Date.now();
    this.serverName = 'github-mcp';
    this.serverVersion = '1.0.0';
  }

  public static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  /**
   * Set the Octokit instance for GitHub API checks
   */
  public setOctokit(octokit: Octokit): void {
    this.octokit = octokit;
  }

  /**
   * Get basic health status
   */
  public async getHealth(): Promise<HealthStatus> {
    const uptime = Date.now() - this.startTime;
    const memory = process.memoryUsage();
    
    // Determine health status based on memory usage and error rates
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    // Check memory usage (warn at 80%, critical at 90%)
    const memoryUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;
    if (memoryUsagePercent > 90) {
      status = 'unhealthy';
    } else if (memoryUsagePercent > 80) {
      status = 'degraded';
    }

    // Check error rates
    const errorStats = metrics.getErrorStats();
    const apiStats = metrics.getApiCallStats();
    if (apiStats.total > 0 && apiStats.successRate < 0.9) {
      status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime / 1000),
      version: this.serverVersion,
    };
  }

  /**
   * Check if the service is ready to handle requests
   */
  public async getReadiness(): Promise<ReadinessStatus> {
    const timestamp = new Date().toISOString();
    const checks = {
      github: await this.checkGitHubAPI(),
      memory: this.checkMemoryUsage(),
      rateLimit: this.checkRateLimit(),
    };

    const ready = Object.values(checks).every(check => 
      check.status === 'ok' || check.status === 'warning'
    );

    return {
      ready,
      timestamp,
      checks,
    };
  }

  /**
   * Get detailed server status
   */
  public async getDetailedStatus(): Promise<DetailedStatus> {
    const [health, readiness] = await Promise.all([
      this.getHealth(),
      this.getReadiness(),
    ]);

    return {
      health,
      readiness,
      metrics: {
        apiCalls: metrics.getApiCallStats(),
        errors: metrics.getErrorStats(),
        memory: process.memoryUsage(),
        rateLimit: metrics.getRateLimitStatus(),
      },
      server: {
        name: this.serverName,
        version: this.serverVersion,
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        startTime: new Date(this.startTime).toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };
  }

  /**
   * Get Prometheus metrics
   */
  public getMetrics(): string {
    return metrics.exportPrometheusMetrics();
  }

  /**
   * Check GitHub API connectivity and rate limits
   */
  private async checkGitHubAPI(): Promise<ReadinessStatus['checks']['github']> {
    if (!this.octokit) {
      return {
        status: 'error',
        message: 'GitHub client not initialized',
      };
    }

    try {
      const startTime = Date.now();
      const response = await this.octokit.rest.meta.get();
      const responseTime = Date.now() - startTime;

      // Update rate limit metrics
      const rateLimit = response.headers['x-ratelimit-remaining'];
      const rateLimitReset = response.headers['x-ratelimit-reset'];
      
      if (rateLimit) {
        metrics.setGauge('github_rate_limit_remaining', parseInt(rateLimit));
      }
      if (rateLimitReset) {
        metrics.setGauge('github_rate_limit_reset_timestamp', parseInt(rateLimitReset));
      }

      return {
        status: 'ok',
        responseTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('GitHub API health check failed', { error: errorMessage }, error instanceof Error ? error : undefined);
      
      return {
        status: 'error',
        message: errorMessage,
      };
    }
  }

  /**
   * Check memory usage levels
   */
  private checkMemoryUsage(): ReadinessStatus['checks']['memory'] {
    const memory = process.memoryUsage();
    const usagePercent = (memory.heapUsed / memory.heapTotal) * 100;
    
    let status: 'ok' | 'warning' | 'critical';
    if (usagePercent > 90) {
      status = 'critical';
    } else if (usagePercent > 80) {
      status = 'warning';
    } else {
      status = 'ok';
    }

    return {
      status,
      usage: memory,
      usagePercent,
    };
  }

  /**
   * Check GitHub API rate limit status
   */
  private checkRateLimit(): ReadinessStatus['checks']['rateLimit'] {
    const rateLimit = metrics.getRateLimitStatus();
    
    let status: 'ok' | 'warning' | 'critical';
    if (rateLimit.remaining < 100) {
      status = 'critical';
    } else if (rateLimit.remaining < 500) {
      status = 'warning';
    } else {
      status = 'ok';
    }

    return {
      status,
      remaining: rateLimit.remaining,
      resetTime: rateLimit.resetTimeRemaining,
    };
  }

  /**
   * Start health monitoring alerts
   */
  public startMonitoring(): void {
    // Check health every minute
    setInterval(async () => {
      try {
        const health = await this.getHealth();
        
        if (health.status === 'unhealthy') {
          logger.error('Health check failed - server unhealthy', {
            status: health.status,
            uptime: health.uptime,
          });
        } else if (health.status === 'degraded') {
          logger.warn('Health check warning - server degraded', {
            status: health.status,
            uptime: health.uptime,
          });
        }

        const readiness = await this.getReadiness();
        if (!readiness.ready) {
          logger.error('Readiness check failed', {
            checks: readiness.checks,
          });
        }

        // Check for high error rates
        const errorStats = metrics.getErrorStats();
        const apiStats = metrics.getApiCallStats();
        
        if (apiStats.total > 10 && apiStats.successRate < 0.8) {
          logger.error('High error rate detected', {
            successRate: apiStats.successRate,
            totalCalls: apiStats.total,
            errorCount: apiStats.failed,
          });
        }

        // Check rate limit warnings
        const rateLimit = metrics.getRateLimitStatus();
        if (rateLimit.remaining < 100) {
          logger.warn('GitHub rate limit running low', {
            remaining: rateLimit.remaining,
            resetTimeRemaining: rateLimit.resetTimeRemaining,
          });
        }

      } catch (error) {
        logger.error('Health monitoring check failed', {}, error instanceof Error ? error : undefined);
      }
    }, 60 * 1000); // Every minute

    logger.info('Health monitoring started');
  }
}

// Export singleton instance
export const healthMonitor = HealthMonitor.getInstance();