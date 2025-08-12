import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
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
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});