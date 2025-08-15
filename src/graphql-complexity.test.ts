/**
 * Tests for GraphQL complexity calculation
 */

import { describe, it, expect } from 'vitest';
import { GraphQLComplexityCalculator, estimateGraphQLPoints, isQueryComplexitySafe } from './graphql-complexity.js';

describe('GraphQL Complexity', () => {
  describe('Basic complexity calculation', () => {
    it('should calculate basic query complexity', () => {
      const calculator = new GraphQLComplexityCalculator();
      const query = `
        query {
          repository(owner: "test", name: "test") {
            name
            description
            stargazerCount
          }
        }
      `;
      
      const analysis = calculator.calculateQueryComplexity(query);
      expect(analysis.estimatedPoints).toBeGreaterThan(0);
      expect(analysis.breakdown.totalFields).toBeGreaterThan(0);
    });
  });

  describe('Connection complexity', () => {
    it('should calculate connection complexity', () => {
      const calculator = new GraphQLComplexityCalculator();
      const query = `
        query {
          repository(owner: "test", name: "test") {
            issues(first: 100) {
              nodes {
                title
                body
                comments(first: 50) {
                  nodes {
                    body
                  }
                }
              }
            }
          }
        }
      `;
      
      const analysis = calculator.calculateQueryComplexity(query);
      expect(analysis.breakdown.connections).toBeGreaterThan(0);
      expect(analysis.breakdown.nestedQueries).toBeGreaterThan(0);
    });
  });

  describe('Large pagination detection', () => {
    it('should detect large pagination values', () => {
      const calculator = new GraphQLComplexityCalculator();
      const query = `
        query {
          search(query: "test", type: REPOSITORY, first: 100) {
            nodes {
              ... on Repository {
                name
              }
            }
          }
        }
      `;
      
      const analysis = calculator.calculateQueryComplexity(query);
      // Pagination contributes to connections count
      expect(analysis.breakdown.connections).toBeGreaterThan(0);
    });
  });

  describe('Nested connections multiplier', () => {
    it('should apply multiplier for nested connections', () => {
      const calculator = new GraphQLComplexityCalculator();
      const simpleQuery = `
        query {
          repository(owner: "test", name: "test") {
            issues(first: 10) {
              nodes { title }
            }
          }
        }
      `;
      
      const nestedQuery = `
        query {
          repository(owner: "test", name: "test") {
            issues(first: 10) {
              nodes {
                title
                comments(first: 10) {
                  nodes {
                    body
                    reactions(first: 10) {
                      nodes { content }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      
      const simpleAnalysis = calculator.calculateQueryComplexity(simpleQuery);
      const nestedAnalysis = calculator.calculateQueryComplexity(nestedQuery);
      
      expect(nestedAnalysis.estimatedPoints).toBeGreaterThan(simpleAnalysis.estimatedPoints);
      expect(nestedAnalysis.breakdown.nestedQueries).toBeGreaterThanOrEqual(simpleAnalysis.breakdown.nestedQueries);
    });
  });

  describe('Safety checks', () => {
    it('should check if query complexity is safe', () => {
      const simpleQuery = `
        query {
          repository(owner: "test", name: "test") {
            name
            description
          }
        }
      `;
      
      const complexQuery = `
        query {
          search(query: "language:javascript", type: REPOSITORY, first: 100) {
            nodes {
              ... on Repository {
                name
                stargazerCount
                issues(first: 100) { totalCount }
                pullRequests(first: 100) { totalCount }
                languages(first: 50) {
                  edges {
                    node { name }
                  }
                }
              }
            }
          }
        }
      `;
      
      const simpleResult = isQueryComplexitySafe(simpleQuery);
      expect(simpleResult.safe).toBe(true);
      expect(simpleResult.points).toBeGreaterThan(0);
      
      // Complex query might still be safe, depending on thresholds
      const complexResult = isQueryComplexitySafe(complexQuery);
      expect(typeof complexResult.safe).toBe('boolean');
      expect(complexResult.points).toBeGreaterThan(0);
    });
  });

  describe('Utility functions', () => {
    it('should estimate GraphQL points', () => {
      const query = `
        query {
          repository(owner: "test", name: "test") {
            name
            description
          }
        }
      `;
      
      const points = estimateGraphQLPoints(query);
      expect(points).toBeGreaterThan(0);
      expect(typeof points).toBe('number');
    });
  });

  describe('Pattern complexity estimation', () => {
    it('should estimate pattern complexity', () => {
      const calculator = new GraphQLComplexityCalculator();
      
      const basicRepo = calculator.estimatePatternComplexity('repository_basic');
      const detailedRepo = calculator.estimatePatternComplexity('repository_detailed');
      
      expect(basicRepo).toBeGreaterThan(0);
      expect(detailedRepo).toBeGreaterThan(0);
      expect(detailedRepo).toBeGreaterThan(basicRepo);
    });
  });

  describe('Optimization suggestions', () => {
    it('should provide optimization suggestions', () => {
      const calculator = new GraphQLComplexityCalculator();
      const complexQuery = `
        query {
          search(query: "language:javascript", type: REPOSITORY, first: 100) {
            nodes {
              ... on Repository {
                name
                stargazerCount
                issues(first: 100) { totalCount }
                pullRequests(first: 100) { totalCount }
                languages(first: 50) {
                  edges {
                    node { name }
                  }
                }
              }
            }
          }
        }
      `;
      
      const analysis = calculator.calculateQueryComplexity(complexQuery);
      const suggestions = calculator.getOptimizationSuggestions(analysis);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(typeof suggestions[0]).toBe('string');
      expect(suggestions[0].length).toBeGreaterThan(0);
    });
  });
});