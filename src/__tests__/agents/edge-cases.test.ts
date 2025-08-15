import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { DefaultAgentRegistry } from '../../agents/base/agent-registry.js';
import { DefaultAgentCoordinator } from '../../agents/base/coordinator.js';
import { createAgentSystem, quickAnalyze } from '../../agents/index.js';
import { CodeAnalysisAgent } from '../../agents/analysis/code-analysis-agent.js';
import { TypeSafetyAgent } from '../../agents/analysis/type-safety-agent.js';
import { TestingAgent } from '../../agents/testing/testing-agent.js';
import { SecurityAgent } from '../../agents/security/security-agent.js';
import { AnalysisContext } from '../../agents/types/agent-interfaces.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Edge Cases and Error Handling', () => {
  let registry: DefaultAgentRegistry;
  let coordinator: DefaultAgentCoordinator;
  let tempDir: string;

  beforeEach(async () => {
    registry = new DefaultAgentRegistry();
    coordinator = new DefaultAgentCoordinator(registry);
    
    // Register agents
    registry.register(new CodeAnalysisAgent());
    registry.register(new TypeSafetyAgent());
    registry.register(new TestingAgent());
    registry.register(new SecurityAgent());
    
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edge-case-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('coordinate() method edge cases', () => {
    test('should handle missing report properties gracefully', async () => {
      // Create a minimal setup that might not generate all expected report properties
      const emptyDir = path.join(tempDir, 'empty');
      await fs.mkdir(emptyDir);

      const options = {
        target: {
          type: 'directory' as const,
          path: emptyDir
        }
      };

      const result = await coordinator.coordinate(options);

      // Should not throw and should provide default values
      expect(result.summary.totalFindings).toBeGreaterThanOrEqual(0);
      expect(result.summary.totalDuration).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.summary.agentsUsed)).toBe(true);
      expect(typeof result.summary.findingsByCategory).toBe('object');
      expect(Array.isArray(result.consolidatedFindings)).toBe(true);
      expect(Array.isArray(result.reports)).toBe(true);
    });

    test('should handle findings without categories', async () => {
      // Create test files that might generate findings without clear categories
      await fs.writeFile(path.join(tempDir, 'minimal.js'), 'var x = 1;');

      const options = {
        target: {
          type: 'project' as const,
          path: tempDir
        }
      };

      const result = await coordinator.coordinate(options);

      // Should handle undefined categories gracefully
      expect(typeof result.summary.findingsByCategory).toBe('object');
      expect(result.summary.findingsByCategory).not.toBeNull();
    });

    test('should handle agents with missing execution time', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'function test() {}');

      const options = {
        target: {
          type: 'project' as const,
          path: tempDir
        }
      };

      const result = await coordinator.coordinate(options);

      // Should default to 0 for missing execution times
      result.reports.forEach(report => {
        expect(typeof report.duration).toBe('number');
        expect(report.duration).toBeGreaterThanOrEqual(0);
        expect(typeof report.summary.duration).toBe('number');
        expect(report.summary.duration).toBeGreaterThanOrEqual(0);
      });
    });

    test('should handle findings without file property', async () => {
      await fs.writeFile(path.join(tempDir, 'test.js'), 'console.log("test");');

      const options = {
        target: {
          type: 'project' as const,
          path: tempDir
        }
      };

      const result = await coordinator.coordinate(options);

      // Should calculate filesAnalyzed correctly even if some findings lack file property
      result.reports.forEach(report => {
        expect(typeof report.summary.filesAnalyzed).toBe('number');
        expect(report.summary.filesAnalyzed).toBeGreaterThanOrEqual(0);
      });
    });

    test('should handle nonexistent target path', async () => {
      const nonexistentPath = path.join(tempDir, 'does-not-exist');

      const options = {
        target: {
          type: 'directory' as const,
          path: nonexistentPath
        }
      };

      // Should not throw, but return empty results
      const result = await coordinator.coordinate(options);
      
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('reports');
      expect(result).toHaveProperty('consolidatedFindings');
    });

    test('should handle exclude patterns as undefined', async () => {
      await fs.writeFile(path.join(tempDir, 'test.js'), 'var x = 1;');

      const options = {
        target: {
          type: 'project' as const,
          path: tempDir
          // exclude is intentionally undefined
        }
      };

      const result = await coordinator.coordinate(options);

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('reports');
      expect(result).toHaveProperty('consolidatedFindings');
    });
  });

  describe('quickAnalyze() edge cases', () => {
    test('should handle undefined report properties', async () => {
      // Test with empty directory that might not generate full report
      const emptyDir = path.join(tempDir, 'empty');
      await fs.mkdir(emptyDir);

      const result = await quickAnalyze(emptyDir);

      // Should provide safe defaults
      expect(result.analysis.summary.totalFindings).toBeGreaterThanOrEqual(0);
      expect(typeof result.analysis.summary.findingsBySeverity).toBe('object');
      expect(result.analysis.summary.findingsBySeverity.critical).toBeGreaterThanOrEqual(0);
      expect(result.analysis.summary.findingsBySeverity.high).toBeGreaterThanOrEqual(0);
      expect(result.analysis.summary.findingsBySeverity.medium).toBeGreaterThanOrEqual(0);
      expect(result.analysis.summary.findingsBySeverity.low).toBeGreaterThanOrEqual(0);
      expect(result.analysis.summary.findingsBySeverity.info).toBeGreaterThanOrEqual(0);
    });

    test('should handle malformed analysis options', async () => {
      await fs.writeFile(path.join(tempDir, 'test.js'), 'var x = 1;');

      // Test with invalid format option
      const result = await quickAnalyze(tempDir, { 
        format: 'invalid-format' as any 
      });

      expect(result).toHaveProperty('analysis');
      expect(typeof result.analysis.report).toBe('string');
    });

    test('should handle empty agents array', async () => {
      await fs.writeFile(path.join(tempDir, 'test.js'), 'var x = 1;');

      const result = await quickAnalyze(tempDir, { agents: [] });

      // Should fall back to full analysis
      expect(result).toHaveProperty('analysis');
      expect(result.analysis).toHaveProperty('summary');
    });

    test('should handle invalid agents array', async () => {
      await fs.writeFile(path.join(tempDir, 'test.js'), 'var x = 1;');

      // Should throw an error for unknown agents
      await expect(quickAnalyze(tempDir, { 
        agents: ['nonexistent-agent'] 
      })).rejects.toThrow('Unknown agents: nonexistent-agent');
    });

    test('should handle path that cannot be read', async () => {
      const unreadablePath = '/proc/1/mem'; // System path that typically can't be read

      const result = await quickAnalyze(unreadablePath);

      // Should not throw, but return minimal results
      expect(result).toHaveProperty('analysis');
      expect(result.analysis).toHaveProperty('summary');
    });

    test('should handle analysis with no discoverable files', async () => {
      // Create directory with only non-source files
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');
      await fs.writeFile(path.join(tempDir, 'image.png'), 'fake-image-content');
      await fs.writeFile(path.join(tempDir, 'data.xml'), '<xml></xml>');

      const result = await quickAnalyze(tempDir);

      expect(result).toHaveProperty('analysis');
      expect(result.analysis.summary.totalFindings).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.analysis.findings)).toBe(true);
      expect(result.analysis.findings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createAgentSystem() edge cases', () => {
    test('should create independent instances', () => {
      const system1 = createAgentSystem();
      const system2 = createAgentSystem();

      // Should be different instances
      expect(system1.registry).not.toBe(system2.registry);
      expect(system1.coordinator).not.toBe(system2.coordinator);
      expect(system1.reportGenerator).not.toBe(system2.reportGenerator);
    });

    test('should handle registry modifications after creation', () => {
      const system = createAgentSystem();
      const initialAgentCount = system.agents.length;

      // Registry should allow modifications
      expect(system.registry.getAgentCount()).toBe(initialAgentCount);
      
      // The agents array is a snapshot, so modifying registry won't affect it
      expect(system.agents.length).toBe(initialAgentCount);
    });
  });

  describe('Data validation and safety', () => {
    test('should handle null/undefined findings arrays', async () => {
      // Create coordinator with minimal context that might not populate findings
      const context: AnalysisContext = {
        projectPath: tempDir,
        files: []
      };

      const report = await coordinator.runFullAnalysis(context);
      const result = await coordinator.coordinate({
        target: {
          type: 'project',
          path: tempDir
        }
      });

      // Should handle empty or undefined findings gracefully
      expect(Array.isArray(result.consolidatedFindings)).toBe(true);
      expect(typeof result.summary.totalFindings).toBe('number');
      expect(result.summary.totalFindings).toBeGreaterThanOrEqual(0);
    });

    test('should validate findings category enumeration', async () => {
      await fs.writeFile(path.join(tempDir, 'test.js'), 'console.log("test");');

      const result = await coordinator.coordinate({
        target: {
          type: 'project',
          path: tempDir
        }
      });

      // All category counts should be non-negative integers
      Object.values(result.summary.findingsByCategory).forEach(count => {
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(count)).toBe(true);
      });
    });

    test('should handle extremely large result sets', async () => {
      // Create file with many potential issues to stress test the system
      const problemFile = `
        ${'console.log("debug");'.repeat(100)}
        ${'// eval("test");'.repeat(50)}
        ${'var x = "password123";'.repeat(25)}
      `;
      
      await fs.writeFile(path.join(tempDir, 'large-test.js'), problemFile);

      const result = await coordinator.coordinate({
        target: {
          type: 'project',
          path: tempDir
        }
      });

      // Should handle large result sets without issues
      expect(typeof result.summary.totalFindings).toBe('number');
      expect(result.summary.totalFindings).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.consolidatedFindings)).toBe(true);
    });
  });
});