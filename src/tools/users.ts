import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';

interface GetUserParams {
  username: string;
}

interface SearchUsersParams {
  query: string;
  sort?: string;
  order?: string;
  page?: number;
  perPage?: number;
}

interface ListUserReposParams {
  username?: string;
  type?: string;
  sort?: string;
  direction?: string;
  page?: number;
  perPage?: number;
}

interface ListFollowersParams {
  username?: string;
  page?: number;
  perPage?: number;
}

interface ListFollowingParams {
  username?: string;
  page?: number;
  perPage?: number;
}

interface CheckFollowingParams {
  username?: string;
  target_user: string;
}

interface FollowUserParams {
  username: string;
}

interface UnfollowUserParams {
  username: string;
}

interface UpdateMeParams {
  name?: string;
  email?: string;
  blog?: string;
  company?: string;
  location?: string;
  hireable?: boolean;
  bio?: string;
  twitter_username?: string;
}

export function createUserTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // Get authenticated user tool
  tools.push({
    tool: {
      name: 'get_me',
      description: 'Get my GitHub user profile',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    handler: async () => {
      const { data } = await octokit.users.getAuthenticated();

      return {
        login: data.login,
        id: data.id,
        node_id: data.node_id,
        avatar_url: data.avatar_url,
        gravatar_id: data.gravatar_id,
        url: data.url,
        html_url: data.html_url,
        type: data.type,
        name: data.name,
        company: data.company,
        blog: data.blog,
        location: data.location,
        email: data.email,
        hireable: data.hireable,
        bio: data.bio,
        twitter_username: data.twitter_username,
        public_repos: data.public_repos,
        public_gists: data.public_gists,
        followers: data.followers,
        following: data.following,
        created_at: data.created_at,
        updated_at: data.updated_at,
        private_gists: data.private_gists,
        total_private_repos: data.total_private_repos,
        owned_private_repos: data.owned_private_repos,
        disk_usage: data.disk_usage,
        collaborators: data.collaborators,
        two_factor_authentication: 'two_factor_authentication' in data ? (data as any).two_factor_authentication : undefined,
        plan: data.plan,
      };
    },
  });

  // Get user by username tool
  tools.push({
    tool: {
      name: 'get_user',
      description: 'Get a GitHub user by username',
      inputSchema: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: 'The username to look up',
          },
        },
        required: ['username'],
      },
    },
    handler: async (args: GetUserParams) => {
      const { data } = await octokit.users.getByUsername({
        username: args.username,
      });

      return {
        login: data.login,
        id: data.id,
        node_id: data.node_id,
        avatar_url: data.avatar_url,
        gravatar_id: data.gravatar_id,
        url: data.url,
        html_url: data.html_url,
        type: data.type,
        name: data.name,
        company: data.company,
        blog: data.blog,
        location: data.location,
        email: data.email,
        hireable: data.hireable,
        bio: data.bio,
        twitter_username: data.twitter_username,
        public_repos: data.public_repos,
        public_gists: data.public_gists,
        followers: data.followers,
        following: data.following,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    },
  });

  // Search users tool
  tools.push({
    tool: {
      name: 'search_users',
      description: 'Search for GitHub users',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query using GitHub users search syntax',
          },
          sort: {
            type: 'string',
            description: 'Sort field',
            enum: ['followers', 'repositories', 'joined'],
          },
          order: {
            type: 'string',
            description: 'Sort order',
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
        required: ['query'],
      },
    },
    handler: async (args: SearchUsersParams) => {
      const { data } = await octokit.search.users({
        q: args.query,
        sort: args.sort,
        order: args.order,
        page: args.page,
        per_page: args.perPage,
      });

      return {
        total_count: data.total_count,
        incomplete_results: data.incomplete_results,
        items: data.items.map((user) => ({
          login: user.login,
          id: user.id,
          node_id: user.node_id,
          avatar_url: user.avatar_url,
          gravatar_id: user.gravatar_id,
          url: user.url,
          html_url: user.html_url,
          type: user.type,
          site_admin: user.site_admin,
          score: user.score,
        })),
      };
    },
  });

  // List user repositories tool
  tools.push({
    tool: {
      name: 'list_user_repos',
      description: 'List repositories for a user',
      inputSchema: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: 'The username (leave empty for authenticated user)',
          },
          type: {
            type: 'string',
            description: 'Type of repositories to list',
            enum: ['all', 'owner', 'public', 'private', 'member'],
          },
          sort: {
            type: 'string',
            description: 'Sort field',
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
    handler: async (args: ListUserReposParams) => {
      let data;
      
      if (args.username) {
        const response = await octokit.repos.listForUser({
          username: args.username,
          type: args.type,
          sort: args.sort,
          direction: args.direction,
          page: args.page,
          per_page: args.perPage,
        });
        data = response.data;
      } else {
        const response = await octokit.repos.listForAuthenticatedUser({
          type: args.type,
          sort: args.sort,
          direction: args.direction,
          page: args.page,
          per_page: args.perPage,
        });
        data = response.data;
      }

      return data.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        owner: {
          login: repo.owner.login,
          type: repo.owner.type,
        },
        private: repo.private,
        html_url: repo.html_url,
        description: repo.description,
        fork: repo.fork,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        watchers_count: repo.watchers_count,
        forks_count: repo.forks_count,
        open_issues_count: repo.open_issues_count,
        default_branch: repo.default_branch,
        archived: repo.archived,
        disabled: repo.disabled,
        visibility: repo.visibility,
      }));
    },
  });

  // List followers tool
  tools.push({
    tool: {
      name: 'list_followers',
      description: 'List followers of a user',
      inputSchema: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: 'The username (leave empty for authenticated user)',
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
    handler: async (args: ListFollowersParams) => {
      let data;
      
      if (args.username) {
        const response = await octokit.users.listFollowersForUser({
          username: args.username,
          page: args.page,
          per_page: args.perPage,
        });
        data = response.data;
      } else {
        const response = await octokit.users.listFollowersForAuthenticatedUser({
          page: args.page,
          per_page: args.perPage,
        });
        data = response.data;
      }

      return data.map((user) => ({
        login: user.login,
        id: user.id,
        node_id: user.node_id,
        avatar_url: user.avatar_url,
        gravatar_id: user.gravatar_id,
        url: user.url,
        html_url: user.html_url,
        type: user.type,
        site_admin: user.site_admin,
      }));
    },
  });

  // List following tool
  tools.push({
    tool: {
      name: 'list_following',
      description: 'List users that a user is following',
      inputSchema: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: 'The username (leave empty for authenticated user)',
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
    handler: async (args: ListFollowingParams) => {
      let data;
      
      if (args.username) {
        const response = await octokit.users.listFollowingForUser({
          username: args.username,
          page: args.page,
          per_page: args.perPage,
        });
        data = response.data;
      } else {
        const response = await octokit.users.listFollowedByAuthenticatedUser({
          page: args.page,
          per_page: args.perPage,
        });
        data = response.data;
      }

      return data.map((user) => ({
        login: user.login,
        id: user.id,
        node_id: user.node_id,
        avatar_url: user.avatar_url,
        gravatar_id: user.gravatar_id,
        url: user.url,
        html_url: user.html_url,
        type: user.type,
        site_admin: user.site_admin,
      }));
    },
  });

  // Check if following tool
  tools.push({
    tool: {
      name: 'check_following',
      description: 'Check if a user follows another user',
      inputSchema: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: 'The username to check (leave empty for authenticated user)',
          },
          target_user: {
            type: 'string',
            description: 'The target user to check if being followed',
          },
        },
        required: ['target_user'],
      },
    },
    handler: async (args: CheckFollowingParams) => {
      try {
        if (args.username) {
          await octokit.users.checkFollowingForUser({
            username: args.username,
            target_user: args.target_user,
          });
        } else {
          await octokit.users.checkPersonIsFollowedByAuthenticated({
            username: args.target_user,
          });
        }
        
        return {
          following: true,
          message: args.username 
            ? `${args.username} is following ${args.target_user}`
            : `You are following ${args.target_user}`,
        };
      } catch (error: any) {
        if (error.status === 404) {
          return {
            following: false,
            message: args.username
              ? `${args.username} is not following ${args.target_user}`
              : `You are not following ${args.target_user}`,
          };
        }
        throw error;
      }
    },
  });

  // Add write operations if not in read-only mode
  if (!readOnly) {
    // Follow user tool
    tools.push({
      tool: {
        name: 'follow_user',
        description: 'Follow a GitHub user',
        inputSchema: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: 'The username to follow',
            },
          },
          required: ['username'],
        },
      },
      handler: async (args: FollowUserParams) => {
        await octokit.users.follow({
          username: args.username,
        });

        return {
          success: true,
          message: `Successfully followed ${args.username}`,
        };
      },
    });

    // Unfollow user tool
    tools.push({
      tool: {
        name: 'unfollow_user',
        description: 'Unfollow a GitHub user',
        inputSchema: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: 'The username to unfollow',
            },
          },
          required: ['username'],
        },
      },
      handler: async (args: UnfollowUserParams) => {
        await octokit.users.unfollow({
          username: args.username,
        });

        return {
          success: true,
          message: `Successfully unfollowed ${args.username}`,
        };
      },
    });

    // Update authenticated user tool
    tools.push({
      tool: {
        name: 'update_me',
        description: 'Update my GitHub profile',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The new name',
            },
            email: {
              type: 'string',
              description: 'The new public email',
            },
            blog: {
              type: 'string',
              description: 'The new blog URL',
            },
            company: {
              type: 'string',
              description: 'The new company',
            },
            location: {
              type: 'string',
              description: 'The new location',
            },
            hireable: {
              type: 'boolean',
              description: 'Whether you are available for hire',
            },
            bio: {
              type: 'string',
              description: 'The new bio',
            },
            twitter_username: {
              type: 'string',
              description: 'The new Twitter username',
            },
          },
        },
      },
      handler: async (args: UpdateMeParams) => {
        const { data } = await octokit.users.updateAuthenticated({
          name: args.name,
          email: args.email,
          blog: args.blog,
          company: args.company,
          location: args.location,
          hireable: args.hireable,
          bio: args.bio,
          twitter_username: args.twitter_username,
        });

        return {
          login: data.login,
          name: data.name,
          email: data.email,
          blog: data.blog,
          company: data.company,
          location: data.location,
          hireable: data.hireable,
          bio: data.bio,
          twitter_username: data.twitter_username,
          updated_at: data.updated_at,
        };
      },
    });
  }

  return tools;
}
