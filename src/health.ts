/**
 * Health check and monitoring utilities for GitHub MCP Server
 */

import { Octokit } from '@octokit/rest';
import { GitHubMCPError } from './errors.js';
import { ReliabilityManager } from './reliability.js';

/**
 * Health status levels
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Individual component health check result
 */
export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  metadata?: Record<string, any>;
  lastChecked: string;
  responseTime?: number;
}

/**
 * Overall system health result
 */
export interface SystemHealth {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  components: ComponentHealth[];
  reliability?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Health check manager
 */
export class HealthManager {
  private startTime: Date = new Date();
  private lastGitHubCheck?: ComponentHealth;

  constructor(
    private octokit: Octokit,
    private reliabilityManager?: ReliabilityManager
  ) {}

  /**
   * Perform comprehensive health check
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const components: ComponentHealth[] = [];

    // Check GitHub API connectivity
    const githubHealth = await this.checkGitHubAPI();
    components.push(githubHealth);

    // Check rate limiting status
    const rateLimitHealth = await this.checkRateLimit();
    components.push(rateLimitHealth);

    // Determine overall status
    const overallStatus = this.determineOverallStatus(components);

    const health: SystemHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime.getTime(),
      components,
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        pid: process.pid,
      },
    };

    // Add reliability information if available
    if (this.reliabilityManager) {
      health.reliability = this.reliabilityManager.getHealthStatus();
    }

    return health;
  }

  /**
   * Quick health check (lightweight)
   */
  async getQuickHealth(): Promise<{ status: HealthStatus; timestamp: string; uptime: number }> {
    // Use cached GitHub check if recent (< 30 seconds old)
    const now = new Date();
    const useCache =
      this.lastGitHubCheck &&
      now.getTime() - new Date(this.lastGitHubCheck.lastChecked).getTime() < 30000;

    let status: HealthStatus = 'healthy';

    if (!useCache) {
      const githubHealth = await this.checkGitHubAPI();
      if (githubHealth.status !== 'healthy') {
        status = githubHealth.status;
      }
    } else if (this.lastGitHubCheck!.status !== 'healthy') {
      status = this.lastGitHubCheck!.status;
    }

    return {
      status,
      timestamp: now.toISOString(),
      uptime: now.getTime() - this.startTime.getTime(),
    };
  }

  /**
   * Check GitHub API connectivity and authentication
   */
  private async checkGitHubAPI(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      // Simple API call to check connectivity and auth
      await this.octokit.rest.users.getAuthenticated();

      const responseTime = Date.now() - startTime;
      const health: ComponentHealth = {
        name: 'github_api',
        status: 'healthy',
        message: 'GitHub API is accessible and authenticated',
        lastChecked: new Date().toISOString(),
        responseTime,
      };

      this.lastGitHubCheck = health;
      return health;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      let status: HealthStatus = 'unhealthy';
      let message = 'GitHub API is not accessible';

      if (error instanceof Error) {
        const githubError = error as any;
        const statusCode = typeof githubError?.status === 'number' ? githubError.status : undefined;
        if (statusCode === 401) {
          message = 'GitHub API authentication failed';
        } else if (statusCode === 403) {
          message = 'GitHub API access forbidden';
          status = 'degraded'; // Might be rate limited but API is up
        } else if (statusCode !== undefined && statusCode >= 500) {
          message = 'GitHub API server error';
        } else {
          message = `GitHub API error: ${error.message}`;
        }
      }

      const health: ComponentHealth = {
        name: 'github_api',
        status,
        message,
        lastChecked: new Date().toISOString(),
        responseTime,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          statusCode: (error as any)?.status,
        },
      };

      this.lastGitHubCheck = health;
      return health;
    }
  }

  /**
   * Check GitHub API rate limiting status
   */
  private async checkRateLimit(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const response = await this.octokit.rest.rateLimit.get();
      const responseTime = Date.now() - startTime;

      const core = response.data.rate;
      const remaining = core.remaining;
      const limit = core.limit;
      const resetTime = new Date(core.reset * 1000);

      let status: HealthStatus = 'healthy';
      let message = `Rate limit: ${remaining}/${limit} remaining`;

      if (remaining === 0) {
        status = 'degraded';
        message = `Rate limit exhausted. Resets at ${resetTime.toISOString()}`;
      } else if (remaining < limit * 0.1) {
        // Less than 10% remaining
        status = 'degraded';
        message = `Rate limit low: ${remaining}/${limit} remaining`;
      }

      return {
        name: 'rate_limit',
        status,
        message,
        lastChecked: new Date().toISOString(),
        responseTime,
        metadata: {
          limit,
          remaining,
          resetTime: resetTime.toISOString(),
          used: limit - remaining,
          percentUsed: Math.round(((limit - remaining) / limit) * 100),
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        name: 'rate_limit',
        status: 'unhealthy',
        message: 'Failed to check rate limit status',
        lastChecked: new Date().toISOString(),
        responseTime,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Determine overall system status from component statuses
   */
  private determineOverallStatus(components: ComponentHealth[]): HealthStatus {
    const statuses = components.map(c => c.status);

    if (statuses.some(s => s === 'unhealthy')) {
      return 'unhealthy';
    }

    if (statuses.some(s => s === 'degraded')) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Get server uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Get server startup time
   */
  getStartupTime(): Date {
    return this.startTime;
  }
}

/**
 * Create health check tools for MCP server
 */
import { ToolConfig } from './types.js';

export function createHealthTools(healthManager: HealthManager): ToolConfig[] {
  return [
    {
      tool: {
        name: 'get_system_health',
        description:
          'Get comprehensive system health status including GitHub API connectivity and rate limits',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => {
        return await healthManager.getSystemHealth();
      },
    },
    {
      tool: {
        name: 'get_quick_health',
        description: 'Get quick health status (lightweight check)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => {
        return await healthManager.getQuickHealth();
      },
    },
  ];
}
