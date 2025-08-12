/**
 * Load Testing Suite
 * Comprehensive load tests for GitHub MCP Server operations
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createIssueTools } from '../../tools/issues.js';
import { createRepositoryTools } from '../../tools/repositories.js';
import { createMockOctokit } from '../mocks/octokit.js';
import { testFixtures } from '../fixtures/test-data.js';
import { 
  LoadTestRunner, 
  MemoryMonitor,
  CircuitBreakerTester,
  RegressionDetector,
  LoadTestConfig,
  LoadTestResult 
} from './load-test-runner.js';
import { ReliabilityManager, RetryManager, ConsoleTelemetry } from '../../reliability.js';

describe('Load Testing Suite', () => {
  let mockOctokit: any;
  let issueTools: any[];
  let repoTools: any[];
  let reliabilityManager: ReliabilityManager;
  let loadTestRunner: LoadTestRunner;

  beforeEach(() => {
    mockOctokit = createMockOctokit();
    issueTools = createIssueTools(mockOctokit, false);
    repoTools = createRepositoryTools(mockOctokit, false);
    
    const telemetry = new ConsoleTelemetry(false); // Quiet for load tests
    const retryManager = new RetryManager();
    reliabilityManager = new ReliabilityManager(retryManager, telemetry);
    
    loadTestRunner = new LoadTestRunner();
  });

  describe('API Operation Load Tests', () => {
    it('should handle sustained load on issue operations', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [testFixtures.issues.open] });

      const config: LoadTestConfig = {
        duration: 5000, // 5 seconds
        concurrency: 20, // 20 concurrent workers
        rampUpTime: 1000, // 1 second ramp up
      };

      const operation = () => listIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
      });

      const result = await loadTestRunner.runLoadTest(operation, config);

      expect(result.totalRequests).toBeGreaterThan(50); // Should process many requests
      expect(result.successfulRequests).toBe(result.totalRequests); // All should succeed
      expect(result.averageResponseTime).toBeLessThan(100); // Fast responses
      expect(result.requestsPerSecond).toBeGreaterThan(10); // Good throughput
      expect(result.failedRequests).toBe(0);
    });

    it('should handle high throughput repository operations', async () => {
      const getRepo = repoTools.find(tool => tool.tool.name === 'get_repository');
      mockOctokit.repos.get.mockResolvedValue({ data: testFixtures.repositories.public });

      const config: LoadTestConfig = {
        duration: 3000, // 3 seconds
        concurrency: 50, // High concurrency
        requestsPerSecond: 100, // Target 100 RPS
      };

      const operation = () => getRepo.handler({
        owner: 'test-owner',
        repo: 'test-repo',
      });

      const result = await loadTestRunner.runLoadTest(operation, config);

      expect(result.requestsPerSecond).toBeGreaterThan(80); // Close to target RPS
      expect(result.percentiles.p95).toBeLessThan(200); // 95% under 200ms
      expect(result.successfulRequests / result.totalRequests).toBeGreaterThan(0.99); // >99% success
    });

    it('should maintain performance under mixed workload', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      const getRepo = repoTools.find(tool => tool.tool.name === 'get_repository');
      
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [] });
      mockOctokit.repos.get.mockResolvedValue({ data: testFixtures.repositories.public });

      const mixedOperation = async () => {
        // Randomly choose operation type
        if (Math.random() < 0.7) {
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
      };

      const config: LoadTestConfig = {
        duration: 4000, // 4 seconds
        concurrency: 30,
      };

      const result = await loadTestRunner.runLoadTest(mixedOperation, config);

      expect(result.averageResponseTime).toBeLessThan(150);
      expect(result.percentiles.p99).toBeLessThan(500);
      expect(result.successfulRequests).toBeGreaterThan(result.totalRequests * 0.95);
    });
  });

  describe('Memory Usage Under Load', () => {
    it('should maintain stable memory usage during sustained load', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      
      // Generate varied responses to prevent caching
      let requestCount = 0;
      mockOctokit.issues.listForRepo.mockImplementation(() => {
        requestCount++;
        return Promise.resolve({ 
          data: Array(10).fill(null).map((_, i) => ({
            ...testFixtures.issues.open,
            id: requestCount * 10 + i,
            number: requestCount * 10 + i,
          }))
        });
      });

      const memoryMonitor = new MemoryMonitor();
      memoryMonitor.startMonitoring(500); // Monitor every 500ms

      const config: LoadTestConfig = {
        duration: 6000, // 6 seconds for memory monitoring
        concurrency: 25,
      };

      const operation = () => listIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
      });

      await loadTestRunner.runLoadTest(operation, config);

      memoryMonitor.stopMonitoring();
      const memoryReport = memoryMonitor.getReport();

      // Memory should not grow excessively
      expect(memoryReport.memoryGrowth).toBeLessThan(100); // Less than 100MB growth
      expect(memoryReport.peakHeapUsed).toBeLessThan(500); // Less than 500MB peak
      expect(memoryReport.samples).toBeGreaterThan(5); // Should have multiple samples
    });

    it('should handle garbage collection during load', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      
      // Create memory pressure with large responses
      mockOctokit.issues.listForRepo.mockResolvedValue({ 
        data: Array(1000).fill(testFixtures.issues.open)
      });

      const memoryBefore = process.memoryUsage();
      
      const config: LoadTestConfig = {
        duration: 3000,
        concurrency: 15,
      };

      const operation = () => listIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
      });

      await loadTestRunner.runLoadTest(operation, config);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryAfter = process.memoryUsage();
      const memoryIncrease = (memoryAfter.heapUsed - memoryBefore.heapUsed) / (1024 * 1024);

      // After GC, memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(200); // Less than 200MB permanent increase
    });
  });

  describe('Circuit Breaker Under Load', () => {
    it('should handle circuit breaker activation during load', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      
      const operation = () => reliabilityManager.executeWithReliability(
        'load_test_operation',
        () => listIssues.handler({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'all',
        })
      );

      const config: LoadTestConfig = {
        duration: 4000,
        concurrency: 20,
      };

      const result = await CircuitBreakerTester.testCircuitBreakerUnderLoad(
        operation,
        0.3, // 30% failure rate to trigger circuit breaker
        config
      );

      expect(result.loadTestResult.totalRequests).toBeGreaterThan(20);
      expect(result.loadTestResult.failedRequests).toBeGreaterThan(0);
      expect(result.circuitBreakerTrips).toBeGreaterThan(0); // Should have circuit breaker activations
    });

    it('should recover from circuit breaker trips', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      
      let requestCount = 0;
      mockOctokit.issues.listForRepo.mockImplementation(() => {
        requestCount++;
        // Fail for first half of test, succeed for second half
        if (requestCount <= 50) {
          throw new Error('Simulated API failure');
        }
        return Promise.resolve({ data: [testFixtures.issues.open] });
      });

      const operation = () => reliabilityManager.executeWithReliability(
        'recovery_test_operation',
        () => listIssues.handler({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'all',
        })
      );

      const config: LoadTestConfig = {
        duration: 8000, // Longer test for recovery
        concurrency: 10,
      };

      const result = await loadTestRunner.runLoadTest(operation, config);

      // Should have both failures and successes
      expect(result.totalRequests).toBeGreaterThan(50);
      expect(result.successfulRequests).toBeGreaterThan(0);
      expect(result.failedRequests).toBeGreaterThan(0);
      
      // Later requests should succeed as system recovers
      expect(result.successfulRequests / result.totalRequests).toBeGreaterThan(0.2);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      const detector = new RegressionDetector();

      // Baseline: Fast responses
      mockOctokit.issues.listForRepo.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: [] }), 10))
      );

      const baselineConfig: LoadTestConfig = {
        duration: 2000,
        concurrency: 10,
      };

      const operation = () => listIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
      });

      const baselineResult = await loadTestRunner.runLoadTest(operation, baselineConfig);
      detector.setBaseline(baselineResult);

      // Current: Slow responses (regression)
      mockOctokit.issues.listForRepo.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: [] }), 100))
      );

      const currentResult = await loadTestRunner.runLoadTest(operation, baselineConfig);
      const regressionAnalysis = detector.detectRegression(currentResult, 0.5); // 50% threshold

      expect(regressionAnalysis.hasRegression).toBe(true);
      expect(regressionAnalysis.regressions.length).toBeGreaterThan(0);
      expect(regressionAnalysis.regressions[0].percentageIncrease).toBeGreaterThan(0.5);
    });

    it('should not flag normal variations as regressions', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      const detector = new RegressionDetector();

      // Baseline
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [] });

      const config: LoadTestConfig = {
        duration: 2000,
        concurrency: 10,
      };

      const operation = () => listIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
      });

      const baselineResult = await loadTestRunner.runLoadTest(operation, config);
      detector.setBaseline(baselineResult);

      // Current: Similar performance (slight variation)
      const currentResult = await loadTestRunner.runLoadTest(operation, config);
      const regressionAnalysis = detector.detectRegression(currentResult, 0.5); // 50% threshold

      expect(regressionAnalysis.hasRegression).toBe(false);
      expect(regressionAnalysis.regressions.length).toBe(0);
    });
  });

  describe('Stress Testing Edge Cases', () => {
    it('should handle extreme concurrency levels', async () => {
      const getRepo = repoTools.find(tool => tool.tool.name === 'get_repository');
      mockOctokit.repos.get.mockResolvedValue({ data: testFixtures.repositories.public });

      const config: LoadTestConfig = {
        duration: 2000, // Shorter duration for extreme concurrency
        concurrency: 200, // Very high concurrency
        rampUpTime: 500,
      };

      const operation = () => getRepo.handler({
        owner: 'test-owner',
        repo: 'test-repo',
      });

      const result = await loadTestRunner.runLoadTest(operation, config);

      // Should handle high concurrency without crashing
      expect(result.totalRequests).toBeGreaterThan(100);
      expect(result.successfulRequests / result.totalRequests).toBeGreaterThan(0.8); // 80% success rate
    });

    it('should handle rapid request bursts', async () => {
      const listIssues = issueTools.find(tool => tool.tool.name === 'list_issues');
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [] });

      const config: LoadTestConfig = {
        duration: 1000, // Very short duration
        concurrency: 100, // High concurrency
        rampUpTime: 100, // Very fast ramp up
      };

      const operation = () => listIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
      });

      const result = await loadTestRunner.runLoadTest(operation, config);

      expect(result.requestsPerSecond).toBeGreaterThan(50); // High RPS
      expect(result.percentiles.p99).toBeLessThan(1000); // Response times under control
    });
  });
});