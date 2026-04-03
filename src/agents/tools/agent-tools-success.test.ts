/**
 * Tests for agent-tools success paths — uses vi.mock to bypass the
 * coordinator/registry errors so the try-block return paths are covered.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createAgentTools } from './agent-tools.js';

const mockReport = {
  summary: {
    totalFindings: 3,
    criticalFindings: 0,
    highFindings: 1,
    mediumFindings: 2,
    lowFindings: 0,
    totalExecutionTime: 50,
  },
  findings: [
    { id: 'f1', severity: 'high', category: 'bug', message: 'Potential null dereference', file: 'src/a.ts', line: 5, title: 'Null dereference', suggestion: 'Add null check' },
    { id: 'f2', severity: 'medium', category: 'style', message: 'Line too long', file: 'src/b.ts', line: 10, title: 'Long line', suggestion: 'Wrap line' },
    { id: 'f3', severity: 'medium', category: 'complexity', message: 'Complex function', file: 'src/c.ts', line: 1, title: 'Complexity', suggestion: 'Refactor' },
  ],
  agentResults: [
    { agentName: 'static-analysis', duration: 20, findings: [], errors: [] },
    { agentName: 'error-detection', duration: 30, findings: [], errors: [] },
  ],
};

vi.mock('../testing/test-generation.js', () => {
  return {
    TestGenerationAgent: vi.fn(function(this: any) {
      this.name = 'test-generation';
      this.version = '1.0.0';
      this.description = 'Test generation agent';
      this.generateTests = vi.fn().mockResolvedValue({
        filePath: '/tmp/output.test.ts',
        content: 'describe("test", () => { it("works", () => {}); });',
        metadata: { framework: 'vitest', testCount: 1 },
      });
    }),
  };
});

vi.mock('../base/coordinator.js', () => {
  return {
    DefaultAgentCoordinator: vi.fn(function(this: any) {
      this.runFullAnalysis = vi.fn().mockResolvedValue(mockReport);
    }),
  };
});

vi.mock('../reporting/report-generator.js', () => {
  return {
    ReportGenerator: vi.fn(function(this: any) {
      this.generateReport = vi.fn().mockResolvedValue('{"title":"Analysis Report","sections":[]}');
    }),
    ReportOptions: {},
    ReportData: {},
  };
});

describe('createAgentTools (success paths with mocked coordinator)', () => {
  let tools: any[];

  beforeAll(() => {
    tools = createAgentTools();
  });

  const findTool = (name: string): { tool: any; handler: (args: any) => Promise<any> } => {
    const t = tools.find((t: any) => t.tool.name === name);
    if (!t) throw new Error(`Tool '${name}' not found`);
    return t;
  };

  // ============================================================
  // generate_tests - success path
  // ============================================================
  describe('generate_tests (mocked agent)', () => {
    it('should return generated test content on success', async () => {
      const tool = findTool('generate_tests');
      const result = await tool.handler({
        target: '/tmp/sample.ts',
        testType: 'unit',
        framework: 'vitest',
      });

      expect(result.content).toContain('describe');
      expect(typeof result.testFile).toBe('string');
      expect(result.saved).toBe(false);
      expect(result.outputPath).toBeUndefined();
    });

    it('should save output file when outputPath is provided', async () => {
      const fs = await import('fs/promises');
      const os = await import('os');
      const path = await import('path');
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-test-'));
      const outputPath = path.join(tmpDir, 'generated.test.ts');

      const tool = findTool('generate_tests');
      const result = await tool.handler({
        target: '/tmp/sample.ts',
        testType: 'unit',
        framework: 'vitest',
        outputPath,
      });

      expect(result.saved).toBe(true);
      expect(result.outputPath).toBe(outputPath);
      const written = await fs.readFile(outputPath, 'utf-8');
      expect(written).toContain('describe');

      await fs.rm(tmpDir, { recursive: true, force: true });
    });
  });

  // ============================================================
  // analyze_code - success path
  // ============================================================
  describe('analyze_code', () => {
    it('should return analysis results on success', async () => {
      const tool = findTool('analyze_code');
      const result = await tool.handler({
        target: '/tmp/test',
        type: 'directory',
        depth: 'deep',
        parallel: true,
        minSeverity: 'low',
        agents: ['static-analysis'],
        includeCategories: ['bug'],
        excludeCategories: ['style'],
      });

      expect(result.summary).toBeDefined();
      expect(result.summary.totalFindings).toBe(3);
      expect(Array.isArray(result.findings)).toBe(true);
      expect(result.findings.length).toBe(3);
      expect(result.truncated).toBe(false);
      expect(Array.isArray(result.reports)).toBe(true);
      expect(result.reports).toHaveLength(2);
      expect(result.errors).toEqual([]);
    });

    it('should truncate findings when over 200', async () => {
      const { DefaultAgentCoordinator } = await import('../base/coordinator.js');
      const manyFindings = Array.from({ length: 250 }, (_, i) => ({
        id: `f${i}`, severity: 'low', category: 'style', message: `Issue ${i}`,
        file: 'a.ts', line: i, title: `Issue ${i}`, suggestion: 'Fix',
      }));
      (DefaultAgentCoordinator as any).mockImplementationOnce(function(this: any) {
        this.runFullAnalysis = vi.fn().mockResolvedValue({
          ...mockReport,
          findings: manyFindings,
          summary: { ...mockReport.summary, totalFindings: 250 },
        });
      });

      // Re-create tools to pick up the new mock implementation
      const freshTools = createAgentTools();
      const tool = freshTools.find((t: any) => t.tool.name === 'analyze_code')! as { tool: any; handler: (args: any) => Promise<any> };
      const result = await tool.handler({ target: '/tmp', type: 'directory' });

      expect(result.summary.totalFindings).toBe(250);
      expect(result.findings.length).toBe(200);
      expect(result.truncated).toBe(true);
    });
  });

  // ============================================================
  // quick_code_scan - success path
  // ============================================================
  describe('quick_code_scan', () => {
    it('should return top findings on success', async () => {
      const tool = findTool('quick_code_scan');
      const result = await tool.handler({
        target: '/tmp/test',
        type: 'directory',
        focus: 'all',
      });

      expect(result.summary).toBeDefined();
      expect(result.summary.totalFindings).toBe(3);
      expect(Array.isArray(result.topFindings)).toBe(true);
      expect(result.topFindings.length).toBeLessThanOrEqual(10);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should include recommendations for issues found', async () => {
      const tool = findTool('quick_code_scan');
      const result = await tool.handler({ target: '/tmp', type: 'file' });
      expect(result.recommendations[0]).toContain('critical');
    });

    it('should give different recommendations when no findings', async () => {
      const { DefaultAgentCoordinator } = await import('../base/coordinator.js');
      (DefaultAgentCoordinator as any).mockImplementationOnce(function(this: any) {
        this.runFullAnalysis = vi.fn().mockResolvedValue({
          ...mockReport,
          findings: [],
          summary: { ...mockReport.summary, totalFindings: 0 },
        });
      });

      const freshTools = createAgentTools();
      const tool = freshTools.find((t: any) => t.tool.name === 'quick_code_scan')! as { tool: any; handler: (args: any) => Promise<any> };
      const result = await tool.handler({ target: '/tmp', type: 'directory' });

      expect(result.topFindings).toHaveLength(0);
      expect(result.recommendations[0]).toContain('No significant');
    });
  });

  // ============================================================
  // generate_analysis_report - success path (json format)
  // ============================================================
  describe('generate_analysis_report', () => {
    it('should return parsed JSON report for json format', async () => {
      const tool = findTool('generate_analysis_report');
      const result = await tool.handler({
        target: '/tmp/test',
        type: 'directory',
        format: 'json',
      });

      expect(result.format).toBe('json');
      expect(result.saved).toBe(false);
      expect(result.summary.totalFindings).toBe(3);
    });

    it('should return string report for non-json format', async () => {
      const tool = findTool('generate_analysis_report');
      const result = await tool.handler({
        target: '/tmp/test',
        type: 'directory',
        format: 'markdown',
        includeDetails: true,
        groupBy: 'severity',
        sortBy: 'severity',
        filterSeverity: ['high', 'medium'],
        filterCategory: ['bug'],
        includeRecommendations: true,
      });

      expect(result.format).toBe('markdown');
      expect(typeof result.content).toBe('string');
    });
  });
});
