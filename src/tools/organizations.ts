import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';

interface SearchOrgsParams {
  query: string;
  sort?: string;
  order?: string;
  page?: number;
  perPage?: number;
}

interface GetOrgParams {
  org: string;
}

interface ListOrgMembersParams {
  org: string;
  filter?: string;
  role?: string;
  page?: number;
  perPage?: number;
}

interface ListOrgReposParams {
  org: string;
  type?: string;
  sort?: string;
  direction?: string;
  page?: number;
  perPage?: number;
}

interface ListOrgTeamsParams {
  org: string;
  page?: number;
  perPage?: number;
}

interface CheckOrgMembershipParams {
  org: string;
  username: string;
}

interface ListUserOrgsParams {
  username?: string;
  page?: number;
  perPage?: number;
}

interface UpdateOrgParams {
  org: string;
  billing_email?: string;
  company?: string;
  email?: string;
  twitter_username?: string;
  location?: string;
  name?: string;
  description?: string;
  blog?: string;
}

export function createOrganizationTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // Search organizations tool
  tools.push({
    tool: {
      name: 'search_orgs',
      description: 'Search for GitHub organizations',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query using GitHub organizations search syntax',
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
    handler: async (args: unknown) => {
      const params = args as SearchOrgsParams;
      const { data } = await octokit.search.users({
        q: `${params.query} type:org`,
        sort: params.sort as any as any,
        order: params.order as any as any,
        page: params.page,
        per_page: params.perPage,
      });

      return {
        total_count: data.total_count,
        incomplete_results: data.incomplete_results,
        items: data.items.map((org) => ({
          login: org.login,
          id: org.id,
          node_id: org.node_id,
          avatar_url: org.avatar_url,
          gravatar_id: org.gravatar_id,
          url: org.url,
          html_url: org.html_url,
          type: org.type,
          site_admin: org.site_admin,
          score: org.score,
        })),
      };
    },
  });

  // Get organization tool
  tools.push({
    tool: {
      name: 'get_org',
      description: 'Get details of a GitHub organization',
      inputSchema: {
        type: 'object',
        properties: {
          org: {
            type: 'string',
            description: 'The organization name',
          },
        },
        required: ['org'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as GetOrgParams;
      const { data } = await octokit.orgs.get({
        org: params.org,
      });

      return {
        login: data.login,
        id: data.id,
        node_id: data.node_id,
        url: data.url,
        html_url: data.html_url,
        name: data.name,
        company: data.company,
        blog: data.blog,
        location: data.location,
        email: data.email,
        twitter_username: data.twitter_username,
        description: data.description,
        public_repos: data.public_repos,
        public_gists: data.public_gists,
        followers: data.followers,
        following: data.following,
        created_at: data.created_at,
        updated_at: data.updated_at,
        type: data.type,
        total_private_repos: data.total_private_repos,
        owned_private_repos: data.owned_private_repos,
        private_gists: data.private_gists,
        disk_usage: data.disk_usage,
        collaborators: data.collaborators,
        billing_email: data.billing_email,
        plan: data.plan,
        default_repository_permission: data.default_repository_permission,
        members_can_create_repositories: data.members_can_create_repositories,
        two_factor_requirement_enabled: data.two_factor_requirement_enabled,
        members_allowed_repository_creation_type: data.members_allowed_repository_creation_type,
        members_can_create_public_repositories: data.members_can_create_public_repositories,
        members_can_create_private_repositories: data.members_can_create_private_repositories,
        members_can_create_internal_repositories: data.members_can_create_internal_repositories,
        members_can_create_pages: data.members_can_create_pages,
        members_can_fork_private_repositories: data.members_can_fork_private_repositories,
      };
    },
  });

  // List organization members tool
  tools.push({
    tool: {
      name: 'list_org_members',
      description: 'List members of an organization',
      inputSchema: {
        type: 'object',
        properties: {
          org: {
            type: 'string',
            description: 'The organization name',
          },
          filter: {
            type: 'string',
            description: 'Filter members by their membership type',
            enum: ['2fa_disabled', 'all'],
          },
          role: {
            type: 'string',
            description: 'Filter members by their role',
            enum: ['all', 'admin', 'member'],
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
        required: ['org'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as ListOrgMembersParams;
      const { data } = await octokit.orgs.listMembers({
        org: params.org,
        filter: params.filter as any as any,
        role: params.role as any,
        page: params.page,
        per_page: params.perPage,
      });

      return data.map((member) => ({
        login: member.login,
        id: member.id,
        node_id: member.node_id,
        avatar_url: member.avatar_url,
        gravatar_id: member.gravatar_id,
        url: member.url,
        html_url: member.html_url,
        type: member.type,
        site_admin: member.site_admin,
      }));
    },
  });

  // List organization repositories tool
  tools.push({
    tool: {
      name: 'list_org_repos',
      description: 'List repositories for an organization',
      inputSchema: {
        type: 'object',
        properties: {
          org: {
            type: 'string',
            description: 'The organization name',
          },
          type: {
            type: 'string',
            description: 'Type of repositories to list',
            enum: ['all', 'public', 'private', 'forks', 'sources', 'member'],
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
        required: ['org'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as ListOrgReposParams;
      const { data } = await octokit.repos.listForOrg({
        org: params.org,
        type: params.type as any,
        sort: params.sort as any as any,
        direction: params.direction as any as any,
        page: params.page,
        per_page: params.perPage,
      });

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

  // List organization teams tool
  tools.push({
    tool: {
      name: 'list_org_teams',
      description: 'List teams in an organization',
      inputSchema: {
        type: 'object',
        properties: {
          org: {
            type: 'string',
            description: 'The organization name',
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
        required: ['org'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as ListOrgTeamsParams;
      const { data } = await octokit.teams.list({
        org: params.org,
        page: params.page,
        per_page: params.perPage,
      });

      return data.map((team) => ({
        id: team.id,
        node_id: team.node_id,
        url: team.url,
        html_url: team.html_url,
        name: team.name,
        slug: team.slug,
        description: team.description,
        privacy: team.privacy,
        permission: team.permission,
        members_url: team.members_url,
        repositories_url: team.repositories_url,
        parent: team.parent,
      }));
    },
  });

  // Check organization membership tool
  tools.push({
    tool: {
      name: 'check_org_membership',
      description: 'Check if a user is a member of an organization',
      inputSchema: {
        type: 'object',
        properties: {
          org: {
            type: 'string',
            description: 'The organization name',
          },
          username: {
            type: 'string',
            description: 'The username to check',
          },
        },
        required: ['org', 'username'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as CheckOrgMembershipParams;
      try {
        await octokit.orgs.checkMembershipForUser({
          org: params.org,
          username: params.username,
        });

        return {
          is_member: true,
          message: `${params.username} is a member of ${params.org}`,
        };
      } catch (error: any) {
        if (error.status === 404) {
          return {
            is_member: false,
            message: `${params.username} is not a member of ${params.org}`,
          };
        }
        throw error;
      }
    },
  });

  // List user organizations tool
  tools.push({
    tool: {
      name: 'list_user_orgs',
      description: 'List organizations for a user',
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
    handler: async (args: unknown) => {
      const params = args as ListUserOrgsParams;
      let data;
      
      if (params.username) {
        const response = await octokit.orgs.listForUser({
          username: params.username,
          page: params.page,
          per_page: params.perPage,
        });
        data = response.data;
      } else {
        const response = await octokit.orgs.listForAuthenticatedUser({
          page: params.page,
          per_page: params.perPage,
        });
        data = response.data;
      }

      return data.map((org) => ({
        login: org.login,
        id: org.id,
        node_id: org.node_id,
        url: org.url,
        avatar_url: org.avatar_url,
        description: org.description,
      }));
    },
  });

  // Add write operations if not in read-only mode
  if (!readOnly) {
    // Update organization tool
    tools.push({
      tool: {
        name: 'update_org',
        description: 'Update an organization\'s profile',
        inputSchema: {
          type: 'object',
          properties: {
            org: {
              type: 'string',
              description: 'The organization name',
            },
            billing_email: {
              type: 'string',
              description: 'Billing email address',
            },
            company: {
              type: 'string',
              description: 'The company name',
            },
            email: {
              type: 'string',
              description: 'The publicly visible email address',
            },
            twitter_username: {
              type: 'string',
              description: 'The Twitter username',
            },
            location: {
              type: 'string',
              description: 'The location',
            },
            name: {
              type: 'string',
              description: 'The shorthand name of the company',
            },
            description: {
              type: 'string',
              description: 'The description of the company',
            },
            blog: {
              type: 'string',
              description: 'The URL of the company blog',
            },
          },
          required: ['org'],
        },
      },
      handler: async (args: unknown) => {
      const params = args as UpdateOrgParams;
        const { data } = await octokit.orgs.update({
          org: params.org,
          billing_email: params.billing_email,
          company: params.company,
          email: params.email,
          twitter_username: params.twitter_username,
          location: params.location,
          name: params.name,
          description: params.description,
          blog: params.blog,
        });

        return {
          login: data.login,
          name: data.name,
          company: data.company,
          blog: data.blog,
          location: data.location,
          email: data.email,
          twitter_username: data.twitter_username,
          description: data.description,
          billing_email: data.billing_email,
          updated_at: data.updated_at,
        };
      },
    });
  }

  return tools;
}
