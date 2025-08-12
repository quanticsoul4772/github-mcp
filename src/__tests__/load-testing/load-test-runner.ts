/**
 * Load Testing Runner
 * Utilities for running performance benchmarks and load tests
 */
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

export interface LoadTestConfig {
  duration: number; // Duration in milliseconds
  concurrency: number; // Number of concurrent operations
  rampUpTime?: number; // Time to reach full concurrency
  requestsPerSecond?: number; // Target RPS (optional)
}

export interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  errors: Array<{
    error: Error;
    count: number;
  }>;
  duration: number;
}

export interface RequestMetrics {
  startTime: number;
  endTime: number;
  success: boolean;
  error?: Error;
}

export class LoadTestRunner extends EventEmitter {
  private metrics: RequestMetrics[] = [];
  private errorCounts = new Map<string, number>();

  async runLoadTest<T>(
    operation: () => Promise<T>,
    config: LoadTestConfig
  ): Promise<LoadTestResult> {
    this.metrics = [];
    this.errorCounts.clear();

    const startTime = performance.now();
    const promises: Promise<void>[] = [];
    const endTime = startTime + config.duration;

    // Ramp up workers
    const rampUpTime = config.rampUpTime || 0;
    const workersToAdd = config.concurrency;
    const rampUpInterval = rampUpTime > 0 ? rampUpTime / workersToAdd : 0;

    for (let i = 0; i < workersToAdd; i++) {
      const delay = i * rampUpInterval;
      
      promises.push(
        this.createWorker(operation, startTime + delay, endTime, config.requestsPerSecond)
      );
    }

    await Promise.all(promises);

    const totalDuration = performance.now() - startTime;
    return this.calculateResults(totalDuration);
  }

  private async createWorker<T>(
    operation: () => Promise<T>,
    workerStartTime: number,
    endTime: number,
    requestsPerSecond?: number
  ): Promise<void> {
    // Wait for ramp-up delay
    const currentTime = performance.now();
    if (workerStartTime > currentTime) {
      await this.sleep(workerStartTime - currentTime);
    }

    const requestInterval = requestsPerSecond ? 1000 / requestsPerSecond : 0;
    let lastRequestTime = performance.now();

    while (performance.now() < endTime) {
      // Throttle requests if RPS is specified
      if (requestInterval > 0) {
        const timeSinceLastRequest = performance.now() - lastRequestTime;
        if (timeSinceLastRequest < requestInterval) {
          await this.sleep(requestInterval - timeSinceLastRequest);
        }
      }

      lastRequestTime = performance.now();
      await this.executeRequest(operation);
    }
  }

  private async executeRequest<T>(operation: () => Promise<T>): Promise<void> {
    const startTime = performance.now();
    let success = false;
    let error: Error | undefined;

    try {
      await operation();
      success = true;
    } catch (err) {
      success = false;
      error = err as Error;
      
      const errorKey = error.message || 'Unknown Error';
      this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    }

    const endTime = performance.now();
    
    this.metrics.push({
      startTime,
      endTime,
      success,
      error
    });

    // Emit progress events
    this.emit('request', { success, duration: endTime - startTime, error });
  }

  private calculateResults(totalDuration: number): LoadTestResult {
    const responseTimes = this.metrics.map(m => m.endTime - m.startTime);
    responseTimes.sort((a, b) => a - b);

    const successfulRequests = this.metrics.filter(m => m.success).length;
    const failedRequests = this.metrics.length - successfulRequests;

    const errors = Array.from(this.errorCounts.entries()).map(([message, count]) => ({
      error: new Error(message),
      count
    }));

    return {
      totalRequests: this.metrics.length,
      successfulRequests,
      failedRequests,
      averageResponseTime: responseTimes.length > 0 
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
        : 0,
      minResponseTime: responseTimes[0] || 0,
      maxResponseTime: responseTimes[responseTimes.length - 1] || 0,
      requestsPerSecond: this.metrics.length / (totalDuration / 1000),
      percentiles: {
        p50: this.calculatePercentile(responseTimes, 0.5),
        p90: this.calculatePercentile(responseTimes, 0.9),
        p95: this.calculatePercentile(responseTimes, 0.95),
        p99: this.calculatePercentile(responseTimes, 0.99),
      },
      errors,
      duration: totalDuration
    };
  }

  private calculatePercentile(sortedTimes: number[], percentile: number): number {
    if (sortedTimes.length === 0) return 0;
    const rawIndex = Math.ceil(sortedTimes.length * percentile) - 1;
    const index = Math.min(sortedTimes.length - 1, Math.max(0, rawIndex));
    return sortedTimes[index];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Memory monitoring utilities
 */
export class MemoryMonitor {
  private samples: Array<{ timestamp: number; usage: NodeJS.MemoryUsage }> = [];
  private intervalId?: NodeJS.Timeout;

  startMonitoring(intervalMs: number = 1000): void {
    this.samples = [];
    this.intervalId = setInterval(() => {
      this.samples.push({
        timestamp: Date.now(),
        usage: process.memoryUsage()
      });
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  getReport(): {
    peakHeapUsed: number;
    averageHeapUsed: number;
    memoryGrowth: number;
    samples: number;
  } {
    if (this.samples.length === 0) {
      return {
        peakHeapUsed: 0,
        averageHeapUsed: 0,
        memoryGrowth: 0,
        samples: 0
      };
    }

    const heapUsages = this.samples.map(s => s.usage.heapUsed);
    const peakHeapUsed = Math.max(...heapUsages);
    const averageHeapUsed = heapUsages.reduce((sum, usage) => sum + usage, 0) / heapUsages.length;
    const memoryGrowth = heapUsages[heapUsages.length - 1] - heapUsages[0];

    return {
      peakHeapUsed: peakHeapUsed / (1024 * 1024), // MB
      averageHeapUsed: averageHeapUsed / (1024 * 1024), // MB
      memoryGrowth: memoryGrowth / (1024 * 1024), // MB
      samples: this.samples.length
    };
  }

  getSamples(): Array<{ timestamp: number; usage: NodeJS.MemoryUsage }> {
    return [...this.samples];
  }
}

/**
 * Circuit breaker load testing utilities
 */
export class CircuitBreakerTester {
  static async testCircuitBreakerUnderLoad<T>(
    operation: () => Promise<T>,
    failureRate: number, // 0.0 to 1.0
    loadConfig: LoadTestConfig
  ): Promise<{
    loadTestResult: LoadTestResult;
    circuitBreakerTrips: number;
    recoveryAttempts: number;
  }> {
    let circuitBreakerTrips = 0;
    let recoveryAttempts = 0;
    
    const wrappedOperation = async (): Promise<T> => {
      // Simulate failures based on failure rate
      if (Math.random() < failureRate) {
        const error = new Error('Simulated failure for circuit breaker testing');
        throw error;
      }
      
      return await operation();
    };

    const runner = new LoadTestRunner();
    
    runner.on('request', ({ success, error }) => {
      if (!success && error?.message.includes('Circuit breaker is open')) {
        circuitBreakerTrips++;
      }
      if (!success && error?.message.includes('half-open')) {
        recoveryAttempts++;
      }
    });

    const loadTestResult = await runner.runLoadTest(wrappedOperation, loadConfig);

    return {
      loadTestResult,
      circuitBreakerTrips,
      recoveryAttempts
    };
  }
}

/**
 * Performance regression detector
 */
export class RegressionDetector {
  private baselineMetrics: LoadTestResult | null = null;

  setBaseline(metrics: LoadTestResult): void {
    this.baselineMetrics = { ...metrics };
  }

  detectRegression(currentMetrics: LoadTestResult, threshold: number = 0.2): {
    hasRegression: boolean;
    regressions: Array<{
      metric: string;
      baselineValue: number;
      currentValue: number;
      percentageIncrease: number;
    }>;
  } {
    if (!this.baselineMetrics) {
      return { hasRegression: false, regressions: [] };
    }

    const metricsToCheck = [
      { key: 'averageResponseTime', name: 'Average Response Time' },
      { key: 'maxResponseTime', name: 'Max Response Time' },
      { key: 'percentiles.p95', name: '95th Percentile Response Time' },
      { key: 'percentiles.p99', name: '99th Percentile Response Time' }
    ];

    const regressions: Array<{
      metric: string;
      baselineValue: number;
      currentValue: number;
      percentageIncrease: number;
    }> = [];

    for (const metric of metricsToCheck) {
      const baselineValue = this.getNestedProperty(this.baselineMetrics, metric.key);
      const currentValue = this.getNestedProperty(currentMetrics, metric.key);
      
      if (baselineValue > 0) {
        const percentageIncrease = (currentValue - baselineValue) / baselineValue;
        
        if (percentageIncrease > threshold) {
          regressions.push({
            metric: metric.name,
            baselineValue,
            currentValue,
            percentageIncrease
          });
        }
      }
    }

    return {
      hasRegression: regressions.length > 0,
      regressions
    };
  }

  private getNestedProperty(obj: any, path: string): number {
    return path.split('.').reduce((current, key) => current?.[key], obj) || 0;
  }
}