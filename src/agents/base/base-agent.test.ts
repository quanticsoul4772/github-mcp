/**
 * Tests for AbstractBaseAgent
 */
import { describe, it, expect, vi } from 'vitest';
import { AbstractBaseAgent } from './base-agent.js';
import type { AnalysisContext, AnalysisResult } from '../types/agent-interfaces.js';

// Concrete implementation for testing
class TestAgent extends AbstractBaseAgent {
  public readonly name = 'test-agent';
  public readonly version = '1.0.0';
  public readonly description = 'Test agent';

  public async analyze(_context: AnalysisContext): Promise<AnalysisResult> {
    return this.createResult('success', [], {}, ['rec1']);
  }

  public canHandle(fileType: string): boolean {
    return fileType === 'ts';
  }

  // Expose protected methods for testing
  public testCreateFinding(...args: Parameters<AbstractBaseAgent['createFinding']>) {
    return this.createFinding(...args);
  }

  public testFilterFiles(files: string[], context: AnalysisContext) {
    return this.filterFiles(files, context);
  }

  public testGetFileExtension(filePath: string) {
    return this.getFileExtension(filePath);
  }

  public async testFileExists(filePath: string) {
    return this.fileExists(filePath);
  }

  public async testReadFile(filePath: string) {
    return this.readFile(filePath);
  }

  public async testGetRelativePath(filePath: string, projectPath: string) {
    return this.getRelativePath(filePath, projectPath);
  }

  public testLog(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    return this.log(level, message, data);
  }
}

describe('AbstractBaseAgent', () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent();
  });

  describe('getDependencies', () => {
    it('should return empty array by default', () => {
      expect(agent.getDependencies()).toEqual([]);
    });
  });

  describe('getPriority', () => {
    it('should return 100 by default', () => {
      expect(agent.getPriority()).toBe(100);
    });
  });

  describe('validateConfiguration', () => {
    it('should return true for valid config', () => {
      expect(agent.validateConfiguration({ enabled: true, priority: 1, timeout: 5000, options: {} })).toBe(true);
    });

    it('should return false for invalid config', () => {
      expect(agent.validateConfiguration(null as any)).toBeFalsy();
    });
  });

  describe('getDefaultConfiguration', () => {
    it('should return default config with correct shape', () => {
      const config = agent.getDefaultConfiguration();
      expect(config.enabled).toBe(true);
      expect(config.priority).toBe(100);
      expect(config.timeout).toBe(30000);
    });
  });

  describe('createResult', () => {
    it('should create a result with the agent name and status', async () => {
      const result = await agent.analyze({ projectPath: '/test', files: [] });
      expect(result.agentName).toBe('test-agent');
      expect(result.status).toBe('success');
    });
  });

  describe('createFinding', () => {
    it('should create a finding with an id', () => {
      const finding = agent.testCreateFinding('high', 'security', 'vulnerability', { file: 'src/a.ts' });
      expect(finding.id).toMatch(/^test-agent-/);
      expect(finding.severity).toBe('high');
      expect(finding.category).toBe('security');
      expect(finding.message).toBe('vulnerability');
      expect(finding.file).toBe('src/a.ts');
    });
  });

  describe('filterFiles', () => {
    it('should filter files by extension', () => {
      const files = ['a.ts', 'b.js', 'c.ts'];
      const result = agent.testFilterFiles(files, { projectPath: '/test', files: [] });
      expect(result).toEqual(['a.ts', 'c.ts']);
    });

    it('should apply excludePatterns', () => {
      const files = ['a.ts', 'node_modules/x.ts', 'c.ts'];
      const result = agent.testFilterFiles(files, { projectPath: '/test', files: [], excludePatterns: ['node_modules'] });
      expect(result).toEqual(['a.ts', 'c.ts']);
    });

    it('should apply targetFiles filter', () => {
      const files = ['a.ts', 'b.ts', 'c.ts'];
      const result = agent.testFilterFiles(files, { projectPath: '/test', files: [], targetFiles: ['a.ts'] });
      expect(result).toEqual(['a.ts']);
    });
  });

  describe('getFileExtension', () => {
    it('should return extension for file with dot', () => {
      expect(agent.testGetFileExtension('foo.ts')).toBe('ts');
      expect(agent.testGetFileExtension('foo.test.ts')).toBe('ts');
    });

    it('should return empty string for file without extension', () => {
      expect(agent.testGetFileExtension('Makefile')).toBe('');
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const result = await agent.testFileExists('/etc/hostname');
      expect(typeof result).toBe('boolean');
    });

    it('should return false for non-existing file', async () => {
      const result = await agent.testFileExists('/nonexistent/path/file.txt');
      expect(result).toBe(false);
    });
  });

  describe('readFile', () => {
    it('should return null for non-existing file', async () => {
      const result = await agent.testReadFile('/nonexistent/file.txt');
      expect(result).toBeNull();
    });
  });

  describe('getRelativePath', () => {
    it('should compute relative path from project root', async () => {
      const result = await agent.testGetRelativePath('/project/src/a.ts', '/project');
      expect(result).toBe('src/a.ts');
    });
  });

  describe('log', () => {
    it('should call console.log for info level', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      agent.testLog('info', 'info message');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should call console.warn for warn level', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      agent.testLog('warn', 'warn message', { detail: 1 });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should call console.error for error level', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      agent.testLog('error', 'error message');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
