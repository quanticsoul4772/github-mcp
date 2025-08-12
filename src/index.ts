#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import { JSONSchema, JSONSchemaProperty, ToolConfig } from './types.js';
import { createRateLimitedOctokit, GitHubRateLimiter, ResponseSizeLimiter } from './rate-limiter.js';

// Environment configuration
import { env, getGitHubToken, getEnabledToolsets, displayConfig } from './env.js';
import { validateEnvironmentConfiguration } from './validation.js';

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
import { createRepositoryInsightsTools } from './tools/repository-insights.js';
import { createAdvancedSearchTools } from './tools/advanced-search.js';
import { createProjectManagementTools } from './tools/project-management.js';
import { createBatchOperationsTools } from './tools/batch-operations.js';
import { createOptimizedRepositoryTools } from './tools/optimized-repositories.js';

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

// Monitoring and observability
import { metrics } from './metrics.js';
import { logger } from './logger.js';

// Server configuration
const SERVER_NAME = 'github-mcp';
const SERVER_VERSION = '1.0.0';

/**
 * GitHub MCP Server - Provides GitHub API integration for the Model Context Protocol
 * 
 * This server enables AI assistants to interact with GitHub repositories, issues,
 * pull requests, actions, and more through a comprehensive set of tools.
 */
export class GitHubMCPServer {
  /** The MCP server instance */
  private server: McpServer;
  /** GitHub API client (Octokit) */
  private octokit: Octokit;
  /** Rate limiter for GitHub API */
  private rateLimiter: GitHubRateLimiter;
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
  constructor(testMode: boolean = false) {
    // Initialize monitoring first
    logger.info('Starting GitHub MCP Server', { 
      version: SERVER_VERSION,
      node: process.version,
      platform: process.platform
    });
    // Initialize MCP server
    this.server = new McpServer({
      name: SERVER_NAME,
      version: SERVER_VERSION,
      description: 'GitHub API integration for MCP'
    });

    // Validate environment configuration for security
    const envValidation = validateEnvironmentConfiguration();
    if (!envValidation.isValid) {
      logger.error('Environment configuration validation failed', { 
        errors: envValidation.errors 
      });
      
      console.error('ERROR: Environment configuration validation failed:');
      envValidation.errors.forEach(error => console.error(`  - ${error}`));
      console.error('Please check your environment variables and try again.');
      console.error('Create a GitHub Personal Access Token at: https://github.com/settings/tokens');
      console.error('Required scopes: repo, workflow, user, notifications');
      
      // Don't exit in test environment
      if (!testMode && process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        process.exit(1);
      } else if (testMode) {
        // In test mode, avoid throwing in constructor to prevent side effects.
        // Consumers can inspect `envValidation.errors` or `server` state, or throw during start().
        logger.warn('Environment validation failed (test mode): ' + envValidation.errors.join(', '));
      }
    }

    // Get token from environment configuration
    const token = getGitHubToken() || envValidation.sanitizedValues.GITHUB_TOKEN;
    
    // Create rate-limited Octokit instance with logging
    const rateLimitedSetup = createRateLimitedOctokit(token);
    this.octokit = rateLimitedSetup.octokit;
    this.rateLimiter = rateLimitedSetup.rateLimiter;
    
    // Configure base URL if using GitHub Enterprise
    if (env.GITHUB_HOST) {
      this.octokit = new Octokit({
        auth: token,
        baseUrl: env.GITHUB_HOST,
      });
    }
    
    // Add logging to Octokit
    this.octokit.hook.before('request', async (options) => {
      logger.debug('API request', {
        method: options.method,
        url: options.url
      });
    });
    
    this.octokit.hook.after('request', async (response, options) => {
      logger.debug('API response', {
        method: options.method,
        url: options.url,
        status: response.status
      });
    });
    
    this.octokit.hook.error('request', async (error, options) => {
      logger.error('API error', {
        method: options.method,
        url: options.url,
        error: error.message
      });
      throw error;
    });

    // Initialize health monitor
    this.healthManager = new HealthManager();

    // Initialize optimized API client
    this.optimizedClient = new OptimizedAPIClient({
      octokit: this.octokit,
      enableCache: process.env.GITHUB_ENABLE_CACHE !== 'false',
      enableDeduplication: process.env.GITHUB_ENABLE_DEDUPLICATION !== 'false',
      enablePerformanceMonitoring: process.env.GITHUB_ENABLE_MONITORING !== 'false',
    });

    // Parse configuration from validated environment
    this.readOnly = env.GITHUB_READ_ONLY;
    this.enabledToolsets = new Set(getEnabledToolsets());

    // Initialize reliability infrastructure
    const enableVerboseTelemetry = process.env.GITHUB_TELEMETRY_VERBOSE === 'true';
    const telemetry = process.env.GITHUB_TELEMETRY_DISABLE === 'true' 
      ? new NoOpTelemetry() 
      : new ConsoleTelemetry(enableVerboseTelemetry);
    
    const retryManager = new RetryManager(DEFAULT_RETRY_CONFIG, telemetry);
    this.reliabilityManager = new ReliabilityManager(retryManager, telemetry);
    this.healthManager = new HealthManager(this.octokit, this.reliabilityManager);

    // Set up request interception for metrics
    this.setupRequestInterception();

    // Register all tools
    this.registerTools();

    logger.info('GitHub MCP Server initialized', {
      readOnly: this.readOnly,
      toolsets: Array.from(this.enabledToolsets),
      toolCount: this.toolCount
    });
  }

  /**
   * Set up request interception for metrics collection
   */
  private setupRequestInterception() {
    // Hook into Octokit's request lifecycle
    this.octokit.hook.before('request', async (options) => {
      metrics.recordApiCall(options.method, options.url);
      logger.debug('API request', {
        method: options.method,
        url: options.url
      });
    });

    this.octokit.hook.after('request', async (response, options) => {
      logger.debug('API response', {
        method: options.method,
        url: options.url,
        status: response.status
      });
    });

    this.octokit.hook.error('request', async (error, options) => {
      metrics.recordError(error.name, error.message);
      logger.error('API error', {
        method: options.method,
        url: options.url,
        error: error.message
      });
      throw error;
    });
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
        const startTime = Date.now();
        const toolName = config.tool.name;
        try {
          logger.debug(`Tool invoked: ${toolName}`, { args });
          metrics.recordApiCall('TOOL', toolName);
          
          // Execute the tool handler
          const result = await config.handler(args);
          
          const duration = Date.now() - startTime;
          logger.info(`Tool completed: ${toolName}`, { 
            duration, 
            success: true 
          });
          
          // Apply response size limiting
          const { data: limitedResult, truncated, originalSize } = ResponseSizeLimiter.limitResponseSize(result);
          
          let responseText: string;
          if (typeof limitedResult === 'string') {
            responseText = limitedResult;
          } else {
            responseText = JSON.stringify(limitedResult, null, 2);
            // Add truncation warning if response was limited
            if (truncated) {
              const warningMsg = `\n\n[Response truncated - original size: ${originalSize ? Math.round(originalSize / 1024) + 'KB' : 'unknown'}]`;
              responseText += warningMsg;
            }
          }
          
          return {
            content: [
              {
                type: 'text' as const,
                text: responseText,
              },
            ],
          };
        } catch (error: any) {
          const duration = Date.now() - startTime;
          metrics.recordError('TOOL_ERROR', error.message);
          
          // Log error details for debugging
          logger.error(`Tool error: ${toolName}`, {
            error: error.message,
            duration,
            args
          });
          
          // Return standardized error response with proper formatting
          const errorResponse = formatErrorResponse(error);
          const errorMessage = errorResponse.error.message;
          const errorCode = errorResponse.error.code;
          const errorDetails = errorResponse.error.details;
          
          // Build a helpful error message
          let errorText = `Error: ${errorMessage}`;
          if (errorCode && errorCode !== 'UNKNOWN_ERROR') {
            errorText += `\nCode: ${errorCode}`;
          }
          if (errorDetails?.statusCode) {
            errorText += `\nStatus: ${errorDetails.statusCode}`;
          }
          
          return {
            content: [
              {
                type: 'text' as const,
                text: errorText,
              },
            ],
            isError: true,
          };
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
    // Register tools silently - no console output to avoid breaking MCP protocol

    // Add rate limit status tool (always enabled)
    this.registerTool({
      tool: {
        name: 'get_rate_limit_status',
        description: 'Get current GitHub API rate limit status',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => {
        const status = this.rateLimiter.getStatus();
        return {
          rate_limits: {
            core: {
              limit: status.core.limit,
              remaining: status.core.remaining,
              reset: status.core.reset.toISOString(),
              used: status.core.limit - status.core.remaining,
            },
            search: {
              limit: status.search.limit,
              remaining: status.search.remaining,
              reset: status.search.reset.toISOString(),
              used: status.search.limit - status.search.remaining,
            },
            graphql: {
              limit: status.graphql.limit,
              remaining: status.graphql.remaining,
              reset: status.graphql.reset.toISOString(),
              used: status.graphql.limit - status.graphql.remaining,
            },
          },
          queue_length: status.queueLength,
        };
      },
    });
    // Rate limit status tool registered

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
            const { data } = await this.reliabilityManager.executeWithReliability(
              'users.getAuthenticated',
              () => this.octokit.users.getAuthenticated()
            );
            return data;
          }
        }
      ];
      contextTools.forEach(tool => this.registerTool(tool));
      // Context tools registered
    }

    // Register repository tools
    if (this.enabledToolsets.has('repos')) {
      // Standard repository tools
      const repoTools = createRepositoryTools(this.octokit, this.readOnly);
      repoTools.forEach(tool => this.registerTool(tool));
      // Repository tools registered

      // Optimized repository tools
      const optimizedRepoTools = createOptimizedRepositoryTools(
        this.optimizedClient,
        this.readOnly
      );
      optimizedRepoTools.forEach(tool => this.registerTool(tool));
      // Optimized repository tools registered
    }

    // Register issue tools
    if (this.enabledToolsets.has('issues')) {
      const issueTools = createIssueTools(this.octokit, this.readOnly);
      issueTools.forEach(tool => this.registerTool(tool));
      // Issue tools registered
    }

    // Register pull request tools
    if (this.enabledToolsets.has('pull_requests')) {
      const prTools = createPullRequestTools(this.octokit, this.readOnly);
      prTools.forEach(tool => this.registerTool(tool));
      // Pull Request tools registered
    }

    // Register GitHub Actions tools
    if (this.enabledToolsets.has('actions')) {
      const actionTools = createActionTools(this.octokit, this.readOnly);
      actionTools.forEach(tool => this.registerTool(tool));
      // GitHub Actions tools registered
    }

    // Register code security tools
    if (this.enabledToolsets.has('code_security')) {
      const codeSecurityTools = createCodeSecurityTools(this.octokit, this.readOnly);
      codeSecurityTools.forEach(tool => this.registerTool(tool));
      // Code Security tools registered
    }

    // Register search tools
    const searchTools = createSearchTools(this.octokit);
    searchTools.forEach(tool => this.registerTool(tool));
    // Search tools registered

    // Register user tools
    if (this.enabledToolsets.has('users')) {
      const userTools = createUserTools(this.octokit, this.readOnly);
      userTools.forEach(tool => this.registerTool(tool));
      // User tools registered
    }

    // Register organization tools
    if (this.enabledToolsets.has('orgs')) {
      const orgTools = createOrganizationTools(this.octokit, this.readOnly);
      orgTools.forEach(tool => this.registerTool(tool));
      // Organization tools registered
    }

    // Register notification tools
    if (this.enabledToolsets.has('notifications')) {
      const notificationTools = createNotificationTools(this.octokit, this.readOnly);
      notificationTools.forEach(tool => this.registerTool(tool));
      // Notification tools registered
    }

    // Register discussion tools
    if (this.enabledToolsets.has('discussions')) {
      const discussionTools = createDiscussionTools(this.octokit, this.readOnly);
      discussionTools.forEach(tool => this.registerTool(tool));
      // Discussion tools registered
    }

    // Register Dependabot tools
    if (this.enabledToolsets.has('dependabot')) {
      const dependabotTools = createDependabotTools(this.octokit, this.readOnly);
      dependabotTools.forEach(tool => this.registerTool(tool));
      // Dependabot tools registered
    }

    // Register secret scanning tools
    if (this.enabledToolsets.has('secret_protection')) {
      const secretScanningTools = createSecretScanningTools(this.octokit, this.readOnly);
      secretScanningTools.forEach(tool => this.registerTool(tool));
      // Secret Scanning tools registered
    }

    // GraphQL repository insights tools
    if (this.enabledToolsets.has('graphql_insights')) {
      const insightsTools = createRepositoryInsightsTools(this.octokit, this.readOnly);
      insightsTools.forEach(tool => this.registerTool(tool));
      // Repository Insights tools registered
    }

    // Advanced search tools
    if (this.enabledToolsets.has('advanced_search')) {
      const advancedSearchTools = createAdvancedSearchTools(this.octokit, this.readOnly);
      advancedSearchTools.forEach(tool => this.registerTool(tool));
      // Advanced Search tools registered
    }

    // Project management tools
    if (this.enabledToolsets.has('project_management')) {
      const projectTools = createProjectManagementTools(this.octokit, this.readOnly);
      projectTools.forEach(tool => this.registerTool(tool));
      // Project Management tools registered
    }

    // Batch operations tools
    if (this.enabledToolsets.has('batch_operations')) {
      const batchTools = createBatchOperationsTools(this.octokit, this.readOnly);
      batchTools.forEach(tool => this.registerTool(tool));
      // Batch Operations tools registered
    }

    // Register health monitoring tools
    const healthTools = createHealthTools(this.healthManager);
    healthTools.forEach(tool => this.registerTool(tool));
    // Health monitoring tools registered

    // Register monitoring and observability tools
    if (this.enabledToolsets.has('monitoring')) {
      // Register health tools
      const healthTools = createHealthTools(this.healthManager);
      healthTools.forEach((tool: any) => this.registerTool(tool));
      // Health tools registered
    }

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
    // Performance monitoring tools registered

    // Total tools registered successfully
  }

  /**
   * Start the MCP server
   * 
   * Establishes a stdio connection for communication with the MCP client
   */
  public async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logger.info('GitHub MCP server started', {
        version: SERVER_VERSION,
        transport: 'stdio'
      });
      
      // Server started successfully - avoid console output to not break MCP protocol
      // displayConfig(); // Disabled to avoid console output
    } catch (error) {
      logger.error('Failed to start GitHub MCP server', { error });
      // Failed to start server - logged via logger above
      if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        process.exit(1);
      }
      throw error;
    }
  }
}

// Export for testing and external usage
export { GitHubMCPServer };
