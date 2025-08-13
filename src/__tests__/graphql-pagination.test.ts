import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphQLPaginationHandler, GraphQLPaginationUtils } from '../graphql-pagination-handler.js';

// Mock Octokit
const mockOctokit = {
  graphql: vi.fn(),
};

describe('GraphQLPaginationHandler', () => {
  let handler: GraphQLPaginationHandler;

  beforeEach(() => {
    handler = new GraphQLPaginationHandler(mockOctokit as any);
    vi.clearAllMocks();
  });

  describe('paginate', () => {
    it('should handle single page query', async () => {
      const mockResponse = {
        repository: {
          discussions: {
            totalCount: 5,
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
            nodes: [
              { id: '1', title: 'Test Discussion 1' },
              { id: '2', title: 'Test Discussion 2' },
            ],
          },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockResponse);

      const queryBuilder = handler.createDiscussionsQuery('owner', 'repo');
      const result = await handler.paginate(queryBuilder, { first: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.totalCount).toBe(5);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('should handle auto-pagination across multiple pages', async () => {
      const page1Response = {
        repository: {
          discussions: {
            totalCount: 25,
            pageInfo: {
              hasNextPage: true,
              endCursor: 'cursor1',
            },
            nodes: [
              { id: '1', title: 'Discussion 1' },
              { id: '2', title: 'Discussion 2' },
            ],
          },
        },
      };

      const page2Response = {
        repository: {
          discussions: {
            totalCount: 25,
            pageInfo: {
              hasNextPage: false,
              endCursor: 'cursor2',
            },
            nodes: [
              { id: '3', title: 'Discussion 3' },
              { id: '4', title: 'Discussion 4' },
            ],
          },
        },
      };

      mockOctokit.graphql
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response);

      const queryBuilder = handler.createDiscussionsQuery('owner', 'repo');
      const result = await handler.paginate(queryBuilder, {
        first: 2,
        autoPage: true,
        maxPages: 2,
      });

      expect(result.data).toHaveLength(4);
      expect(result.totalCount).toBe(25);
      expect(result.hasMore).toBe(false);
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(2);
    });

    it('should respect maxItems limit during auto-pagination', async () => {
      const page1Response = {
        repository: {
          discussions: {
            totalCount: 100,
            pageInfo: {
              hasNextPage: true,
              endCursor: 'cursor1',
            },
            nodes: Array.from({ length: 10 }, (_, i) => ({
              id: `${i + 1}`,
              title: `Discussion ${i + 1}`,
            })),
          },
        },
      };

      const page2Response = {
        repository: {
          discussions: {
            totalCount: 100,
            pageInfo: {
              hasNextPage: true,
              endCursor: 'cursor2',
            },
            nodes: Array.from({ length: 5 }, (_, i) => ({
              id: `${i + 11}`,
              title: `Discussion ${i + 11}`,
            })),
          },
        },
      };

      mockOctokit.graphql
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response);

      const queryBuilder = handler.createDiscussionsQuery('owner', 'repo');
      const result = await handler.paginate(queryBuilder, {
        first: 10,
        autoPage: true,
        maxItems: 12,
      });

      expect(result.data).toHaveLength(12);
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(2);
      // Second call should request only 2 items (12 - 10)
      expect(mockOctokit.graphql).toHaveBeenNthCalledWith(2, expect.any(String), 
        expect.objectContaining({ first: 2 }));
    });

    it('should handle GraphQL errors gracefully', async () => {
      const error = new Error('GraphQL error: Rate limit exceeded');
      mockOctokit.graphql.mockRejectedValue(error);

      const queryBuilder = handler.createDiscussionsQuery('owner', 'repo');
      
      await expect(handler.paginate(queryBuilder, { first: 10 }))
        .rejects.toThrow('GraphQL error: Rate limit exceeded');
    });

    it('should call progress callback during auto-pagination', async () => {
      const onProgress = vi.fn();

      const page1Response = {
        repository: {
          discussions: {
            totalCount: 15,
            pageInfo: {
              hasNextPage: true,
              endCursor: 'cursor1',
            },
            nodes: Array.from({ length: 5 }, (_, i) => ({
              id: `${i + 1}`,
              title: `Discussion ${i + 1}`,
            })),
          },
        },
      };

      const page2Response = {
        repository: {
          discussions: {
            totalCount: 15,
            pageInfo: {
              hasNextPage: false,
              endCursor: 'cursor2',
            },
            nodes: Array.from({ length: 5 }, (_, i) => ({
              id: `${i + 6}`,
              title: `Discussion ${i + 6}`,
            })),
          },
        },
      };

      mockOctokit.graphql
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response);

      const queryBuilder = handler.createDiscussionsQuery('owner', 'repo');
      const result = await handler.paginate(queryBuilder, {
        first: 5,
        autoPage: true,
        onProgress,
      });

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenNthCalledWith(1, 5, 15);
      expect(onProgress).toHaveBeenNthCalledWith(2, 10, 15);
    });
  });

  describe('query builders', () => {
    it('should create discussions query builder', () => {
      const queryBuilder = handler.createDiscussionsQuery('owner', 'repo', 'category123');
      
      expect(queryBuilder.query).toContain('discussions(first: $first, after: $after, categoryId: $categoryId)');
      expect(queryBuilder.variables).toEqual({
        owner: 'owner',
        repo: 'repo',
        categoryId: 'category123',
      });
    });

    it('should create discussion comments query builder', () => {
      const queryBuilder = handler.createDiscussionCommentsQuery('owner', 'repo', 42);
      
      expect(queryBuilder.query).toContain('discussion(number: $number)');
      expect(queryBuilder.query).toContain('comments(first: $first, after: $after)');
      expect(queryBuilder.variables).toEqual({
        owner: 'owner',
        repo: 'repo',
        number: 42,
      });
    });

    it('should create project items query builder', () => {
      const projectId = 'project_123';
      const queryBuilder = handler.createProjectItemsQuery(projectId);
      
      expect(queryBuilder.query).toContain('node(id: $projectId)');
      expect(queryBuilder.query).toContain('items(first: $first, after: $after)');
      expect(queryBuilder.variables).toEqual({
        projectId,
      });
    });

    it('should create collaborators query builder', () => {
      const queryBuilder = handler.createCollaboratorsQuery('owner', 'repo', 'ALL');
      
      expect(queryBuilder.query).toContain('collaborators(first: $first, after: $after, affiliation: $affiliation)');
      expect(queryBuilder.variables).toEqual({
        owner: 'owner',
        repo: 'repo',
        affiliation: 'ALL',
      });
    });

    it('should create commit history query builder', () => {
      const queryBuilder = handler.createCommitHistoryQuery(
        'owner',
        'repo',
        'main',
        '2023-01-01T00:00:00Z',
        '2023-12-31T23:59:59Z'
      );
      
      expect(queryBuilder.query).toContain('history(first: $first, after: $after, since: $since, until: $until)');
      expect(queryBuilder.variables).toEqual({
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
        since: '2023-01-01T00:00:00Z',
        until: '2023-12-31T23:59:59Z',
      });
    });

    it('should create search query builder', () => {
      const queryBuilder = handler.createSearchQuery('test query', 'REPOSITORY');
      
      expect(queryBuilder.query).toContain('search(query: $searchQuery, type: $type, first: $first, after: $after)');
      expect(queryBuilder.variables).toEqual({
        searchQuery: 'test query',
        type: 'REPOSITORY',
      });
    });
  });

  describe('createCachedHandler', () => {
    it('should cache and return cached results', async () => {
      const cache = new Map();
      const cachedHandler = handler.createCachedHandler(cache, 5000);

      const mockResponse = {
        repository: {
          discussions: {
            totalCount: 5,
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [{ id: '1', title: 'Test' }],
          },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockResponse);

      const queryBuilder = handler.createDiscussionsQuery('owner', 'repo');
      
      // First call
      const result1 = await cachedHandler(queryBuilder, { first: 10 });
      
      // Second call should use cache
      const result2 = await cachedHandler(queryBuilder, { first: 10 });
      
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
      expect(cache.size).toBe(1);
    });

    it('should expire cache after TTL', async () => {
      const cache = new Map();
      const shortTTL = 10; // 10ms
      const cachedHandler = handler.createCachedHandler(cache, shortTTL);

      const mockResponse = {
        repository: {
          discussions: {
            totalCount: 5,
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [{ id: '1', title: 'Test' }],
          },
        },
      };

      mockOctokit.graphql.mockResolvedValue(mockResponse);

      const queryBuilder = handler.createDiscussionsQuery('owner', 'repo');
      
      // First call
      await cachedHandler(queryBuilder, { first: 10 });
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Second call should make new request
      await cachedHandler(queryBuilder, { first: 10 });
      
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(2);
    });
  });
});

describe('GraphQLPaginationUtils', () => {
  describe('validatePaginationParams', () => {
    it('should validate first parameter', () => {
      expect(() => GraphQLPaginationUtils.validatePaginationParams({ first: 0 }))
        .toThrow('first parameter must be between 1 and 100');
        
      expect(() => GraphQLPaginationUtils.validatePaginationParams({ first: 101 }))
        .toThrow('first parameter must be between 1 and 100');
        
      expect(() => GraphQLPaginationUtils.validatePaginationParams({ first: 50 }))
        .not.toThrow();
    });

    it('should validate maxPages parameter', () => {
      expect(() => GraphQLPaginationUtils.validatePaginationParams({ maxPages: 0 }))
        .toThrow('maxPages must be positive');
        
      expect(() => GraphQLPaginationUtils.validatePaginationParams({ maxPages: -1 }))
        .toThrow('maxPages must be positive');
        
      expect(() => GraphQLPaginationUtils.validatePaginationParams({ maxPages: 5 }))
        .not.toThrow();
    });

    it('should validate maxItems parameter', () => {
      expect(() => GraphQLPaginationUtils.validatePaginationParams({ maxItems: 0 }))
        .toThrow('maxItems must be positive');
        
      expect(() => GraphQLPaginationUtils.validatePaginationParams({ maxItems: -1 }))
        .toThrow('maxItems must be positive');
        
      expect(() => GraphQLPaginationUtils.validatePaginationParams({ maxItems: 100 }))
        .not.toThrow();
    });
  });

  describe('createPaginationResponse', () => {
    it('should create standard pagination response', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const pageInfo = { hasNextPage: true, endCursor: 'cursor123' };
      const totalCount = 50;

      const response = GraphQLPaginationUtils.createPaginationResponse(
        data,
        pageInfo,
        totalCount
      );

      expect(response).toEqual({
        data,
        pageInfo,
        totalCount,
        hasMore: true,
        nextCursor: 'cursor123',
      });
    });
  });

  describe('mergeResults', () => {
    it('should merge multiple paginated results', () => {
      const results = [
        {
          data: [{ id: '1' }, { id: '2' }],
          pageInfo: { hasNextPage: true, endCursor: 'cursor1' },
          totalCount: 10,
          hasMore: true,
          nextCursor: 'cursor1',
        },
        {
          data: [{ id: '3' }, { id: '4' }],
          pageInfo: { hasNextPage: false, endCursor: 'cursor2' },
          totalCount: 15,
          hasMore: false,
          nextCursor: 'cursor2',
        },
      ];

      const merged = GraphQLPaginationUtils.mergeResults(results);

      expect(merged.data).toHaveLength(4);
      expect(merged.totalCount).toBe(25);
      expect(merged.hasMore).toBe(true); // At least one has more
      expect(merged.pageInfo.endCursor).toBe('cursor2'); // Last one
    });

    it('should handle empty results array', () => {
      const merged = GraphQLPaginationUtils.mergeResults([]);

      expect(merged.data).toHaveLength(0);
      expect(merged.totalCount).toBe(0);
      expect(merged.hasMore).toBe(false);
      expect(merged.pageInfo).toEqual({ hasNextPage: false });
    });
  });
});