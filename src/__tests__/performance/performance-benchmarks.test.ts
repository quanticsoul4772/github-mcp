import { Octokit } from '@octokit/rest';
/**
 * Performance Benchmarks Test Suite
 * Tests performance metrics, response times, memory usage, and concurrent processing
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performance } from 'perf_hooks';
import { createIssueTools } from '../../tools/issues.js';
import { createRepositoryTools } from '../../tools/repositories.js';
import { createPullRequestTools } from '../../tools/pull-requests.js';
import { createMockOctokit } from '../mocks/octokit.js';
import { testFixtures } from '../fixtures/test-data.js';

const PERFORMANCE_THRESHOLDS = {
  SIMPLE_QUERY_MAX_MS: 200,
  CONCURRENT_REQUESTS_MAX_MS: 5000,
  MEMORY_INCREASE_MAX_MB: 50,
  LARGE_DATASET_MAX_MS: 2000,
};

describe('Performance Benchmarks', () => {
  let mockOctokit: any;
  let issueTools: any[];
  let repoTools: any[];
  let prTools: any[];
  let memoryBefore: number;

  beforeEach(() => {
    mockOctokit = createMockOctokit();
    issueTools = createIssueTools(mockOctokit, false);
    repoTools = createRepositoryTools(mockOctokit, false);
    prTools = createPullRequestTools(mockOctokit, false);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    memoryBefore = process.memoryUsage().heapUsed;
  });

  afterEach(() => {
    // Check for memory leaks after each test
    if (global.gc) {
      global.gc();
    }
    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryDiff = (memoryAfter - memoryBefore) / (1024 * 1024);
    
    if (memoryDiff > PERFORMANCE_THRESHOLDS.MEMORY_INCREASE_MAX_MB) {
      console.warn(`Memory increase of ${memoryDiff.toFixed(2)}MB detected (threshold: ${PERFORMANCE_THRESHOLDS.MEMORY_INCREASE_MAX_MB}MB)`);
    }
  });

  describe('Simple Query Response Times', () => {
    it('should handle basic issue listing under 200ms', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [testFixtures.issues.open] });

      const startTime = performance.now();
      await listIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
      });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SIMPLE_QUERY_MAX_MS);
    });

    it('should handle file content queries under 200ms', async () => {
      const getFileContents = repoTools.find(tool => tool.tool.name === 'get_file_contents');
      mockOctokit.repos.getContent.mockResolvedValue({ data: { 
        type: 'file', 
        content: Buffer.from('test content').toString('base64'),
        name: 'README.md',
        path: 'README.md',
        size: 100,
        sha: 'abc123'
      }});

      const startTime = performance.now();
      await getFileContents.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'README.md',
      });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SIMPLE_QUERY_MAX_MS);
    });

    it('should handle PR listing under 200ms', async () => {
      const listPRs = prTools.find(tool => tool.tool.name === 'list_pull_requests');
      mockOctokit.pulls.list.mockResolvedValue({ data: [testFixtures.pullRequests.open] });

      const startTime = performance.now();
      await listPRs.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
      });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SIMPLE_QUERY_MAX_MS);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle 100 concurrent API calls efficiently', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      
      // Mock API to return quickly
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [] });

      const concurrentRequests = 100;
      const requests = Array(concurrentRequests).fill(null).map(() => 
        listIssues.handler({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'all',
        })
      );

      const startTime = performance.now();
      await Promise.all(requests);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_REQUESTS_MAX_MS);
      expect(mockOctokit.issues.listForRepo).toHaveBeenCalledTimes(concurrentRequests);
    });

    it('should handle concurrent requests with different operations', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      const getFileContents = repoTools.find(tool => tool.tool.name === 'get_file_contents');
      const listPRs = prTools.find(tool => tool.tool.name === 'list_pull_requests');
      
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [] });
      mockOctokit.repos.get.mockResolvedValue({ data: testFixtures.repositories.public });
      mockOctokit.rest.pulls.list.mockResolvedValue({ data: [] });

      const requests = [
        ...Array(30).fill(null).map(() => listIssues.handler({
          owner: 'test-owner', repo: 'test-repo', state: 'all'
        })),
        ...Array(30).fill(null).map(() => mockOctokit.repos.get({
          owner: 'test-owner', repo: 'test-repo'
        })),
        ...Array(40).fill(null).map(() => listPRs.handler({
          owner: 'test-owner', repo: 'test-repo', state: 'all'
        })),
      ];

      const startTime = performance.now();
      await Promise.all(requests);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_REQUESTS_MAX_MS);
    });
  });

  describe('Large Dataset Processing', () => {
    it('should process large repository data (10k+ files) efficiently', async () => {
      const getRepoContents = repoTools.find(tool => tool.tool.name === 'get_file_contents');
      
      // Generate large dataset
      const largeFileList = Array(10000).fill(null).map((_, index) => ({
        name: `file${index}.ts`,
        path: `src/file${index}.ts`,
        type: 'file',
        size: 1024,
        sha: `sha${index}`,
        url: `https://api.github.com/repos/test/test/contents/src/file${index}.ts`,
        html_url: `https://github.com/test/test/blob/main/src/file${index}.ts`,
        git_url: `https://api.github.com/repos/test/test/git/blobs/sha${index}`,
        download_url: `https://raw.githubusercontent.com/test/test/main/src/file${index}.ts`,
        _links: {
          self: `https://api.github.com/repos/test/test/contents/src/file${index}.ts`,
          git: `https://api.github.com/repos/test/test/git/blobs/sha${index}`,
          html: `https://github.com/test/test/blob/main/src/file${index}.ts`,
        }
      }));

      mockOctokit.repos.getContent.mockResolvedValue({ data: largeFileList });

      const startTime = performance.now();
      const result = await getRepoContents.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'src',
      });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_DATASET_MAX_MS);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(10000);
    });

    it('should handle large issue lists efficiently', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      
      // Generate large issue list
      const largeIssueList = Array(1000).fill(null).map((_, index) => ({
        ...testFixtures.issues.open,
        id: index + 1,
        number: index + 1,
        title: `Issue ${index + 1}`,
        body: `This is issue number ${index + 1} with some content`.repeat(10),
      }));

      mockOctokit.issues.listForRepo.mockResolvedValue({ data: largeIssueList });

      const startTime = performance.now();
      const result = await listIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
      });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_DATASET_MAX_MS);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1000);
      expect(result[999].title).toBe('Issue 1000');
    });
  });

  describe('Memory Usage Tests', () => {
    it('should maintain stable memory usage during repeated operations', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [testFixtures.issues.open] });

      const iterations = 1000;
      const memoryReadings: number[] = [];

      for (let i = 0; i < iterations; i++) {
        await listIssues.handler({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'all',
        });

        if (i % 100 === 0) {
          if (global.gc) global.gc();
          memoryReadings.push(process.memoryUsage().heapUsed);
        }
      }

      // Check that memory usage is stable (not continuously increasing)
      const memoryIncrease = memoryReadings[memoryReadings.length - 1] - memoryReadings[0];
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      
      expect(memoryIncreaseMB).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_INCREASE_MAX_MB);
    });

    it('should not leak memory when handling errors', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      
      // Mock to throw errors
      mockOctokit.issues.listForRepo.mockRejectedValue(new Error('API Error'));

      const iterations = 500;
      let errorCount = 0;

      const memoryBefore = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
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

      if (global.gc) global.gc();
      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = (memoryAfter - memoryBefore) / (1024 * 1024);

      expect(errorCount).toBe(iterations);
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_INCREASE_MAX_MB);
    });
  });

  describe('Timeout Handling', () => {
    it('should handle timeout scenarios gracefully', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      
      // Mock to simulate timeout
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockOctokit.issues.listForRepo.mockRejectedValue(timeoutError);

      const startTime = performance.now();
      
      await expect(listIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
      })).rejects.toThrow('Request timeout');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should fail quickly, not hang
      expect(duration).toBeLessThan(1000);
    });

    it('should handle slow responses appropriately', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      
      // Mock to simulate slow response
      mockOctokit.issues.listForRepo.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ data: [testFixtures.issues.open] }), 1500)
        )
      );

      const startTime = performance.now();
      const result = await listIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
      });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBeTruthy();
      expect(duration).toBeGreaterThan(1400); // Should wait for slow response
      expect(duration).toBeLessThan(2000); // But not hang indefinitely
    });
  });

  describe('Performance Regression Detection', () => {
    it('should maintain consistent performance across multiple runs', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [testFixtures.issues.open] });

      const runs = 50;
      const durations: number[] = [];

      for (let i = 0; i < runs; i++) {
        const startTime = performance.now();
        await listIssues.handler({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'all',
        });
        const endTime = performance.now();
        durations.push(endTime - startTime);
      }

      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const standardDeviation = Math.sqrt(
        durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length
      );

      // Performance should be consistent
      expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.SIMPLE_QUERY_MAX_MS);
      expect(maxDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.SIMPLE_QUERY_MAX_MS * 2);
      
      // For very fast operations (< 10ms), allow higher variance due to system noise
      // For slower operations, enforce stricter variance limits
      const varianceThreshold = avgDuration < 10 ? 2.0 : 0.5;
      expect(standardDeviation).toBeLessThan(avgDuration * varianceThreshold);
    });
  });
});