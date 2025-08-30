import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import { JSONSchema, JSONSchemaProperty, ToolConfig } from './types.js';
import { jsonSchemaToZod } from 'json-schema-to-zod';
import { ResponseSizeLimiter } from './rate-limiter.js';
import { OptimizedAPIClient } from './optimized-api-client.js';
import { ReliabilityManager } from './reliability.js';
import { HealthManager } from './health.js';
import { formatErrorResponse } from './errors.js';
import { metrics } from './metrics.js';
import { logger } from './logger.js';
import { getEnabledToolsets } from './config.js';

// Tool creators
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
import { createAgentTools } from './agents/tools/agent-tools.js';
import { createCacheManagementTools } from './tools/cache-management.js';
import { createHealthTools } from './health.js';
import { globalPerformanceMonitor } from './performance-monitor.js';
import { GitHubRateLimiter } from './rate-limiter.js';


export class ToolRegistry {
    private server: McpServer;
    private octokit: Octokit;
    private optimizedClient: OptimizedAPIClient;
    private reliabilityManager: ReliabilityManager;
    private healthManager: HealthManager;
    private rateLimiter: GitHubRateLimiter;
    private readOnly: boolean;
    private enabledToolsets: Set<string>;
    private registeredTools = new Set<string>();
    public toolCount = 0;

    constructor(
        server: McpServer,
        octokit: Octokit,
        optimizedClient: OptimizedAPIClient,
        reliabilityManager: ReliabilityManager,
        healthManager: HealthManager,
        rateLimiter: GitHubRateLimiter,
        readOnly: boolean
    ) {
        this.server = server;
        this.octokit = octokit;
        this.optimizedClient = optimizedClient;
        this.reliabilityManager = reliabilityManager;
        this.healthManager = healthManager;
        this.rateLimiter = rateLimiter;
        this.readOnly = readOnly;
        this.enabledToolsets = new Set(getEnabledToolsets());
    }

    public registerTool(config: ToolConfig<unknown, unknown>): void {
        if (this.registeredTools.has(config.tool.name)) {
            logger.warn(`Tool ${config.tool.name} is already registered. Skipping duplicate.`);
            return;
        }

        try {
            // The MCP SDK needs both JSON Schema (for listing) and Zod (for validation)
            const jsonSchema = config.tool.inputSchema as any;
        
        // Check if we have parameters
        const hasParams = jsonSchema && jsonSchema.properties && Object.keys(jsonSchema.properties).length > 0;
        
        if (hasParams) {
            // For tools with parameters, we need to pass the JSON Schema directly
            // The MCP SDK will handle its own validation
            // We'll validate in the handler ourselves
            this.server.tool(
              config.tool.name,
              config.tool.description || 'GitHub API operation',
              jsonSchema,
          async (args: any) => {
                const startTime = Date.now();
                const toolName = config.tool.name;
                
                try {
                    logger.debug(`Tool invoked: ${toolName}`, { args });
                    metrics.recordApiCall({ method: 'TOOL', url: toolName } as any);

                    // The MCP SDK should have already validated the args
                    // Ensure args is at least an empty object if undefined
                    const validatedArgs = args ?? {};
                    
                    // Pass the validated args to the handler
                    const result = await config.handler(validatedArgs);

                    const duration = Date.now() - startTime;
                    logger.info(`Tool completed: ${toolName}`, {
                        duration,
                        success: true,
                    });

                    const {
                        data: limitedResult,
                        truncated,
                        originalSize,
                    } = ResponseSizeLimiter.limitResponseSize(result);

                    let responseText: string;
                    if (typeof limitedResult === 'string') {
                        responseText = limitedResult;
                    } else {
                        responseText = JSON.stringify(limitedResult, null, 2);
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
                    metrics.recordError({ name: 'TOOL_ERROR', message: error.message } as any);

                    logger.error(`Tool error: ${toolName}`, {
                        error: error.message,
                        duration,
                        args,
                    });

                    const errorResponse = formatErrorResponse(error);
                    const errorMessage = errorResponse.error.message;
                    const errorCode = errorResponse.error.code;
                    const errorDetails = errorResponse.error.details;

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

            } else {
                // No parameters - register without schema
                this.server.tool(
                    config.tool.name,
                    config.tool.description || 'GitHub API operation',
                    async () => {
                        const startTime = Date.now();
                        const toolName = config.tool.name;
                        try {
                            logger.debug(`Tool invoked: ${toolName}`, { args: {} });
                            metrics.recordApiCall({ method: 'TOOL', url: toolName } as any);

                            // Call handler with empty object for no-params tools
                            const result = await config.handler({});

                            const duration = Date.now() - startTime;
                            logger.info(`Tool completed: ${toolName}`, {
                                duration,
                                success: true,
                            });

                            const {
                                data: limitedResult,
                                truncated,
                                originalSize,
                            } = ResponseSizeLimiter.limitResponseSize(result);

                            let responseText: string;
                            if (typeof limitedResult === 'string') {
                                responseText = limitedResult;
                            } else {
                                responseText = JSON.stringify(limitedResult, null, 2);
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
                            metrics.recordError({ name: 'TOOL_ERROR', message: error.message } as any);

                            logger.error(`Tool error: ${toolName}`, {
                                error: error.message,
                                duration,
                                args: {},
                            });

                            const errorResponse = formatErrorResponse(error);
                            const errorMessage = errorResponse.error.message;
                            const errorCode = errorResponse.error.code;
                            const errorDetails = errorResponse.error.details;

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
            }

        this.registeredTools.add(config.tool.name);
        this.toolCount++;
        } catch (error) {
            console.error(`ERROR: Failed to register tool ${config.tool.name}:`, error);
            logger.error(`Failed to register tool ${config.tool.name}`, { error });
        }
    }

    public registerAllTools() {
        interface ToolSet {
            name: string;
            createTools: () => ToolConfig<unknown, unknown>[];
            condition?: boolean;
        }

        const toolSets: ToolSet[] = [
            {
                name: 'context',
                createTools: () => [
                    {
                        tool: {
                            name: 'get_me',
                            description: 'Get my GitHub user profile',
                            inputSchema: { type: 'object' as const, properties: {} },
                        },
                        handler: async () => {
                            const { data } = await this.reliabilityManager.executeWithReliability(
                                'users.getAuthenticated',
                                () => this.octokit.users.getAuthenticated()
                            );
                            return data;
                        },
                    },
                ],
                condition: this.enabledToolsets.has('context'),
            },
            {
                name: 'repos',
                createTools: () => {
                    const repoTools = createRepositoryTools(this.octokit, this.readOnly);
                    const optimizedTools = this.optimizedClient 
                        ? createOptimizedRepositoryTools(this.optimizedClient, this.readOnly)
                        : [];
                    return [...repoTools, ...optimizedTools];
                },
                condition: this.enabledToolsets.has('repos'),
            },
            { name: 'issues', createTools: () => createIssueTools(this.octokit, this.readOnly), condition: this.enabledToolsets.has('issues') },
            { name: 'pull_requests', createTools: () => createPullRequestTools(this.octokit, this.readOnly), condition: this.enabledToolsets.has('pull_requests') },
            { name: 'actions', createTools: () => createActionTools(this.octokit, this.readOnly), condition: this.enabledToolsets.has('actions') },
            { name: 'code_security', createTools: () => createCodeSecurityTools(this.octokit, this.readOnly), condition: this.enabledToolsets.has('code_security') },
            { name: 'search', createTools: () => createSearchTools(this.octokit), condition: true }, // always enabled
            { name: 'users', createTools: () => createUserTools(this.octokit, this.readOnly), condition: this.enabledToolsets.has('users') },
            { name: 'orgs', createTools: () => createOrganizationTools(this.octokit, this.readOnly), condition: this.enabledToolsets.has('orgs') },
            { name: 'notifications', createTools: () => createNotificationTools(this.octokit, this.readOnly), condition: this.enabledToolsets.has('notifications') },
            { name: 'discussions', createTools: () => {
                const octokit = (this.optimizedClient && typeof this.optimizedClient.getOctokit === 'function') 
                    ? this.optimizedClient.getOctokit() 
                    : this.octokit;
                return createDiscussionTools(octokit, this.readOnly);
            }, condition: this.enabledToolsets.has('discussions') },
            { name: 'dependabot', createTools: () => createDependabotTools(this.octokit, this.readOnly), condition: this.enabledToolsets.has('dependabot') },
            { name: 'secret_protection', createTools: () => createSecretScanningTools(this.octokit, this.readOnly), condition: this.enabledToolsets.has('secret_protection') },
            { name: 'graphql_insights', createTools: () => {
                const octokit = (this.optimizedClient && typeof this.optimizedClient.getOctokit === 'function')
                    ? this.optimizedClient.getOctokit()
                    : this.octokit;
                return createRepositoryInsightsTools(octokit, this.readOnly);
            }, condition: this.enabledToolsets.has('graphql_insights') },
            { name: 'advanced_search', createTools: () => {
                // Advanced search needs the optimized client, but can fall back to regular octokit
                return createAdvancedSearchTools(this.optimizedClient || { getOctokit: () => this.octokit } as any, this.readOnly);
            }, condition: this.enabledToolsets.has('advanced_search') },
            { name: 'project_management', createTools: () => createProjectManagementTools(this.octokit, this.readOnly), condition: this.enabledToolsets.has('project_management') },
            { name: 'batch_operations', createTools: () => createBatchOperationsTools(this.octokit, this.readOnly), condition: this.enabledToolsets.has('batch_operations') },
            { name: 'health', createTools: () => createHealthTools(this.healthManager), condition: true }, // always enabled
            { name: 'cache_management', createTools: () => {
                // Cache management needs the optimized client, skip if not available
                return this.optimizedClient ? createCacheManagementTools(this.optimizedClient) : [];
            }, condition: true }, // always enabled
            { name: 'monitoring', createTools: () => createHealthTools(this.healthManager), condition: this.enabledToolsets.has('monitoring') },
            {
                name: 'performance',
                createTools: () => [
                    {
                        tool: { name: 'get_performance_metrics', description: 'Get current performance metrics and statistics', inputSchema: { type: 'object' as const, properties: {} } },
                        handler: async () => globalPerformanceMonitor.getMetrics(),
                    },
                    {
                        tool: { name: 'get_performance_report', description: 'Generate a comprehensive performance report', inputSchema: { type: 'object' as const, properties: {} } },
                        handler: async () => globalPerformanceMonitor.generateReport(),
                    },
                    {
                        tool: { name: 'clear_api_cache', description: 'Clear all API response caches', inputSchema: { type: 'object' as const, properties: {} } },
                        handler: async () => {
                            if (this.optimizedClient && typeof this.optimizedClient.clearCache === 'function') {
                                this.optimizedClient.clearCache();
                            }
                            return { success: true, message: 'All caches cleared' };
                        },
                    },
                ],
                condition: true, // always enabled
            },
            { name: 'agent', createTools: () => createAgentTools(), condition: true }, // always enabled
        ];

        // Base tools that are always registered
        this.registerTool({
            tool: { name: 'get_rate_limit_status', description: 'Get current GitHub API rate limit status', inputSchema: { type: 'object' as const, properties: {} } },
            handler: async () => {
                const status = this.rateLimiter.getStatus();
                return {
                    rate_limits: {
                        core: { limit: status.core.limit, remaining: status.core.remaining, reset: status.core.reset.toISOString(), used: status.core.limit - status.core.remaining },
                        search: { limit: status.search.limit, remaining: status.search.remaining, reset: status.search.reset.toISOString(), used: status.search.limit - status.search.remaining },
                        graphql: { limit: status.graphql.limit, remaining: status.graphql.remaining, reset: status.graphql.reset.toISOString(), used: status.graphql.limit - status.graphql.remaining },
                    },
                    queue_length: status.queueLength,
                };
            },
        });


        for (const toolSet of toolSets) {
            if (toolSet.condition) {
                const tools = toolSet.createTools();
                tools.forEach(tool => this.registerTool(tool));
            }
        }

        logger.info('All tools registered', { count: this.toolCount });
    }
}
