import { describe, test, expect } from 'vitest';
import { TestGenerationAgent } from '../../agents/testing/test-generation.js';

describe('TestGenerationAgent Exports', () => {
  test('should export TestGenerationAgent class', () => {
    expect(TestGenerationAgent).toBeDefined();
    expect(typeof TestGenerationAgent).toBe('function');
    expect(TestGenerationAgent.name).toBe('TestGenerationAgent');
  });

  test('should be instantiable', () => {
    const agent = new TestGenerationAgent();
    expect(agent).toBeInstanceOf(TestGenerationAgent);
    expect(agent).toHaveProperty('name');
    expect(agent).toHaveProperty('version');
    expect(agent).toHaveProperty('description');
  });

  test('should have required agent interface methods', () => {
    const agent = new TestGenerationAgent();
    
    expect(typeof agent.analyze).toBe('function');
    expect(typeof agent.canHandle).toBe('function');
    expect(typeof agent.getDependencies).toBe('function');
  });

  test('should be importable from main index', async () => {
    // Test that the agent can be imported through the main index
    const { TestGenerationAgent: ImportedAgent } = await import('../../agents/index.js');
    expect(ImportedAgent).toBeDefined();
    expect(ImportedAgent).toBe(TestGenerationAgent);
  });
});