#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import { JSONSchema, JSONSchemaProperty, ToolConfig } from './types.js';
import {
  createRateLimitedOctokit,
  GitHubRateLimiter,
  ResponseSizeLimiter,
} from './rate-limiter.js';

// Environment configuration
import { config, getGitHubToken, getEnabledToolsets, displayConfig } from './config.js';
import { ToolRegistry } from './tool-registry.js';

// Performance optimizations
import { OptimizedAPIClient } from './optimized-api-client.js';
import { globalPerformanceMonitor } from './performance-monitor.js';

// Reliability and health monitoring
import {
  ReliabilityManager,
  RetryManager,
  ConsoleTelemetry,
  NoOpTelemetry,
  DEFAULT_RETRY_CONFIG,
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
  /** Whether the server is running in read-only mode */
  private readOnly: boolean;
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
    // The 'config' object is initialized on import and will throw an error
    // if validation fails. The try/catch in the config module handles logging
    // and process exit for non-test environments.

    // Initialize monitoring first
    logger.info('Starting GitHub MCP Server', {
      version: SERVER_VERSION,
      node: process.version,
      platform: process.platform,
    });
    // Initialize MCP server
    this.server = new McpServer({
      name: SERVER_NAME,
      version: SERVER_VERSION,
      description: 'GitHub API integration for MCP',
    });

    // Get token from environment configuration
    const token = getGitHubToken();

    // Create rate-limited Octokit instance with logging
    const rateLimitedSetup = createRateLimitedOctokit(token);
    this.octokit = rateLimitedSetup.octokit;
    this.rateLimiter = rateLimitedSetup.rateLimiter;

    // Configure base URL if using GitHub Enterprise
    if (config.GITHUB_HOST) {
      const rateLimitedSetup = createRateLimitedOctokit(token, { baseUrl: config.GITHUB_HOST });
      this.octokit = rateLimitedSetup.octokit;
      this.rateLimiter = rateLimitedSetup.rateLimiter;
    }

    // Add logging to Octokit
    this.octokit.hook.before('request', async options => {
      logger.debug('API request', {
        method: options.method,
        url: options.url,
      });
    });

    this.octokit.hook.after('request', async (response, options) => {
      logger.debug('API response', {
        method: options.method,
        url: options.url,
        status: response.status,
      });
    });

    this.octokit.hook.error('request', async (error, options) => {
      logger.error('API error', {
        method: options.method,
        url: options.url,
        error: error.message,
      });
      throw error;
    });

    // Initialize health monitor
    this.healthManager = new HealthManager(this.octokit);

    // Initialize optimized API client
    this.optimizedClient = new OptimizedAPIClient({
      octokit: this.octokit,
      enableCache: config.GITHUB_ENABLE_CACHE,
      enableGraphQLCache: config.GITHUB_ENABLE_GRAPHQL_CACHE,
      enableDeduplication: config.GITHUB_ENABLE_DEDUPLICATION,
      enablePerformanceMonitoring: config.GITHUB_ENABLE_MONITORING,
    });

    // Parse configuration from validated environment
    this.readOnly = config.GITHUB_READ_ONLY;

    // Initialize reliability infrastructure
    const enableVerboseTelemetry = config.GITHUB_TELEMETRY_VERBOSE;
    const telemetry =
      config.GITHUB_TELEMETRY_DISABLE
        ? new NoOpTelemetry()
        : new ConsoleTelemetry(enableVerboseTelemetry);

    const retryManager = new RetryManager(DEFAULT_RETRY_CONFIG, telemetry);
    this.reliabilityManager = new ReliabilityManager(retryManager, telemetry);
    this.healthManager = new HealthManager(this.octokit, this.reliabilityManager);

    // Set up request interception for metrics
    this.setupRequestInterception();

    // Register all tools
    const toolRegistry = new ToolRegistry(
        this.server,
        this.octokit,
        this.optimizedClient,
        this.reliabilityManager,
        this.healthManager,
        this.rateLimiter,
        this.readOnly,
    );
    toolRegistry.registerAllTools();

    logger.info('GitHub MCP Server initialized', {
      readOnly: this.readOnly,
      toolsets: getEnabledToolsets(),
      toolCount: toolRegistry.toolCount,
    });
  }

  /**
   * Set up request interception for metrics collection
   */
  private setupRequestInterception() {
    // Hook into Octokit's request lifecycle
    this.octokit.hook.before('request', async options => {
      metrics.recordApiCall({ method: options.method, url: options.url } as any);
      logger.debug('API request', {
        method: options.method,
        url: options.url,
      });
    });

    this.octokit.hook.after('request', async (response, options) => {
      logger.debug('API response', {
        method: options.method,
        url: options.url,
        status: response.status,
      });
    });

    this.octokit.hook.error('request', async (error, options) => {
      metrics.recordError({ name: error.name, message: error.message } as any);
      logger.error('API error', {
        method: options.method,
        url: options.url,
        error: error.message,
      });
      throw error;
    });
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
        transport: 'stdio',
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
// GitHubMCPServer is already exported above
