/**
 * Integration tests for the GitHub MCP Server
 * Tests the complete flow from server initialization to tool execution
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMockOctokit, mockResponses } from '../mocks/octokit.js';
import { mockEnvVars, mockProcessExit, restoreProcessExit } from '../helpers/test-helpers.js';

// Mock external dependencies
vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(),
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
      tool: vi.fn((name, description, schema, handler) => {
        registeredTools.set(name, { description, schema, handler });
      }),
      connect: vi.fn(),
    };
    (McpServer as any).mockImplementation(() => mockServer);

    // Mock Octokit
    mockOctokit = createMockOctokit();
    const { Octokit } = await import('@octokit/rest');
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
    vi.clearAllMocks();
  });

  describe('Server Initialization', () => {
    it('should initialize server with all tools registered', async () => {
      const { GitHubMCPServer } = await import('../../index.js');
      new (GitHubMCPServer as any)();

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
      const server = new (GitHubMCPServer as any)();

      await server.start();

      expect(StdioServerTransport).toHaveBeenCalled();
      expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
    });
  });

  describe('Tool Execution Flow', () => {
    let server: any;

    beforeEach(async () => {
      const { GitHubMCPServer } = await import('../../index.js');
      server = new (GitHubMCPServer as any)();
    });

    it('should execute get_me tool successfully', async () => {
      // Setup mock response
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: mockResponses.user,
      });

      // Get the registered handler
      const tool = registeredTools.get('get_me');
      expect(tool).toBeDefined();

      const result = await tool.handler({});

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('test-user');
    });

    it('should execute get_file_contents tool successfully', async () => {
      // Setup mock response
      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: mockResponses.fileContent,
      });

      // Get the registered handler
      const tool = registeredTools.get('get_file_contents');
      expect(tool).toBeDefined();

      const result = await tool.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'README.md',
      });

      expect(mockOctokit.rest.repos.getContent).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'README.md',
        ref: undefined,
      });

      expect(result.content[0].text).toContain('Test file content');
    });

    it('should execute list_repositories tool successfully', async () => {
      // Setup mock response
      mockOctokit.rest.repos.listForAuthenticatedUser.mockResolvedValue({
        data: [mockResponses.repo],
      });

      // Get the registered handler
      const tool = registeredTools.get('list_repositories');
      expect(tool).toBeDefined();

      const result = await tool.handler({
        visibility: 'all',
      });

      expect(mockOctokit.rest.repos.listForAuthenticatedUser).toHaveBeenCalledWith({
        visibility: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 30,
        page: 1,
      });

      expect(result.content[0].text).toContain('test-repo');
    });

    it('should handle tool execution errors gracefully', async () => {
      // Setup mock to throw error
      mockOctokit.rest.users.getAuthenticated.mockRejectedValue(
        new Error('API Error: Rate limited')
      );

      // Get the registered handler
      const tool = registeredTools.get('get_me');
      const result = await tool.handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: API Error: Rate limited');
    });

    it('should validate tool parameters', async () => {
      // Get the registered handler
      const tool = registeredTools.get('get_file_contents');

      const result = await tool.handler({
        owner: '', // Invalid empty owner
        repo: 'test-repo',
        path: 'README.md',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error:');
    });
  });

  describe('Read-Only Mode', () => {
    beforeEach(() => {
      restoreEnv();
      restoreEnv = mockEnvVars({
        GITHUB_PERSONAL_ACCESS_TOKEN: 'test-token-123',
        GITHUB_READ_ONLY: 'true',
        GITHUB_TOOLSETS: 'all',
      });
    });

    it('should not register write tools in read-only mode', async () => {
      const { GitHubMCPServer } = await import('../../index.js');
      new (GitHubMCPServer as any)();

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
    beforeEach(() => {
      restoreEnv();
      restoreEnv = mockEnvVars({
        GITHUB_PERSONAL_ACCESS_TOKEN: 'test-token-123',
        GITHUB_READ_ONLY: 'false',
        GITHUB_TOOLSETS: 'repos,issues',
      });
    });

    it('should only register tools from enabled toolsets', async () => {
      const { GitHubMCPServer } = await import('../../index.js');
      new (GitHubMCPServer as any)();

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
      delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      delete process.env.GITHUB_TOKEN;

      const { GitHubMCPServer } = await import('../../index.js');

      expect(() => new (GitHubMCPServer as any)()).toThrow('process.exit called');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle server connection errors', async () => {
      mockServer.connect.mockRejectedValue(new Error('Connection failed'));

      const { GitHubMCPServer } = await import('../../index.js');
      const server = new (GitHubMCPServer as any)();

      await expect(server.start()).rejects.toThrow('Connection failed');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Tool Schema Conversion', () => {
    it('should convert JSON schemas to Zod schemas correctly', async () => {
      const { GitHubMCPServer } = await import('../../index.js');
      const server = new (GitHubMCPServer as any)();

      // Test the schema conversion with a sample schema
      const jsonSchema = {
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          count: { type: 'number' },
          active: { type: 'boolean' },
          tags: { type: 'array' },
          metadata: { type: 'object' },
        },
        required: ['owner', 'repo'],
      };

      const zodSchema = server.convertSchemaToZod(jsonSchema);

      expect(zodSchema).toBeDefined();
      expect(zodSchema.owner).toBeDefined();
      expect(zodSchema.repo).toBeDefined();
      expect(zodSchema.count).toBeDefined();
      expect(zodSchema.active).toBeDefined();
      expect(zodSchema.tags).toBeDefined();
      expect(zodSchema.metadata).toBeDefined();
    });
  });

  describe('Multiple Tool Calls', () => {
    let server: any;

    beforeEach(async () => {
      const { GitHubMCPServer } = await import('../../index.js');
      server = new (GitHubMCPServer as any)();
    });

    it('should handle concurrent tool executions', async () => {
      // Setup mock responses
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: mockResponses.user,
      });
      mockOctokit.rest.repos.listForAuthenticatedUser.mockResolvedValue({
        data: [mockResponses.repo],
      });

      // Execute multiple tools concurrently
      const getMeTool = registeredTools.get('get_me');
      const listReposTool = registeredTools.get('list_repositories');

      const promises = [
        getMeTool.handler({}),
        listReposTool.handler({ visibility: 'all' }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      expect(results[0].content[0].text).toContain('test-user');
      expect(results[1].content[0].text).toContain('test-repo');
    });

    it('should handle mixed success and error scenarios', async () => {
      // Setup mixed responses
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: mockResponses.user,
      });
      mockOctokit.rest.repos.get.mockRejectedValue(
        new Error('Repository not found')
      );

      // Execute tools with mixed outcomes
      const getMeTool = registeredTools.get('get_me');
      const getRepoTool = registeredTools.get('get_repository');

      const [successResult, errorResult] = await Promise.all([
        getMeTool.handler({}),
        getRepoTool.handler({ owner: 'test-owner', repo: 'nonexistent' }),
      ]);

      expect(successResult.isError).toBeUndefined();
      expect(successResult.content[0].text).toContain('test-user');

      expect(errorResult.isError).toBe(true);
      expect(errorResult.content[0].text).toContain('Repository not found');
    });
  });
});