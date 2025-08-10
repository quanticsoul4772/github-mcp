import { IContainer } from './interfaces.js';

/**
 * Simple dependency injection container
 */
export class Container implements IContainer {
  private dependencies = new Map<symbol | string, any>();

  register<T>(token: symbol | string, implementation: T): void {
    this.dependencies.set(token, implementation);
  }

  resolve<T>(token: symbol | string): T {
    const dependency = this.dependencies.get(token);
    if (!dependency) {
      throw new Error(`Dependency not found for token: ${token.toString()}`);
    }
    return dependency;
  }

  /**
   * Check if a dependency is registered
   */
  has(token: symbol | string): boolean {
    return this.dependencies.has(token);
  }

  /**
   * Clear all dependencies (useful for testing)
   */
  clear(): void {
    this.dependencies.clear();
  }
}