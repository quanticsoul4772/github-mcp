#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tool schemas for documentation
const TOOL_SCHEMAS = {
  // Repository tools
  list_repositories: {
    required: [],
    optional: ['username', 'org', 'type', 'sort', 'per_page'],
    description: 'List repositories for the authenticated user',
    example: {
      type: 'all',
      sort: 'updated',
      per_page: 30
    }
  },
  get_repository: {
    required: ['owner', 'repo'],
    optional: [],
    description: 'Get details of a specific repository',
    example: {
      owner: 'quanticsoul4772',
      repo: 'github-mcp'
    }
  },
  create_repository: {
    required: ['name'],
    optional: ['description', 'private', 'auto_init', 'gitignore_template', 'license_template'],
    description: 'Create a new GitHub repository',
    example: {
      name: 'my-new-repo',
      description: 'A new repository',
      private: false,
      auto_init: true
    }
  },

  // Issue tools
  get_issue: {
    required: ['owner', 'repo', 'issue_number'],
    optional: [],
    description: 'Get details of a specific GitHub issue',
    example: {
      owner: 'quanticsoul4772',
      repo: 'github-mcp',
      issue_number: 42
    }
  },
  list_issues: {
    required: ['owner', 'repo'],
    optional: ['state', 'assignee', 'creator', 'labels', 'sort', 'direction', 'per_page'],
    description: 'List issues in a GitHub repository',
    example: {
      owner: 'quanticsoul4772',
      repo: 'github-mcp',
      state: 'open',
      sort: 'created'
    }
  },
  create_issue: {
    required: ['owner', 'repo', 'title'],
    optional: ['body', 'assignees', 'labels', 'milestone'],
    description: 'Create a new GitHub issue',
    example: {
      owner: 'quanticsoul4772',
      repo: 'github-mcp',
      title: 'Bug: Something is broken',
      body: 'Detailed description of the issue',
      labels: ['bug']
    }
  },
  update_issue: {
    required: ['owner', 'repo', 'issue_number'],
    optional: ['title', 'body', 'state', 'assignees', 'labels', 'milestone'],
    description: 'Update an existing GitHub issue',
    example: {
      owner: 'quanticsoul4772',
      repo: 'github-mcp',
      issue_number: 42,
      state: 'closed'
    }
  },

  // Pull Request tools
  get_pull_request: {
    required: ['owner', 'repo', 'pull_number'],
    optional: [],
    description: 'Get details of a specific pull request',
    example: {
      owner: 'quanticsoul4772',
      repo: 'github-mcp',
      pull_number: 10
    }
  },
  list_pull_requests: {
    required: ['owner', 'repo'],
    optional: ['state', 'head', 'base', 'sort', 'direction', 'per_page'],
    description: 'List pull requests in a repository',
    example: {
      owner: 'quanticsoul4772',
      repo: 'github-mcp',
      state: 'open'
    }
  },
  create_pull_request: {
    required: ['owner', 'repo', 'title', 'head', 'base'],
    optional: ['body', 'maintainer_can_modify', 'draft'],
    description: 'Create a new pull request',
    example: {
      owner: 'quanticsoul4772',
      repo: 'github-mcp',
      title: 'Feature: Add new functionality',
      head: 'feature-branch',
      base: 'main',
      body: 'Description of changes'
    }
  },
  merge_pull_request: {
    required: ['owner', 'repo', 'pull_number'],
    optional: ['commit_title', 'commit_message', 'merge_method'],
    description: 'Merge a pull request',
    example: {
      owner: 'quanticsoul4772',
      repo: 'github-mcp',
      pull_number: 10,
      merge_method: 'squash'
    }
  },

  // File operations
  get_file_contents: {
    required: ['owner', 'repo', 'path'],
    optional: ['ref'],
    description: 'Get contents of a file from a repository',
    example: {
      owner: 'quanticsoul4772',
      repo: 'github-mcp',
      path: 'README.md',
      ref: 'main'
    }
  },
  create_or_update_file: {
    required: ['owner', 'repo', 'path', 'message', 'content'],
    optional: ['branch', 'sha', 'committer', 'author'],
    description: 'Create or update a file in a repository',
    example: {
      owner: 'quanticsoul4772',
      repo: 'github-mcp',
      path: 'docs/new-file.md',
      message: 'Add new documentation',
      content: 'SGVsbG8gV29ybGQh', // Base64 encoded
      branch: 'main'
    }
  },

  // Search tools
  search_repositories: {
    required: ['q'],
    optional: ['sort', 'order', 'per_page'],
    description: 'Search for GitHub repositories',
    example: {
      q: 'language:typescript mcp',
      sort: 'stars',
      order: 'desc'
    }
  },
  search_issues: {
    required: ['q'],
    optional: ['sort', 'order', 'per_page'],
    description: 'Search for GitHub issues and pull requests',
    example: {
      q: 'is:issue is:open label:bug',
      sort: 'created',
      order: 'desc'
    }
  },
  search_code: {
    required: ['q'],
    optional: ['sort', 'order', 'per_page'],
    description: 'Search for code across GitHub repositories',
    example: {
      q: 'console.log repo:quanticsoul4772/github-mcp',
      sort: 'indexed'
    }
  },

  // User tools
  get_me: {
    required: [],
    optional: [],
    description: 'Get my GitHub user profile',
    example: {}
  },
  get_user: {
    required: ['username'],
    optional: [],
    description: 'Get a GitHub user by username',
    example: {
      username: 'quanticsoul4772'
    }
  },

  // GitHub Actions tools
  list_workflows: {
    required: ['owner', 'repo'],
    optional: ['per_page'],
    description: 'List GitHub Actions workflows in a repository',
    example: {
      owner: 'quanticsoul4772',
      repo: 'github-mcp'
    }
  },
  list_workflow_runs: {
    required: ['owner', 'repo', 'workflow_id'],
    optional: ['status', 'branch', 'per_page'],
    description: 'List runs for a specific workflow',
    example: {
      owner: 'quanticsoul4772',
      repo: 'github-mcp',
      workflow_id: 'ci.yml',
      status: 'completed'
    }
  },

  // Branch tools
  list_branches: {
    required: ['owner', 'repo'],
    optional: ['protected', 'per_page'],
    description: 'List branches in a repository',
    example: {
      owner: 'quanticsoul4772',
      repo: 'github-mcp',
      protected: true
    }
  },
  create_branch: {
    required: ['owner', 'repo', 'ref', 'sha'],
    optional: [],
    description: 'Create a new branch in a repository',
    example: {
      owner: 'quanticsoul4772',
      repo: 'github-mcp',
      ref: 'refs/heads/new-feature',
      sha: 'aa218f56b14c9653891f9e74264a383fa43fefbd'
    }
  },

  // Commit tools
  list_commits: {
    required: ['owner', 'repo'],
    optional: ['sha', 'path', 'author', 'since', 'until', 'per_page'],
    description: 'List commits in a repository',
    example: {
      owner: 'quanticsoul4772',
      repo: 'github-mcp',
      since: '2025-08-01T00:00:00Z',
      author: 'quanticsoul4772'
    }
  },
  get_commit: {
    required: ['owner', 'repo', 'sha'],
    optional: [],
    description: 'Get detailed information about a specific commit',
    example: {
      owner: 'quanticsoul4772',
      repo: 'github-mcp',
      sha: 'aa218f56b14c9653891f9e74264a383fa43fefbd'
    }
  },

  // Helper tools
  get_rate_limit_status: {
    required: [],
    optional: [],
    description: 'Get current GitHub API rate limit status',
    example: {}
  }
};

function generateUserPreferences(): string {
  const lines: string[] = [];
  lines.push('# GitHub MCP Tools Reference');
  lines.push('# Generated on ' + new Date().toISOString());
  lines.push('');
  lines.push('github-mcp:');
  
  Object.entries(TOOL_SCHEMAS).forEach(([name, schema]) => {
    lines.push(`  ${name}:`);
    lines.push(`    description: "${schema.description}"`);
    lines.push(`    required: ${JSON.stringify(schema.required)}`);
    if (schema.optional && schema.optional.length > 0) {
      lines.push(`    optional: ${JSON.stringify(schema.optional)}`);
    }
    if (schema.example && Object.keys(schema.example).length > 0) {
      lines.push(`    example: |`);
      const exampleStr = JSON.stringify(schema.example, null, 2);
      exampleStr.split('\n').forEach(line => {
        lines.push(`      ${line}`);
      });
    }
    lines.push('');
  });
  
  return lines.join('\n');
}

function generateMarkdownDocs(): string {
  const lines: string[] = [];
  lines.push('# GitHub MCP Server - Tool Reference');
  lines.push('');
  lines.push('## Overview');
  lines.push('This document provides a complete reference for all tools available in the GitHub MCP Server.');
  lines.push('');
  lines.push('## Tool Categories');
  lines.push('');
  
  // Group tools by category
  const categories = {
    'Repository Management': ['list_repositories', 'get_repository', 'create_repository'],
    'Issues': ['get_issue', 'list_issues', 'create_issue', 'update_issue'],
    'Pull Requests': ['get_pull_request', 'list_pull_requests', 'create_pull_request', 'merge_pull_request'],
    'File Operations': ['get_file_contents', 'create_or_update_file'],
    'Search': ['search_repositories', 'search_issues', 'search_code'],
    'Users': ['get_me', 'get_user'],
    'GitHub Actions': ['list_workflows', 'list_workflow_runs'],
    'Branches': ['list_branches', 'create_branch'],
    'Commits': ['list_commits', 'get_commit'],
    'Utilities': ['get_rate_limit_status']
  };
  
  Object.entries(categories).forEach(([category, tools]) => {
    lines.push(`### ${category}`);
    lines.push('');
    
    tools.forEach(toolName => {
      const schema = TOOL_SCHEMAS[toolName as keyof typeof TOOL_SCHEMAS];
      if (!schema) return;
      
      lines.push(`#### \`${toolName}\``);
      lines.push('');
      lines.push(schema.description);
      lines.push('');
      
      if (schema.required.length > 0) {
        lines.push('**Required Parameters:**');
        schema.required.forEach(param => {
          lines.push(`- \`${param}\``);
        });
        lines.push('');
      }
      
      if (schema.optional && schema.optional.length > 0) {
        lines.push('**Optional Parameters:**');
        schema.optional.forEach(param => {
          lines.push(`- \`${param}\``);
        });
        lines.push('');
      }
      
      if (schema.example && Object.keys(schema.example).length > 0) {
        lines.push('**Example:**');
        lines.push('```json');
        lines.push(JSON.stringify(schema.example, null, 2));
        lines.push('```');
        lines.push('');
      }
    });
  });
  
  lines.push('## Error Handling');
  lines.push('');
  lines.push('All tools now provide clear error messages when:');
  lines.push('- Required parameters are missing');
  lines.push('- Parameters have incorrect types');
  lines.push('- API requests fail');
  lines.push('');
  lines.push('Example error message:');
  lines.push('```');
  lines.push('Error: Missing required parameters for get_issue:');
  lines.push('  Required: ["owner", "repo", "issue_number"]');
  lines.push('  Received: {"owner": "quanticsoul4772"}');
  lines.push('  Missing: ["repo", "issue_number"]');
  lines.push('```');
  
  return lines.join('\n');
}

function generateMigrationGuide(): string {
  const lines: string[] = [];
  lines.push('# GitHub MCP Server - Migration Guide');
  lines.push('');
  lines.push('## Version 2.0 Changes');
  lines.push('');
  lines.push('### Breaking Changes');
  lines.push('None - all existing parameter formats continue to work.');
  lines.push('');
  lines.push('### New Features');
  lines.push('');
  lines.push('1. **Clear Error Messages**');
  lines.push('   - No more `[object Object]` errors');
  lines.push('   - Detailed parameter validation messages');
  lines.push('');
  lines.push('2. **Parameter Flexibility**');
  lines.push('   - Multiple parameter formats accepted');
  lines.push('   - Smart parameter normalization');
  lines.push('');
  lines.push('3. **Tool Discovery**');
  lines.push('   - Query tool schemas at runtime');
  lines.push('   - Built-in documentation');
  lines.push('');
  lines.push('### Parameter Format Examples');
  lines.push('');
  lines.push('The following formats are now all accepted:');
  lines.push('');
  lines.push('**Old format (still works):**');
  lines.push('```json');
  lines.push('{');
  lines.push('  "issueNumber": 42,');
  lines.push('  "repository": "owner/repo"');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('**New format (also works):**');
  lines.push('```json');
  lines.push('{');
  lines.push('  "owner": "owner",');
  lines.push('  "repo": "repo",');
  lines.push('  "issue_number": 42');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('### Upgrade Steps');
  lines.push('');
  lines.push('1. Update the GitHub MCP server:');
  lines.push('   ```bash');
  lines.push('   cd /Users/russellsmith/Projects/mcp-servers/github-mcp');
  lines.push('   git pull');
  lines.push('   npm install');
  lines.push('   npm run build');
  lines.push('   ```');
  lines.push('');
  lines.push('2. Restart Claude Desktop app');
  lines.push('');
  lines.push('3. Test with the new error messages:');
  lines.push('   - Try calling a tool with wrong parameters');
  lines.push('   - You should see helpful error messages');
  lines.push('');
  lines.push('### Troubleshooting');
  lines.push('');
  lines.push('If you encounter issues:');
  lines.push('');
  lines.push('1. Check the logs:');
  lines.push('   ```bash');
  lines.push('   tail -f ~/Library/Logs/Claude/mcp.log');
  lines.push('   ```');
  lines.push('');
  lines.push('2. Enable debug mode:');
  lines.push('   ```bash');
  lines.push('   export GITHUB_MCP_DEBUG=true');
  lines.push('   ```');
  lines.push('');
  lines.push('3. Verify the server is running:');
  lines.push('   ```bash');
  lines.push('   ps aux | grep github-mcp');
  lines.push('   ```');
  
  return lines.join('\n');
}

// Main execution
async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  
  // Ensure directories exist
  const docsDir = path.join(projectRoot, 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  
  // Generate user preferences
  const userPrefs = generateUserPreferences();
  const userPrefsPath = path.join(docsDir, 'user-preferences.yaml');
  fs.writeFileSync(userPrefsPath, userPrefs);
  console.log(`✅ Generated user preferences: ${userPrefsPath}`);
  
  // Generate markdown documentation
  const markdownDocs = generateMarkdownDocs();
  const toolReferencePath = path.join(docsDir, 'tool-reference.md');
  fs.writeFileSync(toolReferencePath, markdownDocs);
  console.log(`✅ Generated tool reference: ${toolReferencePath}`);
  
  // Generate migration guide
  const migrationGuide = generateMigrationGuide();
  const migrationPath = path.join(docsDir, 'migration-guide.md');
  fs.writeFileSync(migrationPath, migrationGuide);
  console.log(`✅ Generated migration guide: ${migrationPath}`);
  
  // Update README
  const readmePath = path.join(projectRoot, 'README.md');
  let readme = fs.readFileSync(readmePath, 'utf-8');
  
  // Add documentation section if it doesn't exist
  if (!readme.includes('## Tool Reference')) {
    const docsSection = `
## Tool Reference

For detailed information about all available tools and their parameters, see:
- [Tool Reference](docs/tool-reference.md) - Complete list of tools with examples
- [Migration Guide](docs/migration-guide.md) - Upgrading from previous versions
- [User Preferences](docs/user-preferences.yaml) - Configuration for Claude Desktop

### Quick Examples

\`\`\`javascript
// Get an issue
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "issue_number": 42
}

// Search repositories
{
  "q": "language:typescript mcp",
  "sort": "stars",
  "order": "desc"
}

// Create a pull request
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "title": "Feature: Add new functionality",
  "head": "feature-branch",
  "base": "main",
  "body": "Description of changes"
}
\`\`\`
`;
    
    // Find a good place to insert (after Installation or Setup)
    const insertIndex = readme.indexOf('## Usage') || readme.indexOf('## Development') || readme.length;
    readme = readme.slice(0, insertIndex) + docsSection + '\n' + readme.slice(insertIndex);
    
    fs.writeFileSync(readmePath, readme);
    console.log(`✅ Updated README.md`);
  } else {
    console.log(`ℹ️  README.md already has Tool Reference section`);
  }
  
  console.log('\n📚 Documentation generation complete!');
  console.log('\nNext steps:');
  console.log('1. Review the generated documentation in the docs/ directory');
  console.log('2. Test the tools with the documented parameters');
  console.log('3. Commit and push the changes');
}

// Run the script
main().catch(console.error);
