/**
 * Tests for project management tools (GraphQL)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProjectManagementTools } from './project-management.js';
import { createMockOctokit } from '../__tests__/mocks/octokit.js';

describe('Project Management Tools', () => {
  let mockOctokit: any;
  let tools: any[];

  beforeEach(() => {
    mockOctokit = createMockOctokit();
    tools = createProjectManagementTools(mockOctokit, false);
  });

  describe('get_project_boards', () => {
    let getProjectBoards: any;

    beforeEach(() => {
      getProjectBoards = tools.find(tool => tool.tool.name === 'get_project_boards');
    });

    it('should be registered', () => {
      expect(getProjectBoards).toBeDefined();
      expect(getProjectBoards.tool.name).toBe('get_project_boards');
      expect(getProjectBoards.tool.description).toContain('GitHub Projects V2 boards');
    });

    it('should get repository projects successfully', async () => {
      const mockGraphQLResponse = {
        repository: {
          projectsV2: {
            totalCount: 2,
            nodes: [
              {
                id: 'project1',
                number: 1,
                title: 'Bug Tracking',
                shortDescription: 'Track bugs and issues',
                readme: '# Bug Tracking Project\nTrack all bugs here.',
                url: 'https://github.com/users/owner/projects/1',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T12:00:00Z',
                closed: false,
                public: true,
                owner: { login: 'owner' },
                creator: { login: 'creator' },
                items: {
                  totalCount: 10,
                  nodes: [
                    {
                      id: 'item1',
                      type: 'ISSUE',
                      content: {
                        number: 123,
                        title: 'Bug in search',
                        state: 'OPEN',
                        url: 'https://github.com/owner/repo/issues/123',
                      },
                    },
                    {
                      id: 'item2',
                      type: 'PULL_REQUEST',
                      content: {
                        number: 45,
                        title: 'Fix search bug',
                        state: 'OPEN',
                        url: 'https://github.com/owner/repo/pull/45',
                      },
                    },
                    {
                      id: 'item3',
                      type: 'DRAFT_ISSUE',
                      content: {
                        title: 'Draft: Improve performance',
                        body: 'We should improve the performance of the search feature.',
                      },
                    },
                  ],
                },
                fields: {
                  totalCount: 3,
                  nodes: [
                    {
                      id: 'field1',
                      name: 'Status',
                      dataType: 'SINGLE_SELECT',
                      options: [
                        { id: 'option1', name: 'Todo', color: 'GRAY' },
                        { id: 'option2', name: 'In Progress', color: 'YELLOW' },
                        { id: 'option3', name: 'Done', color: 'GREEN' },
                      ],
                    },
                    {
                      id: 'field2',
                      name: 'Priority',
                      dataType: 'SINGLE_SELECT',
                    },
                  ],
                },
              },
            ],
          },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await getProjectBoards.handler({
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
        totalCount: 2,
        projects: [
          {
            id: 'project1',
            number: 1,
            title: 'Bug Tracking',
            shortDescription: 'Track bugs and issues',
            readme: '# Bug Tracking Project\nTrack all bugs here.',
            url: 'https://github.com/users/owner/projects/1',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T12:00:00Z',
            closed: false,
            public: true,
            owner: { login: 'owner' },
            creator: { login: 'creator' },
            items: {
              totalCount: 10,
              nodes: [
                {
                  id: 'item1',
                  type: 'ISSUE',
                  content: {
                    number: 123,
                    title: 'Bug in search',
                    state: 'OPEN',
                    url: 'https://github.com/owner/repo/issues/123',
                  },
                },
                {
                  id: 'item2',
                  type: 'PULL_REQUEST',
                  content: {
                    number: 45,
                    title: 'Fix search bug',
                    state: 'OPEN',
                    url: 'https://github.com/owner/repo/pull/45',
                  },
                },
                {
                  id: 'item3',
                  type: 'DRAFT_ISSUE',
                  content: {
                    title: 'Draft: Improve performance',
                    body: 'We should improve the performance of the search feature.',
                  },
                },
              ],
            },
            fields: {
              totalCount: 3,
              nodes: [
                {
                  id: 'field1',
                  name: 'Status',
                  dataType: 'SINGLE_SELECT',
                  options: [
                    { id: 'option1', name: 'Todo', color: 'GRAY' },
                    { id: 'option2', name: 'In Progress', color: 'YELLOW' },
                    { id: 'option3', name: 'Done', color: 'GREEN' },
                  ],
                },
                {
                  id: 'field2',
                  name: 'Priority',
                  dataType: 'SINGLE_SELECT',
                },
              ],
            },
          },
        ],
      });
    });

    it('should get user projects successfully', async () => {
      const mockGraphQLResponse = {
        user: {
          projectsV2: {
            totalCount: 1,
            nodes: [
              {
                id: 'userproject1',
                number: 5,
                title: 'Personal Tasks',
                shortDescription: 'My personal task list',
                readme: null,
                url: 'https://github.com/users/testuser/projects/5',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T12:00:00Z',
                closed: false,
                public: false,
                owner: { login: 'testuser' },
                creator: { login: 'testuser' },
                items: { totalCount: 5, nodes: [] },
                fields: { totalCount: 2, nodes: [] },
              },
            ],
          },
        },
        organization: null,
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await getProjectBoards.handler({
        owner: 'testuser',
      });

      expect(result.totalCount).toBe(1);
      expect(result.projects[0].title).toBe('Personal Tasks');
    });

    it('should get organization projects successfully', async () => {
      const mockGraphQLResponse = {
        user: null,
        organization: {
          projectsV2: {
            totalCount: 3,
            nodes: [
              {
                id: 'orgproject1',
                number: 10,
                title: 'Company Roadmap',
                shortDescription: 'Our product roadmap',
                readme: '# Company Roadmap\nTrack our product development.',
                url: 'https://github.com/orgs/company/projects/10',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T12:00:00Z',
                closed: false,
                public: true,
                owner: { login: 'company' },
                creator: { login: 'admin' },
                items: { totalCount: 25, nodes: [] },
                fields: { totalCount: 5, nodes: [] },
              },
            ],
          },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await getProjectBoards.handler({
        owner: 'company',
      });

      expect(result.totalCount).toBe(3);
      expect(result.projects[0].title).toBe('Company Roadmap');
    });

    it('should use default first value', async () => {
      const mockGraphQLResponse = {
        user: {
          projectsV2: { totalCount: 0, nodes: [] },
        },
        organization: null,
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      await getProjectBoards.handler({
        owner: 'testuser',
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ first: 25 })
      );
    });

    it('should throw error when no projects found', async () => {
      const mockGraphQLResponse = {
        user: null,
        organization: null,
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      await expect(
        getProjectBoards.handler({
          owner: 'nonexistent',
        })
      ).rejects.toThrow('No projects found for nonexistent');
    });
  });

  describe('get_milestones_with_issues', () => {
    let getMilestonesWithIssues: any;

    beforeEach(() => {
      getMilestonesWithIssues = tools.find(tool => tool.tool.name === 'get_milestones_with_issues');
    });

    it('should be registered', () => {
      expect(getMilestonesWithIssues).toBeDefined();
      expect(getMilestonesWithIssues.tool.name).toBe('get_milestones_with_issues');
      expect(getMilestonesWithIssues.tool.description).toContain(
        'repository milestones with their associated issues'
      );
    });

    it('should get milestones with issues and PRs successfully', async () => {
      const mockGraphQLResponse = {
        repository: {
          milestones: {
            totalCount: 2,
            nodes: [
              {
                id: 'milestone1',
                number: 1,
                title: 'v1.0.0',
                description: 'First major release',
                state: 'OPEN',
                url: 'https://github.com/owner/repo/milestone/1',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T12:00:00Z',
                dueOn: '2024-03-01T00:00:00Z',
                closedAt: null,
                creator: {
                  login: 'creator',
                  avatarUrl: 'https://github.com/creator.png',
                },
                issues: {
                  totalCount: 5,
                  nodes: [
                    {
                      id: 'issue1',
                      number: 123,
                      title: 'Implement feature A',
                      state: 'OPEN',
                      url: 'https://github.com/owner/repo/issues/123',
                      createdAt: '2024-01-05T10:00:00Z',
                      author: { login: 'user1' },
                      labels: {
                        nodes: [
                          { name: 'enhancement', color: '00ff00' },
                          { name: 'priority-high', color: 'ff6600' },
                        ],
                      },
                      assignees: {
                        nodes: [{ login: 'dev1', avatarUrl: 'https://github.com/dev1.png' }],
                      },
                    },
                    {
                      id: 'issue2',
                      number: 124,
                      title: 'Fix bug in feature B',
                      state: 'CLOSED',
                      url: 'https://github.com/owner/repo/issues/124',
                      createdAt: '2024-01-06T14:00:00Z',
                      author: { login: 'user2' },
                      labels: { nodes: [{ name: 'bug', color: 'ff0000' }] },
                      assignees: { nodes: [] },
                    },
                  ],
                },
                pullRequests: {
                  totalCount: 3,
                  nodes: [
                    {
                      id: 'pr1',
                      number: 45,
                      title: 'Add feature A implementation',
                      state: 'OPEN',
                      url: 'https://github.com/owner/repo/pull/45',
                      createdAt: '2024-01-10T09:00:00Z',
                      author: { login: 'dev1' },
                      labels: { nodes: [] },
                      assignees: { nodes: [] },
                    },
                    {
                      id: 'pr2',
                      number: 46,
                      title: 'Fix bug in feature B',
                      state: 'MERGED',
                      url: 'https://github.com/owner/repo/pull/46',
                      createdAt: '2024-01-08T16:00:00Z',
                      author: { login: 'dev2' },
                      labels: { nodes: [] },
                      assignees: { nodes: [] },
                    },
                  ],
                },
              },
            ],
          },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await getMilestonesWithIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'OPEN',
        first: 5,
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.stringContaining(
          'query($owner: String!, $repo: String!, $first: Int!, $state: MilestoneState)'
        ),
        {
          owner: 'test-owner',
          repo: 'test-repo',
          first: 5,
          state: 'OPEN',
        }
      );

      expect(result).toEqual({
        totalCount: 2,
        milestones: [
          {
            id: 'milestone1',
            number: 1,
            title: 'v1.0.0',
            description: 'First major release',
            state: 'OPEN',
            url: 'https://github.com/owner/repo/milestone/1',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T12:00:00Z',
            dueOn: '2024-03-01T00:00:00Z',
            closedAt: null,
            creator: {
              login: 'creator',
              avatarUrl: 'https://github.com/creator.png',
            },
            issues: {
              totalCount: 5,
              nodes: [
                {
                  id: 'issue1',
                  number: 123,
                  title: 'Implement feature A',
                  state: 'OPEN',
                  url: 'https://github.com/owner/repo/issues/123',
                  createdAt: '2024-01-05T10:00:00Z',
                  author: { login: 'user1' },
                  labels: {
                    nodes: [
                      { name: 'enhancement', color: '00ff00' },
                      { name: 'priority-high', color: 'ff6600' },
                    ],
                  },
                  assignees: {
                    nodes: [{ login: 'dev1', avatarUrl: 'https://github.com/dev1.png' }],
                  },
                },
                {
                  id: 'issue2',
                  number: 124,
                  title: 'Fix bug in feature B',
                  state: 'CLOSED',
                  url: 'https://github.com/owner/repo/issues/124',
                  createdAt: '2024-01-06T14:00:00Z',
                  author: { login: 'user2' },
                  labels: { nodes: [{ name: 'bug', color: 'ff0000' }] },
                  assignees: { nodes: [] },
                },
              ],
            },
            pullRequests: {
              totalCount: 3,
              nodes: [
                {
                  id: 'pr1',
                  number: 45,
                  title: 'Add feature A implementation',
                  state: 'OPEN',
                  url: 'https://github.com/owner/repo/pull/45',
                  createdAt: '2024-01-10T09:00:00Z',
                  author: { login: 'dev1' },
                  labels: { nodes: [] },
                  assignees: { nodes: [] },
                },
                {
                  id: 'pr2',
                  number: 46,
                  title: 'Fix bug in feature B',
                  state: 'MERGED',
                  url: 'https://github.com/owner/repo/pull/46',
                  createdAt: '2024-01-08T16:00:00Z',
                  author: { login: 'dev2' },
                  labels: { nodes: [] },
                  assignees: { nodes: [] },
                },
              ],
            },
            progress: {
              total: 4,
              completed: 2,
              percentage: 50,
              issues: {
                open: 1,
                closed: 1,
                total: 2,
              },
              pullRequests: {
                open: 1,
                closed: 1,
                total: 2,
              },
            },
          },
        ],
      });
    });

    it('should use default parameters', async () => {
      const mockGraphQLResponse = {
        repository: {
          milestones: { totalCount: 0, nodes: [] },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      await getMilestonesWithIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          first: 10,
          state: undefined,
        })
      );
    });

    it('should calculate progress correctly for empty milestone', async () => {
      const mockGraphQLResponse = {
        repository: {
          milestones: {
            totalCount: 1,
            nodes: [
              {
                id: 'milestone1',
                number: 1,
                title: 'Empty Milestone',
                description: null,
                state: 'OPEN',
                url: 'https://github.com/owner/repo/milestone/1',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
                dueOn: null,
                closedAt: null,
                creator: { login: 'creator', avatarUrl: 'https://github.com/creator.png' },
                issues: { totalCount: 0, nodes: [] },
                pullRequests: { totalCount: 0, nodes: [] },
              },
            ],
          },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await getMilestonesWithIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
      });

      expect(result.milestones[0].progress).toEqual({
        total: 0,
        completed: 0,
        percentage: 0,
        issues: { open: 0, closed: 0, total: 0 },
        pullRequests: { open: 0, closed: 0, total: 0 },
      });
    });
  });

  describe('get_cross_repo_project_view', () => {
    let getCrossRepoProjectView: any;

    beforeEach(() => {
      getCrossRepoProjectView = tools.find(
        tool => tool.tool.name === 'get_cross_repo_project_view'
      );
    });

    it('should be registered', () => {
      expect(getCrossRepoProjectView).toBeDefined();
      expect(getCrossRepoProjectView.tool.name).toBe('get_cross_repo_project_view');
      expect(getCrossRepoProjectView.tool.description).toContain(
        'unified view of issues and PRs across multiple repositories'
      );
    });

    it('should get cross-repository project view successfully', async () => {
      const mockRepo1Response = {
        repository: {
          name: 'repo1',
          nameWithOwner: 'owner/repo1',
          url: 'https://github.com/owner/repo1',
          issues: {
            totalCount: 10,
            nodes: [
              {
                id: 'issue1',
                number: 123,
                title: 'Bug in feature X',
                body: 'Description of the bug',
                state: 'OPEN',
                url: 'https://github.com/owner/repo1/issues/123',
                createdAt: '2024-01-10T10:00:00Z',
                updatedAt: '2024-01-12T14:00:00Z',
                author: { login: 'user1', avatarUrl: 'https://github.com/user1.png' },
                assignees: {
                  nodes: [{ login: 'dev1', avatarUrl: 'https://github.com/dev1.png' }],
                },
                labels: {
                  nodes: [{ name: 'bug', color: 'ff0000' }],
                },
                milestone: {
                  title: 'v1.0.0',
                  dueOn: '2024-03-01T00:00:00Z',
                  state: 'OPEN',
                },
                comments: { totalCount: 3 },
                reactions: { totalCount: 2 },
              },
            ],
          },
          pullRequests: {
            totalCount: 5,
            nodes: [
              {
                id: 'pr1',
                number: 45,
                title: 'Fix bug in feature X',
                body: 'This PR fixes the bug',
                state: 'OPEN',
                url: 'https://github.com/owner/repo1/pull/45',
                createdAt: '2024-01-11T09:00:00Z',
                updatedAt: '2024-01-12T16:00:00Z',
                author: { login: 'dev1', avatarUrl: 'https://github.com/dev1.png' },
                assignees: { nodes: [] },
                labels: { nodes: [] },
                milestone: null,
                reviews: {
                  totalCount: 1,
                  nodes: [{ state: 'APPROVED', author: { login: 'reviewer1' } }],
                },
                mergeable: true,
                isDraft: false,
              },
            ],
          },
        },
      };

      const mockRepo2Response = {
        repository: {
          name: 'repo2',
          nameWithOwner: 'owner/repo2',
          url: 'https://github.com/owner/repo2',
          issues: {
            totalCount: 8,
            nodes: [
              {
                id: 'issue2',
                number: 67,
                title: 'Enhancement request',
                body: 'We need this enhancement',
                state: 'OPEN',
                url: 'https://github.com/owner/repo2/issues/67',
                createdAt: '2024-01-08T15:00:00Z',
                updatedAt: '2024-01-09T11:00:00Z',
                author: { login: 'user2', avatarUrl: 'https://github.com/user2.png' },
                assignees: {
                  nodes: [{ login: 'dev1', avatarUrl: 'https://github.com/dev1.png' }],
                },
                labels: {
                  nodes: [{ name: 'enhancement', color: '00ff00' }],
                },
                milestone: null,
                comments: { totalCount: 1 },
                reactions: { totalCount: 5 },
              },
            ],
          },
          pullRequests: {
            totalCount: 3,
            nodes: [],
          },
        },
      };

      mockOctokit.graphql
        .mockResolvedValueOnce(mockRepo1Response)
        .mockResolvedValueOnce(mockRepo2Response);

      const result = await getCrossRepoProjectView.handler({
        repositories: [
          { owner: 'owner', repo: 'repo1' },
          { owner: 'owner', repo: 'repo2' },
        ],
        state: 'OPEN',
        assignee: 'dev1',
      });

      expect(mockOctokit.graphql).toHaveBeenCalledTimes(2);

      expect(result.summary).toEqual({
        totalItems: 2,
        totalIssues: 2,
        totalPullRequests: 0,
        byRepository: [
          { repository: 'owner/repo1', issues: 1, pullRequests: 0 },
          { repository: 'owner/repo2', issues: 1, pullRequests: 0 },
        ],
        byState: {
          open: 2,
          closed: 0,
        },
        byAssignee: [{ login: 'dev1', count: 2 }],
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].type).toBe('issue');
      expect(result.items[1].type).toBe('issue');

      expect(result.repositories).toEqual([
        { name: 'repo1', nameWithOwner: 'owner/repo1', url: 'https://github.com/owner/repo1' },
        { name: 'repo2', nameWithOwner: 'owner/repo2', url: 'https://github.com/owner/repo2' },
      ]);
    });

    it('should filter by labels', async () => {
      const mockResponse = {
        repository: {
          name: 'repo1',
          nameWithOwner: 'owner/repo1',
          url: 'https://github.com/owner/repo1',
          issues: {
            totalCount: 5,
            nodes: [
              {
                id: 'issue1',
                number: 1,
                title: 'Bug issue',
                body: 'Bug description',
                state: 'OPEN',
                url: 'https://github.com/owner/repo1/issues/1',
                createdAt: '2024-01-10T10:00:00Z',
                updatedAt: '2024-01-10T10:00:00Z',
                author: { login: 'user1', avatarUrl: 'https://github.com/user1.png' },
                assignees: { nodes: [] },
                labels: {
                  nodes: [{ name: 'bug', color: 'ff0000' }],
                },
                milestone: null,
                comments: { totalCount: 0 },
                reactions: { totalCount: 0 },
              },
              {
                id: 'issue2',
                number: 2,
                title: 'Enhancement issue',
                body: 'Enhancement description',
                state: 'OPEN',
                url: 'https://github.com/owner/repo1/issues/2',
                createdAt: '2024-01-11T10:00:00Z',
                updatedAt: '2024-01-11T10:00:00Z',
                author: { login: 'user1', avatarUrl: 'https://github.com/user1.png' },
                assignees: { nodes: [] },
                labels: {
                  nodes: [{ name: 'enhancement', color: '00ff00' }],
                },
                milestone: null,
                comments: { totalCount: 0 },
                reactions: { totalCount: 0 },
              },
            ],
          },
          pullRequests: { totalCount: 0, nodes: [] },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockResponse);

      const result = await getCrossRepoProjectView.handler({
        repositories: [{ owner: 'owner', repo: 'repo1' }],
        labels: ['bug'],
      });

      expect(result.summary.totalItems).toBe(1);
      expect(result.items[0].title).toBe('Bug issue');
    });

    it('should filter by milestone', async () => {
      const mockResponse = {
        repository: {
          name: 'repo1',
          nameWithOwner: 'owner/repo1',
          url: 'https://github.com/owner/repo1',
          issues: {
            totalCount: 5,
            nodes: [
              {
                id: 'issue1',
                number: 1,
                title: 'Milestone issue',
                body: 'Description',
                state: 'OPEN',
                url: 'https://github.com/owner/repo1/issues/1',
                createdAt: '2024-01-10T10:00:00Z',
                updatedAt: '2024-01-10T10:00:00Z',
                author: { login: 'user1', avatarUrl: 'https://github.com/user1.png' },
                assignees: { nodes: [] },
                labels: { nodes: [] },
                milestone: { title: 'v1.0.0', dueOn: '2024-03-01T00:00:00Z', state: 'OPEN' },
                comments: { totalCount: 0 },
                reactions: { totalCount: 0 },
              },
              {
                id: 'issue2',
                number: 2,
                title: 'No milestone issue',
                body: 'Description',
                state: 'OPEN',
                url: 'https://github.com/owner/repo1/issues/2',
                createdAt: '2024-01-11T10:00:00Z',
                updatedAt: '2024-01-11T10:00:00Z',
                author: { login: 'user1', avatarUrl: 'https://github.com/user1.png' },
                assignees: { nodes: [] },
                labels: { nodes: [] },
                milestone: null,
                comments: { totalCount: 0 },
                reactions: { totalCount: 0 },
              },
            ],
          },
          pullRequests: { totalCount: 0, nodes: [] },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockResponse);

      const result = await getCrossRepoProjectView.handler({
        repositories: [{ owner: 'owner', repo: 'repo1' }],
        milestone: 'v1.0.0',
      });

      expect(result.summary.totalItems).toBe(1);
      expect(result.items[0].title).toBe('Milestone issue');
    });

    it('should use default state filter', async () => {
      const mockResponse = {
        repository: {
          name: 'repo1',
          nameWithOwner: 'owner/repo1',
          url: 'https://github.com/owner/repo1',
          issues: { totalCount: 0, nodes: [] },
          pullRequests: { totalCount: 0, nodes: [] },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockResponse);

      await getCrossRepoProjectView.handler({
        repositories: [{ owner: 'owner', repo: 'repo1' }],
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          states: ['OPEN'],
        })
      );
    });

    it('should handle GraphQL errors gracefully', async () => {
      const graphQLError = new Error('GraphQL Error: Repository not found');
      mockOctokit.graphql.mockRejectedValue(graphQLError);

      await expect(
        getCrossRepoProjectView.handler({
          repositories: [{ owner: 'owner', repo: 'nonexistent' }],
        })
      ).rejects.toThrow('GraphQL Error: Repository not found');
    });
  });
});
