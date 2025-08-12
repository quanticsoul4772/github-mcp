/**
 * Test setup and global configuration
 * Enhanced with better isolation and stability features
 */
import { beforeEach, afterEach, vi } from 'vitest';
import { mockSystemTime } from './helpers/test-helpers.js';

// Store original environment
const originalEnv = { ...process.env };
const originalConsole = { ...console };
const originalDate = Date;

// Environment isolation
beforeEach(() => {
  // Reset environment to clean state
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('GITHUB_') || key.startsWith('NODE_')) {
      delete process.env[key];
    }
  });
  
  // Set consistent test environment variables with deterministic values
  process.env.GITHUB_PERSONAL_ACCESS_TOKEN = 'test-token-fixed-12345';
  process.env.GITHUB_READ_ONLY = 'false';
  process.env.GITHUB_TOOLSETS = 'all';
  process.env.NODE_ENV = 'test';
  process.env.GITHUB_TELEMETRY_DISABLE = 'true'; // Disable telemetry in tests
  
  // Mock console to avoid noise
  global.console = {
    ...originalConsole,
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };

  // Note: mockSystemTime() is not called globally anymore to avoid
  // interfering with async operations. Tests that need deterministic
  // dates should call mockSystemTime() explicitly.
  
  // Clear all module imports to prevent cross-test contamination
  vi.resetModules();
});

// Cleanup after each test
afterEach(() => {
  // Restore environment
  process.env = { ...originalEnv };
  
  // Restore console
  global.console = originalConsole;
  
  // Restore Date
  (global as any).Date = originalDate;
  
  // Restore real timers if fake timers were used
  vi.useRealTimers();
  
  // Clear all mocks
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.restoreAllMocks();
});

// Global error handling for unhandled promises
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection in tests:', error);
});

// Increase stack trace limit for better debugging
Error.stackTraceLimit = 100;