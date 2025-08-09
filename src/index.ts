#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';

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

// Performance optimizations
import { OptimizedAPIClient } from './optimized-api-client.js';
import { globalPerformanceMonitor } from './performance-monitor.js';

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

class GitHubMCPServer {
  private server: McpServer;
  private octokit: Octokit;
  private optimizedClient: OptimizedAPIClient;
  private enabledToolsets: Set<string>;
  private readOnly: boolean;
  private registeredTools = new Set<string>();
  private toolCount = 0;

  constructor() {
    // Initialize MCP server
    this.server = new McpServer({
      name: SERVER_NAME,
      version: SERVER_VERSION,
      description: 'GitHub API integration for MCP'
    });

    // Initialize Octokit with auth token
    const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) {
      console.error('ERROR: GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_TOKEN environment variable is required');
      console.error('Please create a GitHub Personal Access Token at: https://github.com/settings/tokens');
      console.error('Required scopes: repo, workflow, user, notifications');
      process.exit(1);
    }

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

    // Register all tools
    this.registerTools();
  }

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
        try {
          const result = await config.handler(args);
          return {
            content: [
              {
                type: 'text' as const,
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          console.error(`Error in tool ${config.tool.name}:`, errorMessage);
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

    // Performance monitoring tools
    this.registerPerformanceTools();

    // Optimized repository tools (showcase performance optimizations)
    if (this.enabledToolsets.has('repos')) {
      const optimizedRepoTools = createOptimizedRepositoryTools(this.optimizedClient, this.readOnly);
      for (const config of optimizedRepoTools) {
        this.registerToolConfig(config);
      }
    }
  }

  private registerPerformanceTools() {
    // Performance metrics tool
    this.registerToolConfig({
      tool: {
        name: 'get_performance_metrics',
        description: 'Get comprehensive performance metrics and statistics',
        inputSchema: {
          type: 'object',
          properties: {
            detailed: {
              type: 'boolean',
              description: 'Include detailed operation metrics',
            },
          },
        },
      },
      handler: async (args: any) => {
        const metrics = this.optimizedClient.getMetrics();
        
        if (args.detailed) {
          return {
            summary: metrics,
            report: this.optimizedClient.getPerformanceReport(),
          };
        }
        
        return metrics;
      },
    });

    // Cache management tool
    this.registerToolConfig({
      tool: {
        name: 'manage_cache',
        description: 'Manage API response cache (clear, invalidate patterns)',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: 'Action to perform: clear, invalidate',
              enum: ['clear', 'invalidate'],
            },
            pattern: {
              type: 'string',
              description: 'Pattern to match for invalidation (regex or string)',
            },
          },
          required: ['action'],
        },
      },
      handler: async (args: any) => {
        if (args.action === 'clear') {
          this.optimizedClient.clearAll();
          return { message: 'Cache cleared successfully' };
        } else if (args.action === 'invalidate' && args.pattern) {
          const count = this.optimizedClient.invalidateCache(args.pattern);
          return { message: `Invalidated ${count} cache entries matching pattern: ${args.pattern}` };
        }
        
        return { error: 'Invalid action or missing pattern for invalidate' };
      },
    });
  }

  public async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      console.error(`GitHub MCP Server v${SERVER_VERSION} started successfully`);
      console.error(`Enabled toolsets: ${Array.from(this.enabledToolsets).join(', ')}`);
      console.error(`Read-only mode: ${this.readOnly}`);
      console.error(`Total tools registered: ${this.toolCount}`);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the server
const server = new GitHubMCPServer();
server.start().catch((error: Error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
