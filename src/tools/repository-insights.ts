import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import { ToolConfig } from '../types.js';
import { createTypeSafeHandler } from '../utils/type-safety.js';
import {
  validateGraphQLInput,
  validateGraphQLVariableValue,
  GraphQLValidationError,
} from '../graphql-validation.js';
import { withErrorHandling } from '../errors.js';

// Type definitions for repository insights
interface RepositoryInsightsParams {
  owner: string;
  repo: string;
  since?: string;
}

interface ContributionStatsParams {
  owner: string;
  repo: string;
  first?: number;
}

interface CommitActivityParams {
  owner: string;
  repo: string;
  branch?: string;
  since?: string;
  until?: string;
}

// Zod schemas for validation
const RepositoryInsightsSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  since: z.string().optional(),
});

const ContributionStatsSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  first: z.number().int().min(1).max(100).optional(),
});

const CommitActivitySchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  branch: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
});

/**
 * Creates repository insights tools using GraphQL API for enhanced analytics capabilities.
 *
 * These tools provide sophisticated repository analytics functionality that leverages GraphQL's
 * ability to fetch nested relationships and statistical data in single queries,
 * offering performance and feature advantages over REST-based analytics.
 *
 * @param octokit - Configured Octokit instance with GraphQL support
 * @param readOnly - Whether to exclude write operations (all insights tools are read-only)
 * @returns Array of repository insights tool configurations
 *
 * @example
 * ```typescript
 * const tools = createRepositoryInsightsTools(octokit, true);
 * // Returns tools: get_repository_insights, get_contribution_stats, etc.
 * ```
 *
 * @see https://docs.github.com/en/graphql/reference/objects#repository
 */
export function createRepositoryInsightsTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // Get repository statistics tool
  tools.push({
    tool: {
      name: 'get_repository_insights',
      description: 'Get comprehensive repository statistics and insights',
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
          since: {
            type: 'string',
            description: 'Filter data since this date (ISO 8601)',
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: createTypeSafeHandler(
      RepositoryInsightsSchema,
      async (params: RepositoryInsightsParams) => {
        return withErrorHandling(
          'get_repository_insights',
          async () => {
            const query = `
              query($owner: String!, $repo: String!) {
                repository(owner: $owner, name: $repo) {
                  id
                  name
                  nameWithOwner
                  description
                  url
                  stargazerCount
                  forkCount
                  watchers {
                    totalCount
                  }
                  createdAt
                  updatedAt
                  pushedAt
                  primaryLanguage {
                    name
                    color
                  }
                  licenseInfo {
                    name
                    spdxId
                  }
                  languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
                    edges {
                      size
                      node {
                        name
                        color
                      }
                    }
                    totalSize
                  }
                  collaborators(first: 25) {
                    totalCount
                    nodes {
                      login
                      name
                      avatarUrl
                      contributionsCollection {
                        totalCommitContributions
                      }
                    }
                  }
                  issues {
                    totalCount
                  }
                  openIssues: issues(states: OPEN) {
                    totalCount
                  }
                  pullRequests {
                    totalCount
                  }
                  openPullRequests: pullRequests(states: OPEN) {
                    totalCount
                  }
                  releases {
                    totalCount
                  }
                  defaultBranchRef {
                    name
                    target {
                      ... on Commit {
                        history(first: 10) {
                          totalCount
                          nodes {
                            committedDate
                            messageHeadline
                            author {
                              user {
                                login
                              }
                            }
                            additions
                            deletions
                          }
                        }
                      }
                    }
                  }
                  repositoryTopics(first: 20) {
                    nodes {
                      topic {
                        name
                      }
                    }
                  }
                  diskUsage
                  isPrivate
                  isFork
                  isArchived
                  isTemplate
                  visibility
                }
              }
            `;

            // Validate GraphQL variables before execution
            const variables = {
              owner: validateGraphQLVariableValue(params.owner, 'owner'),
              repo: validateGraphQLVariableValue(params.repo, 'repo'),
            };

            const result: any = (await (octokit as any).graphqlWithComplexity)
              ? await (octokit as any).graphqlWithComplexity(query, variables)
              : await octokit.graphql(query, variables);

            if (!result.repository) {
              throw new Error('Repository not found or insights query failed');
            }

            const repository = result.repository;

            return {
              basic: {
                id: repository.id,
                name: repository.name,
                fullName: repository.nameWithOwner,
                description: repository.description,
                url: repository.url,
                primaryLanguage: repository.primaryLanguage,
                license: repository.licenseInfo,
                topics: repository.repositoryTopics.nodes.map((node: any) => node.topic.name),
                diskUsage: repository.diskUsage,
              },
              statistics: {
                stars: repository.stargazerCount,
                forks: repository.forkCount,
                watchers: repository.watchers.totalCount,
                collaborators: repository.collaborators.totalCount,
                issues: {
                  total: repository.issues.totalCount,
                  open: repository.openIssues.totalCount,
                  closed: repository.issues.totalCount - repository.openIssues.totalCount,
                },
                pullRequests: {
                  total: repository.pullRequests.totalCount,
                  open: repository.openPullRequests.totalCount,
                  closed:
                    repository.pullRequests.totalCount - repository.openPullRequests.totalCount,
                },
                releases: repository.releases.totalCount,
                commits: repository.defaultBranchRef?.target?.history?.totalCount || 0,
              },
              languages: {
                totalSize: repository.languages.totalSize,
                breakdown: repository.languages.edges.map((edge: any) => ({
                  name: edge.node.name,
                  color: edge.node.color,
                  size: edge.size,
                  percentage:
                    Math.round((edge.size / repository.languages.totalSize) * 100 * 100) / 100,
                })),
              },
              activity: {
                recentCommits:
                  repository.defaultBranchRef?.target?.history?.nodes.map((commit: any) => ({
                    date: commit.committedDate,
                    message: commit.messageHeadline,
                    author: commit.author?.user?.login,
                    additions: commit.additions,
                    deletions: commit.deletions,
                  })) || [],
              },
              metadata: {
                createdAt: repository.createdAt,
                updatedAt: repository.updatedAt,
                pushedAt: repository.pushedAt,
                defaultBranch: repository.defaultBranchRef?.name,
                isPrivate: repository.isPrivate,
                isFork: repository.isFork,
                isArchived: repository.isArchived,
                isTemplate: repository.isTemplate,
                visibility: repository.visibility,
              },
            };
          },
          { tool: 'get_repository_insights', owner: params.owner, repo: params.repo }
        );
      },
      'get_repository_insights'
    ),
  });

  // Get contribution statistics tool
  tools.push({
    tool: {
      name: 'get_contribution_stats',
      description: 'Get detailed contribution statistics for repository contributors',
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
          first: {
            type: 'number',
            description: 'Number of contributors to analyze (max 100)',
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: createTypeSafeHandler(
      ContributionStatsSchema,
      async (params: ContributionStatsParams) => {
        return withErrorHandling(
          'get_contribution_stats',
          async () => {
            const query = `
              query($owner: String!, $repo: String!, $first: Int!) {
                repository(owner: $owner, name: $repo) {
                  collaborators(first: $first, affiliation: ALL) {
                    totalCount
                    nodes {
                      login
                      name
                      avatarUrl
                      contributionsCollection {
                        totalCommitContributions
                        totalIssueContributions
                        totalPullRequestContributions
                        totalPullRequestReviewContributions
                      }
                    }
                  }
                  defaultBranchRef {
                    target {
                      ... on Commit {
                        history(first: 100) {
                          nodes {
                            author {
                              user {
                                login
                              }
                            }
                            additions
                            deletions
                            committedDate
                          }
                        }
                      }
                    }
                  }
                }
              }
            `;

            // Validate GraphQL variables before execution
            const variables = {
              owner: validateGraphQLVariableValue(params.owner, 'owner'),
              repo: validateGraphQLVariableValue(params.repo, 'repo'),
              first: validateGraphQLVariableValue(params.first || 25, 'first'),
            };

            const result: any = (await (octokit as any).graphqlWithComplexity)
              ? await (octokit as any).graphqlWithComplexity(query, variables)
              : await octokit.graphql(query, variables);

            if (!result.repository) {
              throw new Error('Repository not found or contribution stats query failed');
            }

            const repository = result.repository;
            const commitHistory = repository.defaultBranchRef?.target?.history?.nodes || [];

            // Calculate commit statistics per contributor
            const commitStats: Record<
              string,
              { commits: number; additions: number; deletions: number }
            > = {};

            commitHistory.forEach((commit: any) => {
              const author = commit.author?.user?.login;
              if (author) {
                if (!commitStats[author]) {
                  commitStats[author] = { commits: 0, additions: 0, deletions: 0 };
                }
                commitStats[author].commits++;
                commitStats[author].additions += commit.additions || 0;
                commitStats[author].deletions += commit.deletions || 0;
              }
            });

            return {
              totalContributors: repository.collaborators.totalCount,
              contributors: repository.collaborators.nodes.map((contributor: any) => ({
                user: {
                  login: contributor.login,
                  name: contributor.name,
                  avatarUrl: contributor.avatarUrl,
                },
                contributions: {
                  commits: contributor.contributionsCollection.totalCommitContributions,
                  issues: contributor.contributionsCollection.totalIssueContributions,
                  pullRequests: contributor.contributionsCollection.totalPullRequestContributions,
                  reviews: contributor.contributionsCollection.totalPullRequestReviewContributions,
                },
                commitStats: commitStats[contributor.login] || {
                  commits: 0,
                  additions: 0,
                  deletions: 0,
                },
              })),
            };
          },
          { tool: 'get_contribution_stats', owner: params.owner, repo: params.repo }
        );
      },
      'get_contribution_stats'
    ),
  });

  // Get commit activity patterns tool
  tools.push({
    tool: {
      name: 'get_commit_activity',
      description: 'Get commit activity patterns and trends for a repository',
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
            description: 'Branch to analyze (defaults to default branch)',
          },
          since: {
            type: 'string',
            description: 'Start date for analysis (ISO 8601)',
          },
          until: {
            type: 'string',
            description: 'End date for analysis (ISO 8601)',
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: createTypeSafeHandler(
      CommitActivitySchema,
      async (params: CommitActivityParams) => {
        return withErrorHandling(
          'get_commit_activity',
          async () => {
            const query = `
              query($owner: String!, $repo: String!, $branch: String, $since: GitTimestamp, $until: GitTimestamp) {
                repository(owner: $owner, name: $repo) {
                  ref(qualifiedName: $branch) {
                    target {
                      ... on Commit {
                        history(first: 100, since: $since, until: $until) {
                          totalCount
                          nodes {
                            committedDate
                            messageHeadline
                            author {
                              user {
                                login
                              }
                            }
                            additions
                            deletions
                            changedFiles
                          }
                        }
                      }
                    }
                  }
                  defaultBranchRef {
                    name
                    target {
                      ... on Commit {
                        history(first: 100, since: $since, until: $until) {
                          totalCount
                          nodes {
                            committedDate
                            messageHeadline
                            author {
                              user {
                                login
                              }
                            }
                            additions
                            deletions
                            changedFiles
                          }
                        }
                      }
                    }
                  }
                }
              }
            `;

            // Validate GraphQL variables before execution
            const variables = {
              owner: validateGraphQLVariableValue(params.owner, 'owner'),
              repo: validateGraphQLVariableValue(params.repo, 'repo'),
              branch: params.branch
                ? validateGraphQLVariableValue(`refs/heads/${params.branch}`, 'branch')
                : undefined,
              since: params.since ? validateGraphQLVariableValue(params.since, 'since') : undefined,
              until: params.until ? validateGraphQLVariableValue(params.until, 'until') : undefined,
            };

            const result: any = (await (octokit as any).graphqlWithComplexity)
              ? await (octokit as any).graphqlWithComplexity(query, variables)
              : await octokit.graphql(query, variables);

            if (!result.repository) {
              throw new Error('Repository not found or commit activity query failed');
            }

            const repository = result.repository;
            const history = params.branch
              ? repository.ref?.target?.history
              : repository.defaultBranchRef?.target?.history;

            if (!history) {
              throw new Error('Unable to fetch commit history for the specified branch');
            }

            const commits = history.nodes;

            // Analyze commit patterns
            const activityByDay: Record<string, number> = {};
            const activityByHour: Record<number, number> = {};
            const activityByAuthor: Record<string, number> = {};
            const activityByWeekday: Record<string, number> = {};

            let totalAdditions = 0;
            let totalDeletions = 0;
            let totalFilesChanged = 0;

            commits.forEach((commit: any) => {
              const date = new Date(commit.committedDate);
              const dayKey = date.toISOString().split('T')[0];
              const hour = date.getUTCHours();
              const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
              const author = commit.author?.user?.login || 'unknown';

              // Count by day
              activityByDay[dayKey] = (activityByDay[dayKey] || 0) + 1;

              // Count by hour
              activityByHour[hour] = (activityByHour[hour] || 0) + 1;

              // Count by author
              activityByAuthor[author] = (activityByAuthor[author] || 0) + 1;

              // Count by weekday
              activityByWeekday[weekday] = (activityByWeekday[weekday] || 0) + 1;

              // Accumulate stats
              totalAdditions += commit.additions || 0;
              totalDeletions += commit.deletions || 0;
              totalFilesChanged += commit.changedFiles || 0;
            });

            return {
              summary: {
                totalCommits: history.totalCount,
                totalAdditions,
                totalDeletions,
                totalFilesChanged,
                averageAdditionsPerCommit:
                  commits.length > 0 ? Math.round(totalAdditions / commits.length) : 0,
                averageDeletionsPerCommit:
                  commits.length > 0 ? Math.round(totalDeletions / commits.length) : 0,
                averageFilesPerCommit:
                  commits.length > 0 ? Math.round(totalFilesChanged / commits.length) : 0,
              },
              patterns: {
                byDay: Object.entries(activityByDay)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([date, count]) => ({ date, commits: count })),
                byHour: Object.entries(activityByHour)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([hour, count]) => ({ hour: parseInt(hour), commits: count })),
                byWeekday: Object.entries(activityByWeekday).map(([weekday, count]) => ({
                  weekday,
                  commits: count,
                })),
                byAuthor: Object.entries(activityByAuthor)
                  .sort(([, a], [, b]) => b - a)
                  .map(([author, count]) => ({ author, commits: count })),
              },
              commits: commits.map((commit: any) => ({
                date: commit.committedDate,
                message: commit.messageHeadline,
                author: commit.author?.user?.login,
                additions: commit.additions,
                deletions: commit.deletions,
                filesChanged: commit.changedFiles,
              })),
            };
          },
          { tool: 'get_commit_activity', owner: params.owner, repo: params.repo }
        );
      },
      'get_commit_activity'
    ),
  });

  return tools;
}
