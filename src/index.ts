#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import { JSONSchema, JSONSchemaProperty, ToolConfig } from './types.js';

// Tool modules
import { createRepositoryTools } from './tools/repositories.js';
import { createIssueTools } from './tools/issues.js';
import { createPullRequestTools } from './tools/pull-requests.js';
import { createActionTools } from './tools/actions.js';
import { createCodeSecurityTools } from './tools/code-security.js';
import { createSearchTools } from './tools/search.js';
import { createUserTools } from './tools/users.js';
import { createOrganizationTools } from './tools/organizations.js';
import { createNotificationTools } from './tools/notifications.js';
import { createDiscussionTools } from './tools/discussions.js';
import { createDependabotTools } from './tools/dependabot.js';
import { createSecretScanningTools } from './tools/secret-scanning.js';
import { createOptimizedRepositoryTools } from './tools/optimized-repositories.js';
import { validateEnvironmentConfiguration } from './validation.js';

// Performance optimizations
import { OptimizedAPIClient } from './optimized-api-client.js';
import { globalPerformanceMonitor } from './performance-monitor.js';

// Reliability and health monitoring
import { 
  ReliabilityManager, 
  RetryManager, 
  ConsoleTelemetry, 
  NoOpTelemetry,
  DEFAULT_RETRY_CONFIG 
} from './reliability.js';
import { HealthManager, createHealthTools } from './health.js';
import { formatErrorResponse } from './errors.js';

// Server configuration
const SERVER_NAME = 'github-mcp';
const SERVER_VERSION = '1.0.0';

// Tool categories configuration
const DEFAULT_TOOLSETS = [
  'context',
  'repos', 
  'issues',
  'pull_requests',
  'actions',
  'code_security',
  'users',
  'orgs',
  'notifications',
  'discussions',
  'dependabot',
  'secret_protection',
];

/**
 * GitHub MCP Server - Provides GitHub API integration for the Model Context Protocol
 * 
 * This server enables AI assistants to interact with GitHub repositories, issues,
 * pull requests, actions, and more through a comprehensive set of tools.
 */
class GitHubMCPServer {
  /** The MCP server instance */
  private server: McpServer;
  /** GitHub API client (Octokit) */
  private octokit: Octokit;
  /** Optimized API client with performance features */
  private optimizedClient: OptimizedAPIClient;
  /** Set of enabled toolsets */
  private enabledToolsets: Set<string>;
  /** Whether the server is running in read-only mode */
  private readOnly: boolean;
  /** Set of registered tool names to prevent duplicates */
  private registeredTools = new Set<string>();
  /** Total count of registered tools */
  private toolCount = 0;
  /** Reliability manager for circuit breaker and retry logic */
  private reliabilityManager: ReliabilityManager;
  /** Health manager for system monitoring */
  private healthManager: HealthManager;

  /**
   * Initialize the GitHub MCP Server
   * 
   * Sets up the MCP server, configures GitHub authentication,
   * parses environment variables, and registers tools.
   */
  constructor() {
    // Initialize MCP server
    this.server = new McpServer({
      name: SERVER_NAME,
      version: SERVER_VERSION,
      description: 'GitHub API integration for MCP'
    });

    // Validate environment configuration for security
    const envValidation = validateEnvironmentConfiguration();
    if (!envValidation.isValid) {
      console.error('ERROR: Environment configuration validation failed:');
      envValidation.errors.forEach(error => console.error(`  - ${error}`));
      console.error('Please check your environment variables and try again.');
      console.error('Create a GitHub Personal Access Token at: https://github.com/settings/tokens');
      console.error('Required scopes: repo, workflow, user, notifications');
      process.exit(1);
    }

    // Initialize Octokit with validated token
    const token = envValidation.sanitizedValues.GITHUB_TOKEN;
    this.octokit = new Octokit({
      auth: token,
    });

    // Initialize optimized API client
    this.optimizedClient = new OptimizedAPIClient({
      octokit: this.octokit,
      enableCache: process.env.GITHUB_ENABLE_CACHE !== 'false',
      enableDeduplication: process.env.GITHUB_ENABLE_DEDUPLICATION !== 'false',
      enablePerformanceMonitoring: process.env.GITHUB_ENABLE_MONITORING !== 'false',
    });

    // Parse configuration
    this.readOnly = process.env.GITHUB_READ_ONLY === '1' || process.env.GITHUB_READ_ONLY === 'true';

    // Parse enabled toolsets
    const toolsetsConfig = process.env.GITHUB_TOOLSETS;
    if (toolsetsConfig === 'all' || !toolsetsConfig) {
      this.enabledToolsets = new Set(DEFAULT_TOOLSETS);
    } else {
      this.enabledToolsets = new Set(toolsetsConfig.split(',').map(t => t.trim()));
    }

    // Initialize reliability infrastructure
    const enableVerboseTelemetry = process.env.GITHUB_TELEMETRY_VERBOSE === 'true';
    const telemetry = process.env.GITHUB_TELEMETRY_DISABLE === 'true' 
      ? new NoOpTelemetry() 
      : new ConsoleTelemetry(enableVerboseTelemetry);
    
    const retryManager = new RetryManager(DEFAULT_RETRY_CONFIG, telemetry);
    this.reliabilityManager = new ReliabilityManager(retryManager, telemetry);
    this.healthManager = new HealthManager(this.octokit, this.reliabilityManager);

    // Register all tools
    this.registerTools();
  }

  /**
   * Convert a JSON Schema to a Zod schema for validation
   * 
   * @param schema - The JSON schema to convert
   * @returns A Zod schema object for input validation
   */
  private convertSchemaToZod(schema: JSONSchema): Record<string, z.ZodType> {
    if (!schema?.properties) {
      return {};
    }

    const zodSchema: Record<string, z.ZodType> = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      const prop = value as JSONSchemaProperty;
      let zodType: z.ZodType;
      
      if (prop.type === 'string') {
        zodType = z.string();
      } else if (prop.type === 'number') {
        zodType = z.number();
      } else if (prop.type === 'boolean') {
        zodType = z.boolean();
      } else if (prop.type === 'array') {
        // Try to infer array element type from items property
        if (prop.items) {
          if (prop.items.type === 'string') {
            zodType = z.array(z.string());
          } else if (prop.items.type === 'number') {
            zodType = z.array(z.number());
          } else if (prop.items.type === 'boolean') {
            zodType = z.array(z.boolean());
          } else if (prop.items.type === 'object') {
            zodType = z.array(z.object({}));
          } else {
            zodType = z.array(z.unknown());
          }
        } else {
          zodType = z.array(z.unknown());
        }
      } else if (prop.type === 'object') {
        zodType = z.object({});
      } else {
        zodType = z.unknown();
      }

      if (prop.description) {
        zodType = zodType.describe(prop.description);
      }

      // Handle optional fields
      if (!schema.required || !schema.required.includes(key)) {
        zodType = zodType.optional();
      }

      zodSchema[key] = zodType;
    }

    return zodSchema;
  }

  /**
   * Register a tool configuration with the MCP server
   * 
   * @param config - Tool configuration object containing tool definition and handler
   */
  private registerTool(config: ToolConfig<unknown, unknown>): void {
    // Skip if tool name is already registered (prevent duplicates)
    if (this.registeredTools.has(config.tool.name)) {
      console.warn(`Tool ${config.tool.name} is already registered. Skipping duplicate.`);
      return;
    }

    // Convert the JSON schema to Zod schema for validation
    const zodSchema = this.convertSchemaToZod(config.tool.inputSchema as JSONSchema);

    // Register the tool handler with the MCP server
    this.server.tool(
      config.tool.name,
      config.tool.description || 'GitHub API operation',
      z.object(zodSchema),
      async (args: Record<string, unknown>) => {
        try {
          // Execute the tool handler
          const result = await config.handler(args);
          return result;
        } catch (error: any) {
          // Log error details for debugging
          console.error(`Error in tool ${config.tool.name}:`, error);
          
          // Return standardized error response
          throw new Error(formatErrorResponse(error));
        }
      }
    );

    // Track registered tool
    this.registeredTools.add(config.tool.name);
    this.toolCount++;
  }

  /**
   * Register all available GitHub tools with the server
   * 
   * Conditionally registers tools based on enabled toolsets
   * and read-only mode configuration.
   */
  private registerTools() {
    console.log('\n====================================');
    console.log('  GitHub MCP Server Initialization');
    console.log('====================================\n');
    
    console.log('Configuration:');
    console.log(`  Read-only mode: ${this.readOnly}`);
    console.log(`  Enabled toolsets: ${Array.from(this.enabledToolsets).join(', ')}`);
    console.log('\nRegistering tools...\n');

    // Register context tools
    if (this.enabledToolsets.has('context')) {
      const contextTools = [
        {
          tool: {
            name: 'get_me',
            description: 'Get my GitHub user profile',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          handler: async () => {
            const reliableCall = this.reliabilityManager.wrapApiCall(
              () => this.octokit.users.getAuthenticated(),
              'users.getAuthenticated',
              { skipRateLimit: false }
            );
            const { data } = await reliableCall();
            return data;
          }
        }
      ];
      contextTools.forEach(tool => this.registerTool(tool));
      console.log(`  ✓ Context tools (${contextTools.length})`);
    }

    // Register repository tools
    if (this.enabledToolsets.has('repos')) {
      // Standard repository tools
      const repoTools = createRepositoryTools(this.octokit, this.readOnly);
      repoTools.forEach(tool => this.registerTool(tool));
      console.log(`  ✓ Repository tools (${repoTools.length})`);

      // Optimized repository tools
      const optimizedRepoTools = createOptimizedRepositoryTools(
        this.optimizedClient,
        this.readOnly
      );
      optimizedRepoTools.forEach(tool => this.registerTool(tool));
      console.log(`  ✓ Optimized repository tools (${optimizedRepoTools.length})`);
    }

    // Register issue tools
    if (this.enabledToolsets.has('issues')) {
      const issueTools = createIssueTools(this.octokit, this.readOnly);
      issueTools.forEach(tool => this.registerTool(tool));
      console.log(`  ✓ Issue tools (${issueTools.length})`);
    }

    // Register pull request tools
    if (this.enabledToolsets.has('pull_requests')) {
      const prTools = createPullRequestTools(this.octokit, this.readOnly);
      prTools.forEach(tool => this.registerTool(tool));
      console.log(`  ✓ Pull Request tools (${prTools.length})`);
    }

    // Register GitHub Actions tools
    if (this.enabledToolsets.has('actions')) {
      const actionTools = createActionTools(this.octokit, this.readOnly);
      actionTools.forEach(tool => this.registerTool(tool));
      console.log(`  ✓ GitHub Actions tools (${actionTools.length})`);
    }

    // Register code security tools
    if (this.enabledToolsets.has('code_security')) {
      const codeSecurityTools = createCodeSecurityTools(this.octokit, this.readOnly);
      codeSecurityTools.forEach(tool => this.registerTool(tool));
      console.log(`  ✓ Code Security tools (${codeSecurityTools.length})`);
    }

    // Register search tools
    const searchTools = createSearchTools(this.octokit);
    searchTools.forEach(tool => this.registerTool(tool));
    console.log(`  ✓ Search tools (${searchTools.length})`);

    // Register user tools
    if (this.enabledToolsets.has('users')) {
      const userTools = createUserTools(this.octokit, this.readOnly);
      userTools.forEach(tool => this.registerTool(tool));
      console.log(`  ✓ User tools (${userTools.length})`);
    }

    // Register organization tools
    if (this.enabledToolsets.has('orgs')) {
      const orgTools = createOrganizationTools(this.octokit, this.readOnly);
      orgTools.forEach(tool => this.registerTool(tool));
      console.log(`  ✓ Organization tools (${orgTools.length})`);
    }

    // Register notification tools
    if (this.enabledToolsets.has('notifications')) {
      const notificationTools = createNotificationTools(this.octokit, this.readOnly);
      notificationTools.forEach(tool => this.registerTool(tool));
      console.log(`  ✓ Notification tools (${notificationTools.length})`);
    }

    // Register discussion tools
    if (this.enabledToolsets.has('discussions')) {
      const discussionTools = createDiscussionTools(this.octokit, this.readOnly);
      discussionTools.forEach(tool => this.registerTool(tool));
      console.log(`  ✓ Discussion tools (${discussionTools.length})`);
    }

    // Register Dependabot tools
    if (this.enabledToolsets.has('dependabot')) {
      const dependabotTools = createDependabotTools(this.octokit, this.readOnly);
      dependabotTools.forEach(tool => this.registerTool(tool));
      console.log(`  ✓ Dependabot tools (${dependabotTools.length})`);
    }

    // Register secret scanning tools
    if (this.enabledToolsets.has('secret_protection')) {
      const secretScanningTools = createSecretScanningTools(this.octokit, this.readOnly);
      secretScanningTools.forEach(tool => this.registerTool(tool));
      console.log(`  ✓ Secret Scanning tools (${secretScanningTools.length})`);
    }

    // Register health monitoring tools
    const healthTools = createHealthTools(this.healthManager);
    healthTools.forEach(tool => this.registerTool(tool));
    console.log(`  ✓ Health monitoring tools (${healthTools.length})`);

    // Register performance monitoring tools
    const perfTools = [
      {
        tool: {
          name: 'get_performance_metrics',
          description: 'Get current performance metrics and statistics',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        handler: async () => globalPerformanceMonitor.getMetrics()
      },
      {
        tool: {
          name: 'get_performance_report',
          description: 'Generate a comprehensive performance report',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        handler: async () => globalPerformanceMonitor.generateReport()
      },
      {
        tool: {
          name: 'clear_api_cache',
          description: 'Clear all API response caches',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        handler: async () => {
          this.optimizedClient.clearCache();
          return { success: true, message: 'All caches cleared' };
        }
      }
    ];
    perfTools.forEach(tool => this.registerTool(tool));
    console.log(`  ✓ Performance monitoring tools (${perfTools.length})`);

    console.log(`\nTotal tools registered: ${this.toolCount}`);
    console.log('\n====================================\n');
  }

  /**
   * Start the MCP server
   * 
   * Establishes a stdio connection for communication with the MCP client
   */
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.log(`GitHub MCP server (v${SERVER_VERSION}) is running`);
    console.log('Ready to accept MCP requests via stdio\n');
  }
}

// Main execution
(async () => {
  try {
    const server = new GitHubMCPServer();
    await server.start();
  } catch (error) {
    console.error('Failed to start GitHub MCP server:', error);
    process.exit(1);
  }
})();
