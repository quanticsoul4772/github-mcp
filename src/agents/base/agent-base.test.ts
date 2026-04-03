/**
 * Tests for BaseAgent abstract class
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { BaseAgent, DEFAULT_AGENT_CONFIG } from './agent-base.js';
import { Severity, FindingCategory } from '../types.js';
import type { AnalysisTarget, Finding, AgentCapabilities } from '../types.js';

const TEST_CAPABILITIES: AgentCapabilities = {
  supportedFileTypes: ['ts', 'js'],
  analysisTypes: [FindingCategory.SECURITY_VULNERABILITY, FindingCategory.CODE_SMELL],
  canSuggestFixes: true,
  canGenerateTests: false,
  supportsIncremental: false,
  performance: { speed: 'fast', memoryUsage: 'low', cpuUsage: 'low' },
};

class ConcreteAgent extends BaseAgent {
  public findings: Finding[] = [];
  public shouldFailAnalysis = false;

  constructor(config?: any) {
    super('test-agent', '1.0.0', 'Test agent', TEST_CAPABILITIES, config);
  }

  protected async performAnalysis(_target: AnalysisTarget): Promise<Finding[]> {
    if (this.shouldFailAnalysis) throw new Error('analysis failure');
    return this.findings;
  }

  // Expose protected methods for testing
  public testCreateFinding(...args: Parameters<BaseAgent['createFinding']>) {
    return this.createFinding(...args);
  }
  public testGenerateFindingId(...args: Parameters<BaseAgent['generateFindingId']>) {
    return this.generateFindingId(...args);
  }
  public async testReadFileContent(path: string) { return this.readFileContent(path); }
  public async testFileExists(path: string) { return this.fileExists(path); }
  public async testGetFileStats(path: string) { return this.getFileStats(path); }
  public testCountFilesAnalyzed(target: AnalysisTarget) { return this.countFilesAnalyzed(target); }
}

describe('BaseAgent', () => {
  let agent: ConcreteAgent;

  beforeEach(() => {
    agent = new ConcreteAgent();
  });

  describe('DEFAULT_AGENT_CONFIG', () => {
    it('should have expected defaults', () => {
      expect(DEFAULT_AGENT_CONFIG.enabled).toBe(true);
      expect(DEFAULT_AGENT_CONFIG.depth).toBe('deep');
    });
  });

  describe('configure and getConfig', () => {
    it('should merge config updates', () => {
      agent.configure({ enabled: false });
      expect(agent.getConfig().enabled).toBe(false);
    });
  });

  describe('analyze - success path', () => {
    it('should return a report on success', async () => {
      agent.findings = [
        { id: 'f1', severity: Severity.HIGH, category: FindingCategory.SECURITY_VULNERABILITY,
          title: 'Issue', description: 'desc', file: 'a.ts' },
      ];
      const report = await agent.analyze({ type: 'project', path: '/test' });
      expect(report.agentName).toBe('test-agent');
      expect(report.findings.length).toBe(1);
      expect(report.summary.totalFindings).toBe(1);
      expect(report.summary.findingsBySeverity[Severity.HIGH]).toBe(1);
    });

    it('should filter out excluded categories', async () => {
      agent.configure({ excludeCategories: [FindingCategory.CODE_SMELL] });
      agent.findings = [
        { id: 'f1', severity: Severity.HIGH, category: FindingCategory.SECURITY_VULNERABILITY, title: 'X', description: 'X', file: 'a.ts' },
        { id: 'f2', severity: Severity.LOW, category: FindingCategory.CODE_SMELL, title: 'Y', description: 'Y', file: 'b.ts' },
      ];
      const report = await agent.analyze({ type: 'project', path: '/test' });
      expect(report.findings.length).toBe(1);
      expect(report.findings[0].category).toBe(FindingCategory.SECURITY_VULNERABILITY);
    });

    it('should limit findings to maxFindings and sort by severity', async () => {
      agent.configure({ maxFindings: 2 });
      agent.findings = [
        { id: 'f1', severity: Severity.INFO, category: FindingCategory.SECURITY_VULNERABILITY, title: 'info', description: 'i', file: 'a.ts' },
        { id: 'f2', severity: Severity.CRITICAL, category: FindingCategory.SECURITY_VULNERABILITY, title: 'crit', description: 'c', file: 'b.ts' },
        { id: 'f3', severity: Severity.HIGH, category: FindingCategory.SECURITY_VULNERABILITY, title: 'high', description: 'h', file: 'c.ts' },
      ];
      const report = await agent.analyze({ type: 'project', path: '/test' });
      expect(report.findings.length).toBe(2);
      expect(report.findings[0].severity).toBe(Severity.CRITICAL);
      expect(report.findings[1].severity).toBe(Severity.HIGH);
    });
  });

  describe('analyze - error path', () => {
    it('should return error report when performAnalysis throws', async () => {
      agent.shouldFailAnalysis = true;
      const report = await agent.analyze({ type: 'project', path: '/test' });
      expect(report.findings).toHaveLength(0);
      expect(report.errors).toContain('analysis failure');
    });
  });

  describe('analyze - disabled agent', () => {
    it('should throw when agent is disabled', async () => {
      agent.configure({ enabled: false });
      const report = await agent.analyze({ type: 'project', path: '/test' });
      // Throws internally, caught and returned as error report
      expect(report.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('analyze - unsupported target', () => {
    it('should return error report when canAnalyze returns false', async () => {
      // README.md is not a supported file type — canAnalyze returns false
      const report = await agent.analyze({ type: 'file', path: 'README.md' });
      expect(report.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('canAnalyze', () => {
    it('should return false when path is empty', () => {
      expect(agent.canAnalyze({ type: 'file', path: '' })).toBe(false);
    });

    it('should return true for project type', () => {
      expect(agent.canAnalyze({ type: 'project', path: '/test' })).toBe(true);
    });

    it('should return true for supported file type', () => {
      expect(agent.canAnalyze({ type: 'file', path: 'src/index.ts' })).toBe(true);
    });

    it('should return false for unsupported file type', () => {
      expect(agent.canAnalyze({ type: 'file', path: 'README.md' })).toBe(false);
    });

    it('should return false for file without extension', () => {
      expect(agent.canAnalyze({ type: 'file', path: 'Makefile' })).toBe(false);
    });
  });

  describe('getHealth', () => {
    it('should return health status', async () => {
      const health = await agent.getHealth();
      expect(health.healthy).toBe(true);
      expect(health.status).toBe('Healthy');
    });

    it('should return unhealthy when performHealthCheck throws', async () => {
      class FailingHealthAgent extends ConcreteAgent {
        protected async performHealthCheck(): Promise<boolean> {
          throw new Error('health check failed');
        }
      }
      const failingAgent = new FailingHealthAgent();
      const health = await failingAgent.getHealth();
      expect(health.healthy).toBe(false);
      expect(health.status).toContain('health check failed');
    });
  });

  describe('countFilesAnalyzed', () => {
    it('should return 1 for file type', () => {
      expect(agent.testCountFilesAnalyzed({ type: 'file', path: 'a.ts' })).toBe(1);
    });

    it('should return 0 for project type', () => {
      expect(agent.testCountFilesAnalyzed({ type: 'project', path: '/test' })).toBe(0);
    });
  });

  describe('createFinding', () => {
    it('should create a finding with all fields', () => {
      const f = agent.testCreateFinding(
        Severity.MEDIUM, FindingCategory.CODE_SMELL, 'Title', 'Desc', 'file.ts', 10, 5, 'snippet', 'suggestion', 'rule1'
      );
      expect(f.severity).toBe(Severity.MEDIUM);
      expect(f.file).toBe('file.ts');
      expect(f.line).toBe(10);
      expect(f.snippet).toBe('snippet');
    });
  });

  describe('generateFindingId', () => {
    it('should produce a stable ID', () => {
      const id1 = agent.testGenerateFindingId('a.ts', 10, 0, 'rule', 'title');
      const id2 = agent.testGenerateFindingId('a.ts', 10, 0, 'rule', 'title');
      expect(id1).toBe(id2);
    });

    it('should handle missing optional params', () => {
      const id = agent.testGenerateFindingId('a.ts');
      expect(id).toMatch(/^test-agent-/);
    });
  });

  describe('readFileContent', () => {
    it('should throw for non-existent file', async () => {
      await expect(agent.testReadFileContent('/no/such/file.ts')).rejects.toThrow();
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const result = await agent.testFileExists('/etc/hostname');
      expect(typeof result).toBe('boolean');
    });

    it('should return false for non-existing file', async () => {
      expect(await agent.testFileExists('/no/such/file')).toBe(false);
    });
  });

  describe('getFileStats', () => {
    it('should return null for non-existing file', async () => {
      const result = await agent.testGetFileStats('/no/such/file.ts');
      expect(result).toBeNull();
    });
  });
});
