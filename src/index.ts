#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';

// Observability modules
import { logger, LogContext } from './logger.js';
import { metrics, ApiCallMetric } from './metrics.js';
import { healthMonitor } from './health.js';
import { startMemoryMonitoring } from './observability.js';

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
  /** Set of enabled toolsets */
  private enabledToolsets: Set<string>;
  /** Whether the server is running in read-only mode */
  private readOnly: boolean;
  /** Set of registered tool names to prevent duplicates */
  private registeredTools = new Set<string>();
  /** Total count of registered tools */
  private toolCount = 0;
  /** Request correlation tracking */
  private requestContexts = new Map<string, LogContext>();

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

    // Initialize structured logging
    logger.info('Initializing GitHub MCP Server', {
      version: SERVER_VERSION,
      nodeVersion: process.version,
      platform: process.platform
    });

    // Initialize Octokit with auth token
    const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) {
      logger.error('GitHub token not found', {
        requiredEnvVars: ['GITHUB_PERSONAL_ACCESS_TOKEN', 'GITHUB_TOKEN'],
        tokenUrl: 'https://github.com/settings/tokens',
        requiredScopes: ['repo', 'workflow', 'user', 'notifications']
      });
      process.exit(1);
    }

    this.octokit = new Octokit({
      auth: token,
    });

    // Initialize health monitoring
    healthMonitor.setOctokit(this.octokit);

    // Parse configuration
    this.readOnly = process.env.GITHUB_READ_ONLY === '1' || process.env.GITHUB_READ_ONLY === 'true';

    // Parse enabled toolsets
    const toolsetsConfig = process.env.GITHUB_TOOLSETS;
    if (toolsetsConfig === 'all' || !toolsetsConfig) {
      this.enabledToolsets = new Set(DEFAULT_TOOLSETS);
    } else {
      this.enabledToolsets = new Set(toolsetsConfig.split(',').map(t => t.trim()));
    }

    logger.info('Server configuration loaded', {
      readOnly: this.readOnly,
      enabledToolsets: Array.from(this.enabledToolsets),
      logLevel: logger.getLogLevel()
    });

    // Register all tools
    this.registerTools();
  }

  /**
   * Convert a JSON Schema to a Zod schema for validation
   * 
   * @param schema - The JSON schema to convert
   * @returns A Zod schema object for input validation
   */
  private convertSchemaToZod(schema: any): any {
    if (!schema || !schema.properties) {
      return {};
    }

    const zodSchema: any = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      const prop = value as any;
      let zodType: any;
      
      if (prop.type === 'string') {
        zodType = z.string();
      } else if (prop.type === 'number') {
        zodType = z.number();
      } else if (prop.type === 'boolean') {
        zodType = z.boolean();
      } else if (prop.type === 'array') {
        zodType = z.array(z.any());
      } else if (prop.type === 'object') {
        zodType = z.object({});
      } else {
        zodType = z.any();
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
  private registerToolConfig(config: any) {
    // Skip if already registered
    if (this.registeredTools.has(config.tool.name)) {
      return;
    }

    this.registeredTools.add(config.tool.name);
    this.toolCount++;

    // Convert the JSON schema to Zod schema
    const zodSchema = this.convertSchemaToZod(config.tool.inputSchema);

    // Register the tool with the correct signature
    this.server.tool(
      config.tool.name,
      config.tool.description || 'GitHub API operation',
      zodSchema,
      async (args: any) => {
        const startTime = Date.now();
        const correlationId = logger.generateCorrelationId();
        const toolLogger = logger.child({
          correlationId,
          tool: config.tool.name,
          operation: 'tool_execution'
        });

        // Store request context
        this.requestContexts.set(correlationId, {
          correlationId,
          tool: config.tool.name,
          operation: 'tool_execution'
        });

        toolLogger.debug('Tool execution started', { args });

        try {
          const result = await config.handler(args);
          const duration = Date.now() - startTime;
          
          // Record successful API call metric
          const apiMetric: ApiCallMetric = {
            tool: config.tool.name,
            operation: 'tool_execution',
            success: true,
            duration,
            timestamp: Date.now()
          };
          metrics.recordApiCall(apiMetric);

          toolLogger.info('Tool execution completed', {
            duration,
            success: true
          });

          // Clean up request context
          this.requestContexts.delete(correlationId);

          return {
            content: [
              {
                type: 'text' as const,
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const duration = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          
          // Record failed API call metric
          const apiMetric: ApiCallMetric = {
            tool: config.tool.name,
            operation: 'tool_execution',
            success: false,
            duration,
            timestamp: Date.now()
          };
          metrics.recordApiCall(apiMetric);

          // Record error metric
          metrics.recordError({
            tool: config.tool.name,
            operation: 'tool_execution',
            errorType: error instanceof Error ? error.name : 'UnknownError',
            message: errorMessage,
            timestamp: Date.now()
          });

          toolLogger.error('Tool execution failed', {
            duration,
            success: false,
            errorType: error instanceof Error ? error.name : 'UnknownError'
          }, error instanceof Error ? error : undefined);

          // Clean up request context
          this.requestContexts.delete(correlationId);

          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${errorMessage}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Register all enabled tools with the MCP server
   * 
   * Tools are organized into toolsets that can be selectively enabled
   * via the GITHUB_TOOLSETS environment variable.
   */
  private registerTools() {
    // Context tools (always enabled)
    if (this.enabledToolsets.has('context')) {
      const contextTools = createUserTools(this.octokit, this.readOnly);
      // Only add get_me from user tools
      const getMeTool = contextTools.find(t => t.tool.name === 'get_me');
      if (getMeTool) {
        this.registerToolConfig(getMeTool);
      }
    }

    // Repository tools
    if (this.enabledToolsets.has('repos')) {
      const repoTools = createRepositoryTools(this.octokit, this.readOnly);
      for (const config of repoTools) {
        this.registerToolConfig(config);
      }
    }

    // Issue tools
    if (this.enabledToolsets.has('issues')) {
      const issueTools = createIssueTools(this.octokit, this.readOnly);
      for (const config of issueTools) {
        this.registerToolConfig(config);
      }
    }

    // Pull request tools
    if (this.enabledToolsets.has('pull_requests')) {
      const prTools = createPullRequestTools(this.octokit, this.readOnly);
      for (const config of prTools) {
        this.registerToolConfig(config);
      }
    }

    // Actions tools
    if (this.enabledToolsets.has('actions')) {
      const actionTools = createActionTools(this.octokit, this.readOnly);
      for (const config of actionTools) {
        this.registerToolConfig(config);
      }
    }

    // Code security tools
    if (this.enabledToolsets.has('code_security')) {
      const securityTools = createCodeSecurityTools(this.octokit, this.readOnly);
      for (const config of securityTools) {
        this.registerToolConfig(config);
      }
    }

    // Search tools (always enabled)
    const searchTools = createSearchTools(this.octokit);
    for (const config of searchTools) {
      this.registerToolConfig(config);
    }

    // User tools
    if (this.enabledToolsets.has('users')) {
      const userTools = createUserTools(this.octokit, this.readOnly);
      // Filter out duplicate get_me if already added from context
      const filteredUserTools = userTools.filter(t => !this.registeredTools.has(t.tool.name));
      for (const config of filteredUserTools) {
        this.registerToolConfig(config);
      }
    }

    // Organization tools
    if (this.enabledToolsets.has('orgs')) {
      const orgTools = createOrganizationTools(this.octokit, this.readOnly);
      for (const config of orgTools) {
        this.registerToolConfig(config);
      }
    }

    // Notification tools
    if (this.enabledToolsets.has('notifications')) {
      const notificationTools = createNotificationTools(this.octokit, this.readOnly);
      for (const config of notificationTools) {
        this.registerToolConfig(config);
      }
    }

    // Discussion tools
    if (this.enabledToolsets.has('discussions')) {
      const discussionTools = createDiscussionTools(this.octokit, this.readOnly);
      for (const config of discussionTools) {
        this.registerToolConfig(config);
      }
    }

    // Dependabot tools
    if (this.enabledToolsets.has('dependabot')) {
      const dependabotTools = createDependabotTools(this.octokit, this.readOnly);
      for (const config of dependabotTools) {
        this.registerToolConfig(config);
      }
    }

    // Secret scanning tools
    if (this.enabledToolsets.has('secret_protection')) {
      const secretTools = createSecretScanningTools(this.octokit, this.readOnly);
      for (const config of secretTools) {
        this.registerToolConfig(config);
      }
    }

    // Health and monitoring tools (always enabled)
    this.registerHealthTools();

    logger.info('Tool registration completed', {
      totalTools: this.toolCount,
      registeredTools: Array.from(this.registeredTools)
    });
  }

  /**
   * Register health and monitoring tools
   */
  private registerHealthTools() {
    // Health check tool
    this.server.tool(
      'get_health',
      'Get server health status',
      {},
      async () => {
        const health = await healthMonitor.getHealth();
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(health, null, 2)
          }]
        };
      }
    );

    // Readiness check tool
    this.server.tool(
      'get_readiness',
      'Check if server is ready to handle requests',
      {},
      async () => {
        const readiness = await healthMonitor.getReadiness();
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(readiness, null, 2)
          }]
        };
      }
    );

    // Detailed status tool
    this.server.tool(
      'get_status',
      'Get detailed server status and metrics',
      {},
      async () => {
        const status = await healthMonitor.getDetailedStatus();
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(status, null, 2)
          }]
        };
      }
    );

    // Prometheus metrics tool
    this.server.tool(
      'get_metrics',
      'Get Prometheus-formatted metrics',
      {},
      async () => {
        const prometheusMetrics = healthMonitor.getMetrics();
        return {
          content: [{
            type: 'text' as const,
            text: prometheusMetrics
          }]
        };
      }
    );

    this.toolCount += 4;
  }

  public async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      // Start health monitoring
      healthMonitor.startMonitoring();
      
      // Start memory monitoring every 30 seconds
      startMemoryMonitoring(30000);
      
      logger.info('GitHub MCP Server started successfully', {
        version: SERVER_VERSION,
        enabledToolsets: Array.from(this.enabledToolsets),
        readOnly: this.readOnly,
        totalTools: this.toolCount
      });
      
      // Log startup metrics
      const startupDuration = 1000; // Placeholder since we don't track actual startup time
      metrics.recordPerformance({
        operation: 'server_startup',
        duration: startupDuration,
        memoryUsage: process.memoryUsage(),
        timestamp: Date.now()
      });
      
      // Record successful startup
      metrics.incrementCounter('server_starts_total{status="success"}');
      
    } catch (error) {
      logger.error('Failed to start server', {}, error instanceof Error ? error : undefined);
      
      // Record failed startup
      metrics.incrementCounter('server_starts_total{status="error"}');
      
      process.exit(1);
    }
  }
}

// Global error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {}, error);
  metrics.recordError({
    tool: 'system',
    operation: 'uncaught_exception',
    errorType: error.name,
    message: error.message,
    timestamp: Date.now()
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
  metrics.recordError({
    tool: 'system',
    operation: 'unhandled_rejection',
    errorType: 'UnhandledRejection',
    message: String(reason),
    timestamp: Date.now()
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Start the server
const server = new GitHubMCPServer();
server.start().catch((error: Error) => {
  logger.error('Fatal server startup error', {}, error);
  process.exit(1);
});
