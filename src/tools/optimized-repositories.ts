import { OptimizedAPIClient } from '../optimized-api-client.js';
import { ToolConfig } from '../types.js';
import { 
  validateOwnerName, 
  validateRepoName, 
  validateFilePath, 
  validateRef,
  ValidationError 
} from '../validation.js';

export function createOptimizedRepositoryTools(optimizedClient: OptimizedAPIClient, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // Optimized get file contents tool
  tools.push({
    tool: {
      name: 'get_file_contents_optimized',
      description: 'Get file or directory contents from a GitHub repository with performance optimizations (caching, deduplication)',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner (username or organization)',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          path: {
            type: 'string',
            description: 'Path to file/directory (directories must end with a slash \'/\')',
          },
          ref: {
            type: 'string',
            description: 'Git ref (branch, tag, or commit SHA)',
          },
          skipCache: {
            type: 'boolean',
            description: 'Skip cache and fetch fresh data',
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: any) => {
      // Validate inputs
      if (!validateOwnerName(args.owner)) {
        throw new ValidationError('owner', 'Invalid repository owner name');
      }
      if (!validateRepoName(args.repo)) {
        throw new ValidationError('repo', 'Invalid repository name');
      }
      
      // Validate and sanitize path if provided
      let safePath = '';
      if (args.path) {
        const validated = validateFilePath(args.path);
        if (validated === null) {
          throw new ValidationError('path', 'Invalid file path');
        }
        safePath = validated;
      }
      
      // Validate ref if provided
      if (args.ref && !validateRef(args.ref)) {
        throw new ValidationError('ref', 'Invalid Git ref');
      }
      
      const data = await optimizedClient.getFileContents(
        args.owner,
        args.repo,
        safePath,
        args.ref
      );

      if (Array.isArray(data)) {
        // Directory listing
        return data.map((item: any) => ({
          name: item.name,
          path: item.path,
          type: item.type,
          size: item.size,
          sha: item.sha,
        }));
      } else if (data.type === 'file') {
        // File content
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return {
          name: data.name,
          path: data.path,
          size: data.size,
          sha: data.sha,
          content: content,
        };
      } else {
        return data;
      }
    },
  });

  // Optimized repository info tool
  tools.push({
    tool: {
      name: 'get_repository_optimized',
      description: 'Get repository information with performance optimizations',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner (username or organization)',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          skipCache: {
            type: 'boolean',
            description: 'Skip cache and fetch fresh data',
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: any) => {
      // Validate inputs
      if (!validateOwnerName(args.owner)) {
        throw new ValidationError('owner', 'Invalid repository owner name');
      }
      if (!validateRepoName(args.repo)) {
        throw new ValidationError('repo', 'Invalid repository name');
      }

      return optimizedClient.getRepository(args.owner, args.repo);
    },
  });

  // Optimized list branches tool
  tools.push({
    tool: {
      name: 'list_branches_optimized',
      description: 'List repository branches with smart pagination and caching',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner (username or organization)',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          maxPages: {
            type: 'number',
            description: 'Maximum number of pages to fetch (default: 3)',
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: any) => {
      // Validate inputs
      if (!validateOwnerName(args.owner)) {
        throw new ValidationError('owner', 'Invalid repository owner name');
      }
      if (!validateRepoName(args.repo)) {
        throw new ValidationError('repo', 'Invalid repository name');
      }

      const maxPages = args.maxPages || 3;
      return optimizedClient.listBranches(args.owner, args.repo, maxPages);
    },
  });

  // Optimized list issues tool
  tools.push({
    tool: {
      name: 'list_issues_optimized',
      description: 'List repository issues with smart pagination and caching',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner (username or organization)',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          state: {
            type: 'string',
            description: 'Issue state filter',
            enum: ['open', 'closed', 'all'],
          },
          labels: {
            type: 'string',
            description: 'Comma-separated list of labels',
          },
          assignee: {
            type: 'string',
            description: 'Filter by assignee username',
          },
          since: {
            type: 'string',
            description: 'Filter issues updated after this date (ISO 8601)',
          },
          maxPages: {
            type: 'number',
            description: 'Maximum number of pages to fetch (default: 5)',
          },
          perPage: {
            type: 'number',
            description: 'Number of issues per page (default: 100)',
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: any) => {
      // Validate inputs
      if (!validateOwnerName(args.owner)) {
        throw new ValidationError('owner', 'Invalid repository owner name');
      }
      if (!validateRepoName(args.repo)) {
        throw new ValidationError('repo', 'Invalid repository name');
      }

      const options = {
        state: args.state || 'open',
        labels: args.labels,
        assignee: args.assignee,
        since: args.since,
        maxPages: args.maxPages || 5,
        perPage: args.perPage || 100,
      };

      return optimizedClient.listIssues(args.owner, args.repo, options);
    },
  });

  // Optimized list pull requests tool
  tools.push({
    tool: {
      name: 'list_pull_requests_optimized',
      description: 'List repository pull requests with smart pagination and caching',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner (username or organization)',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          state: {
            type: 'string',
            description: 'Pull request state filter',
            enum: ['open', 'closed', 'all'],
          },
          sort: {
            type: 'string',
            description: 'Sort field',
            enum: ['created', 'updated', 'popularity'],
          },
          direction: {
            type: 'string',
            description: 'Sort direction',
            enum: ['asc', 'desc'],
          },
          maxPages: {
            type: 'number',
            description: 'Maximum number of pages to fetch (default: 5)',
          },
          perPage: {
            type: 'number',
            description: 'Number of pull requests per page (default: 100)',
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: any) => {
      // Validate inputs
      if (!validateOwnerName(args.owner)) {
        throw new ValidationError('owner', 'Invalid repository owner name');
      }
      if (!validateRepoName(args.repo)) {
        throw new ValidationError('repo', 'Invalid repository name');
      }

      const options = {
        state: args.state || 'open',
        sort: args.sort,
        direction: args.direction,
        maxPages: args.maxPages || 5,
        perPage: args.perPage || 100,
      };

      return optimizedClient.listPullRequests(args.owner, args.repo, options);
    },
  });

  return tools;
}