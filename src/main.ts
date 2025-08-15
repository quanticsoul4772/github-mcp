#!/usr/bin/env node
/**
 * Main entry point for GitHub MCP Server
 * This file handles server startup and should be used as the entry point
 * to avoid side effects when importing the module for testing or integration
 */

// Load environment variables from .env file
import 'dotenv/config';

import { GitHubMCPServer } from './index.js';
import { logger } from './logger.js';

async function main() {
  try {
    const server = new GitHubMCPServer();
    await server.start();
    logger.info('GitHub MCP server started successfully');
  } catch (error) {
    logger.error('Failed to start GitHub MCP server', { error });
    process.exit(1);
  }
}

// Only run if this file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
