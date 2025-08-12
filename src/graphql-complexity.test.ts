/**
 * Tests for GraphQL complexity calculation
 */

import { GraphQLComplexityCalculator, estimateGraphQLPoints, isQueryComplexitySafe } from './graphql-complexity.js';

// Simple test runner since we're not using a formal testing framework here
function runTests() {
  console.log('Running GraphQL complexity tests...\n');
  
  let testsPassed = 0;
  let testsTotal = 0;
  
  function test(description: string, testFn: () => void) {
    testsTotal++;
    try {
      testFn();
      console.log(`✓ ${description}`);
      testsPassed++;
    } catch (error) {
      console.error(`✗ ${description}: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  function assert(condition: boolean, message: string = 'Assertion failed') {
    if (!condition) {
      throw new Error(message);
    }
  }

  // Test basic complexity calculation
  test('Basic query complexity calculation', () => {
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
    assert(analysis.estimatedPoints > 0, 'Should calculate some points');
    assert(analysis.breakdown.totalFields > 0, 'Should detect fields');
  });

  // Test connection complexity
  test('Connection complexity calculation', () => {
    const calculator = new GraphQLComplexityCalculator();
    const query = `
      query {
        repository(owner: "test", name: "test") {
          issues(first: 50) {
            totalCount
            nodes {
              title
              state
            }
          }
        }
      }
    `;
    
    const analysis = calculator.calculateQueryComplexity(query);
    assert(analysis.breakdown.connections > 0, 'Should detect connections');
    assert(analysis.estimatedPoints > 10, 'Connections should increase complexity');
  });

  // Test nested query complexity
  test('Nested query complexity', () => {
    const calculator = new GraphQLComplexityCalculator();
    const query = `
      query {
        repository(owner: "test", name: "test") {
          issues(first: 10) {
            nodes {
              author {
                login
                avatarUrl
              }
              comments(first: 5) {
                nodes {
                  body
                  author {
                    login
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    const analysis = calculator.calculateQueryComplexity(query);
    assert(analysis.breakdown.nestedQueries > 0, 'Should detect nested queries');
    assert(analysis.estimatedPoints > 15, 'Nested queries should increase complexity significantly');
  });

  // Test complexity warnings
  test('High complexity warnings', () => {
    const calculator = new GraphQLComplexityCalculator({ maxComplexityPerQuery: 10 });
    const complexQuery = `
      query {
        repository(owner: "test", name: "test") {
          issues(first: 100) {
            nodes {
              author { login }
              comments(first: 100) {
                nodes {
                  body
                  author { login }
                  reactions(first: 50) {
                    nodes { content }
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    const analysis = calculator.calculateQueryComplexity(complexQuery);
    assert(analysis.warnings.length > 0, 'Should generate warnings for complex queries');
  });

  // Test query safety check
  test('Query safety check', () => {
    const simpleQuery = `
      query {
        repository(owner: "test", name: "test") {
          name
          stargazerCount
        }
      }
    `;
    
    const safetyCheck = isQueryComplexitySafe(simpleQuery, {}, 100);
    assert(safetyCheck.safe === true, 'Simple query should be safe');
    assert(safetyCheck.points > 0, 'Should estimate some points');
  });

  // Test estimate function
  test('Quick estimation function', () => {
    const query = `
      query {
        repository(owner: "test", name: "test") {
          name
          description
        }
      }
    `;
    
    const points = estimateGraphQLPoints(query);
    assert(points > 0, 'Should estimate positive points');
    assert(typeof points === 'number', 'Should return a number');
  });

  // Test pattern estimation
  test('Pattern complexity estimation', () => {
    const calculator = new GraphQLComplexityCalculator();
    
    const basicRepo = calculator.estimatePatternComplexity('repository_basic');
    const detailedRepo = calculator.estimatePatternComplexity('repository_detailed');
    
    assert(basicRepo < detailedRepo, 'Detailed pattern should be more complex than basic');
    assert(basicRepo > 0 && detailedRepo > 0, 'Both should be positive');
  });

  // Test optimization suggestions
  test('Optimization suggestions', () => {
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
    
    assert(suggestions.length > 0, 'Should provide optimization suggestions for complex queries');
  });

  // Print results
  console.log(`\nTest Results: ${testsPassed}/${testsTotal} passed`);
  
  if (testsPassed === testsTotal) {
    console.log('✓ All tests passed!');
    return true;
  } else {
    console.error(`✗ ${testsTotal - testsPassed} tests failed`);
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

export { runTests };