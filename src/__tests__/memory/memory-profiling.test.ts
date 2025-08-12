/**
 * Memory Profiling Tests
 * Tests for memory leaks, garbage collection, and memory usage patterns
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createIssueTools } from '../../tools/issues.js';
import { createRepositoryTools } from '../../tools/repositories.js';
import { createPullRequestTools } from '../../tools/pull-requests.js';
import { createMockOctokit } from '../mocks/octokit.js';
import { testFixtures } from '../fixtures/test-data.js';
import { ReliabilityManager, RetryManager, ConsoleTelemetry } from '../../reliability.js';

const MEMORY_THRESHOLDS = {
  MAX_HEAP_INCREASE_MB: 100, // Maximum acceptable heap increase
  MAX_EXTERNAL_INCREASE_MB: 50, // Maximum acceptable external memory increase
  MAX_RSS_INCREASE_MB: 200, // Maximum acceptable RSS increase
  GC_EFFICIENCY_THRESHOLD: 0.8, // Minimum GC efficiency (memory freed / memory used)
};

interface MemorySnapshot {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

class MemoryProfiler {
  private snapshots: Array<{ label: string; memory: MemorySnapshot }> = [];

  takeSnapshot(label: string): MemorySnapshot {
    if (global.gc) {
      global.gc();
    }
    
    const memory = process.memoryUsage();
    this.snapshots.push({ label, memory });
    return memory;
  }

  getMemoryIncrease(fromLabel: string, toLabel: string): {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  } {
    const fromSnapshot = this.snapshots.find(s => s.label === fromLabel);
    const toSnapshot = this.snapshots.find(s => s.label === toLabel);
    
    if (!fromSnapshot || !toSnapshot) {
      throw new Error('Snapshots not found');
    }

    return {
      rss: (toSnapshot.memory.rss - fromSnapshot.memory.rss) / (1024 * 1024),
      heapTotal: (toSnapshot.memory.heapTotal - fromSnapshot.memory.heapTotal) / (1024 * 1024),
      heapUsed: (toSnapshot.memory.heapUsed - fromSnapshot.memory.heapUsed) / (1024 * 1024),
      external: (toSnapshot.memory.external - fromSnapshot.memory.external) / (1024 * 1024),
      arrayBuffers: (toSnapshot.memory.arrayBuffers - fromSnapshot.memory.arrayBuffers) / (1024 * 1024),
    };
  }

  clear(): void {
    this.snapshots = [];
  }
}

describe('Memory Profiling Tests', () => {
  let mockOctokit: any;
  let issueTools: any[];
  let repoTools: any[];
  let prTools: any[];
  let reliabilityManager: ReliabilityManager;
  let profiler: MemoryProfiler;

  beforeEach(() => {
    mockOctokit = createMockOctokit();
    issueTools = createIssueTools(mockOctokit, false);
    repoTools = createRepositoryTools(mockOctokit, false);
    prTools = createPullRequestTools(mockOctokit, false);
    
    const telemetry = new ConsoleTelemetry(false);
    const retryManager = new RetryManager();
    reliabilityManager = new ReliabilityManager(retryManager, telemetry);
    
    profiler = new MemoryProfiler();
    profiler.takeSnapshot('start');
  });

  afterEach(() => {
    profiler.clear();
  });

  describe('Basic Memory Usage', () => {
    it('should not leak memory during normal issue operations', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [testFixtures.issues.open] });

      profiler.takeSnapshot('before_operations');

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        await listIssues.handler({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'all',
        });
      }

      profiler.takeSnapshot('after_operations');
      const memoryIncrease = profiler.getMemoryIncrease('before_operations', 'after_operations');

      expect(memoryIncrease.heapUsed).toBeLessThan(MEMORY_THRESHOLDS.MAX_HEAP_INCREASE_MB);
      expect(memoryIncrease.external).toBeLessThan(MEMORY_THRESHOLDS.MAX_EXTERNAL_INCREASE_MB);
      expect(memoryIncrease.rss).toBeLessThan(MEMORY_THRESHOLDS.MAX_RSS_INCREASE_MB);
    });

    it('should not leak memory during repository operations', async () => {
      const getRepo = repoTools.find(tool => tool.tool.name === 'get_repository');
      mockOctokit.repos.get.mockResolvedValue({ data: testFixtures.repositories.public });

      profiler.takeSnapshot('before_repo_ops');

      // Perform repository operations
      for (let i = 0; i < 500; i++) {
        await getRepo.handler({
          owner: 'test-owner',
          repo: 'test-repo',
        });
      }

      profiler.takeSnapshot('after_repo_ops');
      const memoryIncrease = profiler.getMemoryIncrease('before_repo_ops', 'after_repo_ops');

      expect(memoryIncrease.heapUsed).toBeLessThan(MEMORY_THRESHOLDS.MAX_HEAP_INCREASE_MB);
    });

    it('should handle memory efficiently with mixed operations', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      const getRepo = repoTools.find(tool => tool.tool.name === 'get_repository');
      const listPRs = prTools.find(tool => tool.tool.name === 'list_pull_requests');

      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [testFixtures.issues.open] });
      mockOctokit.repos.get.mockResolvedValue({ data: testFixtures.repositories.public });
      mockOctokit.pulls.list.mockResolvedValue({ data: [testFixtures.pullRequests.open] });

      profiler.takeSnapshot('before_mixed_ops');

      // Mix different operations
      for (let i = 0; i < 300; i++) {
        const operation = i % 3;
        if (operation === 0) {
          await listIssues.handler({ owner: 'test-owner', repo: 'test-repo', state: 'all' });
        } else if (operation === 1) {
          await getRepo.handler({ owner: 'test-owner', repo: 'test-repo' });
        } else {
          await listPRs.handler({ owner: 'test-owner', repo: 'test-repo', state: 'all' });
        }
      }

      profiler.takeSnapshot('after_mixed_ops');
      const memoryIncrease = profiler.getMemoryIncrease('before_mixed_ops', 'after_mixed_ops');

      expect(memoryIncrease.heapUsed).toBeLessThan(MEMORY_THRESHOLDS.MAX_HEAP_INCREASE_MB);
    });
  });

  describe('Large Data Handling', () => {
    it('should handle large responses without excessive memory usage', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      
      // Generate large response data
      const largeIssueList = Array(5000).fill(null).map((_, index) => ({
        ...testFixtures.issues.open,
        id: index,
        number: index,
        title: `Issue ${index}`,
        body: 'Large issue body content '.repeat(100), // ~2KB per issue
      }));

      mockOctokit.issues.listForRepo.mockResolvedValue({ data: largeIssueList });

      profiler.takeSnapshot('before_large_data');

      // Process large data multiple times
      for (let i = 0; i < 10; i++) {
        await listIssues.handler({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'all',
        });
      }

      profiler.takeSnapshot('after_large_data');
      const memoryIncrease = profiler.getMemoryIncrease('before_large_data', 'after_large_data');

      // Should handle large data without permanent memory increase
      expect(memoryIncrease.heapUsed).toBeLessThan(MEMORY_THRESHOLDS.MAX_HEAP_INCREASE_MB);
    });

    it('should efficiently process paginated results', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      
      // Simulate paginated responses
      const pageSize = 100;
      const totalPages = 50;
      
      let currentPage = 1;
      mockOctokit.issues.listForRepo.mockImplementation(() => {
        const pageData = Array(pageSize).fill(null).map((_, index) => ({
          ...testFixtures.issues.open,
          id: (currentPage - 1) * pageSize + index,
          number: (currentPage - 1) * pageSize + index,
        }));
        currentPage = (currentPage % totalPages) + 1;
        return Promise.resolve({ data: pageData });
      });

      profiler.takeSnapshot('before_pagination');

      // Process multiple pages
      for (let page = 1; page <= totalPages; page++) {
        await listIssues.handler({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'all',
          page,
        });
      }

      profiler.takeSnapshot('after_pagination');
      const memoryIncrease = profiler.getMemoryIncrease('before_pagination', 'after_pagination');

      expect(memoryIncrease.heapUsed).toBeLessThan(MEMORY_THRESHOLDS.MAX_HEAP_INCREASE_MB * 2);
    });
  });

  describe('Error Handling Memory Impact', () => {
    it('should not leak memory when handling errors', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      
      // Mock to throw errors
      mockOctokit.issues.listForRepo.mockRejectedValue(new Error('API Error'));

      profiler.takeSnapshot('before_errors');

      // Generate many errors
      let errorCount = 0;
      for (let i = 0; i < 500; i++) {
        try {
          await listIssues.handler({
            owner: 'test-owner',
            repo: 'test-repo',
            state: 'all',
          });
        } catch (error) {
          errorCount++;
        }
      }

      profiler.takeSnapshot('after_errors');
      const memoryIncrease = profiler.getMemoryIncrease('before_errors', 'after_errors');

      expect(errorCount).toBe(500); // All should error
      expect(memoryIncrease.heapUsed).toBeLessThan(MEMORY_THRESHOLDS.MAX_HEAP_INCREASE_MB);
    });

    it('should handle retry scenarios without memory leaks', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      
      let attemptCount = 0;
      mockOctokit.issues.listForRepo.mockImplementation(() => {
        attemptCount++;
        if (attemptCount % 3 === 0) {
          // Success every third attempt
          return Promise.resolve({ data: [testFixtures.issues.open] });
        } else {
          throw new Error('Temporary failure');
        }
      });

      profiler.takeSnapshot('before_retries');

      // Use reliability manager for retries
      for (let i = 0; i < 100; i++) {
        await reliabilityManager.executeWithReliability(
          'memory_test_operation',
          () => listIssues.handler({
            owner: 'test-owner',
            repo: 'test-repo',
            state: 'all',
          })
        );
      }

      profiler.takeSnapshot('after_retries');
      const memoryIncrease = profiler.getMemoryIncrease('before_retries', 'after_retries');

      expect(memoryIncrease.heapUsed).toBeLessThan(MEMORY_THRESHOLDS.MAX_HEAP_INCREASE_MB);
    });
  });

  describe('Garbage Collection Efficiency', () => {
    it('should allow effective garbage collection', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      
      // Generate varied responses to create garbage
      let requestCount = 0;
      mockOctokit.issues.listForRepo.mockImplementation(() => {
        requestCount++;
        return Promise.resolve({ 
          data: Array(100).fill(null).map((_, i) => ({
            ...testFixtures.issues.open,
            id: requestCount * 100 + i,
            body: `Request ${requestCount} Issue ${i} - ${new Array(1000).fill('x').join('')}`, // Large strings
          }))
        });
      });

      profiler.takeSnapshot('before_gc_test');

      // Create lots of garbage
      for (let i = 0; i < 200; i++) {
        await listIssues.handler({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'all',
        });
      }

      const memoryBeforeGC = process.memoryUsage();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      profiler.takeSnapshot('after_gc_test');
      const memoryAfterGC = process.memoryUsage();

      // Calculate GC efficiency
      const gcEfficiency = memoryBeforeGC.heapUsed > 0 
        ? (memoryBeforeGC.heapUsed - memoryAfterGC.heapUsed) / memoryBeforeGC.heapUsed 
        : 0;

      if (global.gc) {
        expect(gcEfficiency).toBeGreaterThan(0.1); // Some garbage should be collected
      }

      const memoryIncrease = profiler.getMemoryIncrease('before_gc_test', 'after_gc_test');
      expect(memoryIncrease.heapUsed).toBeLessThan(MEMORY_THRESHOLDS.MAX_HEAP_INCREASE_MB);
    });

    it('should handle rapid allocation and deallocation', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');

      profiler.takeSnapshot('before_rapid_alloc');

      // Rapidly allocate and deallocate through operations
      for (let cycle = 0; cycle < 10; cycle++) {
        // Allocation phase
        const largeData = Array(1000).fill(null).map((_, i) => ({
          ...testFixtures.issues.open,
          id: cycle * 1000 + i,
          body: new Array(500).fill('data').join(''), // Large data
        }));
        
        mockOctokit.issues.listForRepo.mockResolvedValue({ data: largeData });

        // Process data
        for (let i = 0; i < 10; i++) {
          await listIssues.handler({
            owner: 'test-owner',
            repo: 'test-repo',
            state: 'all',
          });
        }

        // Force GC between cycles if available
        if (global.gc) {
          global.gc();
        }
      }

      profiler.takeSnapshot('after_rapid_alloc');
      const memoryIncrease = profiler.getMemoryIncrease('before_rapid_alloc', 'after_rapid_alloc');

      expect(memoryIncrease.heapUsed).toBeLessThan(MEMORY_THRESHOLDS.MAX_HEAP_INCREASE_MB);
    });
  });

  describe('Concurrent Operations Memory Impact', () => {
    it('should handle concurrent operations without excessive memory growth', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      const getRepo = repoTools.find(tool => tool.tool.name === 'get_repository');

      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [testFixtures.issues.open] });
      mockOctokit.repos.get.mockResolvedValue({ data: testFixtures.repositories.public });

      profiler.takeSnapshot('before_concurrent');

      // Run concurrent operations
      const concurrentPromises = Array(100).fill(null).map(async (_, i) => {
        if (i % 2 === 0) {
          return await listIssues.handler({
            owner: 'test-owner',
            repo: 'test-repo',
            state: 'all',
          });
        } else {
          return await getRepo.handler({
            owner: 'test-owner',
            repo: 'test-repo',
          });
        }
      });

      await Promise.all(concurrentPromises);

      profiler.takeSnapshot('after_concurrent');
      const memoryIncrease = profiler.getMemoryIncrease('before_concurrent', 'after_concurrent');

      expect(memoryIncrease.heapUsed).toBeLessThan(MEMORY_THRESHOLDS.MAX_HEAP_INCREASE_MB);
    });
  });

  describe('Long-Running Process Memory Stability', () => {
    it('should maintain stable memory usage over extended operations', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [testFixtures.issues.open] });

      const memoryReadings: number[] = [];
      const iterations = 1000;
      const sampleInterval = 100;

      profiler.takeSnapshot('long_running_start');

      for (let i = 0; i < iterations; i++) {
        await listIssues.handler({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'all',
        });

        // Sample memory periodically
        if (i % sampleInterval === 0) {
          if (global.gc) global.gc();
          memoryReadings.push(process.memoryUsage().heapUsed);
        }
      }

      profiler.takeSnapshot('long_running_end');

      // Check for memory stability (no continuous growth)
      if (memoryReadings.length >= 3) {
        const firstThird = memoryReadings.slice(0, Math.floor(memoryReadings.length / 3));
        const lastThird = memoryReadings.slice(-Math.floor(memoryReadings.length / 3));
        
        const avgFirst = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
        const avgLast = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;
        const memoryGrowth = (avgLast - avgFirst) / (1024 * 1024);

        expect(memoryGrowth).toBeLessThan(MEMORY_THRESHOLDS.MAX_HEAP_INCREASE_MB);
      }
    });
  });
});