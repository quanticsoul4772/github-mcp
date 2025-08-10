/**
 * Test helper utilities
 */
import { vi } from 'vitest';

/**
 * Mock process.exit to prevent tests from exiting
 */
export const mockProcessExit = () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit called');
  });
  return exitSpy;
};

/**
 * Restore process.exit after test
 */
export const restoreProcessExit = (exitSpy: any) => {
  exitSpy.mockRestore();
};

/**
 * Mock console methods
 */
export const mockConsole = () => {
  const originalConsole = { ...console };
  const consoleMock = {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };
  
  Object.assign(console, consoleMock);
  
  return {
    consoleMock,
    restore: () => Object.assign(console, originalConsole),
  };
};

/**
 * Create a mock MCP server transport
 */
export const createMockTransport = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  send: vi.fn().mockResolvedValue(undefined),
});

/**
 * Create environment variable mock
 */
export const mockEnvVar = (key: string, value: string) => {
  const original = process.env[key];
  process.env[key] = value;
  return () => {
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  };
};

/**
 * Create multiple environment variable mocks
 */
export const mockEnvVars = (vars: Record<string, string>) => {
  const restoreFunctions = Object.entries(vars).map(([key, value]) => 
    mockEnvVar(key, value)
  );
  
  return () => restoreFunctions.forEach(restore => restore());
};

/**
 * Wait for a specified number of milliseconds
 */
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Create a promise that can be resolved/rejected externally
 */
export const createControllablePromise = <T = any>() => {
  let resolve: (value: T) => void;
  let reject: (reason?: any) => void;
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  
  return { promise, resolve: resolve!, reject: reject! };
};

/**
 * Assert that a function throws an error with a specific message
 */
export const expectToThrow = async (fn: () => Promise<any>, expectedMessage?: string) => {
  try {
    await fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error) {
    if (expectedMessage && error instanceof Error) {
      expect(error.message).toContain(expectedMessage);
    }
    return error;
  }
};

/**
 * Create a deep copy of an object for test isolation
 */
export const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

/**
 * Generate a random string for test data
 */
export const randomString = (length = 10) => 
  Math.random().toString(36).substring(2, length + 2);

/**
 * Generate a random integer between min and max (inclusive)
 */
export const randomInt = (min: number, max: number) => 
  Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Create a mock response with pagination headers
 */
export const createPaginatedResponse = <T>(data: T[], page = 1, perPage = 30) => ({
  data,
  headers: {
    link: page === 1 
      ? `<https://api.github.com/test?page=${page + 1}>; rel="next", <https://api.github.com/test?page=10>; rel="last"`
      : `<https://api.github.com/test?page=${page - 1}>; rel="prev", <https://api.github.com/test?page=${page + 1}>; rel="next", <https://api.github.com/test?page=10>; rel="last"`,
  },
  status: 200,
  url: `https://api.github.com/test?page=${page}&per_page=${perPage}`,
});

/**
 * Validate that an object matches a schema structure
 */
export const validateResponseStructure = (response: any, expectedKeys: string[]) => {
  const responseKeys = Object.keys(response);
  for (const key of expectedKeys) {
    expect(responseKeys).toContain(key);
  }
};