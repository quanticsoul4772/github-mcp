#!/usr/bin/env node

/**
 * EXAMPLE: Refactored index.ts showing how to integrate the new architecture
 * This demonstrates how the main application would be structured after full refactoring
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';

// New architecture imports
import { bootstrap, getServices } from './foundation/bootstrap.js';
import { createIssueToolsModular } from './tools/issues/index.js';

// Legacy tool modules (to be refactored)
import { createRepositoryTools } from './tools/repositories.js';
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
  'secret_scanning',
  'dependabot',
  'search',
  'users',
  'orgs',
  'notifications',
  'discussions',
];

async function main() {
  // Initialize Octokit
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    console.error('Error: GITHUB_PERSONAL_ACCESS_TOKEN environment variable is required');
    process.exit(1);
  }

  const octokit = new Octokit({ auth: token });
  const readOnly = process.env.GITHUB_READ_ONLY === 'true';
  
  // Bootstrap dependency injection container
  const container = bootstrap(octokit);
  const services = getServices(container);

  // Create MCP server
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  // Register tools
  const enabledToolsets = process.env.GITHUB_TOOLSETS?.split(',') || DEFAULT_TOOLSETS;

  if (enabledToolsets.includes('issues')) {
    // Use NEW refactored architecture for issues
    const issueTools = createIssueToolsModular(octokit, services.issueService, readOnly);
    for (const tool of issueTools) {
      server.addTool(tool.tool, tool.handler);
    }
  }

  // Legacy tools (to be refactored in subsequent phases)
  if (enabledToolsets.includes('repos')) {
    const repoTools = createRepositoryTools(octokit, readOnly);
    for (const tool of repoTools) {
      server.addTool(tool.tool, tool.handler);
    }
  }

  if (enabledToolsets.includes('pull_requests')) {
    const prTools = createPullRequestTools(octokit, readOnly);
    for (const tool of prTools) {
      server.addTool(tool.tool, tool.handler);
    }
  }

  // ... other legacy tools ...

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GitHub MCP Server (Refactored) running on stdio');
}

// Error handling
process.on('SIGINT', async () => {
  console.error('Shutting down GitHub MCP Server...');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}

/**
 * REFACTORING MIGRATION STRATEGY:
 * 
 * 1. Phase 1 (Current): Foundation + Issues module refactored
 *    - New architecture coexists with legacy tools
 *    - Issues use new DI container and service layer
 *    - Other tools continue using direct Octokit
 * 
 * 2. Phase 2: Repositories module
 *    - Add RepositoryService to DI container
 *    - Refactor repositories.ts → repositories/ folder with 6+ focused modules
 *    - Update this file to use new repositories tools
 * 
 * 3. Phase 3: Pull Requests module  
 *    - Add PullRequestService to DI container
 *    - Refactor pull-requests.ts → pull-requests/ folder with 8+ focused modules
 *    - Update this file to use new PR tools
 * 
 * 4. Phase 4: Actions module
 *    - Add ActionsService to DI container  
 *    - Refactor actions.ts → actions/ folder with 5+ focused modules
 *    - Update this file to use new actions tools
 * 
 * 5. Phase 5: Remaining modules
 *    - Apply same pattern to all remaining tool modules
 *    - Remove legacy tool imports
 *    - This file becomes much cleaner with just DI setup and service resolution
 */