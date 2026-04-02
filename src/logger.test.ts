/**
 * Tests for Logger
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Logger, LogLevel, logger } from './logger.js';

describe('Logger', () => {
  it('should be a singleton', () => {
    const a = Logger.getInstance();
    const b = Logger.getInstance();
    expect(a).toBe(b);
  });

  it('should generate unique correlation IDs', () => {
    const id1 = logger.generateCorrelationId();
    const id2 = logger.generateCorrelationId();
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it('should set and get log level', () => {
    const original = logger.getLogLevel();
    logger.setLogLevel(LogLevel.WARN);
    expect(logger.getLogLevel()).toBe(LogLevel.WARN);
    logger.setLogLevel(original); // restore
  });

  it('should log debug without throwing', () => {
    logger.setLogLevel(LogLevel.DEBUG);
    expect(() => logger.debug('debug message', { context: 'test' })).not.toThrow();
    logger.setLogLevel(LogLevel.INFO);
  });

  it('should log info without throwing', () => {
    expect(() => logger.info('info message')).not.toThrow();
  });

  it('should log warn without throwing', () => {
    expect(() => logger.warn('warn message', { key: 'value' })).not.toThrow();
  });

  it('should log error without throwing', () => {
    expect(() => logger.error('error message', {}, new Error('test'))).not.toThrow();
  });

  it('should create a child logger with context', () => {
    const child = logger.child({ correlationId: 'abc123', operation: 'test' });
    expect(child).toBeDefined();
    expect(() => child.info('child message')).not.toThrow();
  });

  it('should create nested child logger', () => {
    const child = logger.child({ correlationId: 'abc' });
    const nested = child.child({ operation: 'nested' });
    expect(nested).toBeDefined();
    expect(() => nested.debug('nested message')).not.toThrow();
  });
});
