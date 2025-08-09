import { defineConfig } from 'vitest/config';

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
        '*.config.ts',
        'src/index.ts', // Main entry point
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});