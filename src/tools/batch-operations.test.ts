/**
 * Tests for batch operations tools (GraphQL)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBatchOperationsTools } from './batch-operations.js';
import { createMockOctokit } from '../__tests__/mocks/octokit.js';

describe('Batch Operations Tools', () => {
  let mockOctokit: any;
  let tools: any[];

  beforeEach(() => {
    mockOctokit = createMockOctokit();
    tools = createBatchOperationsTools(mockOctokit, false);
  });

  describe('batch_query_repositories', () => {
    let batchQueryRepositories: any;

    beforeEach(() => {
      batchQueryRepositories = tools.find(tool => tool.tool.name === 'batch_query_repositories');
    });

    it('should be registered', () => {
      expect(batchQueryRepositories).toBeDefined();
      expect(batchQueryRepositories.tool.name).toBe('batch_query_repositories');
      expect(batchQueryRepositories.tool.description).toContain(
        'Query multiple repositories in a single GraphQL request'
      );
    });

    it('should query multiple repositories successfully', async () => {
      const mockGraphQLResponse = {
        repo0: {
          id: 'repo1',
          name: 'test-repo1',
          nameWithOwner: 'owner1/test-repo1',
          description: 'First test repository',
          url: 'https://github.com/owner1/test-repo1',
          stargazerCount: 100,
          forkCount: 25,
          watchers: { totalCount: 50 },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-15T12:00:00Z',
          pushedAt: '2024-01-15T12:00:00Z',
          primaryLanguage: {
            name: 'TypeScript',
            color: '#2b7489',
          },
          licenseInfo: {
            name: 'MIT License',
            spdxId: 'MIT',
          },
          repositoryTopics: {
            nodes: [{ topic: { name: 'typescript' } }, { topic: { name: 'github' } }],
          },
        },
        repo1: {
          id: 'repo2',
          name: 'test-repo2',
          nameWithOwner: 'owner2/test-repo2',
          description: 'Second test repository',
          url: 'https://github.com/owner2/test-repo2',
          stargazerCount: 200,
          forkCount: 40,
          watchers: { totalCount: 80 },
          createdAt: '2023-06-01T00:00:00Z',
          updatedAt: '2024-01-10T10:00:00Z',
          pushedAt: '2024-01-12T14:30:00Z',
          primaryLanguage: {
            name: 'JavaScript',
            color: '#f1e05a',
          },
          licenseInfo: {
            name: 'Apache License 2.0',
            spdxId: 'Apache-2.0',
          },
          repositoryTopics: {
            nodes: [{ topic: { name: 'javascript' } }, { topic: { name: 'api' } }],
          },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await batchQueryRepositories.handler({
        repositories: [
          { owner: 'owner1', repo: 'test-repo1' },
          { owner: 'owner2', repo: 'test-repo2', alias: 'custom_alias' },
        ],
      });

      expect(mockOctokit.graphql).toHaveBeenCalled();
      const callArgs = mockOctokit.graphql.mock.calls[0];
      expect(callArgs[0]).toContain('query BatchRepositoryQuery');
      expect(callArgs[0]).toContain('repo0: repository(owner: "owner1", name: "test-repo1")');
      expect(callArgs[0]).toContain(
        'custom_alias: repository(owner: "owner2", name: "test-repo2")'
      );

      expect(result).toEqual({
        totalQueried: 2,
        successful: 2,
        failed: 0,
        repositories: [
          {
            id: 'repo1',
            name: 'test-repo1',
            fullName: 'owner1/test-repo1',
            description: 'First test repository',
            url: 'https://github.com/owner1/test-repo1',
            statistics: {
              stars: 100,
              forks: 25,
              watchers: 50,
            },
            primaryLanguage: {
              name: 'TypeScript',
              color: '#2b7489',
            },
            license: {
              name: 'MIT License',
              spdxId: 'MIT',
            },
            topics: ['typescript', 'github'],
            dates: {
              created: '2024-01-01T00:00:00Z',
              updated: '2024-01-15T12:00:00Z',
              pushed: '2024-01-15T12:00:00Z',
            },
          },
          {
            id: 'repo2',
            name: 'test-repo2',
            fullName: 'owner2/test-repo2',
            description: 'Second test repository',
            url: 'https://github.com/owner2/test-repo2',
            statistics: {
              stars: 200,
              forks: 40,
              watchers: 80,
            },
            primaryLanguage: {
              name: 'JavaScript',
              color: '#f1e05a',
            },
            license: {
              name: 'Apache License 2.0',
              spdxId: 'Apache-2.0',
            },
            topics: ['javascript', 'api'],
            dates: {
              created: '2023-06-01T00:00:00Z',
              updated: '2024-01-10T10:00:00Z',
              pushed: '2024-01-12T14:30:00Z',
            },
          },
        ],
        summary: {
          totalStars: 300,
          totalForks: 65,
          languages: ['TypeScript', 'JavaScript'],
          licenses: ['MIT License', 'Apache License 2.0'],
        },
      });
    });

    it('should include language statistics when requested', async () => {
      const mockGraphQLResponse = {
        repo0: {
          id: 'repo1',
          name: 'test-repo1',
          nameWithOwner: 'owner1/test-repo1',
          description: 'Test repository',
          url: 'https://github.com/owner1/test-repo1',
          stargazerCount: 50,
          forkCount: 10,
          watchers: { totalCount: 25 },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-15T12:00:00Z',
          pushedAt: '2024-01-15T12:00:00Z',
          primaryLanguage: { name: 'TypeScript', color: '#2b7489' },
          licenseInfo: null,
          repositoryTopics: { nodes: [] },
          languages: {
            totalSize: 10000,
            edges: [
              { size: 7000, node: { name: 'TypeScript', color: '#2b7489' } },
              { size: 2000, node: { name: 'JavaScript', color: '#f1e05a' } },
              { size: 1000, node: { name: 'CSS', color: '#563d7c' } },
            ],
          },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await batchQueryRepositories.handler({
        repositories: [{ owner: 'owner1', repo: 'test-repo1' }],
        includeLanguages: true,
      });

      expect(result.repositories[0].languages).toEqual({
        totalSize: 10000,
        breakdown: [
          { name: 'TypeScript', color: '#2b7489', size: 7000, percentage: 70 },
          { name: 'JavaScript', color: '#f1e05a', size: 2000, percentage: 20 },
          { name: 'CSS', color: '#563d7c', size: 1000, percentage: 10 },
        ],
      });
    });

    it('should include contributor information when requested', async () => {
      const mockGraphQLResponse = {
        repo0: {
          id: 'repo1',
          name: 'test-repo1',
          nameWithOwner: 'owner1/test-repo1',
          description: 'Test repository',
          url: 'https://github.com/owner1/test-repo1',
          stargazerCount: 50,
          forkCount: 10,
          watchers: { totalCount: 25 },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-15T12:00:00Z',
          pushedAt: '2024-01-15T12:00:00Z',
          primaryLanguage: { name: 'TypeScript', color: '#2b7489' },
          licenseInfo: null,
          repositoryTopics: { nodes: [] },
          collaborators: {
            totalCount: 5,
            nodes: [
              {
                login: 'contributor1',
                name: 'First Contributor',
                avatarUrl: 'https://github.com/contributor1.png',
                contributionsCollection: {
                  totalCommitContributions: 50,
                },
              },
              {
                login: 'contributor2',
                name: 'Second Contributor',
                avatarUrl: 'https://github.com/contributor2.png',
                contributionsCollection: {
                  totalCommitContributions: 25,
                },
              },
            ],
          },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await batchQueryRepositories.handler({
        repositories: [{ owner: 'owner1', repo: 'test-repo1' }],
        includeContributors: true,
      });

      expect(result.repositories[0].contributors).toEqual({
        totalCount: 5,
        top: [
          {
            login: 'contributor1',
            name: 'First Contributor',
            avatarUrl: 'https://github.com/contributor1.png',
            commits: 50,
          },
          {
            login: 'contributor2',
            name: 'Second Contributor',
            avatarUrl: 'https://github.com/contributor2.png',
            commits: 25,
          },
        ],
      });
    });

    it('should include issues summary when requested', async () => {
      const mockGraphQLResponse = {
        repo0: {
          id: 'repo1',
          name: 'test-repo1',
          nameWithOwner: 'owner1/test-repo1',
          description: 'Test repository',
          url: 'https://github.com/owner1/test-repo1',
          stargazerCount: 50,
          forkCount: 10,
          watchers: { totalCount: 25 },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-15T12:00:00Z',
          pushedAt: '2024-01-15T12:00:00Z',
          primaryLanguage: { name: 'TypeScript', color: '#2b7489' },
          licenseInfo: null,
          repositoryTopics: { nodes: [] },
          issues: { totalCount: 25 },
          openIssues: { totalCount: 10 },
          pullRequests: { totalCount: 15 },
          openPullRequests: { totalCount: 5 },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await batchQueryRepositories.handler({
        repositories: [{ owner: 'owner1', repo: 'test-repo1' }],
        includeIssuesSummary: true,
      });

      expect(result.repositories[0].issues).toEqual({
        total: 25,
        open: 10,
        closed: 15,
      });

      expect(result.repositories[0].pullRequests).toEqual({
        total: 15,
        open: 5,
        closed: 10,
      });
    });

    it('should include recent commits when requested', async () => {
      const mockGraphQLResponse = {
        repo0: {
          id: 'repo1',
          name: 'test-repo1',
          nameWithOwner: 'owner1/test-repo1',
          description: 'Test repository',
          url: 'https://github.com/owner1/test-repo1',
          stargazerCount: 50,
          forkCount: 10,
          watchers: { totalCount: 25 },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-15T12:00:00Z',
          pushedAt: '2024-01-15T12:00:00Z',
          primaryLanguage: { name: 'TypeScript', color: '#2b7489' },
          licenseInfo: null,
          repositoryTopics: { nodes: [] },
          defaultBranchRef: {
            name: 'main',
            target: {
              history: {
                nodes: [
                  {
                    committedDate: '2024-01-15T12:00:00Z',
                    messageHeadline: 'Add new feature',
                    author: { user: { login: 'dev1' } },
                    additions: 50,
                    deletions: 5,
                  },
                  {
                    committedDate: '2024-01-14T10:30:00Z',
                    messageHeadline: 'Fix bug',
                    author: { user: { login: 'dev2' } },
                    additions: 10,
                    deletions: 15,
                  },
                ],
              },
            },
          },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await batchQueryRepositories.handler({
        repositories: [{ owner: 'owner1', repo: 'test-repo1' }],
        includeRecentCommits: true,
      });

      expect(result.repositories[0].recentCommits).toEqual({
        branch: 'main',
        commits: [
          {
            date: '2024-01-15T12:00:00Z',
            message: 'Add new feature',
            author: 'dev1',
            additions: 50,
            deletions: 5,
          },
          {
            date: '2024-01-14T10:30:00Z',
            message: 'Fix bug',
            author: 'dev2',
            additions: 10,
            deletions: 15,
          },
        ],
      });
    });

    it('should handle repositories that return null', async () => {
      const mockGraphQLResponse = {
        repo0: null,
        repo1: {
          id: 'repo2',
          name: 'test-repo2',
          nameWithOwner: 'owner2/test-repo2',
          description: 'Second test repository',
          url: 'https://github.com/owner2/test-repo2',
          stargazerCount: 20,
          forkCount: 5,
          watchers: { totalCount: 10 },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-15T12:00:00Z',
          pushedAt: '2024-01-15T12:00:00Z',
          primaryLanguage: { name: 'JavaScript', color: '#f1e05a' },
          licenseInfo: null,
          repositoryTopics: { nodes: [] },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await batchQueryRepositories.handler({
        repositories: [
          { owner: 'owner1', repo: 'nonexistent' },
          { owner: 'owner2', repo: 'test-repo2' },
        ],
      });

      expect(result.totalQueried).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.repositories).toHaveLength(1);
    });

    it('should handle GraphQL errors', async () => {
      const graphQLError = new Error('GraphQL Error: Repository access denied');
      mockOctokit.graphql.mockRejectedValue(graphQLError);

      await expect(
        batchQueryRepositories.handler({
          repositories: [{ owner: 'owner1', repo: 'private-repo' }],
        })
      ).rejects.toThrow('GraphQL Error: Repository access denied');
    });
  });

  describe('batch_query_users', () => {
    let batchQueryUsers: any;

    beforeEach(() => {
      batchQueryUsers = tools.find(tool => tool.tool.name === 'batch_query_users');
    });

    it('should be registered', () => {
      expect(batchQueryUsers).toBeDefined();
      expect(batchQueryUsers.tool.name).toBe('batch_query_users');
      expect(batchQueryUsers.tool.description).toContain('Query multiple users or organizations');
    });

    it('should query multiple users successfully', async () => {
      const mockGraphQLResponse = {
        user0: {
          id: 'user1',
          login: 'testuser1',
          name: 'Test User 1',
          email: 'user1@example.com',
          bio: 'First test user',
          company: 'Test Company 1',
          location: 'Test City 1',
          url: 'https://github.com/testuser1',
          avatarUrl: 'https://github.com/testuser1.png',
          createdAt: '2020-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        org0: null,
        user1: {
          id: 'user2',
          login: 'testuser2',
          name: 'Test User 2',
          email: 'user2@example.com',
          bio: 'Second test user',
          company: 'Test Company 2',
          location: 'Test City 2',
          url: 'https://github.com/testuser2',
          avatarUrl: 'https://github.com/testuser2.png',
          createdAt: '2021-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        org1: null,
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await batchQueryUsers.handler({
        usernames: ['testuser1', 'testuser2'],
      });

      expect(mockOctokit.graphql).toHaveBeenCalled();
      const callArgs = mockOctokit.graphql.mock.calls[0];
      expect(callArgs[0]).toContain('query BatchUserQuery');
      expect(callArgs[0]).toContain('user0: user(login: "testuser1")');
      expect(callArgs[0]).toContain('user1: user(login: "testuser2")');

      expect(result).toEqual({
        totalQueried: 2,
        found: 2,
        notFound: 0,
        entities: [
          {
            id: 'user1',
            login: 'testuser1',
            name: 'Test User 1',
            email: 'user1@example.com',
            bio: 'First test user',
            company: 'Test Company 1',
            location: 'Test City 1',
            url: 'https://github.com/testuser1',
            avatarUrl: 'https://github.com/testuser1.png',
            createdAt: '2020-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            type: 'user',
            totalRepositories: undefined,
            repositories: undefined,
          },
          {
            id: 'user2',
            login: 'testuser2',
            name: 'Test User 2',
            email: 'user2@example.com',
            bio: 'Second test user',
            company: 'Test Company 2',
            location: 'Test City 2',
            url: 'https://github.com/testuser2',
            avatarUrl: 'https://github.com/testuser2.png',
            createdAt: '2021-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            type: 'user',
            totalRepositories: undefined,
            repositories: undefined,
          },
        ],
        summary: {
          totalUsers: 2,
          totalOrganizations: 0,
          totalRepositories: 0,
          topLanguages: [],
        },
      });
    });

    it('should query organizations successfully', async () => {
      const mockGraphQLResponse = {
        user0: null,
        org0: {
          id: 'org1',
          login: 'testorg',
          name: 'Test Organization',
          email: 'contact@testorg.com',
          description: 'A test organization',
          location: 'Test Location',
          url: 'https://github.com/testorg',
          avatarUrl: 'https://github.com/testorg.png',
          createdAt: '2019-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          membersWithRole: { totalCount: 25 },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await batchQueryUsers.handler({
        usernames: ['testorg'],
      });

      expect(result.entities[0]).toEqual({
        id: 'org1',
        login: 'testorg',
        name: 'Test Organization',
        email: 'contact@testorg.com',
        description: 'A test organization',
        location: 'Test Location',
        url: 'https://github.com/testorg',
        avatarUrl: 'https://github.com/testorg.png',
        createdAt: '2019-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        membersWithRole: { totalCount: 25 },
        type: 'organization',
        totalMembers: 25,
        totalRepositories: undefined,
        repositories: undefined,
      });

      expect(result.summary.totalOrganizations).toBe(1);
    });

    it('should include repositories when requested', async () => {
      const mockGraphQLResponse = {
        user0: {
          id: 'user1',
          login: 'testuser',
          name: 'Test User',
          email: 'test@example.com',
          bio: 'Test user bio',
          company: 'Test Company',
          location: 'Test City',
          url: 'https://github.com/testuser',
          avatarUrl: 'https://github.com/testuser.png',
          createdAt: '2020-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          repositories: {
            totalCount: 15,
            nodes: [
              {
                name: 'awesome-project',
                nameWithOwner: 'testuser/awesome-project',
                description: 'An awesome project',
                url: 'https://github.com/testuser/awesome-project',
                stargazerCount: 100,
                forkCount: 20,
                primaryLanguage: { name: 'TypeScript', color: '#2b7489' },
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
          },
        },
        org0: null,
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await batchQueryUsers.handler({
        usernames: ['testuser'],
        includeRepositories: true,
        repositoryLimit: 5,
      });

      expect(result.entities[0].totalRepositories).toBe(15);
      expect(result.entities[0].repositories).toHaveLength(1);
      expect(result.summary.totalRepositories).toBe(15);
      expect(result.summary.topLanguages).toEqual(['TypeScript']);
    });

    it('should include followers when requested', async () => {
      const mockGraphQLResponse = {
        user0: {
          id: 'user1',
          login: 'testuser',
          name: 'Test User',
          email: 'test@example.com',
          bio: 'Test user bio',
          company: 'Test Company',
          location: 'Test City',
          url: 'https://github.com/testuser',
          avatarUrl: 'https://github.com/testuser.png',
          createdAt: '2020-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          followers: { totalCount: 150 },
          following: { totalCount: 75 },
        },
        org0: null,
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await batchQueryUsers.handler({
        usernames: ['testuser'],
        includeFollowers: true,
      });

      expect(result.entities[0].followers.totalCount).toBe(150);
      expect(result.entities[0].following.totalCount).toBe(75);
    });

    it('should handle not found users', async () => {
      const mockGraphQLResponse = {
        user0: null,
        org0: null,
        user1: {
          id: 'user1',
          login: 'existinguser',
          name: 'Existing User',
          email: 'existing@example.com',
          bio: 'Existing user bio',
          company: null,
          location: null,
          url: 'https://github.com/existinguser',
          avatarUrl: 'https://github.com/existinguser.png',
          createdAt: '2020-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        org1: null,
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await batchQueryUsers.handler({
        usernames: ['nonexistent', 'existinguser'],
      });

      expect(result.totalQueried).toBe(2);
      expect(result.found).toBe(1);
      expect(result.notFound).toBe(1);

      expect(result.entities[0]).toEqual({
        login: 'nonexistent',
        error: 'User or organization not found',
      });

      expect(result.entities[1].login).toBe('existinguser');
      expect(result.entities[1].type).toBe('user');
    });
  });

  describe('batch_graphql_query', () => {
    let batchGraphQLQuery: any;

    beforeEach(() => {
      batchGraphQLQuery = tools.find(tool => tool.tool.name === 'batch_graphql_query');
    });

    it('should be registered', () => {
      expect(batchGraphQLQuery).toBeDefined();
      expect(batchGraphQLQuery.tool.name).toBe('batch_graphql_query');
      expect(batchGraphQLQuery.tool.description).toContain('Execute a custom batch GraphQL query');
    });

    it('should execute batch GraphQL queries successfully', async () => {
      const mockGraphQLResponse = {
        repo1: {
          name: 'test-repo',
          stargazerCount: 100,
        },
        user1: {
          login: 'testuser',
          followers: { totalCount: 50 },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await batchGraphQLQuery.handler({
        queries: [
          {
            alias: 'repo1',
            query: 'repository(owner: "owner", name: "repo") { name stargazerCount }',
          },
          {
            alias: 'user1',
            query: 'user(login: "testuser") { login followers { totalCount } }',
          },
        ],
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.stringContaining('query BatchQuery {'),
        {}
      );

      expect(result).toEqual({
        successful: true,
        totalQueries: 2,
        results: mockGraphQLResponse,
        executedQuery: expect.stringContaining('repo1: repository(owner: "owner", name: "repo")'),
        variables: {},
      });
    });

    it('should handle queries with variables', async () => {
      const mockGraphQLResponse = {
        repoWithVars: {
          name: 'variable-repo',
          stargazerCount: 25,
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await batchGraphQLQuery.handler({
        queries: [
          {
            alias: 'repoWithVars',
            query:
              'repository(owner: $repoWithVars_owner, name: $repoWithVars_name) { name stargazerCount }',
            variables: {
              owner: 'test-owner',
              name: 'test-repo',
            },
          },
        ],
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.stringContaining(
          'query BatchQuery($repoWithVars_owner: String, $repoWithVars_name: String)'
        ),
        {
          repoWithVars_owner: 'test-owner',
          repoWithVars_name: 'test-repo',
        }
      );

      expect(result.successful).toBe(true);
      expect(result.variables).toEqual({
        repoWithVars_owner: 'test-owner',
        repoWithVars_name: 'test-repo',
      });
    });

    it('should handle different variable types', async () => {
      const mockGraphQLResponse = {
        mixedTypes: { id: 'test' },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await batchGraphQLQuery.handler({
        queries: [
          {
            alias: 'mixedTypes',
            query: 'someQuery',
            variables: {
              stringVar: 'test',
              numberVar: 42,
              booleanVar: true,
            },
          },
        ],
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.stringContaining(
          '$mixedTypes_stringVar: String, $mixedTypes_numberVar: Int, $mixedTypes_booleanVar: Boolean'
        ),
        {
          mixedTypes_stringVar: 'test',
          mixedTypes_numberVar: 42,
          mixedTypes_booleanVar: true,
        }
      );

      expect(result.successful).toBe(true);
    });

    it('should handle GraphQL errors gracefully', async () => {
      const graphQLError = new Error('GraphQL Error: Field not found');
      mockOctokit.graphql.mockRejectedValue(graphQLError);

      const result = await batchGraphQLQuery.handler({
        queries: [
          {
            alias: 'errorQuery',
            query: 'invalidField { nonExistentProperty }',
          },
        ],
      });

      expect(result.successful).toBe(false);
      expect(result.error).toContain('Batch operation failed');
      expect(result.executedQuery).toContain('errorQuery: invalidField');
      expect(result.variables).toEqual({});
    });

    it('should build query without variables when none provided', async () => {
      const mockGraphQLResponse = {
        simpleQuery: { id: 'simple' },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      await batchGraphQLQuery.handler({
        queries: [
          {
            alias: 'simpleQuery',
            query: 'viewer { id }',
          },
        ],
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.stringContaining('query BatchQuery {'),
        {}
      );
    });

    it('should handle multiple queries with complex variable combinations', async () => {
      const mockGraphQLResponse = {
        query1: { id: '1' },
        query2: { id: '2' },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await batchGraphQLQuery.handler({
        queries: [
          {
            alias: 'query1',
            query: 'repository(owner: $query1_owner, name: $query1_name) { id }',
            variables: { owner: 'owner1', name: 'repo1' },
          },
          {
            alias: 'query2',
            query: 'user(login: $query2_login) { id }',
            variables: { login: 'user1' },
          },
        ],
      });

      expect(result.successful).toBe(true);
      expect(result.variables).toEqual({
        query1_owner: 'owner1',
        query1_name: 'repo1',
        query2_login: 'user1',
      });
    });
  });
});
