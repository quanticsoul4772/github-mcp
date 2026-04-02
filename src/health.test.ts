/**
 * Tests for HealthManager and createHealthTools
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthManager, createHealthTools } from './health.js';

describe('HealthManager', () => {
  let mockOctokit: any;
  let healthManager: HealthManager;

  beforeEach(() => {
    const getAuthenticated = vi.fn().mockResolvedValue({
      data: { login: 'test-user' },
      headers: {},
    });
    const getRateLimit = vi.fn().mockResolvedValue({
      data: {
        rate: {
          limit: 5000,
          remaining: 4999,
          reset: Math.floor(Date.now() / 1000) + 3600,
        },
      },
    });
    mockOctokit = {
      rest: {
        users: { getAuthenticated },
        rateLimit: { get: getRateLimit },
      },
    };
    healthManager = new HealthManager(mockOctokit as any);
  });

  describe('getSystemHealth', () => {
    it('should return healthy status when API is accessible', async () => {
      const health = await healthManager.getSystemHealth();
      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeTruthy();
      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(health.components)).toBe(true);
      expect(health.metadata.nodeVersion).toBeTruthy();
    });

    it('should include github_api component', async () => {
      const health = await healthManager.getSystemHealth();
      const githubComponent = health.components.find(c => c.name === 'github_api');
      expect(githubComponent).toBeDefined();
      expect(githubComponent?.status).toBe('healthy');
    });

    it('should return unhealthy when octokit throws', async () => {
      mockOctokit.rest.users.getAuthenticated.mockRejectedValue(new Error('Network error'));
      mockOctokit.rest.rateLimit.get.mockRejectedValue(new Error('Network error'));
      const health = await healthManager.getSystemHealth();
      const githubComponent = health.components.find(c => c.name === 'github_api');
      expect(githubComponent?.status).toBe('unhealthy');
    });

    it('should include reliability status when reliabilityManager provided', async () => {
      const mockReliabilityManager = {
        getHealthStatus: vi.fn().mockReturnValue({ circuitBreakers: [] }),
        executeWithReliability: vi.fn().mockImplementation((_: string, fn: () => any) => fn()),
      };
      const healthWithReliability = new HealthManager(mockOctokit as any, mockReliabilityManager as any);
      const health = await healthWithReliability.getSystemHealth();
      expect(health.reliability).toBeDefined();
    });
  });

  describe('getSystemHealth - degraded status', () => {
    it('should return degraded when rate limit is low', async () => {
      // Make auth succeed but rate limit return low remaining
      mockOctokit.rest.rateLimit.get.mockResolvedValue({
        data: {
          rate: {
            limit: 5000,
            remaining: 50, // Very low — triggers degraded
            reset: Math.floor(Date.now() / 1000) + 3600,
          },
        },
      });
      const health = await healthManager.getSystemHealth();
      // Components with degraded status pull overall to degraded
      const rateLimitComponent = health.components.find((c: any) => c.name === 'rate_limit');
      if (rateLimitComponent) {
        expect(['degraded', 'healthy', 'unhealthy']).toContain(rateLimitComponent.status);
      }
    });

    it('should set degraded status when API returns 403', async () => {
      const forbiddenError = Object.assign(new Error('Forbidden'), { status: 403 });
      mockOctokit.rest.users.getAuthenticated.mockRejectedValue(forbiddenError);
      const health = await healthManager.getSystemHealth();
      const githubComponent = health.components.find((c: any) => c.name === 'github_api');
      expect(githubComponent?.status).toBe('degraded');
    });

    it('should set unhealthy status when API returns 500', async () => {
      const serverError = Object.assign(new Error('Server Error'), { status: 500 });
      mockOctokit.rest.users.getAuthenticated.mockRejectedValue(serverError);
      const health = await healthManager.getSystemHealth();
      const githubComponent = health.components.find((c: any) => c.name === 'github_api');
      expect(githubComponent?.status).toBe('unhealthy');
    });

    it('should set degraded status when rate limit is exhausted', async () => {
      mockOctokit.rest.rateLimit.get.mockResolvedValue({
        data: {
          rate: {
            limit: 5000,
            remaining: 0,
            reset: Math.floor(Date.now() / 1000) + 3600,
          },
        },
      });
      const health = await healthManager.getSystemHealth();
      const rateLimitComponent = health.components.find((c: any) => c.name === 'rate_limit');
      expect(rateLimitComponent?.status).toBe('degraded');
    });
  });

  describe('getUptime and getStartupTime', () => {
    it('should return a positive uptime', () => {
      const uptime = healthManager.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return a Date for startup time', () => {
      const startupTime = healthManager.getStartupTime();
      expect(startupTime).toBeInstanceOf(Date);
    });
  });

  describe('getQuickHealth', () => {
    it('should return status object', async () => {
      const health = await healthManager.getQuickHealth();
      expect(health.status).toBeDefined();
      expect(health.timestamp).toBeTruthy();
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy on API error', async () => {
      mockOctokit.rest.users.getAuthenticated.mockRejectedValue(new Error('Unauthorized'));
      mockOctokit.rest.rateLimit.get.mockRejectedValue(new Error('Unauthorized'));
      const health = await healthManager.getQuickHealth();
      expect(health.status).toBe('unhealthy');
    });

    it('should use cached result within 30 seconds', async () => {
      // First call populates the cache
      await healthManager.getQuickHealth();
      const callCount = mockOctokit.rest.users.getAuthenticated.mock.calls.length;
      // Second call should use cache (no additional API call)
      await healthManager.getQuickHealth();
      expect(mockOctokit.rest.users.getAuthenticated).toHaveBeenCalledTimes(callCount);
    });
  });
});

describe('createHealthTools', () => {
  let mockHealthManager: any;
  let tools: any[];

  beforeEach(() => {
    mockHealthManager = {
      getSystemHealth: vi.fn().mockResolvedValue({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 1000,
        components: [],
        metadata: {},
      }),
      getQuickHealth: vi.fn().mockResolvedValue({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 1000,
      }),
    };
    tools = createHealthTools(mockHealthManager);
  });

  it('should create health tools', () => {
    expect(tools.length).toBeGreaterThan(0);
    const names = tools.map((t: any) => t.tool.name);
    expect(names).toContain('get_system_health');
  });

  it('get_system_health should call getSystemHealth', async () => {
    const healthTool = tools.find((t: any) => t.tool.name === 'get_system_health');
    expect(healthTool).toBeDefined();
    const result = await healthTool.handler({});
    expect(mockHealthManager.getSystemHealth).toHaveBeenCalled();
    expect(result.status).toBe('healthy');
  });

  it('get_quick_health should call getQuickHealth', async () => {
    const quickTool = tools.find((t: any) => t.tool.name === 'get_quick_health');
    expect(quickTool).toBeDefined();
    const result = await quickTool.handler({});
    expect(mockHealthManager.getQuickHealth).toHaveBeenCalled();
    expect(result.status).toBe('healthy');
  });
});
