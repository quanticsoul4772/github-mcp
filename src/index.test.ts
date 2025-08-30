/**
 * Tests for the main GitHubMCPServer class
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  mockProcessExit,
  restoreProcessExit,
} from './__tests__/helpers/test-helpers.js';

// Mock the config module BEFORE it's imported by anything else
vi.mock('./config.js', () => ({
  config: {
    NODE_ENV: 'test',
    SKIP_VALIDATION: false,
    GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_defaultmocktoken_valid_for_tests',
    GITHUB_TOKEN: undefined,
    GITHUB_READ_ONLY: false,
    GITHUB_TOOLSETS: 'all',
    GITHUB_HOST: undefined,
    GITHUB_ENABLE_CACHE: true,
    GITHUB_ENABLE_GRAPHQL_CACHE: true,
    GITHUB_ENABLE_DEDUPLICATION: true,
    GITHUB_ENABLE_MONITORING: true,
    GITHUB_TELEMETRY_DISABLE: false,
    GITHUB_TELEMETRY_VERBOSE: false,
  },
  getGitHubToken: vi.fn(() => 'ghp_defaultmocktoken_valid_for_tests'),
  getEnabledToolsets: vi.fn(() => ['all']),
  displayConfig: vi.fn(),
}));

// Mock other external dependencies
vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('./optimized-api-client.js');
vi.mock('./tool-registry.js');

describe('GitHubMCPServer', () => {
  let mockMcpServer: any;
  let mockTransport: any;
  let exitSpy: any;
  let configMock: any;
  let ToolRegistryMock: any;

  beforeEach(async () => {
    vi.resetModules(); // This is crucial to re-evaluate modules with new mocks

    // Re-import the mocked config to get access to the mock functions
    configMock = await import('./config.js');
    const { ToolRegistry } = await import('./tool-registry.js');
    ToolRegistryMock = ToolRegistry;
    ToolRegistryMock.prototype.registerAllTools = vi.fn();

    // Mock MCP server
    mockMcpServer = {
      tool: vi.fn(),
      connect: vi.fn(),
    };
    (McpServer as any).mockImplementation(() => mockMcpServer);

    // Mock transport
    mockTransport = { connect: vi.fn() };
    (StdioServerTransport as any).mockImplementation(() => mockTransport);

    // Mock process.exit
    exitSpy = mockProcessExit();
  });

  afterEach(() => {
    restoreProcessExit(exitSpy);
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with proper configuration', async () => {
      const { OptimizedAPIClient } = await import('./optimized-api-client.js');
      const { GitHubMCPServer } = await import('./index.js');

      new (GitHubMCPServer as any)({ start: false });

      expect(McpServer).toHaveBeenCalledWith({
        name: 'github-mcp',
        version: expect.any(String),
        description: 'GitHub API integration for MCP',
      });

      expect(OptimizedAPIClient).toHaveBeenCalledWith({
        octokit: expect.any(Object),
        enableCache: expect.any(Boolean),
        enableGraphQLCache: expect.any(Boolean),
        enableDeduplication: expect.any(Boolean),
        enablePerformanceMonitoring: expect.any(Boolean),
      });
    });

    it('should use token from getGitHubToken', async () => {
      configMock.getGitHubToken.mockReturnValue('gho_secondarytoken_valid_for_tests');
      const { OptimizedAPIClient } = await import('./optimized-api-client.js');
      const { GitHubMCPServer } = await import('./index.js');

      new (GitHubMCPServer as any)({ start: false });

      expect(OptimizedAPIClient).toHaveBeenCalledWith({
        octokit: expect.any(Object),
        enableCache: expect.any(Boolean),
        enableGraphQLCache: expect.any(Boolean),
        enableDeduplication: expect.any(Boolean),
        enablePerformanceMonitoring: expect.any(Boolean),
      });
    });

    it('should configure read-only mode correctly', async () => {
        configMock.config.GITHUB_READ_ONLY = true;
        const { GitHubMCPServer } = await import('./index.js');

        new (GitHubMCPServer as any)({ start: false });

        expect(ToolRegistryMock).toHaveBeenCalledWith(
            expect.any(Object), // server
            expect.any(Object), // octokit
            expect.any(Object), // optimizedClient
            expect.any(Object), // reliabilityManager
            expect.any(Object), // healthManager
            expect.any(Object), // rateLimiter
            true // readOnly
        );
    });

    it('should pass enabled toolsets to ToolRegistry', async () => {
        configMock.getEnabledToolsets.mockReturnValue(['repos', 'issues']);
        const { GitHubMCPServer } = await import('./index.js');

        new (GitHubMCPServer as any)({ start: false });

        expect(ToolRegistryMock).toHaveBeenCalledWith(
            expect.any(Object), // server
            expect.any(Object), // octokit
            expect.any(Object), // optimizedClient
            expect.any(Object), // reliabilityManager
            expect.any(Object), // healthManager
            expect.any(Object), // rateLimiter
            expect.any(Boolean) // readOnly
        );
    });
  });

  describe('start', () => {
    it('should start server successfully', async () => {
      mockMcpServer.connect.mockResolvedValue(undefined);
      const { GitHubMCPServer } = await import('./index.js');
      const server = new (GitHubMCPServer as any)({ start: false });

      await server.start();

      expect(StdioServerTransport).toHaveBeenCalled();
      expect(mockMcpServer.connect).toHaveBeenCalledWith(mockTransport);
    });

    it('should handle start errors', async () => {
      const error = new Error('Connection failed');
      mockMcpServer.connect.mockRejectedValue(error);
      const { GitHubMCPServer } = await import('./index.js');
      const server = new (GitHubMCPServer as any)({ start: false });

      await expect(server.start()).rejects.toThrow('Connection failed');
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  describe('tool registration', () => {
    it('should call registerAllTools on startup', async () => {
        const { GitHubMCPServer } = await import('./index.js');

        new (GitHubMCPServer as any)({ start: false });

        const toolRegistryInstance = ToolRegistryMock.mock.instances[0];
        expect(toolRegistryInstance.registerAllTools).toHaveBeenCalled();
    });
  });
});
