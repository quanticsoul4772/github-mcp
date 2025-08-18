/**
 * Parameter schemas for GitHub MCP tools
 * Defines expected parameters for each tool with types and descriptions
 */

export interface ToolSchema {
  name: string;
  properties: Record<
    string,
    {
      type: string;
      description: string;
      optional?: boolean;
    }
  >;
  required: string[];
  examples: Array<Record<string, any>>;
}

/**
 * Issue-related tool schemas
 */
export const ISSUE_TOOL_SCHEMAS: Record<string, ToolSchema> = {
  get_issue: {
    name: 'get_issue',
    properties: {
      owner: {
        type: 'string',
        description: 'The owner of the repository',
      },
      repo: {
        type: 'string',
        description: 'The name of the repository',
      },
      issue_number: {
        type: 'number',
        description: 'The number of the issue',
      },
    },
    required: ['owner', 'repo', 'issue_number'],
    examples: [
      { owner: 'quanticsoul4772', repo: 'github-mcp', issue_number: 38 },
      { owner: 'microsoft', repo: 'vscode', issue_number: 123 },
    ],
  },

  list_issues: {
    name: 'list_issues',
    properties: {
      owner: {
        type: 'string',
        description: 'The owner of the repository',
      },
      repo: {
        type: 'string',
        description: 'The name of the repository',
      },
      state: {
        type: 'string',
        description: 'State of issues to return (open, closed, all)',
        optional: true,
      },
      labels: {
        type: 'string',
        description: 'Comma-separated list of labels',
        optional: true,
      },
      page: {
        type: 'number',
        description: 'Page number for pagination',
        optional: true,
      },
      per_page: {
        type: 'number',
        description: 'Number of issues per page (max 100)',
        optional: true,
      },
    },
    required: ['owner', 'repo'],
    examples: [
      { owner: 'quanticsoul4772', repo: 'github-mcp' },
      { owner: 'quanticsoul4772', repo: 'github-mcp', state: 'open' },
      { owner: 'quanticsoul4772', repo: 'github-mcp', state: 'all', labels: 'bug,critical' },
    ],
  },

  create_issue: {
    name: 'create_issue',
    properties: {
      owner: {
        type: 'string',
        description: 'The owner of the repository',
      },
      repo: {
        type: 'string',
        description: 'The name of the repository',
      },
      title: {
        type: 'string',
        description: 'The title of the issue',
      },
      body: {
        type: 'string',
        description: 'The body/description of the issue',
        optional: true,
      },
      labels: {
        type: 'array',
        description: 'Array of label names',
        optional: true,
      },
      assignees: {
        type: 'array',
        description: 'Array of usernames to assign',
        optional: true,
      },
    },
    required: ['owner', 'repo', 'title'],
    examples: [
      { owner: 'quanticsoul4772', repo: 'github-mcp', title: 'Bug: Parameter validation failing' },
      {
        owner: 'quanticsoul4772',
        repo: 'github-mcp',
        title: 'Feature request',
        body: 'Add new feature',
        labels: ['enhancement'],
      },
    ],
  },

  update_issue: {
    name: 'update_issue',
    properties: {
      owner: {
        type: 'string',
        description: 'The owner of the repository',
      },
      repo: {
        type: 'string',
        description: 'The name of the repository',
      },
      issue_number: {
        type: 'number',
        description: 'The number of the issue',
      },
      title: {
        type: 'string',
        description: 'New title for the issue',
        optional: true,
      },
      body: {
        type: 'string',
        description: 'New body for the issue',
        optional: true,
      },
      state: {
        type: 'string',
        description: 'New state (open or closed)',
        optional: true,
      },
    },
    required: ['owner', 'repo', 'issue_number'],
    examples: [
      { owner: 'quanticsoul4772', repo: 'github-mcp', issue_number: 38, state: 'closed' },
      { owner: 'quanticsoul4772', repo: 'github-mcp', issue_number: 38, title: 'Updated title' },
    ],
  },

  list_issue_comments: {
    name: 'list_issue_comments',
    properties: {
      owner: {
        type: 'string',
        description: 'The owner of the repository',
      },
      repo: {
        type: 'string',
        description: 'The name of the repository',
      },
      issue_number: {
        type: 'number',
        description: 'The number of the issue',
      },
      page: {
        type: 'number',
        description: 'Page number for pagination',
        optional: true,
      },
      per_page: {
        type: 'number',
        description: 'Number of comments per page',
        optional: true,
      },
    },
    required: ['owner', 'repo', 'issue_number'],
    examples: [
      { owner: 'quanticsoul4772', repo: 'github-mcp', issue_number: 38 },
      { owner: 'quanticsoul4772', repo: 'github-mcp', issue_number: 38, per_page: 50 },
    ],
  },
};

/**
 * Pull request tool schemas
 */
export const PR_TOOL_SCHEMAS: Record<string, ToolSchema> = {
  get_pull_request: {
    name: 'get_pull_request',
    properties: {
      owner: {
        type: 'string',
        description: 'The owner of the repository',
      },
      repo: {
        type: 'string',
        description: 'The name of the repository',
      },
      pull_number: {
        type: 'number',
        description: 'The number of the pull request',
      },
    },
    required: ['owner', 'repo', 'pull_number'],
    examples: [
      { owner: 'quanticsoul4772', repo: 'github-mcp', pull_number: 18 },
      { owner: 'microsoft', repo: 'vscode', pull_number: 1234 },
    ],
  },

  list_pull_requests: {
    name: 'list_pull_requests',
    properties: {
      owner: {
        type: 'string',
        description: 'The owner of the repository',
      },
      repo: {
        type: 'string',
        description: 'The name of the repository',
      },
      state: {
        type: 'string',
        description: 'State of PRs to return (open, closed, all)',
        optional: true,
      },
      head: {
        type: 'string',
        description: 'Filter by head branch',
        optional: true,
      },
      base: {
        type: 'string',
        description: 'Filter by base branch',
        optional: true,
      },
      page: {
        type: 'number',
        description: 'Page number for pagination',
        optional: true,
      },
      per_page: {
        type: 'number',
        description: 'Number of PRs per page',
        optional: true,
      },
    },
    required: ['owner', 'repo'],
    examples: [
      { owner: 'quanticsoul4772', repo: 'github-mcp' },
      { owner: 'quanticsoul4772', repo: 'github-mcp', state: 'open' },
      { owner: 'quanticsoul4772', repo: 'github-mcp', state: 'all', base: 'main' },
    ],
  },
};

/**
 * Repository tool schemas
 */
export const REPO_TOOL_SCHEMAS: Record<string, ToolSchema> = {
  get_repository: {
    name: 'get_repository',
    properties: {
      owner: {
        type: 'string',
        description: 'The owner of the repository',
      },
      repo: {
        type: 'string',
        description: 'The name of the repository',
      },
    },
    required: ['owner', 'repo'],
    examples: [
      { owner: 'quanticsoul4772', repo: 'github-mcp' },
      { owner: 'microsoft', repo: 'vscode' },
    ],
  },

  list_repositories: {
    name: 'list_repositories',
    properties: {
      username: {
        type: 'string',
        description: 'Username to list repos for (optional, defaults to authenticated user)',
        optional: true,
      },
      type: {
        type: 'string',
        description: 'Type of repositories (all, owner, public, private, member)',
        optional: true,
      },
      sort: {
        type: 'string',
        description: 'Sort field (created, updated, pushed, full_name)',
        optional: true,
      },
      direction: {
        type: 'string',
        description: 'Sort direction (asc or desc)',
        optional: true,
      },
      page: {
        type: 'number',
        description: 'Page number for pagination',
        optional: true,
      },
      per_page: {
        type: 'number',
        description: 'Number of repos per page',
        optional: true,
      },
    },
    required: [],
    examples: [
      {},
      { username: 'quanticsoul4772' },
      { type: 'public', sort: 'updated', direction: 'desc' },
    ],
  },

  create_repository: {
    name: 'create_repository',
    properties: {
      name: {
        type: 'string',
        description: 'The name of the repository',
      },
      description: {
        type: 'string',
        description: 'A short description of the repository',
        optional: true,
      },
      private: {
        type: 'boolean',
        description: 'Whether the repository is private',
        optional: true,
      },
      auto_init: {
        type: 'boolean',
        description: 'Initialize with README',
        optional: true,
      },
      gitignore_template: {
        type: 'string',
        description: 'Gitignore template name',
        optional: true,
      },
      license_template: {
        type: 'string',
        description: 'License template name',
        optional: true,
      },
    },
    required: ['name'],
    examples: [
      { name: 'my-new-repo' },
      { name: 'my-private-repo', private: true, description: 'A private repository' },
    ],
  },
};

/**
 * Combined schemas for all tools
 */
export const ALL_TOOL_SCHEMAS: Record<string, ToolSchema> = {
  ...ISSUE_TOOL_SCHEMAS,
  ...PR_TOOL_SCHEMAS,
  ...REPO_TOOL_SCHEMAS,
};

/**
 * Get schema for a specific tool
 */
export function getToolSchema(toolName: string): ToolSchema | undefined {
  return ALL_TOOL_SCHEMAS[toolName];
}

/**
 * Get help text for a specific tool
 */
export function getToolHelp(toolName: string): string {
  const schema = getToolSchema(toolName);
  if (!schema) {
    return `Unknown tool: ${toolName}`;
  }

  const lines = [`Tool: ${schema.name}`, ''];

  // Required parameters
  if (schema.required.length > 0) {
    lines.push('Required parameters:');
    for (const param of schema.required) {
      const prop = schema.properties[param];
      lines.push(`  ${param} (${prop.type}): ${prop.description}`);
    }
    lines.push('');
  }

  // Optional parameters
  const optional = Object.entries(schema.properties).filter(
    ([key]) => !schema.required.includes(key)
  );

  if (optional.length > 0) {
    lines.push('Optional parameters:');
    for (const [key, prop] of optional) {
      lines.push(`  ${key} (${prop.type}): ${prop.description}`);
    }
    lines.push('');
  }

  // Examples
  if (schema.examples.length > 0) {
    lines.push('Examples:');
    for (const example of schema.examples) {
      lines.push(`  ${JSON.stringify(example)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Get a list of all available tools
 */
export function listAllTools(): string[] {
  return Object.keys(ALL_TOOL_SCHEMAS);
}

/**
 * Generate documentation for all tools
 */
export function generateToolDocumentation(): string {
  const lines = ['# GitHub MCP Tool Reference', ''];

  const categories = [
    { name: 'Issues', schemas: ISSUE_TOOL_SCHEMAS },
    { name: 'Pull Requests', schemas: PR_TOOL_SCHEMAS },
    { name: 'Repositories', schemas: REPO_TOOL_SCHEMAS },
  ];

  for (const category of categories) {
    lines.push(`## ${category.name}`, '');

    for (const [toolName, schema] of Object.entries(category.schemas)) {
      lines.push(`### ${toolName}`, '');

      // Required parameters
      if (schema.required.length > 0) {
        lines.push('**Required parameters:**');
        for (const param of schema.required) {
          const prop = schema.properties[param];
          lines.push(`- \`${param}\` (${prop.type}): ${prop.description}`);
        }
        lines.push('');
      }

      // Optional parameters
      const optional = Object.entries(schema.properties).filter(
        ([key]) => !schema.required.includes(key)
      );

      if (optional.length > 0) {
        lines.push('**Optional parameters:**');
        for (const [key, prop] of optional) {
          lines.push(`- \`${key}\` (${prop.type}): ${prop.description}`);
        }
        lines.push('');
      }

      // Examples
      if (schema.examples.length > 0) {
        lines.push('**Examples:**');
        lines.push('```json');
        for (const example of schema.examples) {
          lines.push(JSON.stringify(example, null, 2));
        }
        lines.push('```');
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}
