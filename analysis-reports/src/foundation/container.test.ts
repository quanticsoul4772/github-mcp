/**
 * Tests for DI Container
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from './container.js';

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  it('should register and resolve a dependency', () => {
    const TOKEN = 'MY_SERVICE';
    const service = { greet: () => 'hello' };
    container.register(TOKEN, service);
    const resolved = container.resolve<typeof service>(TOKEN);
    expect(resolved.greet()).toBe('hello');
  });

  it('should register with Symbol token', () => {
    const TOKEN = Symbol('MY_SERVICE');
    container.register(TOKEN, 42);
    expect(container.resolve(TOKEN)).toBe(42);
  });

  it('should throw when resolving unregistered token', () => {
    expect(() => container.resolve('MISSING')).toThrow('Dependency not found');
  });

  it('should return true for registered token with has()', () => {
    container.register('X', 'value');
    expect(container.has('X')).toBe(true);
  });

  it('should return false for unregistered token with has()', () => {
    expect(container.has('MISSING')).toBe(false);
  });

  it('should clear all dependencies', () => {
    container.register('A', 1);
    container.register('B', 2);
    container.clear();
    expect(container.has('A')).toBe(false);
    expect(container.has('B')).toBe(false);
  });

  it('should overwrite a registration', () => {
    container.register('KEY', 'old');
    container.register('KEY', 'new');
    expect(container.resolve('KEY')).toBe('new');
  });
});
