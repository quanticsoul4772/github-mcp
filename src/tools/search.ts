import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';
import {
  SearchCodeParams,
  SearchReposParams,
  SearchIssuesParams,
  SearchUsersParams
} from '../tool-types.js';

export function createSearchTools(octokit: Octokit): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // Search code tool
  tools.push({
    tool: {
      name: 'search_code',
      description: 'Search for code across GitHub repositories',
      inputSchema: {
        type: 'object',
        properties: {
          q: {
            type: 'string',
            description: 'Search query using GitHub code search syntax',
          },
          sort: {
            type: 'string',
            description: 'Sort field (\'indexed\' only)',
            enum: ['indexed'],
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
        required: ['q'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as SearchCodeParams;
      const { data } = await octokit.search.code({
        q: params.q,
        sort: params.sort as any as any,
        order: params.order as any as any,
        page: params.page,
        per_page: params.perPage,
      });

      return {
        total_count: data.total_count,
        incomplete_results: data.incomplete_results,
        items: data.items.map((item) => ({
          name: item.name,
          path: item.path,
          sha: item.sha,
          url: item.url,
          git_url: item.git_url,
          html_url: item.html_url,
          repository: {
            name: item.repository.name,
            full_name: item.repository.full_name,
            owner: {
              login: item.repository.owner.login,
            },
            private: item.repository.private,
            html_url: item.repository.html_url,
            description: item.repository.description,
          },
          score: item.score,
        })),
      };
    },
  });

  // Search commits tool
  tools.push({
    tool: {
      name: 'search_commits',
      description: 'Search for commits across GitHub repositories',
      inputSchema: {
        type: 'object',
        properties: {
          q: {
            type: 'string',
            description: 'Search query using GitHub commits search syntax',
          },
          sort: {
            type: 'string',
            description: 'Sort field',
            enum: ['author-date', 'committer-date'],
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
        required: ['q'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as SearchCodeParams;
      const { data } = await octokit.search.commits({
        q: params.q,
        sort: params.sort as any as any,
        order: params.order as any as any,
        page: params.page,
        per_page: params.perPage,
      });

      return {
        total_count: data.total_count,
        incomplete_results: data.incomplete_results,
        items: data.items.map((item) => ({
          sha: item.sha,
          commit: {
            message: item.commit.message,
            author: {
        name: item.commit.author?.name || "",
        email: item.commit.author?.email || "",
        date: item.commit.author?.date || "",
      },
            committer: {
              name: item.commit.committer?.name || "",
              email: item.commit.committer?.email || "",
              date: item.commit.committer?.date || "",
            },
            comment_count: item.commit.comment_count,
          },
          author: item.author ? {
            login: (item.author as any).login,
            type: (item.author as any).type,
          } : null,
          committer: item.committer ? {
            login: (item.committer as any).login,
            type: (item.committer as any).type,
          } : null,
          repository: {
            name: item.repository.name,
            full_name: item.repository.full_name,
            owner: {
              login: item.repository.owner.login,
            },
            private: item.repository.private,
            html_url: item.repository.html_url,
          },
          score: item.score,
          html_url: item.html_url,
        })),
      };
    },
  });

  // Search topics tool
  tools.push({
    tool: {
      name: 'search_topics',
      description: 'Search for repository topics on GitHub',
      inputSchema: {
        type: 'object',
        properties: {
          q: {
            type: 'string',
            description: 'Search query for topics',
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
        required: ['q'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as SearchCodeParams;
      const { data } = await octokit.search.topics({
        q: params.q,
        page: params.page,
        per_page: params.perPage,
      });

      return {
        total_count: data.total_count,
        incomplete_results: data.incomplete_results,
        items: data.items.map((item) => ({
          name: item.name,
          display_name: item.display_name,
          short_description: item.short_description,
          description: item.description,
          created_by: item.created_by,
          released: item.released,
          created_at: item.created_at,
          updated_at: item.updated_at,
          featured: item.featured,
          curated: item.curated,
          score: item.score,
        })),
      };
    },
  });

  // Search labels tool
  tools.push({
    tool: {
      name: 'search_labels',
      description: 'Search for labels in a repository',
      inputSchema: {
        type: 'object',
        properties: {
          repository_id: {
            type: 'number',
            description: 'Repository ID',
          },
          q: {
            type: 'string',
            description: 'Search query for labels',
          },
          sort: {
            type: 'string',
            description: 'Sort field',
            enum: ['created', 'updated'],
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
        required: ['repository_id', 'q'],
      },
    },
    handler: async (args: unknown) => {
      const params = args as SearchCodeParams;
      const { data } = await octokit.search.labels({
        repository_id: params.repository_id!,
        q: params.q,
        sort: params.sort as any as any,
        order: params.order as any as any,
        page: params.page,
        per_page: params.perPage,
      });

      return {
        total_count: data.total_count,
        incomplete_results: data.incomplete_results,
        items: data.items.map((item) => ({
          id: item.id,
          node_id: item.node_id,
          url: item.url,
          name: item.name,
          color: item.color,
          default: item.default,
          description: item.description,
          score: item.score,
        })),
      };
    },
  });

  return tools;
}
