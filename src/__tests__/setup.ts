/**
 * Test setup and global configuration
 */
import { beforeEach, vi, expect } from 'vitest';

// Mock environment variables
beforeEach(() => {
  process.env.GITHUB_PERSONAL_ACCESS_TOKEN = 'test-token-123';
  process.env.GITHUB_READ_ONLY = 'false';
  process.env.GITHUB_TOOLSETS = 'all';
});

// Global test utilities
global.console = {
  ...console,
  // Mock console.error to avoid noise in tests
  error: vi.fn(),
};