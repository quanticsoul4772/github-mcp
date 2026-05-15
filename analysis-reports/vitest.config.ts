import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: ['build/**', 'node_modules/**', 'dist/**'],
    isolate: true, // Better test isolation
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Prevent race conditions
      }
    },
    retry: 2, // Retry flaky tests up to 2 times
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'cobertura'],
      exclude: [
        'node_modules/',
        'build/',
        '*.config.ts',
        'src/__tests__/**', // Test utilities and fixtures
        'src/**/*.test.ts', // Test files themselves
        'src/index-refactored-example.ts', // Example file
        'test-reliability.js', // Test script
      ],
      include: [
        'src/**/*.ts',
      ],
      reportOnFailure: true,
      skipFull: false,
    },
    // Enhanced timeout configurations
    testTimeout: 15000, // Increased for network operations
    hookTimeout: 10000,
    teardownTimeout: 5000,
    // Bail on first failure in CI to fail fast
    bail: process.env.CI ? 1 : 0,
    // Better error handling
    includeSource: ['src/**/*.ts'],
    passWithNoTests: false,
    // Improved reporting for flaky tests
    reporter: process.env.CI ? ['verbose', 'github-actions'] : ['verbose'],
  },
});