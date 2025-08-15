import { describe, it, expect } from 'vitest';
import {
  validateGraphQLInput,
  validateGraphQLVariableValue,
  RepositoryInsightsSchema,
  ContributionStatsSchema,
  CrossRepoSearchSchema,
  AdvancedRepoSearchSchema,
  ProjectBoardsSchema,
  BatchRepositoryQuerySchema,
  GraphQLValidationError,
  SearchQuerySchema,
  ISO8601DateSchema,
} from '../graphql-validation.js';

describe('GraphQL Validation', () => {
  describe('RepositoryInsightsSchema', () => {
    it('should validate valid repository insights input', () => {
      const input = {
        owner: 'octocat',
        repo: 'Hello-World',
        since: '2023-01-01T00:00:00.000Z',
      };
      
      const result = validateGraphQLInput(RepositoryInsightsSchema, input, 'test');
      expect(result.owner).toBe('octocat');
      expect(result.repo).toBe('Hello-World');
      expect(result.since).toBe('2023-01-01T00:00:00.000Z');
    });

    it('should reject invalid owner names', () => {
      const input = {
        owner: 'invalid..owner',
        repo: 'valid-repo',
      };
      
      expect(() => validateGraphQLInput(RepositoryInsightsSchema, input, 'test'))
        .toThrow(GraphQLValidationError);
    });

    it('should reject invalid repository names', () => {
      const input = {
        owner: 'valid-owner',
        repo: '.invalid-repo',
      };
      
      expect(() => validateGraphQLInput(RepositoryInsightsSchema, input, 'test'))
        .toThrow(GraphQLValidationError);
    });
  });

  describe('CrossRepoSearchSchema', () => {
    it('should validate and sanitize search queries', () => {
      const input = {
        query: 'react ${malicious} test',
        type: 'REPOSITORY' as const,
        first: 10,
      };
      
      const result = validateGraphQLInput(CrossRepoSearchSchema, input, 'test');
      expect(result.query).toBe('react test'); // malicious variable reference removed
      expect(result.type).toBe('REPOSITORY');
      expect(result.first).toBe(10);
    });

    it('should reject queries with GraphQL injection', () => {
      const input = {
        query: 'test { repository { name } }',
        type: 'REPOSITORY' as const,
      };
      
      const result = validateGraphQLInput(CrossRepoSearchSchema, input, 'test');
      expect(result.query).toBe('test repository name'); // GraphQL syntax removed
    });
  });

  describe('AdvancedRepoSearchSchema', () => {
    it('should validate advanced search parameters', () => {
      const input = {
        query: 'javascript framework',
        language: 'javascript',
        stars: '>100',
        created: '>2020-01-01',
        topics: ['frontend', 'web-dev'],
        includeMetrics: true,
        first: 25,
      };
      
      const result = validateGraphQLInput(AdvancedRepoSearchSchema, input, 'test');
      expect(result.query).toBe('javascript framework');
      expect(result.language).toBe('javascript');
      expect(result.stars).toBe('>100');
      expect(result.created).toBe('>2020-01-01');
      expect(result.topics).toEqual(['frontend', 'web-dev']);
      expect(result.includeMetrics).toBe(true);
      expect(result.first).toBe(25);
    });

    it('should reject invalid date filters', () => {
      const input = {
        query: 'test',
        created: 'invalid-date',
      };
      
      expect(() => validateGraphQLInput(AdvancedRepoSearchSchema, input, 'test'))
        .toThrow(GraphQLValidationError);
    });

    it('should reject too many topics', () => {
      const input = {
        query: 'test',
        topics: Array(25).fill('topic'),
      };
      
      expect(() => validateGraphQLInput(AdvancedRepoSearchSchema, input, 'test'))
        .toThrow(GraphQLValidationError);
    });
  });

  describe('BatchRepositoryQuerySchema', () => {
    it('should validate batch repository queries', () => {
      const input = {
        repositories: [
          { owner: 'octocat', repo: 'Hello-World' },
          { owner: 'github', repo: 'docs', alias: 'githubDocs' },
        ],
        includeLanguages: true,
        includeContributors: false,
      };
      
      const result = validateGraphQLInput(BatchRepositoryQuerySchema, input, 'test');
      expect(result.repositories).toHaveLength(2);
      expect(result.repositories[0]?.owner).toBe('octocat');
      expect(result.repositories[1]?.alias).toBe('githubDocs');
      expect(result.includeLanguages).toBe(true);
    });

    it('should reject too many repositories', () => {
      const input = {
        repositories: Array(15).fill({ owner: 'test', repo: 'repo' }),
      };
      
      expect(() => validateGraphQLInput(BatchRepositoryQuerySchema, input, 'test'))
        .toThrow(GraphQLValidationError);
    });

    it('should reject invalid alias format', () => {
      const input = {
        repositories: [
          { owner: 'test', repo: 'repo', alias: 'invalid-alias-name' },
        ],
      };
      
      expect(() => validateGraphQLInput(BatchRepositoryQuerySchema, input, 'test'))
        .toThrow(GraphQLValidationError);
    });
  });

  describe('validateGraphQLVariableValue', () => {
    it('should reject strings with injection patterns', () => {
      expect(() => validateGraphQLVariableValue('test ${injection}', 'testVar'))
        .toThrow(GraphQLValidationError);
    });

    it('should validate and sanitize safe string values', () => {
      const result = validateGraphQLVariableValue('test string', 'testVar');
      expect(result).toBe('test string');
    });

    it('should validate numeric values', () => {
      const result = validateGraphQLVariableValue(42, 'testVar');
      expect(result).toBe(42);
    });

    it('should reject infinite numbers', () => {
      expect(() => validateGraphQLVariableValue(Infinity, 'testVar'))
        .toThrow(GraphQLValidationError);
    });

    it('should validate arrays with size limits', () => {
      const result = validateGraphQLVariableValue(['a', 'b', 'c'], 'testVar');
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should reject arrays that are too large', () => {
      const largeArray = Array(150).fill('item');
      expect(() => validateGraphQLVariableValue(largeArray, 'testVar'))
        .toThrow(GraphQLValidationError);
    });

    it('should validate objects with property limits', () => {
      const obj = { prop1: 'value1', prop2: 'value2' };
      const result = validateGraphQLVariableValue(obj, 'testVar');
      expect(result).toEqual({ prop1: 'value1', prop2: 'value2' });
    });

    it('should reject objects with too many properties', () => {
      const largeObj: any = {};
      for (let i = 0; i < 60; i++) {
        largeObj[`prop${i}`] = `value${i}`;
      }
      
      expect(() => validateGraphQLVariableValue(largeObj, 'testVar'))
        .toThrow(GraphQLValidationError);
    });

    it('should reject objects with invalid property names', () => {
      const obj = { 'invalid-prop': 'value' };
      expect(() => validateGraphQLVariableValue(obj, 'testVar'))
        .toThrow(GraphQLValidationError);
    });
  });

  describe('SearchQuerySchema', () => {
    it('should sanitize dangerous patterns', () => {
      const dangerous = 'search query { malicious } $variable';
      const result = SearchQuerySchema.parse(dangerous);
      expect(result).toBe('search query malicious'); // cleaned
    });

    it('should remove quotes and backslashes', () => {
      const dangerous = 'search "query" \\escape';
      const result = SearchQuerySchema.parse(dangerous);
      expect(result).toBe('search query escape'); // cleaned
    });

    it('should limit length', () => {
      const longQuery = 'a'.repeat(2000);
      expect(() => SearchQuerySchema.parse(longQuery))
        .toThrow();
    });
  });

  describe('ISO8601DateSchema', () => {
    it('should validate correct ISO 8601 dates', () => {
      const validDates = [
        '2023-01-01T00:00:00Z',
        '2023-12-31T23:59:59.999Z',
        '2020-06-15T12:30:45.000Z',
      ];
      
      validDates.forEach(date => {
        expect(() => ISO8601DateSchema.parse(date)).not.toThrow();
      });
    });

    it('should reject invalid date formats', () => {
      const invalidDates = [
        '2023-01-01',
        '01/01/2023',
        '2023-1-1T00:00:00Z',
        '2023-01-01T25:00:00Z',
        'not a date',
      ];
      
      invalidDates.forEach(date => {
        expect(() => ISO8601DateSchema.parse(date)).toThrow();
      });
    });

    it('should reject dates outside reasonable range', () => {
      const invalidDates = [
        '1999-01-01T00:00:00Z',
        '2101-01-01T00:00:00Z',
      ];
      
      invalidDates.forEach(date => {
        expect(() => ISO8601DateSchema.parse(date)).toThrow();
      });
    });
  });
});