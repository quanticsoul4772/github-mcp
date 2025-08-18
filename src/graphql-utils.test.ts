/**
 * Tests for GraphQL utility functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cachedGraphQL,
  smartGraphQL,
  batchCachedGraphQL,
  GraphQLTTL,
  getQueryOperation,
  createGraphQLWrapper,
  GraphQLQueries,
} from './graphql-utils.js';
import { OptimizedAPIClient } from './optimized-api-client.js';
import { createMockOctokit } from './__tests__/mocks/octokit.js';

describe('GraphQL Utils', () => {
  let mockOctokit: any;
  let mockOptimizedClient: OptimizedAPIClient;

  beforeEach(() => {
    mockOctokit = createMockOctokit();
    mockOptimizedClient = new OptimizedAPIClient({
      octokit: mockOctokit,
      enableGraphQLCache: true,
    });
  });

  describe('cachedGraphQL', () => {
    it('should use OptimizedAPIClient.graphql when available', async () => {
      const query = 'query GetRepo { repository { name } }';
      const variables = { owner: 'test', repo: 'test' };
      const mockResponse = { repository: { name: 'test' } };

      const graphqlSpy = vi.spyOn(mockOptimizedClient, 'graphql').mockResolvedValue(mockResponse);

      const result = await cachedGraphQL(mockOptimizedClient, query, variables, { ttl: 1000 });

      expect(result).toEqual(mockResponse);
      expect(graphqlSpy).toHaveBeenCalledWith(query, variables, { ttl: 1000 });
    });

    it('should fallback to octokit.graphql for regular Octokit instance', async () => {
      const query = 'query GetRepo { repository { name } }';
      const variables = { owner: 'test', repo: 'test' };
      const mockResponse = { repository: { name: 'test' } };

      mockOctokit.graphql.mockResolvedValue(mockResponse);

      const result = await cachedGraphQL(mockOctokit, query, variables);

      expect(result).toEqual(mockResponse);
      expect(mockOctokit.graphql).toHaveBeenCalledWith(query, variables);
    });
  });

  describe('smartGraphQL', () => {
    it('should execute regular queries normally', async () => {
      const query = 'query GetRepo { repository { name } }';
      const mockResponse = { repository: { name: 'test' } };

      const graphqlSpy = vi.spyOn(mockOptimizedClient, 'graphql').mockResolvedValue(mockResponse);

      const result = await smartGraphQL(mockOptimizedClient, query, {}, { ttl: 1000 });

      expect(result).toEqual(mockResponse);
      expect(graphqlSpy).toHaveBeenCalledWith(query, {}, { ttl: 1000 });
    });

    it('should invalidate cache for mutations', async () => {
      const mutation = 'mutation CreateDiscussion { createDiscussion { id } }';
      const mockResponse = { createDiscussion: { id: '123' } };

      const graphqlSpy = vi.spyOn(mockOptimizedClient, 'graphql').mockResolvedValue(mockResponse);
      const invalidateSpy = vi
        .spyOn(mockOptimizedClient, 'invalidateGraphQLCacheForMutation')
        .mockReturnValue(2);

      const result = await smartGraphQL(
        mockOptimizedClient,
        mutation,
        { owner: 'test', repo: 'test' },
        { isMutation: true }
      );

      expect(result).toEqual(mockResponse);
      expect(graphqlSpy).toHaveBeenCalledWith(
        mutation,
        { owner: 'test', repo: 'test' },
        { isMutation: true }
      );
      expect(invalidateSpy).toHaveBeenCalledWith(mutation, { owner: 'test', repo: 'test' });
    });

    it('should not invalidate cache for regular queries', async () => {
      const query = 'query GetRepo { repository { name } }';
      const mockResponse = { repository: { name: 'test' } };

      vi.spyOn(mockOptimizedClient, 'graphql').mockResolvedValue(mockResponse);
      const invalidateSpy = vi.spyOn(mockOptimizedClient, 'invalidateGraphQLCacheForMutation');

      await smartGraphQL(mockOptimizedClient, query);

      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe('batchCachedGraphQL', () => {
    it('should execute multiple GraphQL queries', async () => {
      const queries = [
        {
          query: 'query GetRepo1 { repository(owner: "test1", name: "repo1") { name } }',
          variables: { owner: 'test1', repo: 'repo1' },
        },
        {
          query: 'query GetRepo2 { repository(owner: "test2", name: "repo2") { name } }',
          variables: { owner: 'test2', repo: 'repo2' },
        },
      ];

      const mockResponses = [{ repository: { name: 'repo1' } }, { repository: { name: 'repo2' } }];

      vi.spyOn(mockOptimizedClient, 'graphql')
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1]);

      const results = await batchCachedGraphQL(mockOptimizedClient, queries);

      expect(results).toEqual(mockResponses);
      expect(mockOptimizedClient.graphql).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success and failure', async () => {
      const queries = [
        { query: 'query Success { repository { name } }' },
        { query: 'query Failure { repository { name } }' },
      ];

      vi.spyOn(mockOptimizedClient, 'graphql')
        .mockResolvedValueOnce({ repository: { name: 'success' } })
        .mockRejectedValueOnce(new Error('GraphQL Error'));

      await expect(batchCachedGraphQL(mockOptimizedClient, queries)).rejects.toThrow(
        'GraphQL Error'
      );
    });
  });

  describe('GraphQLTTL constants', () => {
    it('should provide appropriate TTL values', () => {
      expect(GraphQLTTL.REPOSITORY_INSIGHTS).toBe(60 * 60 * 1000); // 1 hour
      expect(GraphQLTTL.CONTRIBUTORS).toBe(6 * 60 * 60 * 1000); // 6 hours
      expect(GraphQLTTL.SEARCH_RESULTS).toBe(15 * 60 * 1000); // 15 minutes
      expect(GraphQLTTL.DEFAULT).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('should have reasonable relationships between TTL values', () => {
      // Long-term data should have longer TTL
      expect(GraphQLTTL.CONTRIBUTORS).toBeGreaterThan(GraphQLTTL.REPOSITORY_INSIGHTS);
      expect(GraphQLTTL.REPOSITORY_INSIGHTS).toBeGreaterThan(GraphQLTTL.DISCUSSIONS_LIST);
      expect(GraphQLTTL.DISCUSSIONS_LIST).toBeGreaterThan(GraphQLTTL.SEARCH_RESULTS);
    });
  });

  describe('getQueryOperation', () => {
    it('should extract operation names from GraphQL queries', () => {
      const testCases = [
        { query: 'query GetRepository { repository { name } }', expected: 'GetRepository' },
        {
          query: 'mutation CreateDiscussion { createDiscussion { id } }',
          expected: 'CreateDiscussion',
        },
        {
          query: 'query GetUser($login: String!) { user(login: $login) { name } }',
          expected: 'GetUser',
        },
        { query: '{ repository(owner: "test", name: "repo") { name } }', expected: 'repository' },
        { query: 'invalid query', expected: 'unknown_operation' },
      ];

      testCases.forEach(({ query, expected }) => {
        expect(getQueryOperation(query)).toBe(expected);
      });
    });
  });

  describe('createGraphQLWrapper', () => {
    it('should create a wrapper with proper methods', () => {
      const wrapper = createGraphQLWrapper(mockOptimizedClient);

      expect(wrapper).toHaveProperty('query');
      expect(wrapper).toHaveProperty('mutate');
      expect(wrapper).toHaveProperty('execute');
      expect(wrapper).toHaveProperty('getClient');
      expect(typeof wrapper.query).toBe('function');
      expect(typeof wrapper.mutate).toBe('function');
      expect(typeof wrapper.execute).toBe('function');
      expect(wrapper.getClient()).toBe(mockOptimizedClient);
    });

    it('should execute queries with caching', async () => {
      const wrapper = createGraphQLWrapper(mockOptimizedClient);
      const mockResponse = { repository: { name: 'test' } };

      vi.spyOn(mockOptimizedClient, 'graphql').mockResolvedValue(mockResponse);

      const result = await wrapper.query(
        'query GetRepo { repository { name } }',
        { owner: 'test' },
        1000
      );

      expect(result).toEqual(mockResponse);
      expect(mockOptimizedClient.graphql).toHaveBeenCalledWith(
        'query GetRepo { repository { name } }',
        { owner: 'test' },
        { ttl: 1000, operation: 'GetRepo' }
      );
    });

    it('should execute mutations with cache invalidation', async () => {
      const wrapper = createGraphQLWrapper(mockOptimizedClient);
      const mockResponse = { createDiscussion: { id: '123' } };

      vi.spyOn(mockOptimizedClient, 'graphql').mockResolvedValue(mockResponse);
      const invalidateSpy = vi
        .spyOn(mockOptimizedClient, 'invalidateGraphQLCacheForMutation')
        .mockReturnValue(1);

      const result = await wrapper.mutate('mutation CreateDiscussion { createDiscussion { id } }', {
        title: 'Test',
      });

      expect(result).toEqual(mockResponse);
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe('GraphQLQueries helpers', () => {
    it('should provide repository insights query configuration', () => {
      const config = GraphQLQueries.repositoryInsights('test', 'repo');

      expect(config).toHaveProperty('query');
      expect(config).toHaveProperty('variables');
      expect(config).toHaveProperty('operation');
      expect(config).toHaveProperty('ttl');
      expect(config.variables).toEqual({ owner: 'test', repo: 'repo' });
      expect(config.operation).toBe('GetRepositoryInsights');
      expect(config.ttl).toBe(GraphQLTTL.REPOSITORY_INSIGHTS);
    });

    it('should provide discussions list query configuration', () => {
      const config = GraphQLQueries.discussionsList('test', 'repo', 50, 'cursor123', 'category456');

      expect(config.variables).toEqual({
        owner: 'test',
        repo: 'repo',
        first: 50,
        after: 'cursor123',
        categoryId: 'category456',
      });
      expect(config.operation).toBe('ListDiscussions');
      expect(config.ttl).toBe(GraphQLTTL.DISCUSSIONS_LIST);
    });

    it('should provide contributor stats query configuration', () => {
      const config = GraphQLQueries.contributorStats('test', 'repo', 10);

      expect(config.variables).toEqual({ owner: 'test', repo: 'repo', first: 10 });
      expect(config.operation).toBe('GetContributorStats');
      expect(config.ttl).toBe(GraphQLTTL.CONTRIBUTORS);
    });

    it('should use default values when optional parameters are not provided', () => {
      const config = GraphQLQueries.discussionsList('test', 'repo');

      expect(config.variables.first).toBe(25);
      expect(config.variables.after).toBeUndefined();
      expect(config.variables.categoryId).toBeUndefined();
    });
  });

  describe('Error handling in utils', () => {
    it('should handle errors in batch operations gracefully', async () => {
      const queries = [
        { query: 'query Success { repository { name } }' },
        { query: 'query Failure { repository { name } }' },
      ];

      vi.spyOn(mockOptimizedClient, 'graphql')
        .mockResolvedValueOnce({ repository: { name: 'success' } })
        .mockRejectedValueOnce(new Error('API Error'));

      // Should propagate the error
      await expect(batchCachedGraphQL(mockOptimizedClient, queries)).rejects.toThrow('API Error');
    });

    it('should handle wrapper method errors', async () => {
      const wrapper = createGraphQLWrapper(mockOptimizedClient);

      vi.spyOn(mockOptimizedClient, 'graphql').mockRejectedValue(new Error('GraphQL Error'));

      await expect(wrapper.query('query { test }')).rejects.toThrow('GraphQL Error');
    });
  });
});
