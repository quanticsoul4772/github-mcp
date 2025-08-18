/**
 * Tests for repository insights tools (GraphQL)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRepositoryInsightsTools } from './repository-insights.js';
import { createMockOctokit } from '../__tests__/mocks/octokit.js';
import { ValidationError } from '../validation.js';

describe('Repository Insights Tools', () => {
  let mockOctokit: any;
  let tools: any[];

  beforeEach(() => {
    mockOctokit = createMockOctokit();
    tools = createRepositoryInsightsTools(mockOctokit, false);
  });

  describe('get_repository_insights', () => {
    let getInsights: any;

    beforeEach(() => {
      getInsights = tools.find(tool => tool.tool.name === 'get_repository_insights');
    });

    it('should be registered', () => {
      expect(getInsights).toBeDefined();
      expect(getInsights.tool.name).toBe('get_repository_insights');
      expect(getInsights.tool.description).toContain('comprehensive repository statistics');
    });

    it('should get repository insights successfully', async () => {
      const mockGraphQLResponse = {
        repository: {
          id: '1',
          name: 'test-repo',
          nameWithOwner: 'test-owner/test-repo',
          description: 'A test repository',
          url: 'https://github.com/test-owner/test-repo',
          stargazerCount: 100,
          forkCount: 25,
          watchers: { totalCount: 50 },
          issues: { totalCount: 15 },
          openIssues: { totalCount: 10 },
          pullRequests: { totalCount: 8 },
          openPullRequests: { totalCount: 3 },
          releases: { totalCount: 3 },
          collaborators: { totalCount: 5 },
          diskUsage: 1024,
          primaryLanguage: { name: 'TypeScript', color: '#2b7489' },
          languages: {
            totalSize: 10000,
            edges: [
              { size: 5000, node: { name: 'TypeScript', color: '#2b7489' } },
              { size: 3000, node: { name: 'JavaScript', color: '#f1e05a' } },
              { size: 2000, node: { name: 'CSS', color: '#563d7c' } },
            ],
          },
          repositoryTopics: {
            nodes: [
              { topic: { name: 'typescript' } },
              { topic: { name: 'github' } },
              { topic: { name: 'api' } },
            ],
          },
          licenseInfo: {
            name: 'MIT License',
            spdxId: 'MIT',
          },
          defaultBranchRef: {
            name: 'main',
            target: {
              history: {
                totalCount: 150,
                nodes: [],
              },
            },
          },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-15T12:00:00Z',
          pushedAt: '2024-01-15T12:00:00Z',
          isPrivate: false,
          isArchived: false,
          isFork: false,
          isTemplate: false,
          visibility: 'PUBLIC',
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await getInsights.handler({
        owner: 'test-owner',
        repo: 'test-repo',
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.stringContaining('query($owner: String!, $repo: String!)'),
        {
          owner: 'test-owner',
          repo: 'test-repo',
        }
      );

      expect(result).toEqual({
        basic: {
          id: '1',
          name: 'test-repo',
          fullName: 'test-owner/test-repo',
          description: 'A test repository',
          url: 'https://github.com/test-owner/test-repo',
          primaryLanguage: { name: 'TypeScript', color: '#2b7489' },
          license: {
            name: 'MIT License',
            spdxId: 'MIT',
          },
          topics: ['typescript', 'github', 'api'],
          diskUsage: 1024,
        },
        statistics: {
          stars: 100,
          forks: 25,
          watchers: 50,
          collaborators: 5,
          issues: {
            total: 15,
            open: 10,
            closed: 5,
          },
          pullRequests: {
            total: 8,
            open: 3,
            closed: 5,
          },
          releases: 3,
          commits: 150,
        },
        languages: {
          totalSize: 10000,
          breakdown: [
            { name: 'TypeScript', color: '#2b7489', size: 5000, percentage: 50 },
            { name: 'JavaScript', color: '#f1e05a', size: 3000, percentage: 30 },
            { name: 'CSS', color: '#563d7c', size: 2000, percentage: 20 },
          ],
        },
        activity: {
          recentCommits: [],
        },
        metadata: {
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-15T12:00:00Z',
          pushedAt: '2024-01-15T12:00:00Z',
          defaultBranch: 'main',
          isPrivate: false,
          isFork: false,
          isArchived: false,
          isTemplate: false,
          visibility: 'PUBLIC',
        },
      });
    });

    it('should handle GraphQL errors', async () => {
      const graphQLError = new Error('GraphQL Error: Repository not found');
      mockOctokit.graphql.mockRejectedValue(graphQLError);

      await expect(
        getInsights.handler({
          owner: 'test-owner',
          repo: 'nonexistent-repo',
        })
      ).rejects.toThrow('GraphQL Error: Repository not found');
    });

    it('should handle empty language data', async () => {
      const mockGraphQLResponse = {
        repository: {
          id: '2',
          name: 'empty-repo',
          nameWithOwner: 'test-owner/empty-repo',
          description: null,
          url: 'https://github.com/test-owner/empty-repo',
          stargazerCount: 0,
          forkCount: 0,
          watchers: { totalCount: 0 },
          issues: { totalCount: 0 },
          openIssues: { totalCount: 0 },
          pullRequests: { totalCount: 0 },
          openPullRequests: { totalCount: 0 },
          releases: { totalCount: 0 },
          collaborators: { totalCount: 1 },
          diskUsage: 0,
          primaryLanguage: null,
          languages: { totalSize: 0, edges: [] },
          repositoryTopics: { nodes: [] },
          licenseInfo: null,
          defaultBranchRef: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          pushedAt: '2024-01-01T00:00:00Z',
          isPrivate: true,
          isArchived: false,
          isFork: false,
          isTemplate: false,
          visibility: 'PRIVATE',
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await getInsights.handler({
        owner: 'test-owner',
        repo: 'empty-repo',
      });

      expect(result.languages.breakdown).toEqual([]);
      expect(result.basic.topics).toEqual([]);
      expect(result.basic.license).toBeNull();
    });
  });

  describe('get_contribution_stats', () => {
    let getContributions: any;

    beforeEach(() => {
      getContributions = tools.find(tool => tool.tool.name === 'get_contribution_stats');
    });

    it('should be registered', () => {
      expect(getContributions).toBeDefined();
      expect(getContributions.tool.name).toBe('get_contribution_stats');
      expect(getContributions.tool.description).toContain('contribution statistics');
    });

    it('should get contribution statistics successfully', async () => {
      const mockGraphQLResponse = {
        repository: {
          collaborators: {
            totalCount: 3,
            nodes: [
              {
                login: 'user1',
                name: 'User One',
                avatarUrl: 'https://github.com/user1.png',
                contributionsCollection: {
                  totalCommitContributions: 50,
                  totalIssueContributions: 10,
                  totalPullRequestContributions: 15,
                  totalPullRequestReviewContributions: 8,
                },
              },
              {
                login: 'user2',
                name: 'User Two',
                avatarUrl: 'https://github.com/user2.png',
                contributionsCollection: {
                  totalCommitContributions: 25,
                  totalIssueContributions: 5,
                  totalPullRequestContributions: 8,
                  totalPullRequestReviewContributions: 3,
                },
              },
              {
                login: 'user3',
                name: 'User Three',
                avatarUrl: 'https://github.com/user3.png',
                contributionsCollection: {
                  totalCommitContributions: 25,
                  totalIssueContributions: 2,
                  totalPullRequestContributions: 7,
                  totalPullRequestReviewContributions: 1,
                },
              },
            ],
          },
          defaultBranchRef: {
            target: {
              history: {
                totalCount: 100,
                nodes: [
                  {
                    author: { user: { login: 'user1' } },
                    committedDate: '2024-01-15T12:00:00Z',
                    additions: 50,
                    deletions: 10,
                  },
                  {
                    author: { user: { login: 'user2' } },
                    committedDate: '2024-01-14T10:00:00Z',
                    additions: 30,
                    deletions: 5,
                  },
                  {
                    author: { user: { login: 'user1' } },
                    committedDate: '2024-01-13T14:00:00Z',
                    additions: 20,
                    deletions: 15,
                  },
                ],
              },
            },
          },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await getContributions.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        first: 10,
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.stringContaining('query($owner: String!, $repo: String!, $first: Int!)'),
        {
          owner: 'test-owner',
          repo: 'test-repo',
          first: 10,
        }
      );

      expect(result).toEqual({
        totalContributors: 3,
        contributors: [
          {
            user: {
              login: 'user1',
              name: 'User One',
              avatarUrl: 'https://github.com/user1.png',
            },
            contributions: {
              commits: 50,
              issues: 10,
              pullRequests: 15,
              reviews: 8,
            },
            commitStats: {
              commits: 2,
              additions: 70,
              deletions: 25,
            },
          },
          {
            user: {
              login: 'user2',
              name: 'User Two',
              avatarUrl: 'https://github.com/user2.png',
            },
            contributions: {
              commits: 25,
              issues: 5,
              pullRequests: 8,
              reviews: 3,
            },
            commitStats: {
              commits: 1,
              additions: 30,
              deletions: 5,
            },
          },
          {
            user: {
              login: 'user3',
              name: 'User Three',
              avatarUrl: 'https://github.com/user3.png',
            },
            contributions: {
              commits: 25,
              issues: 2,
              pullRequests: 7,
              reviews: 1,
            },
            commitStats: {
              commits: 0,
              additions: 0,
              deletions: 0,
            },
          },
        ],
      });
    });

    it('should use default first value', async () => {
      const mockGraphQLResponse = {
        repository: {
          collaborators: { totalCount: 0, nodes: [] },
          defaultBranchRef: {
            target: {
              history: { totalCount: 0, nodes: [] },
            },
          },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      await getContributions.handler({
        owner: 'test-owner',
        repo: 'test-repo',
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ first: 25 })
      );
    });

    it('should handle repository with no default branch', async () => {
      const mockGraphQLResponse = {
        repository: {
          collaborators: { totalCount: 1, nodes: [] },
          defaultBranchRef: null,
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await getContributions.handler({
        owner: 'test-owner',
        repo: 'empty-repo',
      });

      expect(result.totalContributors).toBe(1);
      expect(result.contributors).toEqual([]);
    });
  });

  describe('get_commit_activity', () => {
    let getCommitActivity: any;

    beforeEach(() => {
      getCommitActivity = tools.find(tool => tool.tool.name === 'get_commit_activity');
    });

    it('should be registered', () => {
      expect(getCommitActivity).toBeDefined();
      expect(getCommitActivity.tool.name).toBe('get_commit_activity');
      expect(getCommitActivity.tool.description).toContain('commit activity patterns');
    });

    it('should get commit activity successfully', async () => {
      const mockGraphQLResponse = {
        repository: {
          ref: null,
          defaultBranchRef: {
            name: 'main',
            target: {
              history: {
                totalCount: 50,
                nodes: [
                  {
                    committedDate: '2024-01-15T14:30:00Z',
                    author: { user: { login: 'user1' }, date: '2024-01-15T14:30:00Z' },
                    additions: 25,
                    deletions: 5,
                    changedFiles: 3,
                    messageHeadline: 'Add new feature',
                  },
                  {
                    committedDate: '2024-01-15T10:15:00Z',
                    author: { user: { login: 'user2' }, date: '2024-01-15T10:15:00Z' },
                    additions: 15,
                    deletions: 8,
                    changedFiles: 2,
                    messageHeadline: 'Fix bug',
                  },
                  {
                    committedDate: '2024-01-14T16:45:00Z',
                    author: { user: { login: 'user1' }, date: '2024-01-14T16:45:00Z' },
                    additions: 40,
                    deletions: 2,
                    changedFiles: 4,
                    messageHeadline: 'Update documentation',
                  },
                ],
              },
            },
          },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await getCommitActivity.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        since: '2024-01-01T00:00:00Z',
        until: '2024-01-31T23:59:59Z',
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.stringContaining(
          'query($owner: String!, $repo: String!, $branch: String, $since: GitTimestamp, $until: GitTimestamp)'
        ),
        {
          owner: 'test-owner',
          repo: 'test-repo',
          branch: undefined,
          since: '2024-01-01T00:00:00Z',
          until: '2024-01-31T23:59:59Z',
        }
      );

      expect(result).toEqual({
        summary: {
          totalCommits: 50,
          totalAdditions: 80,
          totalDeletions: 15,
          totalFilesChanged: 9,
          averageAdditionsPerCommit: 27,
          averageDeletionsPerCommit: 5,
          averageFilesPerCommit: 3,
        },
        patterns: {
          byDay: [
            { date: '2024-01-14', commits: 1 },
            { date: '2024-01-15', commits: 2 },
          ],
          byHour: [
            { hour: 10, commits: 1 },
            { hour: 14, commits: 1 },
            { hour: 16, commits: 1 },
          ],
          byWeekday: expect.arrayContaining([
            expect.objectContaining({ weekday: expect.any(String), commits: expect.any(Number) }),
          ]),
          byAuthor: [
            { author: 'user1', commits: 2 },
            { author: 'user2', commits: 1 },
          ],
        },
        commits: [
          {
            date: '2024-01-15T14:30:00Z',
            author: 'user1',
            message: 'Add new feature',
            additions: 25,
            deletions: 5,
            filesChanged: 3,
          },
          {
            date: '2024-01-15T10:15:00Z',
            author: 'user2',
            message: 'Fix bug',
            additions: 15,
            deletions: 8,
            filesChanged: 2,
          },
          {
            date: '2024-01-14T16:45:00Z',
            author: 'user1',
            message: 'Update documentation',
            additions: 40,
            deletions: 2,
            filesChanged: 4,
          },
        ],
      });
    });

    it('should use specific branch when provided', async () => {
      const mockGraphQLResponse = {
        repository: {
          ref: {
            target: {
              history: {
                totalCount: 25,
                nodes: [],
              },
            },
          },
          defaultBranchRef: {
            name: 'main',
            target: {
              history: {
                totalCount: 50,
                nodes: [],
              },
            },
          },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await getCommitActivity.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'feature-branch',
      });

      expect(result.summary.totalCommits).toBe(25); // Should use branch data, not default branch
    });

    it('should throw error when no commit history available', async () => {
      const mockGraphQLResponse = {
        repository: {
          ref: null,
          defaultBranchRef: null,
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      await expect(
        getCommitActivity.handler({
          owner: 'test-owner',
          repo: 'empty-repo',
        })
      ).rejects.toThrow('Unable to fetch commit history for the specified branch');
    });

    it('should handle commits with missing author data', async () => {
      const mockGraphQLResponse = {
        repository: {
          ref: null,
          defaultBranchRef: {
            name: 'main',
            target: {
              history: {
                totalCount: 2,
                nodes: [
                  {
                    committedDate: '2024-01-15T14:30:00Z',
                    author: null,
                    additions: 10,
                    deletions: 2,
                    changedFiles: 1,
                    messageHeadline: 'Anonymous commit',
                  },
                  {
                    committedDate: '2024-01-15T14:30:00Z',
                    author: { user: null },
                    additions: 5,
                    deletions: 1,
                    changedFiles: 1,
                    messageHeadline: 'Another anonymous commit',
                  },
                ],
              },
            },
          },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await getCommitActivity.handler({
        owner: 'test-owner',
        repo: 'test-repo',
      });

      expect(result.patterns.byAuthor).toEqual([{ author: 'unknown', commits: 2 }]);
    });
  });
});
