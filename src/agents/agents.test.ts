/**
 * Basic tests for the agent system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StaticAnalysisAgent } from './analysis/static-analysis.js';
import { ErrorDetectionAgent } from './analysis/error-detection.js';
import { TestGenerationAgent } from './testing/test-generation.js';
import { AgentCoordinator } from './base/coordinator.js';
import { ReportGenerator } from './reporting/report-generator.js';
import { AnalysisTarget, Severity, FindingCategory } from './types.js';

describe('Agent System', () => {
  let coordinator: AgentCoordinator;
  let staticAgent: StaticAnalysisAgent;
  let errorAgent: ErrorDetectionAgent;
  let testAgent: TestGenerationAgent;

  beforeEach(() => {
    coordinator = new AgentCoordinator();
    staticAgent = new StaticAnalysisAgent();
    errorAgent = new ErrorDetectionAgent();
    testAgent = new TestGenerationAgent();
  });

  describe('Agent Registration', () => {
    it('should register agents successfully', () => {
      coordinator.registerAgent(staticAgent);
      coordinator.registerAgent(errorAgent);
      coordinator.registerAgent(testAgent);

      const agents = coordinator.getAgents();
      expect(agents).toHaveLength(3);
      expect(agents.map(a => a.name)).toContain('static-analysis');
      expect(agents.map(a => a.name)).toContain('error-detection');
      expect(agents.map(a => a.name)).toContain('test-generation');
    });

    it('should retrieve specific agents', () => {
      coordinator.registerAgent(staticAgent);
      
      const retrieved = coordinator.getAgent('static-analysis');
      expect(retrieved).toBe(staticAgent);
      
      const notFound = coordinator.getAgent('non-existent');
      expect(notFound).toBeUndefined();
    });
  });

  describe('Agent Configuration', () => {
    it('should configure agents', () => {
      const config = {
        enabled: true,
        depth: 'shallow' as const,
        maxFindings: 10,
        minSeverity: Severity.HIGH
      };

      staticAgent.configure(config);
      const retrievedConfig = staticAgent.getConfig();
      
      expect(retrievedConfig.enabled).toBe(true);
      expect(retrievedConfig.depth).toBe('shallow');
      expect(retrievedConfig.maxFindings).toBe(10);
      expect(retrievedConfig.minSeverity).toBe(Severity.HIGH);
    });
  });

  describe('Agent Capabilities', () => {
    it('should have correct capabilities for StaticAnalysisAgent', () => {
      const capabilities = staticAgent.capabilities;
      
      expect(capabilities.supportedFileTypes).toContain('ts');
      expect(capabilities.supportedFileTypes).toContain('js');
      expect(capabilities.analysisTypes).toContain(FindingCategory.SYNTAX_ERROR);
      expect(capabilities.analysisTypes).toContain(FindingCategory.CODE_SMELL);
      expect(capabilities.canSuggestFixes).toBe(true);
      expect(capabilities.canGenerateTests).toBe(false);
    });

    it('should have correct capabilities for ErrorDetectionAgent', () => {
      const capabilities = errorAgent.capabilities;
      
      expect(capabilities.supportedFileTypes).toContain('ts');
      expect(capabilities.supportedFileTypes).toContain('js');
      expect(capabilities.analysisTypes).toContain(FindingCategory.RUNTIME_ERROR);
      expect(capabilities.canSuggestFixes).toBe(true);
      expect(capabilities.canGenerateTests).toBe(false);
    });

    it('should have correct capabilities for TestGenerationAgent', () => {
      const capabilities = testAgent.capabilities;
      
      expect(capabilities.supportedFileTypes).toContain('ts');
      expect(capabilities.supportedFileTypes).toContain('js');
      expect(capabilities.analysisTypes).toContain(FindingCategory.TESTING);
      expect(capabilities.canSuggestFixes).toBe(false);
      expect(capabilities.canGenerateTests).toBe(true);
    });
  });

  describe('Target Validation', () => {
    it('should validate TypeScript files', () => {
      const target: AnalysisTarget = {
        type: 'file',
        path: 'test.ts'
      };

      expect(staticAgent.canAnalyze(target)).toBe(true);
      expect(errorAgent.canAnalyze(target)).toBe(true);
      expect(testAgent.canAnalyze(target)).toBe(true);
    });

    it('should validate JavaScript files', () => {
      const target: AnalysisTarget = {
        type: 'file',
        path: 'test.js'
      };

      expect(staticAgent.canAnalyze(target)).toBe(true);
      expect(errorAgent.canAnalyze(target)).toBe(true);
      expect(testAgent.canAnalyze(target)).toBe(true);
    });

    it('should reject unsupported file types', () => {
      const target: AnalysisTarget = {
        type: 'file',
        path: 'test.py'
      };

      expect(staticAgent.canAnalyze(target)).toBe(false);
      expect(errorAgent.canAnalyze(target)).toBe(false);
      expect(testAgent.canAnalyze(target)).toBe(false);
    });

    it('should validate directory targets', () => {
      const target: AnalysisTarget = {
        type: 'directory',
        path: './src'
      };

      expect(staticAgent.canAnalyze(target)).toBe(true);
      expect(errorAgent.canAnalyze(target)).toBe(true);
      expect(testAgent.canAnalyze(target)).toBe(true);
    });
  });

  describe('Health Monitoring', () => {
    it('should report healthy status for new agents', async () => {
      const health = await staticAgent.getHealth();
      
      expect(health.healthy).toBe(true);
      expect(health.status).toBe('Healthy');
      expect(health.lastCheck).toBeInstanceOf(Date);
    });

    it('should track analysis metrics', async () => {
      // Mock file system to avoid actual file operations
      vi.spyOn(staticAgent as any, 'readFileContent').mockResolvedValue('const x = 1;');
      vi.spyOn(staticAgent as any, 'fileExists').mockResolvedValue(true);

      const target: AnalysisTarget = {
        type: 'file',
        path: 'mock.ts'
      };

      // Run analysis to generate metrics
      await staticAgent.analyze(target);

      const health = await staticAgent.getHealth();
      expect(health.metrics).toBeDefined();
      expect(health.metrics!.avgAnalysisTime).toBeGreaterThan(0);
      expect(health.metrics!.successRate).toBe(1);
    });
  });

  describe('Report Generation', () => {
    it('should generate JSON reports', async () => {
      const reportGenerator = new ReportGenerator();
      
      // Mock analysis result
      const mockResult = {
        agentName: 'test-agent',
        agentVersion: '1.0.0',
        target: { type: 'file' as const, path: 'test.ts' },
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        findings: [],
        summary: {
          totalFindings: 0,
          findingsBySeverity: {} as any,
          findingsByCategory: {} as any,
          filesAnalyzed: 1,
          linesAnalyzed: 10
        },
        config: staticAgent.getConfig()
      };

      const report = await reportGenerator.generateReport(mockResult, {
        format: 'json',
        includeDetails: true
      });

      expect(() => JSON.parse(report)).not.toThrow();
      const parsed = JSON.parse(report);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.summary).toBeDefined();
      expect(parsed.findings).toBeDefined();
    });

    it('should generate markdown reports', async () => {
      const reportGenerator = new ReportGenerator();
      
      const mockResult = {
        agentName: 'test-agent',
        agentVersion: '1.0.0',
        target: { type: 'file' as const, path: 'test.ts' },
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        findings: [],
        summary: {
          totalFindings: 0,
          findingsBySeverity: {} as any,
          findingsByCategory: {} as any,
          filesAnalyzed: 1,
          linesAnalyzed: 10
        },
        config: staticAgent.getConfig()
      };

      const report = await reportGenerator.generateReport(mockResult, {
        format: 'markdown',
        includeDetails: true
      });

      expect(report).toContain('# Code Analysis Report');
      expect(report).toContain('## Summary');
      expect(report).toContain('**Total Findings:**');
    });
  });

  describe('Error Handling', () => {
    it('should handle analysis errors gracefully', async () => {
      // Mock file read to throw error
      vi.spyOn(staticAgent as any, 'readFileContent').mockRejectedValue(new Error('File not found'));

      const target: AnalysisTarget = {
        type: 'file',
        path: 'nonexistent.ts'
      };

      const report = await staticAgent.analyze(target);
      
      expect(report.errors).toBeDefined();
      expect(report.errors).toHaveLength(1);
      expect(report.errors![0]).toContain('File not found');
      expect(report.findings).toHaveLength(0);
    });

    it('should handle coordination errors', async () => {
      coordinator.registerAgent(staticAgent);
      
      // Mock agent to throw error
      vi.spyOn(staticAgent, 'analyze').mockRejectedValue(new Error('Analysis failed'));

      const target: AnalysisTarget = {
        type: 'file',
        path: 'test.ts'
      };

      const result = await coordinator.coordinate({
        target,
        agents: ['static-analysis']
      });

      expect(result.reports).toHaveLength(1);
      expect(result.reports[0].errors).toBeDefined();
      expect(result.reports[0].errors).toHaveLength(1);
    });
  });

  describe('Integration', () => {
    it('should coordinate multiple agents', async () => {
      coordinator.registerAgent(staticAgent);
      coordinator.registerAgent(errorAgent);

      // Mock file operations
      vi.spyOn(staticAgent as any, 'readFileContent').mockResolvedValue('const x = 1;');
      vi.spyOn(staticAgent as any, 'fileExists').mockResolvedValue(true);
      vi.spyOn(errorAgent as any, 'readFileContent').mockResolvedValue('const x = 1;');
      vi.spyOn(errorAgent as any, 'fileExists').mockResolvedValue(true);

      const target: AnalysisTarget = {
        type: 'file',
        path: 'test.ts'
      };

      const result = await coordinator.coordinate({
        target,
        parallel: false // Sequential for predictable testing
      });

      expect(result.reports).toHaveLength(2);
      expect(result.summary.agentsUsed).toContain('static-analysis');
      expect(result.summary.agentsUsed).toContain('error-detection');
      expect(result.summary.totalDuration).toBeGreaterThan(0);
    });
  });
});