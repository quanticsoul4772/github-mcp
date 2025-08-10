import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';
import { typedGraphQL, createTypedHandler } from '../graphql-utils.js';
import { RepositoryInsightsResponse, ContributionStatsResponse, CommitActivityResponse } from '../graphql-types.js';

export function createRepositoryInsightsTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // Get repository statistics tool
  tools.push({
    tool: {
      name: 'get_repository_insights',
      description: 'Get comprehensive repository statistics including contribution data, language stats, and commit activity',
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
            description: 'ISO 8601 date to get insights since (default: 1 year ago)',
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: createTypedHandler<{owner: string, repo: string, since?: string}, any>(async (args: {owner: string, repo: string, since?: string}) => {
      const query = `
        query($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            name
            description
            stargazerCount
            forkCount
            watchers {
              totalCount
            }
            issues {
              totalCount
            }
            pullRequests {
              totalCount
            }
            releases {
              totalCount
            }
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              edges {
                size
                node {
                  name
                  color
                }
              }
            }
            collaborators {
              totalCount
            }
            repositoryTopics(first: 20) {
              nodes {
                topic {
                  name
                }
              }
            }
            licenseInfo {
              name
              spdxId
            }
            createdAt
            updatedAt
            pushedAt
            diskUsage
            isArchived
            isDisabled
            isFork
            isTemplate
            visibility
          }
        }
      `;

      const result = await typedGraphQL<RepositoryInsightsResponse>(octokit, query, {
        owner: args.owner,
        repo: args.repo,
      });

      const repository = result.repository;

      return {
        name: repository.name,
        description: repository.description,
        statistics: {
          stars: repository.stargazerCount,
          forks: repository.forkCount,
          watchers: repository.watchers.totalCount,
          issues: repository.issues.totalCount,
          pullRequests: repository.pullRequests.totalCount,
          releases: repository.releases.totalCount,
          collaborators: repository.collaborators.totalCount,
          diskUsage: repository.diskUsage,
        },
        languages: repository.languages.edges.map((edge: any) => ({
          name: edge.node.name,
          color: edge.node.color,
          size: edge.size,
          percentage: Math.round((edge.size / repository.languages.edges.reduce((sum: number, e: any) => sum + e.size, 0)) * 100 * 100) / 100,
        })),
        topics: repository.repositoryTopics.nodes.map((node: any) => node.topic.name),
        license: repository.licenseInfo,
        metadata: {
          createdAt: repository.createdAt,
          updatedAt: repository.updatedAt,
          pushedAt: repository.pushedAt,
          isArchived: repository.isArchived,
          isDisabled: repository.isDisabled,
          isFork: repository.isFork,
          isTemplate: repository.isTemplate,
          visibility: repository.visibility,
        },
      };
    }),
  });

  // Get contribution statistics tool
  tools.push({
    tool: {
      name: 'get_contribution_stats',
      description: 'Get contributor statistics for a repository',
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
            description: 'Number of contributors to return (max 100)',
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: any) => {
      const query = `
        query($owner: String!, $repo: String!, $first: Int!) {
          repository(owner: $owner, name: $repo) {
            collaborators(first: $first, affiliation: ALL) {
              totalCount
              nodes {
                login
                name
                email
                avatarUrl
                url
                company
                location
                bio
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
                    totalCount
                    nodes {
                      author {
                        user {
                          login
                        }
                      }
                      committedDate
                      additions
                      deletions
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const result: any = await octokit.graphql(query, {
        owner: args.owner,
        repo: args.repo,
        first: args.first || 25,
      });

      const repository = result.repository;
      const commitHistory = repository.defaultBranchRef?.target?.history?.nodes || [];

      // Aggregate commit statistics by user
      const commitStats: { [login: string]: { commits: number; additions: number; deletions: number; } } = {};
      
      for (const commit of commitHistory) {
        const login = commit.author?.user?.login;
        if (login) {
          if (!commitStats[login]) {
            commitStats[login] = { commits: 0, additions: 0, deletions: 0 };
          }
          commitStats[login].commits++;
          commitStats[login].additions += commit.additions || 0;
          commitStats[login].deletions += commit.deletions || 0;
        }
      }

      return {
        totalContributors: repository.collaborators.totalCount,
        totalCommits: repository.defaultBranchRef?.target?.history?.totalCount || 0,
        contributors: repository.collaborators.nodes.map((contributor: any) => ({
          login: contributor.login,
          name: contributor.name,
          email: contributor.email,
          avatarUrl: contributor.avatarUrl,
          url: contributor.url,
          company: contributor.company,
          location: contributor.location,
          bio: contributor.bio,
          contributions: {
            commits: contributor.contributionsCollection.totalCommitContributions,
            issues: contributor.contributionsCollection.totalIssueContributions,
            pullRequests: contributor.contributionsCollection.totalPullRequestContributions,
            reviews: contributor.contributionsCollection.totalPullRequestReviewContributions,
          },
          commitStats: commitStats[contributor.login] || { commits: 0, additions: 0, deletions: 0 },
        })),
      };
    },
  });

  // Get commit activity patterns tool
  tools.push({
    tool: {
      name: 'get_commit_activity',
      description: 'Get commit activity patterns and frequency analysis',
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
            description: 'Branch to analyze (default: default branch)',
          },
          since: {
            type: 'string',
            description: 'ISO 8601 date to analyze commits since',
          },
          until: {
            type: 'string',
            description: 'ISO 8601 date to analyze commits until',
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: any) => {
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
                      author {
                        user {
                          login
                        }
                        date
                      }
                      additions
                      deletions
                      changedFiles
                      messageHeadline
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
                      author {
                        user {
                          login
                        }
                        date
                      }
                      additions
                      deletions
                      changedFiles
                      messageHeadline
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const result: any = await octokit.graphql(query, {
        owner: args.owner,
        repo: args.repo,
        branch: args.branch,
        since: args.since,
        until: args.until,
      });

      const repository = result.repository;
      const history = args.branch 
        ? repository.ref?.target?.history
        : repository.defaultBranchRef?.target?.history;

      if (!history) {
        throw new Error('Unable to fetch commit history for the specified branch');
      }

      const commits = history.nodes;

      // Analyze patterns
      const hourlyActivity: { [hour: string]: number } = {};
      const dailyActivity: { [day: string]: number } = {};
      const authorActivity: { [author: string]: number } = {};
      
      let totalAdditions = 0;
      let totalDeletions = 0;
      let totalFilesChanged = 0;

      for (const commit of commits) {
        const date = new Date(commit.committedDate);
        const hour = date.getUTCHours().toString();
        const day = date.toISOString().split('T')[0];
        const author = commit.author?.user?.login || 'unknown';

        hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
        dailyActivity[day] = (dailyActivity[day] || 0) + 1;
        authorActivity[author] = (authorActivity[author] || 0) + 1;

        totalAdditions += commit.additions || 0;
        totalDeletions += commit.deletions || 0;
        totalFilesChanged += commit.changedFiles || 0;
      }

      return {
        totalCommits: history.totalCount,
        analyzedCommits: commits.length,
        summary: {
          totalAdditions,
          totalDeletions,
          totalFilesChanged,
          averageAdditionsPerCommit: Math.round(totalAdditions / commits.length),
          averageDeletionsPerCommit: Math.round(totalDeletions / commits.length),
          averageFilesPerCommit: Math.round(totalFilesChanged / commits.length),
        },
        patterns: {
          hourlyActivity: Object.entries(hourlyActivity)
            .map(([hour, count]) => ({ hour: parseInt(hour), commits: count }))
            .sort((a, b) => a.hour - b.hour),
          dailyActivity: Object.entries(dailyActivity)
            .map(([day, count]) => ({ date: day, commits: count }))
            .sort((a, b) => a.date.localeCompare(b.date)),
          topAuthors: Object.entries(authorActivity)
            .map(([author, count]) => ({ author, commits: count }))
            .sort((a, b) => b.commits - a.commits)
            .slice(0, 10),
        },
        recentCommits: commits.slice(0, 10).map((commit: any) => ({
          date: commit.committedDate,
          author: commit.author?.user?.login,
          message: commit.messageHeadline,
          additions: commit.additions,
          deletions: commit.deletions,
          filesChanged: commit.changedFiles,
        })),
      };
    },
  });

  return tools;
}