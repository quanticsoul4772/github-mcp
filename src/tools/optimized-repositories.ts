import { z } from 'zod';
import { OptimizedAPIClient } from '../optimized-api-client.js';
import { ToolConfig } from '../types.js';
import { createTypeSafeHandler } from '../utils/type-safety.js';
import { 
  validateOwnerName, 
  validateRepoName, 
  validateFilePath, 
  validateRef,
  ValidationError 
} from '../validation.js';

// Type definitions for optimized repository tools
interface GetFileContentsOptimizedParams {
  owner: string;
  repo: string;
  path?: string;
  ref?: string;
  skipCache?: boolean;
}

interface GetRepositoryOptimizedParams {
  owner: string;
  repo: string;
  skipCache?: boolean;
}

interface ListBranchesOptimizedParams {
  owner: string;
  repo: string;
  maxPages?: number;
}

interface ListIssuesOptimizedParams {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  labels?: string;
  assignee?: string;
  since?: string;
  maxPages?: number;
  perPage?: number;
}

interface ListPullRequestsOptimizedParams {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  sort?: 'created' | 'updated' | 'popularity';
  direction?: 'asc' | 'desc';
  maxPages?: number;
  perPage?: number;
}

// Zod schemas for validation
const GetFileContentsOptimizedSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  path: z.string().optional(),
  ref: z.string().optional(),
  skipCache: z.boolean().optional(),
});

const GetRepositoryOptimizedSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  skipCache: z.boolean().optional(),
});

const ListBranchesOptimizedSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  maxPages: z.number().int().min(1).optional(),
});

const ListIssuesOptimizedSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  state: z.enum(['open', 'closed', 'all']).optional(),
  labels: z.string().optional(),
  assignee: z.string().optional(),
  since: z.string().optional(),
  maxPages: z.number().int().min(1).optional(),
  perPage: z.number().int().min(1).max(100).optional(),
});

const ListPullRequestsOptimizedSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  state: z.enum(['open', 'closed', 'all']).optional(),
  sort: z.enum(['created', 'updated', 'popularity']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  maxPages: z.number().int().min(1).optional(),
  perPage: z.number().int().min(1).max(100).optional(),
});

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
    handler: createTypeSafeHandler(
      GetFileContentsOptimizedSchema,
      async (params: GetFileContentsOptimizedParams) => {
        // Validate inputs
        if (!validateOwnerName(params.owner)) {
          throw new ValidationError('owner', 'Invalid repository owner name');
        }
        if (!validateRepoName(params.repo)) {
          throw new ValidationError('repo', 'Invalid repository name');
        }
        
        // Validate and sanitize path if provided
        let safePath = '';
        if (params.path) {
          const validated = validateFilePath(params.path);
          if (validated === null) {
            throw new ValidationError('path', 'Invalid file path');
          }
          safePath = validated;
        }
        
        // Validate ref if provided
        if (params.ref && !validateRef(params.ref)) {
          throw new ValidationError('ref', 'Invalid Git ref');
        }
        
        const data = await optimizedClient.getFileContents(
          params.owner,
          params.repo,
          safePath,
          params.ref
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
          // File content: only decode when content and encoding are provided and content is not excessively large
          const encoding = (data as any).encoding;
          const rawContent = (data as any).content;
          let decoded: string | undefined;
          if (typeof rawContent === 'string' && encoding === 'base64') {
            // Avoid decoding extremely large contents into memory
            const maxDecodableSize = 5 * 1024 * 1024; // 5MB safety limit
            const approximateBytes = rawContent.length * 0.75; // base64 size approximation
            if (approximateBytes <= maxDecodableSize) {
              decoded = Buffer.from(rawContent, 'base64').toString('utf-8');
            }
          }
          return {
            name: (data as any).name,
            path: (data as any).path,
            size: (data as any).size,
            sha: (data as any).sha,
            encoding,
            // If decoding failed or was skipped, return raw content and a flag
            content: decoded,
            content_raw: decoded ? undefined : rawContent,
            is_decoded: !!decoded,
            media_type: (data as any).type,
          };
      } else {
        return data;
      }
      },
      'get_file_contents_optimized'
    ),
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
    handler: createTypeSafeHandler(
      GetRepositoryOptimizedSchema,
      async (params: GetRepositoryOptimizedParams) => {
        // Validate inputs
        if (!validateOwnerName(params.owner)) {
          throw new ValidationError('owner', 'Invalid repository owner name');
        }
        if (!validateRepoName(params.repo)) {
          throw new ValidationError('repo', 'Invalid repository name');
        }

        return optimizedClient.getRepository(params.owner, params.repo);
      },
      'get_repository_optimized'
    ),
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
    handler: createTypeSafeHandler(
      ListBranchesOptimizedSchema,
      async (params: ListBranchesOptimizedParams) => {
        // Validate inputs
        if (!validateOwnerName(params.owner)) {
          throw new ValidationError('owner', 'Invalid repository owner name');
        }
        if (!validateRepoName(params.repo)) {
          throw new ValidationError('repo', 'Invalid repository name');
        }

        const maxPages = params.maxPages || 3;
        return optimizedClient.listBranches(params.owner, params.repo, maxPages);
      },
      'list_branches_optimized'
    ),
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
    handler: createTypeSafeHandler(
      ListIssuesOptimizedSchema,
      async (params: ListIssuesOptimizedParams) => {
        // Validate inputs
        if (!validateOwnerName(params.owner)) {
          throw new ValidationError('owner', 'Invalid repository owner name');
        }
        if (!validateRepoName(params.repo)) {
          throw new ValidationError('repo', 'Invalid repository name');
        }

        const options = {
          state: params.state || 'open',
          labels: params.labels,
          assignee: params.assignee,
          since: params.since,
          maxPages: params.maxPages || 5,
          perPage: params.perPage || 100,
        };

        return optimizedClient.listIssues(params.owner, params.repo, options);
      },
      'list_issues_optimized'
    ),
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
    handler: createTypeSafeHandler(
      ListPullRequestsOptimizedSchema,
      async (params: ListPullRequestsOptimizedParams) => {
        // Validate inputs
        if (!validateOwnerName(params.owner)) {
          throw new ValidationError('owner', 'Invalid repository owner name');
        }
        if (!validateRepoName(params.repo)) {
          throw new ValidationError('repo', 'Invalid repository name');
        }

        const options = {
          state: params.state || 'open',
          sort: params.sort,
          direction: params.direction,
          maxPages: params.maxPages || 5,
          perPage: params.perPage || 100,
        };

        return optimizedClient.listPullRequests(params.owner, params.repo, options);
      },
      'list_pull_requests_optimized'
    ),
  });

  return tools;
}