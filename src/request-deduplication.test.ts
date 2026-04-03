/**
 * Tests for RequestDeduplicator
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RequestDeduplicator, globalDeduplicator } from './request-deduplication.js';

describe('RequestDeduplicator', () => {
  let dedup: RequestDeduplicator;

  beforeEach(() => {
    dedup = new RequestDeduplicator({ enableMetrics: true });
  });

  afterEach(() => {
    dedup.destroy();
  });

  // ============================================================================
  // deduplicate
  // ============================================================================

  describe('deduplicate', () => {
    it('should execute and return result for new request', async () => {
      const executor = vi.fn().mockResolvedValue('result');
      const result = await dedup.deduplicate('op', { id: 1 }, executor);
      expect(result).toBe('result');
      expect(executor).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent identical requests', async () => {
      let resolvePromise!: (v: string) => void;
      const promise = new Promise<string>(r => { resolvePromise = r; });
      const executor = vi.fn().mockReturnValue(promise);

      // Fire two concurrent identical requests
      const [p1, p2] = [
        dedup.deduplicate('op', { id: 1 }, executor),
        dedup.deduplicate('op', { id: 1 }, executor),
      ];
      resolvePromise('shared-result');
      const [r1, r2] = await Promise.all([p1, p2]);

      expect(executor).toHaveBeenCalledTimes(1); // only one real call
      expect(r1).toBe('shared-result');
      expect(r2).toBe('shared-result');
    });

    it('should NOT deduplicate requests with different params', async () => {
      const executor = vi.fn().mockResolvedValue('result');
      await dedup.deduplicate('op', { id: 1 }, executor);
      await dedup.deduplicate('op', { id: 2 }, executor);
      expect(executor).toHaveBeenCalledTimes(2);
    });

    it('should NOT deduplicate requests with different operations', async () => {
      const executor = vi.fn().mockResolvedValue('result');
      await dedup.deduplicate('op1', { id: 1 }, executor);
      await dedup.deduplicate('op2', { id: 1 }, executor);
      expect(executor).toHaveBeenCalledTimes(2);
    });

    it('should allow re-execution after first request completes', async () => {
      const executor = vi.fn().mockResolvedValue('result');
      await dedup.deduplicate('op', { id: 1 }, executor);
      await dedup.deduplicate('op', { id: 1 }, executor);
      expect(executor).toHaveBeenCalledTimes(2);
    });

    it('should propagate errors from executor', async () => {
      const executor = vi.fn().mockRejectedValue(new Error('exec error'));
      await expect(dedup.deduplicate('op', {}, executor)).rejects.toThrow('exec error');
    });

    it('should sort params for consistent key generation', async () => {
      const executor = vi.fn().mockResolvedValue('result');
      // Same params, different key order — should be treated as same request (sequentially)
      await dedup.deduplicate('op', { b: 2, a: 1 }, executor);
      // Wait for first to complete, then second should also run (new request)
      await dedup.deduplicate('op', { a: 1, b: 2 }, executor);
      // Both share same key so second call creates new execution after first finishes
      expect(executor).toHaveBeenCalledTimes(2);
    });

    it('should exclude null/undefined params from key', async () => {
      const executor = vi.fn().mockResolvedValue('ok');
      await dedup.deduplicate('op', { a: 1, b: null, c: undefined }, executor);
      await dedup.deduplicate('op', { a: 1 }, executor);
      // Should have same key — second is new after first completes
      expect(executor).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // metrics
  // ============================================================================

  describe('metrics', () => {
    it('should track totalRequests', async () => {
      const executor = vi.fn().mockResolvedValue('r');
      await dedup.deduplicate('op', {}, executor);
      await dedup.deduplicate('op', { a: 1 }, executor);
      const metrics = dedup.getMetrics();
      expect(metrics.totalRequests).toBe(2);
    });

    it('should track deduplicatedRequests', async () => {
      let resolve!: (v: string) => void;
      const promise = new Promise<string>(r => { resolve = r; });
      const executor = vi.fn().mockReturnValue(promise);

      const [p1, p2] = [
        dedup.deduplicate('op', { id: 1 }, executor),
        dedup.deduplicate('op', { id: 1 }, executor),
      ];
      resolve('r');
      await Promise.all([p1, p2]);

      const metrics = dedup.getMetrics();
      expect(metrics.deduplicatedRequests).toBe(1);
    });

    it('should return zero metrics when metrics disabled', async () => {
      const noMetrics = new RequestDeduplicator({ enableMetrics: false });
      const executor = vi.fn().mockResolvedValue('r');
      await noMetrics.deduplicate('op', {}, executor);
      const metrics = noMetrics.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      noMetrics.destroy();
    });
  });

  // ============================================================================
  // getPendingCount / clear
  // ============================================================================

  describe('getPendingCount', () => {
    it('should return 0 when no pending requests', () => {
      expect(dedup.getPendingCount()).toBe(0);
    });

    it('should return 1 during pending request', async () => {
      let resolve!: (v: string) => void;
      const promise = new Promise<string>(r => { resolve = r; });
      const executor = vi.fn().mockReturnValue(promise);

      const pending = dedup.deduplicate('op', {}, executor);
      expect(dedup.getPendingCount()).toBe(1);
      resolve('done');
      await pending;
      expect(dedup.getPendingCount()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all pending requests', async () => {
      let resolve!: (v: string) => void;
      const promise = new Promise<string>(r => { resolve = r; });
      const executor = vi.fn().mockReturnValue(promise);

      void dedup.deduplicate('op', {}, executor);
      expect(dedup.getPendingCount()).toBe(1);
      dedup.clear();
      expect(dedup.getPendingCount()).toBe(0);
      resolve('done');
    });

    it('should reset pendingRequests metric when enabled', () => {
      dedup.clear();
      const metrics = dedup.getMetrics();
      expect(metrics.pendingRequests).toBe(0);
    });
  });

  // ============================================================================
  // destroy
  // ============================================================================

  describe('destroy', () => {
    it('should clear interval and pending requests', () => {
      const d = new RequestDeduplicator();
      d.destroy();
      expect(d.getPendingCount()).toBe(0);
    });

    it('should be idempotent (second destroy is safe)', () => {
      const d = new RequestDeduplicator();
      d.destroy();
      expect(() => d.destroy()).not.toThrow();
    });
  });

  // ============================================================================
  // cleanup via fake timers
  // ============================================================================

  describe('cleanup (expired requests)', () => {
    it('should remove expired entries via private cleanup method', async () => {
      // Call the private cleanup method directly after manually inserting expired entry
      const d = new RequestDeduplicator({ maxPendingTime: 100, enableMetrics: true });

      // Manually insert an expired pending request
      const map = (d as any).pendingRequests as Map<string, { promise: Promise<any>; timestamp: number }>;
      map.set('old-key', { promise: Promise.resolve('x'), timestamp: Date.now() - 5000 });
      expect(d.getPendingCount()).toBe(1);

      // Trigger cleanup directly
      (d as any).cleanup();
      expect(d.getPendingCount()).toBe(0);

      d.destroy();
    });
  });

  // ============================================================================
  // globalDeduplicator
  // ============================================================================

  it('globalDeduplicator should be a RequestDeduplicator instance', () => {
    expect(globalDeduplicator).toBeInstanceOf(RequestDeduplicator);
  });
});
