/**
 * Tests for the main GitHubMCPServer class
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Octokit } from '@octokit/rest';
import { createMockOctokit } from './__tests__/mocks/octokit.js';
import { mockEnvVars, mockProcessExit, restoreProcessExit } from './__tests__/helpers/test-helpers.js';

// Mock external dependencies
vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('@octokit/rest');
vi.mock('./tools/repositories.js', () => ({
  createRepositoryTools: () => [
    {
      tool: { name: 'test-repo-tool', description: 'Test repo tool' },
      handler: vi.fn(),
    },
  ],
}));
vi.mock('./tools/issues.js', () => ({
  createIssueTools: () => [
    {
      tool: { name: 'test-issue-tool', description: 'Test issue tool' },
      handler: vi.fn(),
    },
  ],
}));
vi.mock('./tools/pull-requests.js', () => ({
  createPullRequestTools: () => [
    {
      tool: { name: 'test-pr-tool', description: 'Test PR tool' },
      handler: vi.fn(),
    },
  ],
}));
vi.mock('./tools/actions.js', () => ({
  createActionTools: () => [
    {
      tool: { name: 'test-action-tool', description: 'Test action tool' },
      handler: vi.fn(),
    },
  ],
}));
vi.mock('./tools/code-security.js', () => ({
  createCodeSecurityTools: () => [
    {
      tool: { name: 'test-security-tool', description: 'Test security tool' },
      handler: vi.fn(),
    },
  ],
}));
vi.mock('./tools/search.js', () => ({
  createSearchTools: () => [
    {
      tool: { name: 'test-search-tool', description: 'Test search tool' },
      handler: vi.fn(),
    },
  ],
}));
vi.mock('./tools/users.js', () => ({
  createUserTools: () => [
    {
      tool: { name: 'get_me', description: 'Get current user' },
      handler: vi.fn(),
    },
    {
      tool: { name: 'test-user-tool', description: 'Test user tool' },
      handler: vi.fn(),
    },
  ],
}));
vi.mock('./tools/organizations.js', () => ({
  createOrganizationTools: () => [
    {
      tool: { name: 'test-org-tool', description: 'Test org tool' },
      handler: vi.fn(),
    },
  ],
}));
vi.mock('./tools/notifications.js', () => ({
  createNotificationTools: () => [
    {
      tool: { name: 'test-notification-tool', description: 'Test notification tool' },
      handler: vi.fn(),
    },
  ],
}));
vi.mock('./tools/discussions.js', () => ({
  createDiscussionTools: () => [
    {
      tool: { name: 'test-discussion-tool', description: 'Test discussion tool' },
      handler: vi.fn(),
    },
  ],
}));
vi.mock('./tools/dependabot.js', () => ({
  createDependabotTools: () => [
    {
      tool: { name: 'test-dependabot-tool', description: 'Test dependabot tool' },
      handler: vi.fn(),
    },
  ],
}));
vi.mock('./tools/secret-scanning.js', () => ({
  createSecretScanningTools: () => [
    {
      tool: { name: 'test-secret-tool', description: 'Test secret tool' },
      handler: vi.fn(),
    },
  ],
}));

describe('GitHubMCPServer', () => {
  let mockServer: any;
  let mockOctokit: any;
  let mockTransport: any;
  let restoreEnv: () => void;
  let exitSpy: any;

  beforeEach(() => {
    // Mock MCP server
    mockServer = {
      tool: vi.fn(),
      connect: vi.fn(),
    };
    (McpServer as any).mockImplementation(() => mockServer);

    // Mock Octokit
    mockOctokit = createMockOctokit();
    (Octokit as any).mockImplementation(() => mockOctokit);

    // Mock transport
    mockTransport = { connect: vi.fn() };
    (StdioServerTransport as any).mockImplementation(() => mockTransport);

    // Mock process.exit
    exitSpy = mockProcessExit();

    // Set up environment variables
    restoreEnv = mockEnvVars({
      GITHUB_PERSONAL_ACCESS_TOKEN: 'test-token-123',
      GITHUB_READ_ONLY: 'false',
      GITHUB_TOOLSETS: 'all',
    });
  });

  afterEach(() => {
    restoreEnv();
    restoreProcessExit(exitSpy);
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with proper configuration', async () => {
      const { GitHubMCPServer } = await import('./index.js');
      
      const server = new (GitHubMCPServer as any)();

      expect(McpServer).toHaveBeenCalledWith({
        name: 'github-mcp',
        version: '1.0.0',
        description: 'GitHub API integration for MCP',
      });
      
      expect(Octokit).toHaveBeenCalledWith({
        auth: 'test-token-123',
      });
    });

    it('should exit if no GitHub token is provided', async () => {
      restoreEnv();
      delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      delete process.env.GITHUB_TOKEN;

      const { GitHubMCPServer } = await import('./index.js');

      expect(() => new (GitHubMCPServer as any)()).toThrow('process.exit called');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should use GITHUB_TOKEN if GITHUB_PERSONAL_ACCESS_TOKEN is not set', async () => {
      restoreEnv();
      restoreEnv = mockEnvVars({
        GITHUB_TOKEN: 'github-token-456',
      });

      const { GitHubMCPServer } = await import('./index.js');
      new (GitHubMCPServer as any)();

      expect(Octokit).toHaveBeenCalledWith({
        auth: 'github-token-456',
      });
    });

    it('should configure read-only mode correctly', async () => {
      restoreEnv();
      restoreEnv = mockEnvVars({
        GITHUB_PERSONAL_ACCESS_TOKEN: 'test-token',
        GITHUB_READ_ONLY: 'true',
      });

      const { GitHubMCPServer } = await import('./index.js');
      const server = new (GitHubMCPServer as any)();
      
      expect(server.readOnly).toBe(true);
    });

    it('should configure enabled toolsets correctly', async () => {
      restoreEnv();
      restoreEnv = mockEnvVars({
        GITHUB_PERSONAL_ACCESS_TOKEN: 'test-token',
        GITHUB_TOOLSETS: 'repos,issues,pull_requests',
      });

      const { GitHubMCPServer } = await import('./index.js');
      const server = new (GitHubMCPServer as any)();
      
      expect(server.enabledToolsets).toEqual(new Set(['repos', 'issues', 'pull_requests']));
    });

    it('should use all toolsets when not specified', async () => {
      const { GitHubMCPServer } = await import('./index.js');
      const server = new (GitHubMCPServer as any)();
      
      expect(server.enabledToolsets.size).toBeGreaterThan(0);
      expect(server.enabledToolsets.has('context')).toBe(true);
      expect(server.enabledToolsets.has('repos')).toBe(true);
    });
  });

  describe('convertSchemaToZod', () => {
    it('should convert JSON schema to Zod schema', async () => {
      const { GitHubMCPServer } = await import('./index.js');
      const server = new (GitHubMCPServer as any)();

      const jsonSchema = {
        properties: {
          name: { type: 'string', description: 'Repository name' },
          count: { type: 'number' },
          active: { type: 'boolean' },
          tags: { type: 'array' },
          metadata: { type: 'object' },
        },
        required: ['name'],
      };

      const zodSchema = server.convertSchemaToZod(jsonSchema);

      expect(zodSchema).toBeDefined();
      expect(zodSchema.name).toBeDefined();
      expect(zodSchema.count).toBeDefined();
      expect(zodSchema.active).toBeDefined();
      expect(zodSchema.tags).toBeDefined();
      expect(zodSchema.metadata).toBeDefined();
    });

    it('should handle empty schema', async () => {
      const { GitHubMCPServer } = await import('./index.js');
      const server = new (GitHubMCPServer as any)();

      const result = server.convertSchemaToZod({});
      expect(result).toEqual({});
    });

    it('should handle null schema', async () => {
      const { GitHubMCPServer } = await import('./index.js');
      const server = new (GitHubMCPServer as any)();

      const result = server.convertSchemaToZod(null);
      expect(result).toEqual({});
    });
  });

  describe('registerToolConfig', () => {
    it('should register tool successfully', async () => {
      const { GitHubMCPServer } = await import('./index.js');
      const server = new (GitHubMCPServer as any)();

      const config = {
        tool: {
          name: 'test-tool',
          description: 'Test tool',
          inputSchema: {
            properties: { param: { type: 'string' } },
            required: ['param'],
          },
        },
        handler: vi.fn().mockResolvedValue('test result'),
      };

      server.registerToolConfig(config);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'test-tool',
        'Test tool',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should not register duplicate tools', async () => {
      const { GitHubMCPServer } = await import('./index.js');
      const server = new (GitHubMCPServer as any)();

      const config = {
        tool: { name: 'duplicate-tool', description: 'Duplicate tool' },
        handler: vi.fn(),
      };

      server.registerToolConfig(config);
      server.registerToolConfig(config);

      expect(mockServer.tool).toHaveBeenCalledTimes(1);
    });

    it('should handle tool execution errors', async () => {
      const { GitHubMCPServer } = await import('./index.js');
      const server = new (GitHubMCPServer as any)();

      const config = {
        tool: {
          name: 'error-tool',
          description: 'Error tool',
          inputSchema: { properties: {} },
        },
        handler: vi.fn().mockRejectedValue(new Error('Test error')),
      };

      server.registerToolConfig(config);

      // Get the registered handler function
      const toolCall = mockServer.tool.mock.calls.find(call => call[0] === 'error-tool');
      const handler = toolCall[3];

      const result = await handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: Test error');
    });

    it('should handle successful tool execution', async () => {
      const { GitHubMCPServer } = await import('./index.js');
      const server = new (GitHubMCPServer as any)();

      const config = {
        tool: {
          name: 'success-tool',
          description: 'Success tool',
          inputSchema: { properties: {} },
        },
        handler: vi.fn().mockResolvedValue({ data: 'success' }),
      };

      server.registerToolConfig(config);

      // Get the registered handler function
      const toolCall = mockServer.tool.mock.calls.find(call => call[0] === 'success-tool');
      const handler = toolCall[3];

      const result = await handler({});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('"data": "success"');
    });
  });

  describe('start', () => {
    it('should start server successfully', async () => {
      mockServer.connect.mockResolvedValue(undefined);

      const { GitHubMCPServer } = await import('./index.js');
      const server = new (GitHubMCPServer as any)();

      await server.start();

      expect(StdioServerTransport).toHaveBeenCalled();
      expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
    });

    it('should handle start errors', async () => {
      const error = new Error('Connection failed');
      mockServer.connect.mockRejectedValue(error);

      const { GitHubMCPServer } = await import('./index.js');
      const server = new (GitHubMCPServer as any)();

      await expect(server.start()).rejects.toThrow('Connection failed');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('tool registration', () => {
    it('should register all enabled toolsets', async () => {
      const { GitHubMCPServer } = await import('./index.js');
      new (GitHubMCPServer as any)();

      // Verify tools were registered
      expect(mockServer.tool).toHaveBeenCalled();
      
      // Check that tools from different modules were registered
      const registeredTools = mockServer.tool.mock.calls.map(call => call[0]);
      expect(registeredTools).toContain('get_me');
      expect(registeredTools).toContain('test-repo-tool');
      expect(registeredTools).toContain('test-search-tool');
    });

    it('should only register enabled toolsets', async () => {
      restoreEnv();
      restoreEnv = mockEnvVars({
        GITHUB_PERSONAL_ACCESS_TOKEN: 'test-token',
        GITHUB_TOOLSETS: 'repos,issues',
      });

      const { GitHubMCPServer } = await import('./index.js');
      new (GitHubMCPServer as any)();

      const registeredTools = mockServer.tool.mock.calls.map(call => call[0]);
      expect(registeredTools).toContain('test-repo-tool');
      expect(registeredTools).toContain('test-issue-tool');
      expect(registeredTools).toContain('test-search-tool'); // Always enabled
      expect(registeredTools).not.toContain('test-pr-tool');
    });

    it('should avoid duplicate tool registration', async () => {
      const { GitHubMCPServer } = await import('./index.js');
      new (GitHubMCPServer as any)();

      const registeredTools = mockServer.tool.mock.calls.map(call => call[0]);
      const uniqueTools = [...new Set(registeredTools)];
      
      expect(registeredTools).toHaveLength(uniqueTools.length);
    });
  });
});