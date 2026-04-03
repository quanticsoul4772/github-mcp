/**
 * Tests for DefaultAgentRegistry
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultAgentRegistry } from './agent-registry.js';

function makeAgent(name: string, priority = 1, deps: string[] = [], handles = true): any {
  return {
    name,
    version: '1.0.0',
    getPriority: () => priority,
    getDependencies: () => deps,
    canHandle: () => handles,
  };
}

describe('DefaultAgentRegistry', () => {
  let registry: DefaultAgentRegistry;

  beforeEach(() => {
    registry = new DefaultAgentRegistry();
  });

  describe('register', () => {
    it('should register an agent', () => {
      registry.register(makeAgent('code-analysis'));
      expect(registry.hasAgent('code-analysis')).toBe(true);
      expect(registry.getAgentCount()).toBe(1);
    });

    it('should throw when registering duplicate agent name', () => {
      registry.register(makeAgent('code-analysis'));
      expect(() => registry.register(makeAgent('code-analysis'))).toThrow(
        "Agent with name 'code-analysis' is already registered"
      );
    });
  });

  describe('unregister', () => {
    it('should unregister a registered agent', () => {
      registry.register(makeAgent('code-analysis'));
      registry.unregister('code-analysis');
      expect(registry.hasAgent('code-analysis')).toBe(false);
      expect(registry.getAgentCount()).toBe(0);
    });

    it('should throw when unregistering an agent that is not registered', () => {
      expect(() => registry.unregister('nonexistent')).toThrow(
        "Agent with name 'nonexistent' is not registered"
      );
    });
  });

  describe('getAgent', () => {
    it('should return the agent by name', () => {
      const agent = makeAgent('security');
      registry.register(agent);
      expect(registry.getAgent('security')).toBe(agent);
    });

    it('should return undefined for unknown agent', () => {
      expect(registry.getAgent('unknown')).toBeUndefined();
    });
  });

  describe('getAllAgents', () => {
    it('should return all registered agents', () => {
      registry.register(makeAgent('a'));
      registry.register(makeAgent('b'));
      expect(registry.getAllAgents()).toHaveLength(2);
    });

    it('should return empty array when no agents registered', () => {
      expect(registry.getAllAgents()).toEqual([]);
    });
  });

  describe('getAgentsByPriority', () => {
    it('should return agents sorted by priority ascending', () => {
      registry.register(makeAgent('low', 10));
      registry.register(makeAgent('high', 1));
      const sorted = registry.getAgentsByPriority();
      expect(sorted[0].name).toBe('high');
      expect(sorted[1].name).toBe('low');
    });
  });

  describe('clear', () => {
    it('should remove all agents', () => {
      registry.register(makeAgent('a'));
      registry.register(makeAgent('b'));
      registry.clear();
      expect(registry.getAgentCount()).toBe(0);
      expect(registry.getAllAgents()).toEqual([]);
    });

    it('should be safe to call on empty registry', () => {
      expect(() => registry.clear()).not.toThrow();
    });
  });

  describe('getAgentsForFileType', () => {
    it('should return agents that can handle the file type', () => {
      registry.register(makeAgent('yes', 1, [], true));
      registry.register(makeAgent('no', 1, [], false));
      const result = registry.getAgentsForFileType('ts');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('yes');
    });

    it('should return empty array when no agents can handle the file type', () => {
      registry.register(makeAgent('no', 1, [], false));
      expect(registry.getAgentsForFileType('ts')).toEqual([]);
    });
  });

  describe('validateDependencies', () => {
    it('should return valid=true when all dependencies are met', () => {
      const depAgent = makeAgent('dep');
      const mainAgent = makeAgent('main', 1, ['dep']);
      registry.register(depAgent);
      registry.register(mainAgent);
      const result = registry.validateDependencies();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing dependencies', () => {
      const mainAgent = makeAgent('main', 1, ['missing-dep']);
      registry.register(mainAgent);
      const result = registry.validateDependencies();
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('missing-dep');
    });
  });

  describe('getExecutionOrder', () => {
    it('should return agents in dependency-resolved order', () => {
      const dep = makeAgent('dep', 1, []);
      const main = makeAgent('main', 2, ['dep']);
      registry.register(dep);
      registry.register(main);
      const order = registry.getExecutionOrder();
      const names = order.map(a => a.name);
      expect(names.indexOf('dep')).toBeLessThan(names.indexOf('main'));
    });

    it('should throw on circular dependency', () => {
      const a = makeAgent('a', 1, ['b']);
      const b = makeAgent('b', 2, ['a']);
      registry.register(a);
      registry.register(b);
      expect(() => registry.getExecutionOrder()).toThrow('Circular dependency');
    });

    it('should return empty array for empty registry', () => {
      expect(registry.getExecutionOrder()).toEqual([]);
    });
  });
});
