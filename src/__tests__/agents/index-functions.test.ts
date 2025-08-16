import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createAgentSystem, quickAnalyze } from '../../agents/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Agent Index Functions', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-index-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('createAgentSystem()', () => {
    test('should include reportGenerator in returned object', () => {
      const system = createAgentSystem();
      
      expect(system).toHaveProperty('registry');
      expect(system).toHaveProperty('coordinator');
      expect(system).toHaveProperty('reportGenerator');
      expect(system).toHaveProperty('agents');
      
      expect(system.reportGenerator).toBeDefined();
      expect(typeof system.reportGenerator).toBe('object');
    });

    test('should return all required components', () => {
      const system = createAgentSystem();
      
      // Verify registry
      expect(system.registry).toBeDefined();
      expect(typeof system.registry.register).toBe('function');
      expect(typeof system.registry.getAgent).toBe('function');
      expect(typeof system.registry.hasAgent).toBe('function');
      
      // Verify coordinator
      expect(system.coordinator).toBeDefined();
      expect(typeof system.coordinator.runFullAnalysis).toBe('function');
      expect(typeof system.coordinator.coordinate).toBe('function');
      
      // Verify agents array
      expect(Array.isArray(system.agents)).toBe(true);
      expect(system.agents.length).toBeGreaterThan(0);
    });

    test('should have agents pre-registered', () => {
      const system = createAgentSystem();
      
      expect(system.registry.hasAgent('code-analysis')).toBe(true);
      expect(system.registry.hasAgent('type-safety')).toBe(true);
      expect(system.registry.hasAgent('testing')).toBe(true);
      expect(system.registry.hasAgent('security')).toBe(true);
      
      expect(system.agents.length).toBe(4);
    });
  });

  describe('quickAnalyze()', () => {
    beforeEach(async () => {
      await createTestFiles(tempDir);
    });

    test('should return analysis in expected format', async () => {
      const result = await quickAnalyze(tempDir);
      
      expect(result).toHaveProperty('analysis');
      expect(result.analysis).toHaveProperty('summary');
      expect(result.analysis).toHaveProperty('findings');
      expect(result.analysis).toHaveProperty('report');
      
      // Verify summary structure
      expect(result.analysis.summary).toHaveProperty('totalFindings');
      expect(result.analysis.summary).toHaveProperty('findingsBySeverity');
      
      expect(typeof result.analysis.summary.totalFindings).toBe('number');
      expect(typeof result.analysis.summary.findingsBySeverity).toBe('object');
    });

    test('should include findingsBySeverity with all severity levels', async () => {
      const result = await quickAnalyze(tempDir);
      
      const severity = result.analysis.summary.findingsBySeverity;
      expect(severity).toHaveProperty('critical');
      expect(severity).toHaveProperty('high');
      expect(severity).toHaveProperty('medium');
      expect(severity).toHaveProperty('low');
      expect(severity).toHaveProperty('info');
      
      // All should be numbers
      expect(typeof severity.critical).toBe('number');
      expect(typeof severity.high).toBe('number');
      expect(typeof severity.medium).toBe('number');
      expect(typeof severity.low).toBe('number');
      expect(typeof severity.info).toBe('number');
    });

    test('should return findings array', async () => {
      const result = await quickAnalyze(tempDir);
      
      expect(Array.isArray(result.analysis.findings)).toBe(true);
      // Should have some findings from the test files
      expect(result.analysis.findings.length).toBeGreaterThan(0);
    });

    test('should handle different format options', async () => {
      const jsonResult = await quickAnalyze(tempDir, { format: 'json' });
      const textResult = await quickAnalyze(tempDir, { format: 'text' });
      const htmlResult = await quickAnalyze(tempDir, { format: 'html' });
      
      // All should have the same analysis structure
      expect(jsonResult.analysis).toHaveProperty('summary');
      expect(textResult.analysis).toHaveProperty('summary');
      expect(htmlResult.analysis).toHaveProperty('summary');
      
      // But different report formats
      expect(typeof jsonResult.analysis.report).toBe('string');
      expect(typeof textResult.analysis.report).toBe('string');
      expect(typeof htmlResult.analysis.report).toBe('string');
      
      // JSON format should be valid JSON
      expect(() => JSON.parse(jsonResult.analysis.report)).not.toThrow();
      
      // HTML format should contain HTML tags
      expect(htmlResult.analysis.report).toContain('<html>');
      expect(htmlResult.analysis.report).toContain('</html>');
      
      // Text format should contain text indicators
      expect(textResult.analysis.report).toContain('ANALYSIS SUMMARY');
    });

    test('should handle empty options object', async () => {
      const result = await quickAnalyze(tempDir, {});
      
      expect(result).toHaveProperty('analysis');
      expect(result.analysis).toHaveProperty('summary');
      expect(result.analysis).toHaveProperty('findings');
      expect(result.analysis).toHaveProperty('report');
    });

    test('should handle undefined options', async () => {
      const result = await quickAnalyze(tempDir);
      
      expect(result).toHaveProperty('analysis');
      expect(result.analysis).toHaveProperty('summary');
      expect(result.analysis).toHaveProperty('findings');
      expect(result.analysis).toHaveProperty('report');
    });

    test('should respect agent selection when provided', async () => {
      const result = await quickAnalyze(tempDir, { 
        agents: ['code-analysis', 'security'] 
      });
      
      expect(result).toHaveProperty('analysis');
      expect(result.analysis).toHaveProperty('summary');
      expect(result.analysis).toHaveProperty('findings');
      expect(result.analysis).toHaveProperty('report');
      
      // Should still have valid structure even with limited agents
      expect(typeof result.analysis.summary.totalFindings).toBe('number');
    });

    test('should handle include and exclude patterns', async () => {
      const result = await quickAnalyze(tempDir, {
        include: ['*.ts'],
        exclude: ['*.test.*']
      });
      
      expect(result).toHaveProperty('analysis');
      expect(result.analysis).toHaveProperty('summary');
    });

    test('should handle different analysis types', async () => {
      const projectResult = await quickAnalyze(tempDir, { type: 'project' });
      const directoryResult = await quickAnalyze(tempDir, { type: 'directory' });
      
      expect(projectResult).toHaveProperty('analysis');
      expect(directoryResult).toHaveProperty('analysis');
      
      // Both should have valid analysis structures
      expect(projectResult.analysis).toHaveProperty('summary');
      expect(directoryResult.analysis).toHaveProperty('summary');
    });

    test('should handle analysis depth options', async () => {
      const shallowResult = await quickAnalyze(tempDir, { depth: 'shallow' });
      const deepResult = await quickAnalyze(tempDir, { depth: 'deep' });
      
      expect(shallowResult).toHaveProperty('analysis');
      expect(deepResult).toHaveProperty('analysis');
      
      // Both should have valid analysis structures
      expect(shallowResult.analysis).toHaveProperty('summary');
      expect(deepResult.analysis).toHaveProperty('summary');
    });

    test('should maintain backwards compatibility with analysis object structure', async () => {
      const result = await quickAnalyze(tempDir);
      
      // The analysis object should contain the key properties that workflow expects
      expect(result.analysis).toHaveProperty('summary');
      expect(result.analysis).toHaveProperty('findings');
      expect(result.analysis).toHaveProperty('report');
      
      // Summary should have the structure that workflow can process
      expect(result.analysis.summary).toHaveProperty('totalFindings');
      expect(result.analysis.summary).toHaveProperty('findingsBySeverity');
      
      // Findings should be an array that workflow can iterate
      expect(Array.isArray(result.analysis.findings)).toBe(true);
      
      // Report should be a string that workflow can write to file
      expect(typeof result.analysis.report).toBe('string');
    });
  });

  // Helper function to create test files
  async function createTestFiles(dir: string): Promise<void> {
    await fs.writeFile(path.join(dir, 'test.ts'), `
      function example(param: any): void {
        console.log(param);
        // eval("dangerous code"); // Removed for security testing
      }
    `);

    await fs.writeFile(path.join(dir, 'test.js'), `
      const x = 1
      function test() {
        return x;
      }
    `);

    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({
      dependencies: {
        "lodash": "*"
      }
    }, null, 2));
  }
});