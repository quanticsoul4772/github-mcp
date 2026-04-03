/**
 * Tests for graphql-types type guards and utilities
 */
import { describe, it, expect } from 'vitest';
import {
  isRepository,
  isIssue,
  isUser,
  isDiscussion,
  validatePageInfo,
  validateActor,
  validateRepository,
  extractGraphQLData,
} from './graphql-types.js';

describe('graphql-types', () => {

  // ============================================================================
  // isRepository
  // ============================================================================

  describe('isRepository', () => {
    it('should return true for valid repository node', () => {
      expect(isRepository({ id: 'R_1', name: 'my-repo', stargazerCount: 10 })).toBe(true);
    });

    it('should return false when id is not a string', () => {
      expect(isRepository({ id: 1, name: 'my-repo', stargazerCount: 10 })).toBe(false);
    });

    it('should return false when name is missing', () => {
      expect(isRepository({ id: 'R_1', stargazerCount: 10 })).toBe(false);
    });

    it('should return false when stargazerCount is undefined', () => {
      expect(isRepository({ id: 'R_1', name: 'my-repo' })).toBe(false);
    });

    it('should return falsy for null', () => {
      expect(isRepository(null)).toBeFalsy();
    });
  });

  // ============================================================================
  // isIssue
  // ============================================================================

  describe('isIssue', () => {
    it('should return true for valid issue node', () => {
      expect(isIssue({ id: 'I_1', number: 42, state: 'open' })).toBe(true);
    });

    it('should return false when id is not a string', () => {
      expect(isIssue({ id: 1, number: 42, state: 'open' })).toBeFalsy();
    });

    it('should return false when number is not a number', () => {
      expect(isIssue({ id: 'I_1', number: '42', state: 'open' })).toBeFalsy();
    });

    it('should return false when state is undefined', () => {
      expect(isIssue({ id: 'I_1', number: 42 })).toBeFalsy();
    });

    it('should return falsy for null', () => {
      expect(isIssue(null)).toBeFalsy();
    });
  });

  // ============================================================================
  // isUser
  // ============================================================================

  describe('isUser', () => {
    it('should return true for valid user node', () => {
      expect(isUser({ id: 'U_1', login: 'octocat', followers: { totalCount: 5 } })).toBe(true);
    });

    it('should return false when login is not a string', () => {
      expect(isUser({ id: 'U_1', login: 123, followers: {} })).toBeFalsy();
    });

    it('should return false when followers is undefined', () => {
      expect(isUser({ id: 'U_1', login: 'octocat' })).toBeFalsy();
    });

    it('should return falsy for null', () => {
      expect(isUser(null)).toBeFalsy();
    });
  });

  // ============================================================================
  // isDiscussion
  // ============================================================================

  describe('isDiscussion', () => {
    it('should return true for valid discussion node', () => {
      expect(isDiscussion({ id: 'D_1', number: 5, upvoteCount: 3 })).toBe(true);
    });

    it('should return false when id is not a string', () => {
      expect(isDiscussion({ id: 1, number: 5, upvoteCount: 3 })).toBeFalsy();
    });

    it('should return false when upvoteCount is undefined', () => {
      expect(isDiscussion({ id: 'D_1', number: 5 })).toBeFalsy();
    });

    it('should return falsy for null', () => {
      expect(isDiscussion(null)).toBeFalsy();
    });
  });

  // ============================================================================
  // validatePageInfo
  // ============================================================================

  describe('validatePageInfo', () => {
    it('should return true for valid PageInfo', () => {
      expect(validatePageInfo({ hasNextPage: true, endCursor: 'cursor123' })).toBe(true);
    });

    it('should return true for hasNextPage: false', () => {
      expect(validatePageInfo({ hasNextPage: false, endCursor: null })).toBe(true);
    });

    it('should return falsy when hasNextPage is not boolean', () => {
      expect(validatePageInfo({ hasNextPage: 'true', endCursor: null })).toBeFalsy();
    });

    it('should return falsy for null', () => {
      expect(validatePageInfo(null)).toBeFalsy();
    });
  });

  // ============================================================================
  // validateActor
  // ============================================================================

  describe('validateActor', () => {
    it('should return true for valid actor', () => {
      expect(validateActor({ login: 'octocat' })).toBe(true);
    });

    it('should return falsy when login is not a string', () => {
      expect(validateActor({ login: 123 })).toBeFalsy();
    });

    it('should return falsy for null', () => {
      expect(validateActor(null)).toBeFalsy();
    });
  });

  // ============================================================================
  // validateRepository
  // ============================================================================

  describe('validateRepository', () => {
    it('should return true for valid repository', () => {
      expect(validateRepository({ id: 'R_1', name: 'my-repo', stargazerCount: 0 })).toBe(true);
    });

    it('should return falsy when stargazerCount is not a number', () => {
      expect(validateRepository({ id: 'R_1', name: 'my-repo', stargazerCount: '10' })).toBeFalsy();
    });

    it('should return falsy for null', () => {
      expect(validateRepository(null)).toBeFalsy();
    });
  });

  // ============================================================================
  // extractGraphQLData
  // ============================================================================

  describe('extractGraphQLData', () => {
    it('should return data from a successful response', () => {
      const response = { data: { viewer: { login: 'octocat' } } };
      expect(extractGraphQLData(response)).toEqual({ viewer: { login: 'octocat' } });
    });

    it('should throw when response has errors', () => {
      const response = {
        errors: [{ message: 'Field not found' }, { message: 'Access denied' }],
      };
      expect(() => extractGraphQLData(response)).toThrow('GraphQL errors: Field not found, Access denied');
    });

    it('should throw when data is missing', () => {
      expect(() => extractGraphQLData({})).toThrow('No data returned from GraphQL query');
    });

    it('should prioritize errors over missing data', () => {
      const response = { errors: [{ message: 'Some error' }] };
      expect(() => extractGraphQLData(response)).toThrow('GraphQL errors: Some error');
    });
  });
});
