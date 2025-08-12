/**
 * Test helper utilities
 */
import { vi, expect } from 'vitest';

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

/**
 * Retry a function with exponential backoff
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    backoffFactor?: number;
    maxDelay?: number;
  } = {}
): Promise<T> => {
  const {
    retries = 3,
    delay = 100,
    backoffFactor = 2,
    maxDelay = 5000
  } = options;

  let attempt = 0;
  let lastError: Error;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      attempt++;

      if (attempt > retries) {
        throw lastError;
      }

      const currentDelay = Math.min(delay * Math.pow(backoffFactor, attempt - 1), maxDelay);
      await sleep(currentDelay);
    }
  }

  throw lastError!;
};

/**
 * Wait for a condition to be true with timeout
 */
export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
  } = {}
): Promise<void> => {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return;
    }
    await sleep(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms timeout`);
};

/**
 * Create a timeout wrapper for async operations with proper cleanup
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = `Operation timed out after ${timeoutMs}ms`
): Promise<T> => {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  
  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    timeoutPromise,
  ]);
};

/**
 * Mock system time for testing
 */
export const mockSystemTime = (fixedTime?: Date | string | number) => {
  // Use Vitest's built-in fake timers
  vi.useFakeTimers();
  
  const fixed = fixedTime ? new Date(fixedTime) : new Date('2024-01-01T12:00:00Z');
  vi.setSystemTime(fixed);
  
  return {
    restore: () => {
      vi.useRealTimers();
    },
    setTime: (newTime: Date | string | number) => {
      const newFixed = new Date(newTime);
      vi.setSystemTime(newFixed);
    },
    advanceTime: (ms: number) => {
      vi.advanceTimersByTime(ms);
    },
    runAllTimers: () => {
      vi.runAllTimers();
    },
    runOnlyPendingTimers: () => {
      vi.runOnlyPendingTimers();
    }
  };
};
/**
 * Enhanced error assertion with retry logic
 */
export const expectEventually = async <T>(
  fn: () => T | Promise<T>,
  assertion: (result: T) => void | Promise<void>,
  options: {
    timeout?: number;
    interval?: number;
    retries?: number;
  } = {}
): Promise<T> => {
  const { timeout = 5000, interval = 100, retries = 3 } = options;
  
  return retry(async () => {
    const result = await withTimeout(Promise.resolve(fn()), timeout);
    await assertion(result);
    return result;
  }, { retries, delay: interval });
};

/**
 * Create a flaky test detector
 */
export const createFlakeDetector = () => {
  const results = new Map<string, { passed: number; failed: number }>();
  
  return {
    recordResult: (testName: string, passed: boolean) => {
      const current = results.get(testName) || { passed: 0, failed: 0 };
      if (passed) {
        current.passed++;
      } else {
        current.failed++;
      }
      results.set(testName, current);
    },
    
    isFlaky: (testName: string, threshold = 0.1) => {
      const result = results.get(testName);
      if (!result || result.passed + result.failed < 5) {
        return false; // Need more runs to determine
      }
      const failureRate = result.failed / (result.passed + result.failed);
      return failureRate > threshold && failureRate < 0.9; // Flaky if sometimes fails
    },
    
    getStats: () => Object.fromEntries(results),
    clear: () => results.clear(),
  };
};