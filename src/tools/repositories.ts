import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';
import { 
  validateOwnerName, 
  validateRepoName, 
  validateFilePath, 
  validateRef,
  ValidationError 
} from '../validation.js';
import {
  GetFileContentsParams,
  ListBranchesParams,
  ListCommitsParams,
  CreateRepoParams,
  CreateOrUpdateFileParams,
  DeleteFileParams,
  PushFilesParams,
  ListUserRepositoriesParams,
  GetRepositoryParams
} from '../tool-types.js';

interface GetCommitParams {
  owner: string;
  repo: string;
  sha: string;
}

interface ListTagsParams {
  owner: string;
  repo: string;
  page?: number;
  perPage?: number;
}

interface SearchRepositoriesParams {
  query: string;
  page?: number;
  perPage?: number;
}

interface CreateBranchParams {
  owner: string;
  repo: string;
  branch: string;
  from_branch?: string;
}

interface ForkRepositoryParams {
  owner: string;
  repo: string;
  organization?: string;
}

export function createRepositoryTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // List repositories tool
  tools.push({
    tool: {
      name: 'list_repositories',
      description: 'List repositories for the authenticated user',
      inputSchema: {
        type: 'object',
        properties: {
          visibility: {
            type: 'string',
            description: 'Repository visibility filter',
            enum: ['all', 'public', 'private'],
          },
          affiliation: {
            type: 'string',
            description: 'Repository affiliation filter',
            enum: ['owner', 'collaborator', 'organization_member'],
          },
          type: {
            type: 'string',
            description: 'Repository type filter',
            enum: ['all', 'owner', 'public', 'private', 'member'],
          },
          sort: {
            type: 'string',
            description: 'Sort repositories by',
            enum: ['created', 'updated', 'pushed', 'full_name'],
          },
          direction: {
            type: 'string',
            description: 'Sort direction',
            enum: ['asc', 'desc'],
          },
          page: {
            type: 'number',
            description: 'Page number for pagination (min 1)',
            minimum: 1,
          },
          perPage: {
            type: 'number',
            description: 'Results per page for pagination (min 1, max 100)',
            minimum: 1,
            maximum: 100,
          },
        },
      },
    },
    handler: async (args: unknown) => {
      const params = args as ListUserRepositoriesParams;
      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        visibility: params.visibility as any || 'all',
        affiliation: params.affiliation as any,
        type: params.type as any,
        sort: params.sort as any || 'updated',
        direction: params.direction as any || 'desc',
        page: params.page || 1,
        per_page: params.perPage || 30,
      });

      return data.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        owner: {
          login: repo.owner?.login || "",
          type: repo.owner?.type || "",
        },
        description: repo.description,
        private: repo.private,
        html_url: repo.html_url,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at,
      }));
    },
  });

  // Get repository tool
  tools.push({
    tool: {
      name: 'get_repository',
      description: 'Get details of a specific repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as GetRepositoryParams;
      // Validate inputs
      if (!validateOwnerName(params.owner)) {
        throw new ValidationError('owner', 'Invalid repository owner name');
      }
      if (!validateRepoName(params.repo)) {
        throw new ValidationError('repo', 'Invalid repository name');
      }
      
      const { data } = await octokit.rest.repos.get({
        owner: params.owner,
        repo: params.repo,
      });

      return {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        owner: {
          login: data.owner.login,
          type: data.owner.type,
        },
        description: data.description,
        private: data.private,
        html_url: data.html_url,
        language: data.language,
        stargazers_count: data.stargazers_count,
        forks_count: data.forks_count,
        watchers_count: data.watchers_count,
        size: data.size,
        default_branch: data.default_branch,
        topics: data.topics,
        has_issues: data.has_issues,
        has_projects: data.has_projects,
        has_wiki: data.has_wiki,
        has_pages: data.has_pages,
        has_downloads: data.has_downloads,
        archived: data.archived,
        disabled: data.disabled,
        open_issues_count: data.open_issues_count,
        license: data.license ? {
          key: data.license.key,
          name: data.license.name,
          spdx_id: data.license.spdx_id,
        } : null,
        created_at: data.created_at,
        updated_at: data.updated_at,
        pushed_at: data.pushed_at,
      };
    },
  });

  // Get file contents tool
  tools.push({
    tool: {
      name: 'get_file_contents',
      description: 'Get file or directory contents from a GitHub repository',
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
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as GetFileContentsParams;
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
      
      const { data } = await octokit.rest.repos.getContent({
        owner: params.owner,
        repo: params.repo,
        path: safePath,
        ref: params.ref,
      });

      if (Array.isArray(data)) {
        // Directory listing
        return data.map((item) => ({
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

  // List branches tool
  tools.push({
    tool: {
      name: 'list_branches',
      description: 'List branches in a GitHub repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          page: {
            type: 'number',
            description: 'Page number for pagination (min 1)',
            minimum: 1,
          },
          perPage: {
            type: 'number',
            description: 'Results per page for pagination (min 1, max 100)',
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as ListBranchesParams;
      const { data } = await octokit.rest.repos.listBranches({
        owner: params.owner,
        repo: params.repo,
        page: params.page || 1,
        per_page: params.perPage || 30,
      });

      return data.map((branch) => ({
        name: branch.name,
        commit: {
          sha: branch.commit.sha,
          url: branch.commit.url,
        },
        protected: branch.protected,
      }));
    },
  });

  // List commits tool
  tools.push({
    tool: {
      name: 'list_commits',
      description: 'List commits in a GitHub repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          sha: {
            type: 'string',
            description: 'SHA or branch to list commits from',
          },
          author: {
            type: 'string',
            description: 'Author username or email address to filter by',
          },
          page: {
            type: 'number',
            description: 'Page number for pagination (min 1)',
            minimum: 1,
          },
          perPage: {
            type: 'number',
            description: 'Results per page for pagination (min 1, max 100)',
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as ListCommitsParams;
      const { data } = await octokit.rest.repos.listCommits({
        owner: params.owner,
        repo: params.repo,
        sha: params.sha,
        author: params.author,
        page: params.page,
        per_page: params.perPage,
      });

      return data.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author?.name,
          email: commit.commit.author?.email,
          date: commit.commit.author?.date,
        },
        committer: {
          name: commit.commit.committer?.name,
          email: commit.commit.committer?.email,
          date: commit.commit.committer?.date,
        },
        url: commit.html_url,
      }));
    },
  });

  // Get commit details tool
  tools.push({
    tool: {
      name: 'get_commit',
      description: 'Get detailed information about a specific commit',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          sha: {
            type: 'string',
            description: 'Commit SHA, branch name, or tag name',
          },
        },
        required: ['owner', 'repo', 'sha'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as GetCommitParams;
      const { data } = await octokit.rest.repos.getCommit({
        owner: params.owner,
        repo: params.repo,
        ref: params.sha,
      });

      return {
        sha: data.sha,
        message: data.commit.message,
        author: data.commit.author,
        committer: data.commit.committer,
        stats: data.stats,
        files: data.files?.map((file) => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          patch: file.patch,
        })),
        url: data.html_url,
      };
    },
  });

  // List tags tool
  tools.push({
    tool: {
      name: 'list_tags',
      description: 'List tags in a GitHub repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          page: {
            type: 'number',
            description: 'Page number for pagination (min 1)',
            minimum: 1,
          },
          perPage: {
            type: 'number',
            description: 'Results per page for pagination (min 1, max 100)',
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as ListTagsParams;
      const { data } = await octokit.rest.repos.listTags({
        owner: params.owner,
        repo: params.repo,
        page: params.page,
        per_page: params.perPage,
      });

      return data.map((tag) => ({
        name: tag.name,
        commit: {
          sha: tag.commit.sha,
          url: tag.commit.url,
        },
        zipball_url: tag.zipball_url,
        tarball_url: tag.tarball_url,
      }));
    },
  });

  // Search repositories tool
  tools.push({
    tool: {
      name: 'search_repositories',
      description: 'Search for GitHub repositories',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query using GitHub search syntax',
          },
          page: {
            type: 'number',
            description: 'Page number for pagination (min 1)',
            minimum: 1,
          },
          perPage: {
            type: 'number',
            description: 'Results per page for pagination (min 1, max 100)',
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['query'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as SearchRepositoriesParams;
      const { data } = await octokit.rest.search.repos({
        q: params.query,
        page: params.page,
        per_page: params.perPage,
      });

      return {
        total_count: data.total_count,
        incomplete_results: data.incomplete_results,
        items: data.items.map((repo) => ({
          name: repo.name,
          full_name: repo.full_name,
          owner: {
            login: repo.owner?.login || "",
            type: repo.owner?.type || "",
          },
          description: repo.description,
          private: repo.private,
          html_url: repo.html_url,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          forks_count: repo.forks_count,
          created_at: repo.created_at,
          updated_at: repo.updated_at,
        })),
      };
    },
  });

  // Add write operations if not in read-only mode
  if (!readOnly) {
    // Create repository tool
    tools.push({
      tool: {
        name: 'create_repository',
        description: 'Create a new GitHub repository',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Repository name',
            },
            description: {
              type: 'string',
              description: 'Repository description',
            },
            private: {
              type: 'boolean',
              description: 'Whether repo should be private',
            },
            autoInit: {
              type: 'boolean',
              description: 'Initialize with README',
            },
          },
          required: ['name'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as CreateRepoParams;
        const { data } = await octokit.rest.repos.createForAuthenticatedUser({
          name: params.name,
          description: params.description,
          private: params.private,
          auto_init: params.autoInit,
        });

        return {
          id: data.id,
          name: data.name,
          full_name: data.full_name,
          html_url: data.html_url,
          ssh_url: data.ssh_url,
          clone_url: data.clone_url,
          created_at: data.created_at,
        };
      },
    });

    // Create or update file tool
    tools.push({
      tool: {
        name: 'create_or_update_file',
        description: 'Create or update a file in a GitHub repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            path: {
              type: 'string',
              description: 'Path where to create/update the file',
            },
            message: {
              type: 'string',
              description: 'Commit message',
            },
            content: {
              type: 'string',
              description: 'Content of the file',
            },
            branch: {
              type: 'string',
              description: 'Branch to create/update the file in',
            },
            sha: {
              type: 'string',
              description: 'Required if updating an existing file. The blob SHA of the file being replaced.',
            },
          },
          required: ['owner', 'repo', 'path', 'message', 'content', 'branch'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as CreateOrUpdateFileParams;
        // Validate inputs
        if (!validateOwnerName(params.owner)) {
          throw new ValidationError('owner', 'Invalid repository owner name');
        }
        if (!validateRepoName(params.repo)) {
          throw new ValidationError('repo', 'Invalid repository name');
        }
        
        // Validate and sanitize path
        const safePath = validateFilePath(params.path);
        if (safePath === null) {
          throw new ValidationError('path', 'Invalid file path');
        }
        
        // Validate branch name if provided
        if (params.branch && !validateRef(params.branch)) {
          throw new ValidationError('branch', 'Invalid branch name');
        }
        
        const content = Buffer.from(params.content).toString('base64');
        
        const { data } = await octokit.rest.repos.createOrUpdateFileContents({
          owner: params.owner,
          repo: params.repo,
          path: safePath,
          message: params.message,
          content: content,
          branch: params.branch,
          sha: params.sha,
        });

        return {
          content: {
            name: data.content?.name,
            path: data.content?.path,
            sha: data.content?.sha,
            size: data.content?.size,
            url: data.content?.url,
            html_url: data.content?.html_url,
          },
          commit: {
            sha: data.commit.sha,
            message: data.commit.message,
            url: data.commit.html_url,
          },
        };
      },
    });

    // Delete file tool
    tools.push({
      tool: {
        name: 'delete_file',
        description: 'Delete a file from a GitHub repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            path: {
              type: 'string',
              description: 'Path to the file to delete',
            },
            message: {
              type: 'string',
              description: 'Commit message',
            },
            branch: {
              type: 'string',
              description: 'Branch to delete the file from',
            },
          },
          required: ['owner', 'repo', 'path', 'message', 'branch'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as DeleteFileParams;
        // Validate inputs first
        if (!validateOwnerName(params.owner)) {
          throw new ValidationError('owner', 'Invalid repository owner name');
        }
        if (!validateRepoName(params.repo)) {
          throw new ValidationError('repo', 'Invalid repository name');
        }
        
        // Validate and sanitize path
        const safePath = validateFilePath(params.path);
        if (safePath === null) {
          throw new ValidationError('path', 'Invalid file path');
        }
        
        // First get the file to get its SHA
        const { data: file } = await octokit.rest.repos.getContent({
          owner: params.owner,
          repo: params.repo,
          path: safePath,
          ref: params.branch,
        });

        if (Array.isArray(file) || file.type !== 'file') {
          throw new Error('Path does not point to a file');
        }

        const { data } = await octokit.rest.repos.deleteFile({
          owner: params.owner,
          repo: params.repo,
          path: safePath,
          message: params.message,
          sha: file.sha,
          branch: params.branch,
        });

        return {
          commit: {
            sha: data.commit.sha,
            message: data.commit.message,
            url: data.commit.html_url,
          },
        };
      },
    });

    // Create branch tool
    tools.push({
      tool: {
        name: 'create_branch',
        description: 'Create a new branch in a GitHub repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            branch: {
              type: 'string',
              description: 'Name for new branch',
            },
            from_branch: {
              type: 'string',
              description: 'Source branch (defaults to repo default)',
            },
          },
          required: ['owner', 'repo', 'branch'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as CreateBranchParams;
        // Get the SHA of the source branch
        let sha: string;
        if (params.from_branch) {
          const { data: ref } = await octokit.rest.git.getRef({
            owner: params.owner,
            repo: params.repo,
            ref: `heads/${params.from_branch}`,
          });
          sha = ref.object.sha;
        } else {
          // Get default branch
          const { data: repo } = await octokit.rest.repos.get({
            owner: params.owner,
            repo: params.repo,
          });
          const { data: ref } = await octokit.rest.git.getRef({
            owner: params.owner,
            repo: params.repo,
            ref: `heads/${repo.default_branch}`,
          });
          sha = ref.object.sha;
        }

        // Create the new branch
        const { data } = await octokit.rest.git.createRef({
          owner: params.owner,
          repo: params.repo,
          ref: `refs/heads/${params.branch}`,
          sha: sha,
        });

        return {
          ref: data.ref,
          node_id: data.node_id,
          url: data.url,
          object: {
            sha: data.object.sha,
            type: data.object.type,
            url: data.object.url,
          },
        };
      },
    });

    // Fork repository tool
    tools.push({
      tool: {
        name: 'fork_repository',
        description: 'Fork a GitHub repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            organization: {
              type: 'string',
              description: 'Organization to fork to',
            },
          },
          required: ['owner', 'repo'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as ForkRepositoryParams;
        const { data } = await octokit.rest.repos.createFork({
          owner: params.owner,
          repo: params.repo,
          organization: params.organization,
        });

        return {
          id: data.id,
          name: data.name,
          full_name: data.full_name,
          owner: {
            login: data.owner.login,
            type: data.owner.type,
          },
          parent: data.parent ? {
            name: data.parent.name,
            full_name: data.parent.full_name,
            owner: {
              login: data.parent.owner.login,
            },
          } : undefined,
          html_url: data.html_url,
          ssh_url: data.ssh_url,
          clone_url: data.clone_url,
        };
      },
    });

    // Push multiple files tool
    tools.push({
      tool: {
        name: 'push_files',
        description: 'Push multiple files to a GitHub repository in a single commit',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner',
            },
            repo: {
              type: 'string',
              description: 'Repository name',
            },
            branch: {
              type: 'string',
              description: 'Branch to push to',
            },
            message: {
              type: 'string',
              description: 'Commit message',
            },
            files: {
              type: 'array',
              description: 'Array of file objects to push',
              items: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                    description: 'File path',
                  },
                  content: {
                    type: 'string',
                    description: 'File content',
                  },
                },
                required: ['path', 'content'],
              },
            },
          },
          required: ['owner', 'repo', 'branch', 'message', 'files'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as PushFilesParams;
        // This is a simplified implementation
        // In production, you'd want to use the Git Data API to create a tree and commit
        const results = [];
        
        for (const file of params.files) {
          const content = Buffer.from(file.content).toString('base64');
          
          try {
            // Try to get existing file SHA
            let sha: string | undefined;
            try {
              const { data: existingFile } = await octokit.rest.repos.getContent({
                owner: params.owner,
                repo: params.repo,
                path: file.path,
                ref: params.branch,
              });
              if (!Array.isArray(existingFile) && existingFile.type === 'file') {
                sha = existingFile.sha;
              }
            } catch {
              // File doesn't exist yet
            }

            const { data } = await octokit.rest.repos.createOrUpdateFileContents({
              owner: params.owner,
              repo: params.repo,
              path: file.path,
              message: params.message,
              content: content,
              branch: params.branch,
              sha: sha,
            });

            results.push({
              path: file.path,
              success: true,
              sha: data.content?.sha,
            });
          } catch (error) {
            console.error('Failed to push file:', file.path, error); // Log for debugging
            results.push({
              path: file.path,
              success: false,
              error: 'Failed to push file',
            });
          }
        }

        return results;
      },
    });
  }

  return tools;
}
