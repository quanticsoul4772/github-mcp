# Testing Documentation

## Overview

The GitHub MCP Server uses a comprehensive testing strategy to ensure reliability, performance, and security. Our test suite includes unit tests, integration tests, performance tests, and specialized test scenarios.

## Test Framework

We use **Vitest** as our primary testing framework, chosen for its:
- TypeScript-first design
- Fast execution with parallel test running
- Built-in coverage reporting
- Excellent IDE integration
- Compatible API with Jest

## Test Structure

```
src/
├── __tests__/
│   ├── integration/        # Integration tests with real API calls
│   ├── type-safety/        # Type system and validation tests
│   ├── agents/            # Agent system tests
│   ├── memory/            # Memory profiling tests
│   └── load-testing/      # Performance and load tests
├── tools/
│   └── *.test.ts          # Unit tests for each tool module
└── *.test.ts              # Unit tests for core modules
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Specialized Test Suites

```bash
# Unit tests only
npm run test:unit

# Integration tests (requires GITHUB_TEST_TOKEN)
npm run test:integration

# Performance tests
npm run test:performance

# Rate limiting tests
npm run test:rate-limiting
```

## Test Categories

### 1. Unit Tests

Unit tests verify individual functions and modules in isolation.

**Location**: `src/**/*.test.ts`

**Characteristics**:
- No external API calls
- Mocked dependencies
- Fast execution
- Run on every commit

**Example**:
```typescript
describe('validateFilePath', () => {
  it('should accept valid file paths', () => {
    expect(validateFilePath('README.md')).toBe('README.md');
    expect(validateFilePath('src/index.ts')).toBe('src/index.ts');
  });

  it('should reject directory traversal attempts', () => {
    expect(() => validateFilePath('../etc/passwd')).toThrow();
    expect(() => validateFilePath('../../secret')).toThrow();
  });
});
```

### 2. Integration Tests

Integration tests verify interactions with the GitHub API.

**Location**: `src/__tests__/integration/`

**Requirements**:
- `GITHUB_TEST_TOKEN` environment variable
- Network connectivity
- Valid GitHub account

**Configuration**:
```bash
# Create a test token with minimal scopes
export GITHUB_TEST_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Run integration tests
npm run test:integration
```

**Features Tested**:
- Authentication flow
- API error handling
- Rate limiting behavior
- Token permission verification
- Real API responses

### 3. Performance Tests

Performance tests ensure the system meets performance requirements.

**Location**: `src/__tests__/load-testing/`

**Metrics Monitored**:
- Response time (p50, p95, p99)
- Throughput (requests/second)
- Memory usage
- CPU utilization
- API rate limit consumption

**Example Thresholds**:
```typescript
const PERFORMANCE_THRESHOLDS = {
  p50ResponseTime: 100,  // 50th percentile < 100ms
  p95ResponseTime: 500,  // 95th percentile < 500ms
  p99ResponseTime: 1000, // 99th percentile < 1s
  minThroughput: 10,     // At least 10 req/s
  maxMemoryGrowth: 50    // Max 50MB memory growth
};
```

### 4. Type Safety Tests

Type safety tests verify TypeScript types and schema validation.

**Location**: `src/__tests__/type-safety/`

**Coverage**:
- Zod schema validation
- JSON Schema to Zod conversion
- Parameter validation
- Error type checking
- API response types

### 5. Memory Profiling Tests

Memory tests detect and prevent memory leaks.

**Location**: `src/__tests__/memory/`

**Scenarios**:
- Large file processing
- Batch operations
- Long-running processes
- Cache management
- Stream handling

## Test Configuration

### Vitest Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'build/',
        '**/*.test.ts',
        '**/*.config.ts'
      ]
    },
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
```

### Environment Variables for Testing

```bash
# Required for integration tests
GITHUB_TEST_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Optional test configuration
TEST_REPO_OWNER=test-org
TEST_REPO_NAME=test-repo
TEST_TIMEOUT=60000
TEST_PARALLEL=true
```

## Mocking Strategy

### API Mocking

We use Vitest's built-in mocking capabilities:

```typescript
import { vi } from 'vitest';
import { Octokit } from '@octokit/rest';

// Mock Octokit
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      repos: {
        get: vi.fn().mockResolvedValue({
          data: { name: 'test-repo' }
        })
      }
    }
  }))
}));
```

### File System Mocking

```typescript
import { vi } from 'vitest';
import * as fs from 'fs/promises';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn()
}));
```

## Coverage Requirements

We maintain strict coverage requirements:

- **Lines**: 80% minimum
- **Functions**: 80% minimum
- **Branches**: 80% minimum
- **Statements**: 80% minimum

Check coverage:
```bash
npm run coverage:check
```

Generate coverage report:
```bash
npm run test:coverage
```

## CI/CD Integration

Tests run automatically in GitHub Actions:

1. **On Pull Request**: Unit tests and type checking
2. **On Merge to Main**: Full test suite including integration
3. **Nightly**: Performance and load tests
4. **Weekly**: Security and dependency tests

## Best Practices

### 1. Test Naming

Use descriptive test names that explain the scenario:

```typescript
// Good
it('should return 404 when repository does not exist', ...)

// Bad
it('should work', ...)
```

### 2. Test Organization

Group related tests using `describe` blocks:

```typescript
describe('Repository Operations', () => {
  describe('getRepository', () => {
    it('should return repository details', ...);
    it('should handle missing repository', ...);
  });
  
  describe('createRepository', () => {
    it('should create public repository', ...);
    it('should create private repository', ...);
  });
});
```

### 3. Test Data

Use factories for test data:

```typescript
const createTestRepository = (overrides = {}) => ({
  name: 'test-repo',
  owner: 'test-user',
  private: false,
  ...overrides
});
```

### 4. Async Testing

Always handle async operations properly:

```typescript
// Good
it('should fetch data', async () => {
  const result = await fetchData();
  expect(result).toBeDefined();
});

// Bad
it('should fetch data', () => {
  fetchData().then(result => {
    expect(result).toBeDefined();
  });
});
```

### 5. Error Testing

Test both success and failure paths:

```typescript
it('should handle API errors gracefully', async () => {
  mockApi.mockRejectedValue(new Error('API Error'));
  
  await expect(performOperation()).rejects.toThrow('API Error');
  expect(logger.error).toHaveBeenCalled();
});
```

## Troubleshooting

### Common Issues

1. **Integration Tests Failing**
   - Verify `GITHUB_TEST_TOKEN` is set
   - Check token permissions
   - Ensure network connectivity

2. **Performance Tests Timing Out**
   - Increase timeout: `TEST_TIMEOUT=120000`
   - Check system resources
   - Verify API rate limits

3. **Coverage Below Threshold**
   - Run `npm run test:coverage` to identify gaps
   - Add tests for uncovered branches
   - Focus on critical paths first

4. **Memory Tests Failing**
   - Check for memory leaks in async operations
   - Verify proper cleanup in afterEach hooks
   - Monitor heap snapshots

## Contributing Tests

When adding new features:

1. Write tests first (TDD approach)
2. Ensure all edge cases are covered
3. Add integration tests for API interactions
4. Include performance tests for critical paths
5. Update this documentation if needed

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [GitHub API Testing Guide](https://docs.github.com/en/rest/guides/getting-started-with-the-rest-api)