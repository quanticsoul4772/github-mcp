/**
 * Tests for ToolRegistry
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock heavy dependencies before importing ToolRegistry
vi.mock('./agents/tools/agent-tools.js', () => ({ createAgentTools: () => [] }));
vi.mock('./tools/repositories.js', () => ({ createRepositoryTools: () => [] }));
vi.mock('./tools/issues.js', () => ({ createIssueTools: () => [] }));
vi.mock('./tools/pull-requests.js', () => ({ createPullRequestTools: () => [] }));
vi.mock('./tools/actions.js', () => ({ createActionTools: () => [] }));
vi.mock('./tools/code-security.js', () => ({ createCodeSecurityTools: () => [] }));
vi.mock('./tools/search.js', () => ({ createSearchTools: () => [] }));
vi.mock('./tools/users.js', () => ({ createUserTools: () => [] }));
vi.mock('./tools/organizations.js', () => ({ createOrganizationTools: () => [] }));
vi.mock('./tools/notifications.js', () => ({ createNotificationTools: () => [] }));
vi.mock('./tools/discussions.js', () => ({ createDiscussionTools: () => [] }));
vi.mock('./tools/dependabot.js', () => ({ createDependabotTools: () => [] }));
vi.mock('./tools/secret-scanning.js', () => ({ createSecretScanningTools: () => [] }));
vi.mock('./tools/repository-insights.js', () => ({ createRepositoryInsightsTools: () => [] }));
vi.mock('./tools/advanced-search.js', () => ({ createAdvancedSearchTools: () => [] }));
vi.mock('./tools/project-management.js', () => ({ createProjectManagementTools: () => [] }));
vi.mock('./tools/batch-operations.js', () => ({ createBatchOperationsTools: () => [] }));
vi.mock('./tools/optimized-repositories.js', () => ({ createOptimizedRepositoryTools: () => [] }));
vi.mock('./tools/cache-management.js', () => ({ createCacheManagementTools: () => [] }));
vi.mock('./health.js', () => ({
  createHealthTools: () => [],
  HealthManager: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('./performance-monitor.js', () => ({
  globalPerformanceMonitor: {
    getMetrics: vi.fn().mockReturnValue({ cpu: 0 }),
    generateReport: vi.fn().mockReturnValue({ summary: 'ok' }),
  },
}));
vi.mock('./config.js', () => ({
  getEnabledToolsets: () => ['context', 'repos', 'issues', 'pull_requests', 'actions',
    'code_security', 'search', 'users', 'orgs', 'notifications', 'discussions',
    'dependabot', 'secret_protection', 'graphql_insights', 'advanced_search',
    'project_management', 'batch_operations', 'health', 'cache_management',
    'monitoring', 'performance', 'agent'],
}));

import { ToolRegistry } from './tool-registry.js';

function makeMocks() {
  const capturedTools: Record<string, { handler: (params: any) => Promise<any> }> = {};

  const mockServer = {
    tool: vi.fn((...args: any[]) => {
      // server.tool(name, description, zodShape, handler) OR server.tool(name, description, handler)
      const name = args[0];
      const handler = args[args.length - 1]; // last arg is always handler
      capturedTools[name] = { handler };
    }),
  };

  const mockOctokit = {
    users: { getAuthenticated: vi.fn().mockResolvedValue({ data: { login: 'test-user' } }) },
  };

  const mockOptimizedClient = {
    getOctokit: vi.fn().mockReturnValue(mockOctokit),
    clearCache: vi.fn(),
  };

  const mockReliabilityManager = {
    executeWithReliability: vi.fn().mockImplementation((_name: string, fn: () => any) => fn()),
  };

  const mockHealthManager = {};

  const mockRateLimiter = {
    getStatus: vi.fn().mockReturnValue({
      core: { limit: 5000, remaining: 4999, reset: new Date('2026-01-01') },
      search: { limit: 30, remaining: 29, reset: new Date('2026-01-01') },
      graphql: { limit: 5000, remaining: 4998, reset: new Date('2026-01-01') },
      queueLength: 0,
    }),
  };

  return { mockServer, mockOctokit, mockOptimizedClient, mockReliabilityManager, mockHealthManager, mockRateLimiter, capturedTools };
}

describe('ToolRegistry', () => {
  describe('registerTool', () => {
    it('should register a tool with schema params', async () => {
      const { mockServer, mockOctokit, mockOptimizedClient, mockReliabilityManager, mockHealthManager, mockRateLimiter, capturedTools } = makeMocks();

      const registry = new ToolRegistry(
        mockServer as any, mockOctokit as any, mockOptimizedClient as any,
        mockReliabilityManager as any, mockHealthManager as any, mockRateLimiter as any, false
      );

      registry.registerTool({
        tool: {
          name: 'my_tool',
          description: 'A test tool',
          inputSchema: { type: 'object', properties: { owner: { type: 'string' }, count: { type: 'number' }, active: { type: 'boolean' }, tags: { type: 'array' }, data: { type: 'object' } } },
        },
        handler: async () => ({ ok: true }),
      });

      expect(mockServer.tool).toHaveBeenCalledWith('my_tool', expect.any(String), expect.any(Object), expect.any(Function));
      expect(registry.toolCount).toBe(1);
    });

    it('should register a tool without schema params', async () => {
      const { mockServer, mockOctokit, mockOptimizedClient, mockReliabilityManager, mockHealthManager, mockRateLimiter } = makeMocks();

      const registry = new ToolRegistry(
        mockServer as any, mockOctokit as any, mockOptimizedClient as any,
        mockReliabilityManager as any, mockHealthManager as any, mockRateLimiter as any, false
      );

      registry.registerTool({
        tool: { name: 'no_params_tool', description: 'No params', inputSchema: { type: 'object', properties: {} } },
        handler: async () => 'done',
      });

      expect(mockServer.tool).toHaveBeenCalledWith('no_params_tool', expect.any(String), expect.any(Function));
    });

    it('should skip duplicate tool registration', async () => {
      const { mockServer, mockOctokit, mockOptimizedClient, mockReliabilityManager, mockHealthManager, mockRateLimiter } = makeMocks();

      const registry = new ToolRegistry(
        mockServer as any, mockOctokit as any, mockOptimizedClient as any,
        mockReliabilityManager as any, mockHealthManager as any, mockRateLimiter as any, false
      );

      const config = {
        tool: { name: 'dup_tool', description: 'Dup', inputSchema: { type: 'object', properties: {} } },
        handler: async () => 'ok',
      };

      registry.registerTool(config);
      registry.registerTool(config);

      expect(registry.toolCount).toBe(1);
      expect(mockServer.tool).toHaveBeenCalledTimes(1);
    });

    it('should return text content for object result', async () => {
      const { mockServer, mockOctokit, mockOptimizedClient, mockReliabilityManager, mockHealthManager, mockRateLimiter, capturedTools } = makeMocks();

      const registry = new ToolRegistry(
        mockServer as any, mockOctokit as any, mockOptimizedClient as any,
        mockReliabilityManager as any, mockHealthManager as any, mockRateLimiter as any, false
      );

      registry.registerTool({
        tool: { name: 'obj_tool', description: '', inputSchema: { type: 'object', properties: {} } },
        handler: async () => ({ result: 'data' }),
      });

      const result = await capturedTools['obj_tool'].handler({});
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('result');
    });

    it('should return text content for string result', async () => {
      const { mockServer, mockOctokit, mockOptimizedClient, mockReliabilityManager, mockHealthManager, mockRateLimiter, capturedTools } = makeMocks();

      const registry = new ToolRegistry(
        mockServer as any, mockOctokit as any, mockOptimizedClient as any,
        mockReliabilityManager as any, mockHealthManager as any, mockRateLimiter as any, false
      );

      registry.registerTool({
        tool: { name: 'str_tool', description: '', inputSchema: { type: 'object', properties: {} } },
        handler: async () => 'hello world',
      });

      const result = await capturedTools['str_tool'].handler({});
      expect(result.content[0].text).toBe('hello world');
    });

    it('should return error content on handler error', async () => {
      const { mockServer, mockOctokit, mockOptimizedClient, mockReliabilityManager, mockHealthManager, mockRateLimiter, capturedTools } = makeMocks();

      const registry = new ToolRegistry(
        mockServer as any, mockOctokit as any, mockOptimizedClient as any,
        mockReliabilityManager as any, mockHealthManager as any, mockRateLimiter as any, false
      );

      registry.registerTool({
        tool: { name: 'err_tool', description: '', inputSchema: { type: 'object', properties: {} } },
        handler: async () => { throw new Error('boom'); },
      });

      const result = await capturedTools['err_tool'].handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error');
    });

    it('should append truncation notice when response is truncated', async () => {
      const { mockServer, mockOctokit, mockOptimizedClient, mockReliabilityManager, mockHealthManager, mockRateLimiter, capturedTools } = makeMocks();

      const registry = new ToolRegistry(
        mockServer as any, mockOctokit as any, mockOptimizedClient as any,
        mockReliabilityManager as any, mockHealthManager as any, mockRateLimiter as any, false
      );

      // Return an array with > 1000 items to trigger truncation (DEFAULT_MAX_ITEMS = 1000)
      const largeArray = Array.from({ length: 1001 }, (_, i) => ({ id: i, name: `item-${i}` }));
      registry.registerTool({
        tool: { name: 'big_tool', description: '', inputSchema: { type: 'object', properties: {} } },
        handler: async () => largeArray,
      });

      const result = await capturedTools['big_tool'].handler({});
      expect(result.content[0].text).toContain('[Response truncated');
    });

    it('should log error when server.tool throws during registration', async () => {
      const { mockServer, mockOctokit, mockOptimizedClient, mockReliabilityManager, mockHealthManager, mockRateLimiter } = makeMocks();
      mockServer.tool.mockImplementationOnce(() => { throw new Error('server.tool failed'); });

      const registry = new ToolRegistry(
        mockServer as any, mockOctokit as any, mockOptimizedClient as any,
        mockReliabilityManager as any, mockHealthManager as any, mockRateLimiter as any, false
      );

      // Should NOT throw — error is caught and logged
      expect(() => registry.registerTool({
        tool: { name: 'fail_tool', description: '', inputSchema: { type: 'object', properties: {} } },
        handler: async () => 'ok',
      })).not.toThrow();
    });
  });

  describe('registerAllTools', () => {
    it('should register core tools including get_rate_limit_status', () => {
      const { mockServer, mockOctokit, mockOptimizedClient, mockReliabilityManager, mockHealthManager, mockRateLimiter } = makeMocks();

      const registry = new ToolRegistry(
        mockServer as any, mockOctokit as any, mockOptimizedClient as any,
        mockReliabilityManager as any, mockHealthManager as any, mockRateLimiter as any, false
      );

      registry.registerAllTools();

      const toolNames: string[] = mockServer.tool.mock.calls.map((c: any[]) => c[0]);
      expect(toolNames).toContain('get_rate_limit_status');
      expect(toolNames).toContain('get_me');
    });

    it('get_rate_limit_status handler returns rate limit data', async () => {
      const { mockServer, mockOctokit, mockOptimizedClient, mockReliabilityManager, mockHealthManager, mockRateLimiter, capturedTools } = makeMocks();

      const registry = new ToolRegistry(
        mockServer as any, mockOctokit as any, mockOptimizedClient as any,
        mockReliabilityManager as any, mockHealthManager as any, mockRateLimiter as any, false
      );

      registry.registerAllTools();

      const result = await capturedTools['get_rate_limit_status'].handler({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.rate_limits.core.limit).toBe(5000);
      expect(parsed.queue_length).toBe(0);
    });

    it('get_me handler invokes octokit.users.getAuthenticated', async () => {
      const { mockServer, mockOctokit, mockOptimizedClient, mockReliabilityManager, mockHealthManager, mockRateLimiter, capturedTools } = makeMocks();

      const registry = new ToolRegistry(
        mockServer as any, mockOctokit as any, mockOptimizedClient as any,
        mockReliabilityManager as any, mockHealthManager as any, mockRateLimiter as any, false
      );

      registry.registerAllTools();

      const result = await capturedTools['get_me'].handler({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.login).toBe('test-user');
    });

    it('get_performance_metrics handler returns metrics', async () => {
      const { mockServer, mockOctokit, mockOptimizedClient, mockReliabilityManager, mockHealthManager, mockRateLimiter, capturedTools } = makeMocks();

      const registry = new ToolRegistry(
        mockServer as any, mockOctokit as any, mockOptimizedClient as any,
        mockReliabilityManager as any, mockHealthManager as any, mockRateLimiter as any, false
      );

      registry.registerAllTools();

      const result = await capturedTools['get_performance_metrics'].handler({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.cpu).toBe(0);
    });

    it('get_performance_report handler returns report', async () => {
      const { mockServer, mockOctokit, mockOptimizedClient, mockReliabilityManager, mockHealthManager, mockRateLimiter, capturedTools } = makeMocks();

      const registry = new ToolRegistry(
        mockServer as any, mockOctokit as any, mockOptimizedClient as any,
        mockReliabilityManager as any, mockHealthManager as any, mockRateLimiter as any, false
      );

      registry.registerAllTools();

      const result = await capturedTools['get_performance_report'].handler({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.summary).toBe('ok');
    });

    it('clear_api_cache handler clears optimized client cache', async () => {
      const { mockServer, mockOctokit, mockOptimizedClient, mockReliabilityManager, mockHealthManager, mockRateLimiter, capturedTools } = makeMocks();

      const registry = new ToolRegistry(
        mockServer as any, mockOctokit as any, mockOptimizedClient as any,
        mockReliabilityManager as any, mockHealthManager as any, mockRateLimiter as any, false
      );

      registry.registerAllTools();

      const result = await capturedTools['clear_api_cache'].handler({});
      expect(mockOptimizedClient.clearCache).toHaveBeenCalled();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    it('clear_api_cache handler works without optimizedClient', async () => {
      const { mockServer, mockOctokit, mockReliabilityManager, mockHealthManager, mockRateLimiter, capturedTools } = makeMocks();

      const registry = new ToolRegistry(
        mockServer as any, mockOctokit as any, null as any,
        mockReliabilityManager as any, mockHealthManager as any, mockRateLimiter as any, false
      );

      registry.registerAllTools();

      const result = await capturedTools['clear_api_cache'].handler({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });
  });
});
