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
    github: {
      token: 'ghp_defaultmocktoken_valid_for_tests',
      readOnly: false,
      toolsets: ['all'],
      telemetry: false,
      api: {
        baseUrl: 'https://api.github.com',
        retries: 3,
        retryDelay: 1000,
      },
      agent: {
        exclude: [],
        analysis_depth: 10,
        max_file_size: 1000000,
      },
    },
    server: {
      port: 3000,
      logLevel: 'info',
    },
    performance: {
      enabled: false,
      reportInterval: 60000,
    },
    reliability: {
      telemetry: 'console',
    },
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

      expect(OptimizedAPIClient).toHaveBeenCalledWith(
        'ghp_defaultmocktoken_valid_for_tests',
        expect.any(Object),
      );
    });

    it('should use token from getGitHubToken', async () => {
      configMock.getGitHubToken.mockReturnValue('gho_secondarytoken_valid_for_tests');
      const { OptimizedAPIClient } = await import('./optimized-api-client.js');
      const { GitHubMCPServer } = await import('./index.js');

      new (GitHubMCPServer as any)({ start: false });

      expect(OptimizedAPIClient).toHaveBeenCalledWith('gho_secondarytoken_valid_for_tests', expect.any(Object));
    });

    it('should configure read-only mode correctly', async () => {
        configMock.config.github.readOnly = true;
        const { GitHubMCPServer } = await import('./index.js');

        new (GitHubMCPServer as any)({ start: false });

        expect(ToolRegistryMock).toHaveBeenCalledWith(expect.any(Object), true, expect.any(Array));
    });

    it('should pass enabled toolsets to ToolRegistry', async () => {
        configMock.getEnabledToolsets.mockReturnValue(['repos', 'issues']);
        const { GitHubMCPServer } = await import('./index.js');

        new (GitHubMCPServer as any)({ start: false });

        expect(ToolRegistryMock).toHaveBeenCalledWith(expect.any(Object), expect.any(Boolean), ['repos', 'issues']);
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
