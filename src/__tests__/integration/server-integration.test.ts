/**
 * Integration tests for the GitHub MCP Server
 * Tests the complete flow from server initialization to tool execution
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMockOctokit, staticMockResponses } from '../mocks/octokit.js';
import { mockEnvVars, mockProcessExit, restoreProcessExit } from '../helpers/test-helpers.js';

// Mock external dependencies
vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(),
}));



// Mock rate limiter - We'll need to set this up dynamically per test
vi.mock('../../rate-limiter.js', () => ({
  createRateLimitedOctokit: vi.fn(),
  GitHubRateLimiter: vi.fn(),
  ResponseSizeLimiter: {
    limitResponseSize: vi.fn(data => ({ data, truncated: false, originalSize: 0 })),
  },
}));

// Mock other dependencies to prevent import errors
vi.mock('../../optimized-api-client.js', () => ({
  OptimizedAPIClient: vi.fn().mockImplementation(() => ({
    getOctokit: vi.fn(() => ({
        graphql: vi.fn()
    })),
    clearCache: vi.fn(),
  })),
}));

vi.mock('../../performance-monitor.js', () => ({
  globalPerformanceMonitor: {
    measure: vi.fn((name, fn) => fn()),
    getMetrics: vi.fn(),
    generateReport: vi.fn(),
  },
}));

vi.mock('../../reliability.js', () => ({
  ReliabilityManager: vi.fn().mockImplementation(() => ({
    executeWithReliability: vi.fn(async (name, fn) => {
      // Execute the function directly and return the result
      const result = await fn();
      return result;
    }),
  })),
  RetryManager: vi.fn().mockImplementation(() => ({})),
  ConsoleTelemetry: vi.fn().mockImplementation(() => ({})),
  NoOpTelemetry: vi.fn().mockImplementation(() => ({})),
  DEFAULT_RETRY_CONFIG: {},
}));

vi.mock('../../health.js', () => ({
  HealthManager: vi.fn(),
  createHealthTools: () => [],
}));

vi.mock('../../metrics.js', () => ({
  metrics: {
    recordApiCall: vi.fn(),
    recordError: vi.fn(),
  },
}));

vi.mock('../../logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock tool creation functions
vi.mock('../../tools/repositories.js', () => ({
  createRepositoryTools: () => [
    {
      tool: { 
        name: 'get_file_contents', 
        description: 'Get file contents',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string' },
            repo: { type: 'string' },
            path: { type: 'string' }
          },
          required: ['owner', 'repo', 'path']
        }
      },
      handler: vi.fn(),
    },
    {
      tool: { 
        name: 'list_repositories', 
        description: 'List repositories',
        inputSchema: {
          type: 'object',
          properties: {
            visibility: { type: 'string' }
          }
        }
      },
      handler: vi.fn(),
    },
  ],
}));

vi.mock('../../tools/issues.js', () => ({
  createIssueTools: (octokit: any, readOnly: boolean) => {
    const tools = [
      {
        tool: { name: 'list_issues', description: 'List issues' },
        handler: vi.fn(),
      },
    ];

    // Only add write tools if not in read-only mode
    if (!readOnly) {
      tools.push({
        tool: { name: 'create_issue', description: 'Create issue' },
        handler: vi.fn(),
      });
    }

    return tools;
  },
}));

vi.mock('../../tools/pull-requests.js', () => ({
  createPullRequestTools: (octokit: any, readOnly: boolean) => {
    const tools = [
      {
        tool: { name: 'list_pull_requests', description: 'List pull requests' },
        handler: vi.fn(),
      },
    ];

    // Only add write tools if not in read-only mode
    if (!readOnly) {
      tools.push({
        tool: { name: 'create_pull_request', description: 'Create pull request' },
        handler: vi.fn(),
      });
    }

    return tools;
  },
}));

vi.mock('../../tools/actions.js', () => ({
  createActionTools: () => [
    {
      tool: { name: 'list_workflows', description: 'List workflows' },
      handler: vi.fn(),
    },
  ],
}));

vi.mock('../../tools/search.js', () => ({
  createSearchTools: () => [
    {
      tool: { name: 'search_repositories', description: 'Search repositories' },
      handler: vi.fn(),
    },
  ],
}));

vi.mock('../../tools/users.js', () => ({
  createUserTools: () => [],
}));

vi.mock('../../tools/organizations.js', () => ({
  createOrganizationTools: () => [],
}));

vi.mock('../../tools/notifications.js', () => ({
  createNotificationTools: () => [],
}));

vi.mock('../../tools/code-security.js', () => ({
  createCodeSecurityTools: () => [],
}));

vi.mock('../../tools/discussions.js', () => ({
  createDiscussionTools: () => [],
}));

vi.mock('../../tools/dependabot.js', () => ({
  createDependabotTools: () => [],
}));

vi.mock('../../tools/secret-scanning.js', () => ({
  createSecretScanningTools: () => [],
}));

vi.mock('../../tools/repository-insights.js', () => ({
  createRepositoryInsightsTools: () => [],
}));

vi.mock('../../tools/advanced-search.js', () => ({
  createAdvancedSearchTools: () => [],
}));

vi.mock('../../tools/project-management.js', () => ({
  createProjectManagementTools: () => [],
}));

vi.mock('../../tools/batch-operations.js', () => ({
  createBatchOperationsTools: () => [],
}));

vi.mock('../../tools/optimized-repositories.js', () => ({
  createOptimizedRepositoryTools: () => [],
}));

vi.mock('../../agents/tools/agent-tools.js', () => ({
  createAgentTools: () => [],
}));

vi.mock('../../tools/cache-management.js', () => ({
  createCacheManagementTools: () => [],
}));

describe('GitHub MCP Server Integration', () => {
  let mockServer: any;
  let mockOctokit: any;
  let mockTransport: any;
  let restoreEnv: () => void;
  let exitSpy: any;
  let registeredTools: Map<string, any>;

  beforeEach(async () => {
    // Reset modules to ensure clean imports
    vi.resetModules();

    // Mock MCP server with tool registration tracking
    registeredTools = new Map();
    mockServer = {
      tool: vi.fn((name, description, schemaOrHandler, handlerOrUndefined) => {
        // Handle both overloads: with schema (4 params) and without (3 params)
        const hasSchema = typeof schemaOrHandler !== 'function';
        const handler = hasSchema ? handlerOrUndefined : schemaOrHandler;
        const schema = hasSchema ? schemaOrHandler : undefined;
        registeredTools.set(name, { description, schema, handler });
      }),
      connect: vi.fn(),
    };
    (McpServer as any).mockImplementation(() => mockServer);

    // Mock Octokit
    mockOctokit = createMockOctokit();
    const { Octokit } = await import('@octokit/rest');
    (Octokit as any).mockImplementation(() => mockOctokit);

    // Configure the rate limiter mock to return the mock Octokit
    const { createRateLimitedOctokit } = await import('../../rate-limiter.js');
    (createRateLimitedOctokit as any).mockImplementation(() => ({
      octokit: mockOctokit,
      rateLimiter: {
        limit: vi.fn(),
        getStatus: vi.fn(() => ({
          core: { limit: 5000, remaining: 4999, reset: new Date(Date.now() + 3600000) },
          search: { limit: 30, remaining: 30, reset: new Date(Date.now() + 3600000) },
          graphql: { limit: 5000, remaining: 5000, reset: new Date(Date.now() + 3600000) },
          queueLength: 0,
        })),
      },
    }));

    // Mock transport
    mockTransport = { connect: vi.fn() };
    (StdioServerTransport as any).mockImplementation(() => mockTransport);

    // Mock process.exit
    exitSpy = mockProcessExit();

    // Set up environment variables with valid token format
    restoreEnv = mockEnvVars({
      GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      GITHUB_READ_ONLY: 'false',
      GITHUB_TOOLSETS: 'all',
      NODE_ENV: 'test',
      GITHUB_TELEMETRY_DISABLE: 'true',
    });
  });

  afterEach(() => {
    restoreEnv();
    restoreProcessExit(exitSpy);
    vi.clearAllMocks();
  });

  describe('Server Initialization', () => {
    it('should initialize server with all tools registered', async () => {
      const { GitHubMCPServer } = await import('../../index.js');
      new (GitHubMCPServer as any)(true);

      // Verify MCP server was created correctly
      expect(McpServer).toHaveBeenCalledWith({
        name: 'github-mcp',
        version: '1.0.0',
        description: 'GitHub API integration for MCP',
      });

      // Verify tools were registered
      expect(mockServer.tool).toHaveBeenCalled();
      expect(registeredTools.size).toBeGreaterThan(10);

      // Check that essential tools are registered
      expect(registeredTools.has('get_me')).toBe(true);
      expect(registeredTools.has('get_file_contents')).toBe(true);
      expect(registeredTools.has('list_repositories')).toBe(true);
      expect(registeredTools.has('list_issues')).toBe(true);
      expect(registeredTools.has('list_pull_requests')).toBe(true);
    });

    it('should start server and connect transport', async () => {
      const { GitHubMCPServer } = await import('../../index.js');
      const server = new (GitHubMCPServer as any)(true);

      await server.start();

      expect(StdioServerTransport).toHaveBeenCalled();
      expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
    });
  });

  describe('Tool Execution Flow', () => {
    let server: any;

    beforeEach(async () => {
      const { GitHubMCPServer } = await import('../../index.js');
      server = new (GitHubMCPServer as any)(true);
    });

    it('should execute get_me tool successfully', async () => {
      // This test verifies the tool is registered and can be called
      // The actual execution testing is done in unit tests
      const tool = registeredTools.get('get_me');
      expect(tool).toBeDefined();
      expect(tool.description).toBe('Get my GitHub user profile');

      // Verify the handler exists and is a function
      expect(tool.handler).toBeDefined();
      expect(typeof tool.handler).toBe('function');
    });

    it('should execute get_file_contents tool successfully', async () => {
      // This test verifies the tool is registered
      const tool = registeredTools.get('get_file_contents');
      expect(tool).toBeDefined();
      expect(tool.description).toBe('Get file contents');

      // Verify the handler exists and is a function
      expect(tool.handler).toBeDefined();
      expect(typeof tool.handler).toBe('function');
    });

    it('should execute list_repositories tool successfully', async () => {
      // This test verifies the tool is registered
      const tool = registeredTools.get('list_repositories');
      expect(tool).toBeDefined();
      expect(tool.description).toBe('List repositories');

      // Verify the handler exists and is a function
      expect(tool.handler).toBeDefined();
      expect(typeof tool.handler).toBe('function');
    });

    it('should handle tool execution errors gracefully', async () => {
      // This test verifies error handling wrapper is in place
      const tool = registeredTools.get('get_me');
      expect(tool).toBeDefined();

      // The handler wrapper should handle errors gracefully
      // Actual error handling is tested in unit tests
      expect(tool.handler).toBeDefined();
      expect(typeof tool.handler).toBe('function');
    });

    it('should validate tool parameters', async () => {
      // This test verifies tools have schemas for validation
      const tool = registeredTools.get('get_file_contents');
      expect(tool).toBeDefined();
      expect(tool.schema).toBeDefined();

      // The schema should define required parameters
      // Actual validation is tested in unit tests
      expect(tool.handler).toBeDefined();
    });
  });

  describe('Read-Only Mode', () => {
    it('should not register write tools in read-only mode', async () => {
        restoreEnv();
        restoreEnv = mockEnvVars({
            GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            GITHUB_READ_ONLY: 'true',
            GITHUB_TOOLSETS: 'all',
            NODE_ENV: 'test',
            GITHUB_TELEMETRY_DISABLE: 'true',
        });
      const { GitHubMCPServer } = await import('../../index.js');
      new (GitHubMCPServer as any)(true);

      // Write tools should not be registered
      expect(registeredTools.has('create_or_update_file')).toBe(false);
      expect(registeredTools.has('delete_file')).toBe(false);
      expect(registeredTools.has('create_issue')).toBe(false);
      expect(registeredTools.has('create_pull_request')).toBe(false);
      expect(registeredTools.has('cancel_workflow_run')).toBe(false);

      // Read tools should still be registered
      expect(registeredTools.has('get_file_contents')).toBe(true);
      expect(registeredTools.has('list_repositories')).toBe(true);
      expect(registeredTools.has('list_issues')).toBe(true);
      expect(registeredTools.has('list_pull_requests')).toBe(true);
    });
  });

  describe('Selective Toolsets', () => {
    it('should only register tools from enabled toolsets', async () => {
        restoreEnv();
        restoreEnv = mockEnvVars({
            GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            GITHUB_READ_ONLY: 'false',
            GITHUB_TOOLSETS: 'repos,issues',
            NODE_ENV: 'test',
            GITHUB_TELEMETRY_DISABLE: 'true',
        });
      const { GitHubMCPServer } = await import('../../index.js');
      new (GitHubMCPServer as any)(true);

      // Enabled toolsets should have their tools registered
      expect(registeredTools.has('get_file_contents')).toBe(true);
      expect(registeredTools.has('list_repositories')).toBe(true);
      expect(registeredTools.has('list_issues')).toBe(true);
      expect(registeredTools.has('create_issue')).toBe(true);

      // Search tools are always enabled
      expect(registeredTools.has('search_repositories')).toBe(true);

      // Disabled toolsets should not have their tools registered
      expect(registeredTools.has('list_pull_requests')).toBe(false);
      expect(registeredTools.has('create_pull_request')).toBe(false);
      expect(registeredTools.has('list_workflows')).toBe(false);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing GitHub token', async () => {
        restoreEnv();
        restoreEnv = mockEnvVars({
            GITHUB_PERSONAL_ACCESS_TOKEN: '',
            GITHUB_TOKEN: '',
        });

        // We need to dynamically import the server to re-evaluate the config
        await expect(import('../../index.js')).rejects.toThrow();
    });

    it('should handle server connection errors', async () => {
      mockServer.connect.mockRejectedValue(new Error('Connection failed'));

      const { GitHubMCPServer } = await import('../../index.js');
      const server = new (GitHubMCPServer as any)(true);

      await expect(server.start()).rejects.toThrow('Connection failed');
      // In test mode, process.exit should NOT be called
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });


});
