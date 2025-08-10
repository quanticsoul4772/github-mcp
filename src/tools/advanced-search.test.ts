/**
 * Tests for advanced search tools (GraphQL)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdvancedSearchTools } from './advanced-search.js';
import { createMockOctokit } from '../__tests__/mocks/octokit.js';

describe('Advanced Search Tools', () => {
  let mockOctokit: any;
  let tools: any[];

  beforeEach(() => {
    mockOctokit = createMockOctokit();
    tools = createAdvancedSearchTools(mockOctokit, false);
  });

  describe('search_across_repos', () => {
    let searchAcrossRepos: any;

    beforeEach(() => {
      searchAcrossRepos = tools.find(tool => tool.tool.name === 'search_across_repos');
    });

    it('should be registered', () => {
      expect(searchAcrossRepos).toBeDefined();
      expect(searchAcrossRepos.tool.name).toBe('search_across_repos');
      expect(searchAcrossRepos.tool.description).toContain('Search across multiple repositories');
    });

    it('should search repositories successfully', async () => {
      const mockGraphQLResponse = {
        search: {
          repositoryCount: 150,
          issueCount: 0,
          userCount: 0,
          discussionCount: 0,
          pageInfo: {
            hasNextPage: true,
            endCursor: 'cursor123',
          },
          nodes: [
            {
              id: 'repo1',
              name: 'test-repo',
              nameWithOwner: 'owner/test-repo',
              description: 'A test repository',
              url: 'https://github.com/owner/test-repo',
              stargazerCount: 50,
              forkCount: 10,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-15T12:00:00Z',
              primaryLanguage: {
                name: 'TypeScript',
                color: '#2b7489',
              },
              owner: {
                login: 'owner',
                avatarUrl: 'https://github.com/owner.png',
              },
              licenseInfo: {
                name: 'MIT License',
                spdxId: 'MIT',
              },
              repositoryTopics: {
                nodes: [
                  { topic: { name: 'typescript' } },
                  { topic: { name: 'github' } },
                ],
              },
            },
          ],
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await searchAcrossRepos.handler({
        query: 'typescript language:typescript',
        type: 'REPOSITORY',
        first: 25,
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.stringContaining('query($searchQuery: String!, $type: SearchType!, $first: Int!, $after: String)'),
        {
          searchQuery: 'typescript language:typescript',
          type: 'REPOSITORY',
          first: 25,
          after: undefined,
        }
      );

      expect(result).toEqual({
        totalCount: {
          repositories: 150,
          issues: 0,
          users: 0,
          discussions: 0,
        },
        pageInfo: {
          hasNextPage: true,
          endCursor: 'cursor123',
        },
        results: [
          {
            id: 'repo1',
            name: 'test-repo',
            nameWithOwner: 'owner/test-repo',
            description: 'A test repository',
            url: 'https://github.com/owner/test-repo',
            stargazerCount: 50,
            forkCount: 10,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T12:00:00Z',
            primaryLanguage: {
              name: 'TypeScript',
              color: '#2b7489',
            },
            owner: {
              login: 'owner',
              avatarUrl: 'https://github.com/owner.png',
            },
            licenseInfo: {
              name: 'MIT License',
              spdxId: 'MIT',
            },
            repositoryTopics: {
              nodes: [
                { topic: { name: 'typescript' } },
                { topic: { name: 'github' } },
              ],
            },
          },
        ],
      });
    });

    it('should search issues successfully', async () => {
      const mockGraphQLResponse = {
        search: {
          repositoryCount: 0,
          issueCount: 25,
          userCount: 0,
          discussionCount: 0,
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
          nodes: [
            {
              id: 'issue1',
              number: 123,
              title: 'Bug in search functionality',
              body: 'The search feature is not working correctly',
              url: 'https://github.com/owner/repo/issues/123',
              state: 'OPEN',
              createdAt: '2024-01-10T10:00:00Z',
              updatedAt: '2024-01-11T14:30:00Z',
              author: {
                login: 'user1',
                avatarUrl: 'https://github.com/user1.png',
              },
              repository: {
                name: 'repo',
                nameWithOwner: 'owner/repo',
              },
              labels: {
                nodes: [
                  { name: 'bug', color: 'ff0000' },
                  { name: 'priority-high', color: 'ff6600' },
                ],
              },
              comments: {
                totalCount: 5,
              },
            },
          ],
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await searchAcrossRepos.handler({
        query: 'bug state:open',
        type: 'ISSUE',
      });

      expect(result.totalCount.issues).toBe(25);
      expect(result.results[0].state).toBe('OPEN');
      expect(result.results[0].labels.nodes).toHaveLength(2);
    });

    it('should search users successfully', async () => {
      const mockGraphQLResponse = {
        search: {
          repositoryCount: 0,
          issueCount: 0,
          userCount: 10,
          discussionCount: 0,
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
          nodes: [
            {
              id: 'user1',
              login: 'testuser',
              name: 'Test User',
              email: 'test@example.com',
              bio: 'Software developer',
              company: 'Test Company',
              location: 'Test City',
              url: 'https://github.com/testuser',
              avatarUrl: 'https://github.com/testuser.png',
              createdAt: '2020-01-01T00:00:00Z',
              followers: {
                totalCount: 100,
              },
              following: {
                totalCount: 50,
              },
              repositories: {
                totalCount: 25,
              },
            },
          ],
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await searchAcrossRepos.handler({
        query: 'location:"Test City"',
        type: 'USER',
      });

      expect(result.totalCount.users).toBe(10);
      expect(result.results[0].login).toBe('testuser');
      expect(result.results[0].followers.totalCount).toBe(100);
    });

    it('should use default first value', async () => {
      const mockGraphQLResponse = {
        search: {
          repositoryCount: 0,
          issueCount: 0,
          userCount: 0,
          discussionCount: 0,
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [],
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      await searchAcrossRepos.handler({
        query: 'test',
        type: 'REPOSITORY',
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ first: 25 })
      );
    });

    it('should handle pagination with after cursor', async () => {
      const mockGraphQLResponse = {
        search: {
          repositoryCount: 100,
          issueCount: 0,
          userCount: 0,
          discussionCount: 0,
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [],
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      await searchAcrossRepos.handler({
        query: 'test',
        type: 'REPOSITORY',
        after: 'cursor456',
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ after: 'cursor456' })
      );
    });

    it('should handle GraphQL errors', async () => {
      const graphQLError = new Error('GraphQL Error: Invalid search query');
      mockOctokit.graphql.mockRejectedValue(graphQLError);

      await expect(
        searchAcrossRepos.handler({
          query: 'invalid:syntax',
          type: 'REPOSITORY',
        })
      ).rejects.toThrow('GraphQL Error: Invalid search query');
    });
  });

  describe('search_repositories_advanced', () => {
    let searchRepositoriesAdvanced: any;

    beforeEach(() => {
      searchRepositoriesAdvanced = tools.find(tool => tool.tool.name === 'search_repositories_advanced');
    });

    it('should be registered', () => {
      expect(searchRepositoriesAdvanced).toBeDefined();
      expect(searchRepositoriesAdvanced.tool.name).toBe('search_repositories_advanced');
      expect(searchRepositoriesAdvanced.tool.description).toContain('Advanced repository search');
    });

    it('should build query with filters', async () => {
      const mockGraphQLResponse = {
        search: {
          repositoryCount: 50,
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            {
              id: 'repo1',
              name: 'test-repo',
              nameWithOwner: 'owner/test-repo',
              description: 'A test repository',
              url: 'https://github.com/owner/test-repo',
              stargazerCount: 100,
              forkCount: 25,
              watchers: { totalCount: 50 },
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-15T12:00:00Z',
              pushedAt: '2024-01-15T12:00:00Z',
              diskUsage: 1024,
              primaryLanguage: {
                name: 'TypeScript',
                color: '#2b7489',
              },
              languages: {
                edges: [
                  { size: 5000, node: { name: 'TypeScript', color: '#2b7489' } },
                  { size: 3000, node: { name: 'JavaScript', color: '#f1e05a' } },
                ],
              },
              owner: {
                login: 'owner',
                avatarUrl: 'https://github.com/owner.png',
                name: 'Test Owner',
                company: 'Test Company',
              },
              licenseInfo: {
                name: 'MIT License',
                spdxId: 'MIT',
              },
              repositoryTopics: {
                nodes: [
                  { topic: { name: 'typescript' } },
                  { topic: { name: 'api' } },
                ],
              },
              defaultBranchRef: {
                name: 'main',
                target: {
                  committedDate: '2024-01-15T12:00:00Z',
                },
              },
            },
          ],
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await searchRepositoriesAdvanced.handler({
        query: 'api',
        language: 'typescript',
        stars: '>50',
        forks: '>10',
        size: '<2000',
        created: '>2023-01-01',
        pushed: '>2024-01-01',
        license: 'mit',
        topics: ['typescript', 'api'],
        includeMetrics: false,
        first: 20,
      });

      // Verify the query was built correctly
      const expectedQuery = 'api language:typescript stars:>50 forks:>10 size:<2000 created:>2023-01-01 pushed:>2024-01-01 license:mit topic:typescript topic:api';

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.stringContaining('query($searchQuery: String!, $first: Int!)'),
        {
          searchQuery: expectedQuery,
          first: 20,
        }
      );

      expect(result).toEqual({
        query: expectedQuery,
        totalCount: 50,
        pageInfo: { hasNextPage: false, endCursor: null },
        repositories: [
          {
            id: 'repo1',
            name: 'test-repo',
            fullName: 'owner/test-repo',
            description: 'A test repository',
            url: 'https://github.com/owner/test-repo',
            statistics: {
              stars: 100,
              forks: 25,
              watchers: 50,
              size: 1024,
            },
            languages: [
              { name: 'TypeScript', color: '#2b7489', size: 5000 },
              { name: 'JavaScript', color: '#f1e05a', size: 3000 },
            ],
            primaryLanguage: {
              name: 'TypeScript',
              color: '#2b7489',
            },
            owner: {
              login: 'owner',
              avatarUrl: 'https://github.com/owner.png',
              name: 'Test Owner',
              company: 'Test Company',
            },
            license: {
              name: 'MIT License',
              spdxId: 'MIT',
            },
            topics: ['typescript', 'api'],
            dates: {
              created: '2024-01-01T00:00:00Z',
              updated: '2024-01-15T12:00:00Z',
              pushed: '2024-01-15T12:00:00Z',
              lastCommit: '2024-01-15T12:00:00Z',
            },
            defaultBranch: 'main',
          },
        ],
      });
    });

    it('should include metrics when requested', async () => {
      const mockGraphQLResponse = {
        search: {
          repositoryCount: 1,
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            {
              id: 'repo1',
              name: 'test-repo',
              nameWithOwner: 'owner/test-repo',
              description: 'A test repository',
              url: 'https://github.com/owner/test-repo',
              stargazerCount: 100,
              forkCount: 25,
              watchers: { totalCount: 50 },
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-15T12:00:00Z',
              pushedAt: '2024-01-15T12:00:00Z',
              diskUsage: 1024,
              primaryLanguage: { name: 'TypeScript', color: '#2b7489' },
              languages: { edges: [] },
              owner: { login: 'owner', avatarUrl: 'https://github.com/owner.png' },
              licenseInfo: null,
              repositoryTopics: { nodes: [] },
              issues: { totalCount: 15 },
              pullRequests: { totalCount: 8 },
              releases: { totalCount: 3 },
              collaborators: { totalCount: 5 },
              defaultBranchRef: {
                name: 'main',
                target: { committedDate: '2024-01-15T12:00:00Z' },
              },
            },
          ],
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await searchRepositoriesAdvanced.handler({
        query: 'test',
        includeMetrics: true,
      });

      expect(result.repositories[0].statistics).toEqual({
        stars: 100,
        forks: 25,
        watchers: 50,
        size: 1024,
        issues: 15,
        pullRequests: 8,
        releases: 3,
        collaborators: 5,
      });
    });

    it('should use default values for optional parameters', async () => {
      const mockGraphQLResponse = {
        search: {
          repositoryCount: 1,
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [],
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      await searchRepositoriesAdvanced.handler({
        query: 'test',
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.any(String),
        {
          searchQuery: 'test',
          first: 25,
        }
      );
    });
  });

  describe('search_with_relationships', () => {
    let searchWithRelationships: any;

    beforeEach(() => {
      searchWithRelationships = tools.find(tool => tool.tool.name === 'search_with_relationships');
    });

    it('should be registered', () => {
      expect(searchWithRelationships).toBeDefined();
      expect(searchWithRelationships.tool.name).toBe('search_with_relationships');
      expect(searchWithRelationships.tool.description).toContain('Search for entities and include their relationships');
    });

    it('should search users with relationships', async () => {
      const mockGraphQLResponse = {
        search: {
          userCount: 5,
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            {
              id: 'user1',
              login: 'testuser',
              name: 'Test User',
              email: 'test@example.com',
              bio: 'Software developer',
              company: 'Test Company',
              location: 'Test City',
              url: 'https://github.com/testuser',
              avatarUrl: 'https://github.com/testuser.png',
              createdAt: '2020-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              repositories: {
                totalCount: 25,
                nodes: [
                  {
                    name: 'awesome-project',
                    nameWithOwner: 'testuser/awesome-project',
                    description: 'An awesome project',
                    url: 'https://github.com/testuser/awesome-project',
                    stargazerCount: 100,
                    forkCount: 20,
                    primaryLanguage: { name: 'JavaScript', color: '#f1e05a' },
                    createdAt: '2023-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z',
                  },
                ],
              },
              gists: {
                totalCount: 10,
                nodes: [
                  {
                    name: 'test-gist',
                    description: 'A test gist',
                    url: 'https://gist.github.com/testuser/123',
                    createdAt: '2023-06-01T00:00:00Z',
                    isPublic: true,
                  },
                ],
              },
              followers: { totalCount: 150 },
              following: { totalCount: 75 },
            },
          ],
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await searchWithRelationships.handler({
        entityType: 'USER',
        query: 'location:"Test City"',
        includeRepositories: true,
        includeGists: true,
        includeFollowers: true,
        repositoryLimit: 5,
        first: 10,
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.stringContaining('query($searchQuery: String!, $entityType: SearchType!, $first: Int!, $repoLimit: Int!)'),
        {
          searchQuery: 'location:"Test City"',
          entityType: 'USER',
          first: 10,
          repoLimit: 5,
        }
      );

      expect(result).toEqual({
        totalCount: 5,
        pageInfo: { hasNextPage: false, endCursor: null },
        entities: [
          {
            id: 'user1',
            login: 'testuser',
            name: 'Test User',
            email: 'test@example.com',
            bio: 'Software developer',
            company: 'Test Company',
            location: 'Test City',
            url: 'https://github.com/testuser',
            avatarUrl: 'https://github.com/testuser.png',
            createdAt: '2020-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            repositories: {
              totalCount: 25,
              nodes: [
                {
                  name: 'awesome-project',
                  nameWithOwner: 'testuser/awesome-project',
                  description: 'An awesome project',
                  url: 'https://github.com/testuser/awesome-project',
                  stargazerCount: 100,
                  forkCount: 20,
                  primaryLanguage: { name: 'JavaScript', color: '#f1e05a' },
                  createdAt: '2023-01-01T00:00:00Z',
                  updatedAt: '2024-01-01T00:00:00Z',
                },
              ],
            },
            gists: {
              totalCount: 10,
              nodes: [
                {
                  name: 'test-gist',
                  description: 'A test gist',
                  url: 'https://gist.github.com/testuser/123',
                  createdAt: '2023-06-01T00:00:00Z',
                  isPublic: true,
                },
              ],
            },
            followers: { totalCount: 150 },
            following: { totalCount: 75 },
          },
        ],
      });
    });

    it('should search organizations with repositories', async () => {
      const mockGraphQLResponse = {
        search: {
          userCount: 2,
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            {
              id: 'org1',
              login: 'testorg',
              name: 'Test Organization',
              email: 'contact@testorg.com',
              description: 'A test organization',
              location: 'Test City',
              url: 'https://github.com/testorg',
              avatarUrl: 'https://github.com/testorg.png',
              createdAt: '2020-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              repositories: {
                totalCount: 50,
                nodes: [
                  {
                    name: 'org-project',
                    nameWithOwner: 'testorg/org-project',
                    description: 'Organization project',
                    url: 'https://github.com/testorg/org-project',
                    stargazerCount: 500,
                    forkCount: 100,
                    primaryLanguage: { name: 'TypeScript', color: '#2b7489' },
                    createdAt: '2022-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z',
                  },
                ],
              },
              membersWithRole: { totalCount: 25 },
            },
          ],
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await searchWithRelationships.handler({
        entityType: 'ORGANIZATION',
        query: 'Test Organization',
        includeRepositories: true,
      });

      expect(result.entities[0]).toEqual({
        id: 'org1',
        login: 'testorg',
        name: 'Test Organization',
        email: 'contact@testorg.com',
        description: 'A test organization',
        location: 'Test City',
        url: 'https://github.com/testorg',
        avatarUrl: 'https://github.com/testorg.png',
        createdAt: '2020-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        repositories: {
          totalCount: 50,
          nodes: [
            {
              name: 'org-project',
              nameWithOwner: 'testorg/org-project',
              description: 'Organization project',
              url: 'https://github.com/testorg/org-project',
              stargazerCount: 500,
              forkCount: 100,
              primaryLanguage: { name: 'TypeScript', color: '#2b7489' },
              createdAt: '2022-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
        },
        membersWithRole: { totalCount: 25 },
        type: 'organization',
        totalMembers: 25,
        totalRepositories: 50,
      });
    });

    it('should use default values for optional parameters', async () => {
      const mockGraphQLResponse = {
        search: {
          userCount: 1,
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [],
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      await searchWithRelationships.handler({
        entityType: 'USER',
        query: 'test',
      });

      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.any(String),
        {
          searchQuery: 'test',
          entityType: 'USER',
          first: 10,
          repoLimit: 10,
        }
      );
    });

    it('should handle mixed user and organization results', async () => {
      const mockGraphQLResponse = {
        search: {
          userCount: 2,
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            {
              id: 'user1',
              login: 'testuser',
              name: 'Test User',
              // ... user fields
            },
            {
              id: 'org1',
              login: 'testorg',
              name: 'Test Organization',
              // ... org fields
              membersWithRole: { totalCount: 10 },
            },
          ],
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockGraphQLResponse);

      const result = await searchWithRelationships.handler({
        entityType: 'USER',
        query: 'test',
      });

      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].type).toBe('user');
      expect(result.entities[1].type).toBe('organization');
    });

    it('should handle GraphQL errors', async () => {
      const graphQLError = new Error('GraphQL Error: Search query too complex');
      mockOctokit.graphql.mockRejectedValue(graphQLError);

      await expect(
        searchWithRelationships.handler({
          entityType: 'USER',
          query: 'very complex query with many filters',
        })
      ).rejects.toThrow('GraphQL Error: Search query too complex');
    });
  });
});