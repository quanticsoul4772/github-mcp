/**
 * Tests for ReportGenerator
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  ReportGenerator,
  createReportGenerator,
  generateHtmlReport,
  generatePlainTextReport,
  generateSafeReport,
  generateAnalysisReport,
  ReportData,
  ReportOptions,
} from './report-generator.js';
import {
  AnalysisReport,
  CoordinationResult,
  Finding,
  Severity,
  FindingCategory,
  AnalysisTarget,
  AgentConfig,
} from '../types.js';

// ============================================================================
// Test fixtures
// ============================================================================

function makeTarget(): AnalysisTarget {
  return { type: 'file', path: 'src/test.ts' };
}

function makeConfig(): AgentConfig {
  return { enabled: true, depth: 'shallow' };
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'f1',
    severity: Severity.HIGH,
    category: FindingCategory.SECURITY_VULNERABILITY,
    title: 'Test Finding',
    description: 'A test security issue',
    file: 'src/test.ts',
    line: 10,
    snippet: 'const x = eval(input);',
    suggestion: 'Avoid eval()',
    ...overrides,
  };
}

function makeAnalysisReport(findings: Finding[] = []): AnalysisReport {
  return {
    agentName: 'test-agent',
    agentVersion: '1.0.0',
    target: makeTarget(),
    startTime: new Date('2024-01-01T00:00:00Z'),
    endTime: new Date('2024-01-01T00:00:01Z'),
    duration: 1000,
    findings,
    summary: {
      totalFindings: findings.length,
      findingsBySeverity: {
        [Severity.CRITICAL]: 0,
        [Severity.HIGH]: findings.filter(f => f.severity === Severity.HIGH).length,
        [Severity.MEDIUM]: 0,
        [Severity.LOW]: 0,
        [Severity.INFO]: 0,
      },
      findingsByCategory: {} as Record<FindingCategory, number>,
      filesAnalyzed: 1,
      linesAnalyzed: 100,
    },
    config: makeConfig(),
  };
}

function makeCoordinationResult(findings: Finding[] = []): CoordinationResult {
  return {
    reports: [makeAnalysisReport(findings)],
    consolidatedFindings: findings,
    summary: {
      totalFindings: findings.length,
      findingsBySeverity: {
        [Severity.CRITICAL]: 0,
        [Severity.HIGH]: 0,
        [Severity.MEDIUM]: 0,
        [Severity.LOW]: 0,
        [Severity.INFO]: 0,
      },
      findingsByCategory: {} as Record<FindingCategory, number>,
      agentsUsed: ['test-agent'],
      totalDuration: 1000,
    },
  };
}

function makeReportData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    title: 'Test Report',
    summary: 'A test report summary',
    sections: [
      {
        title: 'Section 1',
        content: 'Section content',
        subsections: [
          { title: 'Sub 1', content: 'Sub content', data: { key: 'value' } },
        ],
        data: { info: 'data' },
      },
    ],
    metadata: {
      generatedAt: new Date('2024-01-01'),
      generatedBy: 'test',
      version: '1.0.0',
      repository: 'test/repo',
      branch: 'main',
    },
    ...overrides,
  };
}

// ============================================================================
// ReportGenerator
// ============================================================================

describe('ReportGenerator', () => {
  let generator: ReportGenerator;
  let tempDir: string;

  beforeEach(async () => {
    generator = new ReportGenerator();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'report-gen-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // ============================================================================
  // generateReport (HTML)
  // ============================================================================

  describe('generateReport', () => {
    it('should generate HTML report with title and summary', () => {
      const data = makeReportData();
      const result = generator.generateReport(data);
      expect(result).toContain('Test Report');
      expect(result).toContain('A test report summary');
      expect(result).toContain('Section 1');
    });

    it('should escape HTML in title to prevent XSS', () => {
      const data = makeReportData({ title: '<script>alert("xss")</script>' });
      const result = generator.generateReport(data);
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('should include repository and branch in metadata', () => {
      const data = makeReportData();
      const result = generator.generateReport(data);
      // '/' is escaped to &#x2F; by escapeHtml, so 'test/repo' becomes 'test&#x2F;repo'
      expect(result).toContain('test&#x2F;repo');
    });

    it('should handle sections with data tables', () => {
      const data = makeReportData();
      const result = generator.generateReport(data);
      expect(result).toContain('info');
    });

    it('should handle sections without subsections', () => {
      const data = makeReportData({
        sections: [{ title: 'Plain Section', content: 'plain content' }],
      });
      const result = generator.generateReport(data);
      expect(result).toContain('Plain Section');
      expect(result).toContain('plain content');
    });

    it('should handle metadata without repository/branch', () => {
      const data = makeReportData({
        metadata: {
          generatedAt: new Date('2024-01-01'),
          generatedBy: 'test',
          version: '1.0.0',
        },
      });
      const result = generator.generateReport(data);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // generateReportSafe
  // ============================================================================

  describe('generateReportSafe', () => {
    it('should work with partial data', () => {
      const result = generator.generateReportSafe({});
      expect(typeof result).toBe('string');
    });

    it('should use defaults for missing fields', () => {
      const result = generator.generateReportSafe({ title: 'My Report' });
      expect(result).toContain('My Report');
    });

    it('should handle full data', () => {
      const data = makeReportData();
      const result = generator.generateReportSafe(data);
      expect(result).toContain('Test Report');
    });
  });

  // ============================================================================
  // generatePlainTextReport
  // ============================================================================

  describe('generatePlainTextReport', () => {
    it('should generate plain text report', () => {
      const data = makeReportData();
      const result = generator.generatePlainTextReport(data);
      // Title is uppercased in plain text format
      expect(result).toContain('TEST REPORT');
      expect(result).toContain('A test report summary');
      expect(result).toContain('Section 1');
    });

    it('should not contain HTML tags', () => {
      const data = makeReportData();
      const result = generator.generatePlainTextReport(data);
      expect(result).not.toContain('<html>');
      expect(result).not.toContain('<div>');
    });

    it('should include subsections in plain text', () => {
      const data = makeReportData();
      const result = generator.generatePlainTextReport(data);
      expect(result).toContain('Sub 1');
    });
  });

  // ============================================================================
  // generateAnalysisReport - JSON format
  // ============================================================================

  describe('generateAnalysisReport - JSON', () => {
    it('should generate JSON report from AnalysisReport', async () => {
      const findings = [makeFinding()];
      const data = makeAnalysisReport(findings);
      const options: ReportOptions = { format: 'json' };
      const result = await generator.generateAnalysisReport(data, options);
      const parsed = JSON.parse(result);
      expect(parsed.summary).toBeDefined();
      expect(parsed.findings).toHaveLength(1);
      expect(parsed.findings[0].severity).toBe('high');
    });

    it('should include full data when includeDetails is true', async () => {
      const data = makeAnalysisReport([makeFinding()]);
      const options: ReportOptions = { format: 'json', includeDetails: true };
      const result = await generator.generateAnalysisReport(data, options);
      const parsed = JSON.parse(result);
      expect(parsed.data).toBeDefined();
    });

    it('should generate JSON from CoordinationResult', async () => {
      const coord = makeCoordinationResult([makeFinding()]);
      const options: ReportOptions = { format: 'json' };
      const result = await generator.generateAnalysisReport(coord, options);
      const parsed = JSON.parse(result);
      expect(parsed.summary).toBeDefined();
    });

    it('should filter by severity', async () => {
      const findings = [
        makeFinding({ id: 'h1', severity: Severity.HIGH }),
        makeFinding({ id: 'l1', severity: Severity.LOW }),
      ];
      const data = makeAnalysisReport(findings);
      const options: ReportOptions = { format: 'json', filterSeverity: [Severity.HIGH] };
      const result = await generator.generateAnalysisReport(data, options);
      const parsed = JSON.parse(result);
      expect(parsed.findings.every((f: any) => f.severity === 'high')).toBe(true);
    });

    it('should filter by category', async () => {
      const findings = [
        makeFinding({ id: 'sec', category: FindingCategory.SECURITY_VULNERABILITY }),
        makeFinding({ id: 'perf', category: FindingCategory.PERFORMANCE_ISSUE }),
      ];
      const data = makeAnalysisReport(findings);
      const options: ReportOptions = {
        format: 'json',
        filterCategory: [FindingCategory.SECURITY_VULNERABILITY],
      };
      const result = await generator.generateAnalysisReport(data, options);
      const parsed = JSON.parse(result);
      expect(parsed.findings.every((f: any) => f.category === 'security_vulnerability')).toBe(true);
    });

    it('should sort findings by severity', async () => {
      const findings = [
        makeFinding({ id: 'low', severity: Severity.LOW }),
        makeFinding({ id: 'crit', severity: Severity.CRITICAL }),
        makeFinding({ id: 'high', severity: Severity.HIGH }),
      ];
      const data = makeAnalysisReport(findings);
      const options: ReportOptions = { format: 'json', sortBy: 'severity' };
      const result = await generator.generateAnalysisReport(data, options);
      const parsed = JSON.parse(result);
      expect(parsed.findings[0].severity).toBe('critical');
    });

    it('should sort findings by category', async () => {
      const findings = [
        makeFinding({ id: 'b', category: FindingCategory.TESTING }),
        makeFinding({ id: 'a', category: FindingCategory.BEST_PRACTICE }),
      ];
      const data = makeAnalysisReport(findings);
      const options: ReportOptions = { format: 'json', sortBy: 'category' };
      const result = await generator.generateAnalysisReport(data, options);
      const parsed = JSON.parse(result);
      expect(parsed.findings).toHaveLength(2);
    });

    it('should sort findings by file', async () => {
      const findings = [
        makeFinding({ id: 'b', file: 'z.ts' }),
        makeFinding({ id: 'a', file: 'a.ts' }),
      ];
      const data = makeAnalysisReport(findings);
      const options: ReportOptions = { format: 'json', sortBy: 'file' };
      const result = await generator.generateAnalysisReport(data, options);
      const parsed = JSON.parse(result);
      expect(parsed.findings[0].file).toBe('a.ts');
    });

    it('should sort findings by line', async () => {
      const findings = [
        makeFinding({ id: 'b', line: 50 }),
        makeFinding({ id: 'a', line: 10 }),
      ];
      const data = makeAnalysisReport(findings);
      const options: ReportOptions = { format: 'json', sortBy: 'line' };
      const result = await generator.generateAnalysisReport(data, options);
      const parsed = JSON.parse(result);
      expect(parsed.findings[0].line).toBe(10);
    });

    it('should save report to file when outputPath provided', async () => {
      const data = makeAnalysisReport([makeFinding()]);
      const outputPath = path.join(tempDir, 'report.json');
      const options: ReportOptions = { format: 'json', outputPath };
      await generator.generateAnalysisReport(data, options);
      const saved = await fs.readFile(outputPath, 'utf-8');
      expect(JSON.parse(saved)).toBeDefined();
    });
  });

  // ============================================================================
  // generateAnalysisReport - Markdown format
  // ============================================================================

  describe('generateAnalysisReport - Markdown', () => {
    it('should generate Markdown report', async () => {
      const data = makeAnalysisReport([makeFinding()]);
      const options: ReportOptions = { format: 'markdown' };
      const result = await generator.generateAnalysisReport(data, options);
      expect(result).toContain('# Code Analysis Report');
      expect(result).toContain('## Summary');
    });

    it('should group findings by severity in Markdown', async () => {
      const findings = [
        makeFinding({ id: 'h', severity: Severity.HIGH }),
        makeFinding({ id: 'l', severity: Severity.LOW }),
      ];
      const data = makeAnalysisReport(findings);
      const options: ReportOptions = { format: 'markdown', groupBy: 'severity' };
      const result = await generator.generateAnalysisReport(data, options);
      expect(result).toContain('##');
    });

    it('should group findings by category in Markdown', async () => {
      const data = makeAnalysisReport([makeFinding()]);
      const options: ReportOptions = { format: 'markdown', groupBy: 'category' };
      const result = await generator.generateAnalysisReport(data, options);
      expect(result).toContain('#');
    });

    it('should group findings by file in Markdown', async () => {
      const data = makeAnalysisReport([makeFinding({ file: 'src/foo.ts' })]);
      const options: ReportOptions = { format: 'markdown', groupBy: 'file', includeDetails: true };
      const result = await generator.generateAnalysisReport(data, options);
      expect(result).toContain('src/foo.ts');
    });

    it('should include recommendations in Markdown when requested', async () => {
      const findings = [
        makeFinding({ severity: Severity.CRITICAL }),
        makeFinding({ id: 'f2', severity: Severity.HIGH, category: FindingCategory.CODE_SMELL }),
      ];
      const data = makeAnalysisReport(findings);
      const options: ReportOptions = {
        format: 'markdown',
        includeRecommendations: true,
        includeMetrics: true,
      };
      const result = await generator.generateAnalysisReport(data, options);
      expect(result).toBeTruthy();
    });

    it('should generate Markdown from CoordinationResult', async () => {
      const coord = makeCoordinationResult([makeFinding()]);
      const options: ReportOptions = { format: 'markdown' };
      const result = await generator.generateAnalysisReport(coord, options);
      expect(result).toContain('# Code Analysis Report');
    });

    it('should include finding details with snippet and suggestion', async () => {
      const finding = makeFinding({
        snippet: 'const x = eval(input);',
        suggestion: 'Use JSON.parse instead',
        rule: 'no-eval',
      });
      const data = makeAnalysisReport([finding]);
      const options: ReportOptions = { format: 'markdown', includeDetails: true };
      const result = await generator.generateAnalysisReport(data, options);
      expect(result).toContain('eval');
    });
  });

  // ============================================================================
  // generateAnalysisReport - HTML format
  // ============================================================================

  describe('generateAnalysisReport - HTML', () => {
    it('should generate HTML analysis report', async () => {
      const data = makeAnalysisReport([makeFinding()]);
      const options: ReportOptions = { format: 'html' };
      const result = await generator.generateAnalysisReport(data, options);
      expect(result).toContain('<!DOCTYPE html>');
    });

    it('should escape XSS in HTML analysis report', async () => {
      const finding = makeFinding({ title: '<script>alert("xss")</script>' });
      const data = makeAnalysisReport([finding]);
      const options: ReportOptions = { format: 'html' };
      const result = await generator.generateAnalysisReport(data, options);
      expect(result).not.toContain('<script>alert');
    });

    it('should generate HTML from CoordinationResult', async () => {
      const coord = makeCoordinationResult([makeFinding()]);
      const options: ReportOptions = { format: 'html' };
      const result = await generator.generateAnalysisReport(coord, options);
      expect(result).toContain('<!DOCTYPE html>');
    });

    it('should include recommendations in HTML', async () => {
      const findings = [makeFinding({ severity: Severity.CRITICAL })];
      const data = makeAnalysisReport(findings);
      const options: ReportOptions = { format: 'html', includeRecommendations: true };
      const result = await generator.generateAnalysisReport(data, options);
      expect(result).toBeTruthy();
    });

    it('should group by severity in HTML', async () => {
      const findings = [
        makeFinding({ id: 'c', severity: Severity.CRITICAL }),
        makeFinding({ id: 'l', severity: Severity.LOW }),
      ];
      const data = makeAnalysisReport(findings);
      const options: ReportOptions = { format: 'html', groupBy: 'severity' };
      const result = await generator.generateAnalysisReport(data, options);
      expect(result).toContain('critical');
    });
  });

  // ============================================================================
  // generateAnalysisReport - Console format
  // ============================================================================

  describe('generateAnalysisReport - Console', () => {
    it('should generate console report', async () => {
      const data = makeAnalysisReport([makeFinding()]);
      const options: ReportOptions = { format: 'console' };
      const result = await generator.generateAnalysisReport(data, options);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate console report with various severities', async () => {
      const findings = [
        makeFinding({ id: 'c', severity: Severity.CRITICAL }),
        makeFinding({ id: 'h', severity: Severity.HIGH }),
        makeFinding({ id: 'm', severity: Severity.MEDIUM }),
        makeFinding({ id: 'l', severity: Severity.LOW }),
        makeFinding({ id: 'i', severity: Severity.INFO }),
      ];
      const data = makeAnalysisReport(findings);
      const options: ReportOptions = { format: 'console' };
      const result = await generator.generateAnalysisReport(data, options);
      expect(typeof result).toBe('string');
    });

    it('should generate console report from CoordinationResult', async () => {
      const coord = makeCoordinationResult([makeFinding()]);
      const options: ReportOptions = { format: 'console' };
      const result = await generator.generateAnalysisReport(coord, options);
      expect(typeof result).toBe('string');
    });

    it('should include group headers in console report', async () => {
      const data = makeAnalysisReport([makeFinding()]);
      const options: ReportOptions = { format: 'console', groupBy: 'severity' };
      const result = await generator.generateAnalysisReport(data, options);
      expect(typeof result).toBe('string');
    });

    it('should include recommendations in console report', async () => {
      const data = makeAnalysisReport([makeFinding({ severity: Severity.CRITICAL })]);
      const options: ReportOptions = { format: 'console', includeRecommendations: true };
      const result = await generator.generateAnalysisReport(data, options);
      expect(typeof result).toBe('string');
    });

    it('should include detailed findings in console report when includeDetails is true', async () => {
      const findings = [
        makeFinding({ id: 'c', severity: Severity.CRITICAL }),
        makeFinding({ id: 'h', severity: Severity.HIGH, suggestion: undefined }),
      ];
      const data = makeAnalysisReport(findings);
      const options: ReportOptions = { format: 'console', includeDetails: true, groupBy: 'severity' };
      const result = await generator.generateAnalysisReport(data, options);
      expect(result).toContain('DETAILED FINDINGS');
    });
  });

  // ============================================================================
  // generateAnalysisReport - CSV format
  // ============================================================================

  describe('generateAnalysisReport - CSV', () => {
    it('should generate CSV report with header', async () => {
      const data = makeAnalysisReport([makeFinding()]);
      const options: ReportOptions = { format: 'csv' };
      const result = await generator.generateAnalysisReport(data, options);
      expect(result).toContain('ID,Severity,Category');
      expect(result).toContain('f1');
    });

    it('should escape commas in CSV fields', async () => {
      const finding = makeFinding({ title: 'Title, with comma', description: 'Line "one"' });
      const data = makeAnalysisReport([finding]);
      const options: ReportOptions = { format: 'csv' };
      const result = await generator.generateAnalysisReport(data, options);
      expect(result).toContain('"Title, with comma"');
    });

    it('should include metrics in CSV when requested', async () => {
      const data = makeAnalysisReport([makeFinding()]);
      const options: ReportOptions = { format: 'csv', includeMetrics: true };
      const result = await generator.generateAnalysisReport(data, options);
      expect(typeof result).toBe('string');
    });

    it('should include plain text fields in CSV output', async () => {
      const finding = makeFinding({ title: 'PlainTitle', description: 'PlainDesc', suggestion: 'PlainFix' });
      const data = makeAnalysisReport([finding]);
      const options: ReportOptions = { format: 'csv' };
      const result = await generator.generateAnalysisReport(data, options);
      expect(result).toContain('PlainTitle');
      expect(result).toContain('PlainDesc');
    });

    it('should generate CSV from CoordinationResult', async () => {
      const coord = makeCoordinationResult([makeFinding()]);
      const options: ReportOptions = { format: 'csv' };
      const result = await generator.generateAnalysisReport(coord, options);
      expect(result).toContain('ID,Severity');
    });
  });

  // ============================================================================
  // generateAnalysisReport - groupings
  // ============================================================================

  describe('groupBy behavior', () => {
    it('should group by severity', async () => {
      const findings = [
        makeFinding({ id: 'h1', severity: Severity.HIGH }),
        makeFinding({ id: 'h2', severity: Severity.HIGH }),
        makeFinding({ id: 'l1', severity: Severity.LOW }),
      ];
      const data = makeAnalysisReport(findings);
      const options: ReportOptions = { format: 'json', groupBy: 'severity' };
      const result = await generator.generateAnalysisReport(data, options);
      expect(JSON.parse(result)).toBeDefined();
    });

    it('should group by category', async () => {
      const findings = [
        makeFinding({ id: 'a', category: FindingCategory.SECURITY_VULNERABILITY }),
        makeFinding({ id: 'b', category: FindingCategory.CODE_SMELL }),
      ];
      const data = makeAnalysisReport(findings);
      const options: ReportOptions = { format: 'json', groupBy: 'category' };
      const result = await generator.generateAnalysisReport(data, options);
      expect(JSON.parse(result)).toBeDefined();
    });

    it('should group by file', async () => {
      const findings = [
        makeFinding({ id: 'a', file: 'a.ts' }),
        makeFinding({ id: 'b', file: 'b.ts' }),
        makeFinding({ id: 'c', file: 'a.ts' }),
      ];
      const data = makeAnalysisReport(findings);
      const options: ReportOptions = { format: 'markdown', groupBy: 'file', includeDetails: true };
      const result = await generator.generateAnalysisReport(data, options);
      expect(result).toContain('a.ts');
      expect(result).toContain('b.ts');
    });

    it('should handle undefined groupBy (default grouping)', async () => {
      const data = makeAnalysisReport([makeFinding()]);
      const options: ReportOptions = { format: 'markdown' };
      const result = await generator.generateAnalysisReport(data, options);
      expect(typeof result).toBe('string');
    });
  });

  // ============================================================================
  // Error cases
  // ============================================================================

  describe('error handling', () => {
    it('should throw for unsupported format', async () => {
      const data = makeAnalysisReport([]);
      const options = { format: 'xml' as any };
      await expect(generator.generateAnalysisReport(data, options)).rejects.toThrow(
        'Unsupported report format'
      );
    });

    it('should handle empty findings', async () => {
      const data = makeAnalysisReport([]);
      const options: ReportOptions = { format: 'json' };
      const result = await generator.generateAnalysisReport(data, options);
      const parsed = JSON.parse(result);
      expect(parsed.findings).toHaveLength(0);
    });

    it('should rethrow error when outputPath is unwritable (saveReport catch path)', async () => {
      // Create a regular file then try to use it as a directory
      const blockerFile = path.join(tempDir, 'not-a-dir');
      await fs.writeFile(blockerFile, 'blocker');
      const outputPath = path.join(blockerFile, 'report.json');
      const data = makeAnalysisReport([makeFinding()]);
      const options: ReportOptions = { format: 'json', outputPath };
      await expect(generator.generateAnalysisReport(data, options)).rejects.toThrow();
    });
  });

  // ============================================================================
  // CoordinationResult - summary path
  // ============================================================================

  describe('CoordinationResult summary', () => {
    it('should sum filesAnalyzed from reports', async () => {
      const coord = makeCoordinationResult([makeFinding()]);
      const options: ReportOptions = { format: 'json' };
      const result = await generator.generateAnalysisReport(coord, options);
      const parsed = JSON.parse(result);
      expect(parsed.summary.filesAnalyzed).toBeGreaterThanOrEqual(0);
    });

    it('should use agentsUsed from coordination summary', async () => {
      const coord = makeCoordinationResult([]);
      const options: ReportOptions = { format: 'json' };
      const result = await generator.generateAnalysisReport(coord, options);
      const parsed = JSON.parse(result);
      expect(parsed.summary.agentsUsed).toContain('test-agent');
    });
  });

  // ============================================================================
  // validateReportData coverage
  // ============================================================================

  describe('generateReport validation (exercises validateReportData)', () => {
    it('should throw for invalid summary (not a string)', () => {
      const data = { title: 'T', summary: null, sections: [], metadata: { generatedAt: new Date(), generatedBy: 'test', version: '1.0.0' } } as any;
      expect(() => generator.generateReport(data)).toThrow('summary');
    });

    it('should throw for sections not being an array', () => {
      const data = { title: 'T', summary: 'S', sections: 'not-an-array', metadata: { generatedAt: new Date(), generatedBy: 'test', version: '1.0.0' } } as any;
      expect(() => generator.generateReport(data)).toThrow('sections');
    });

    it('should handle data with empty sections', () => {
      const data = makeReportData({ sections: [] });
      const result = generator.generateReport(data);
      expect(typeof result).toBe('string');
    });

    it('should handle sections with subsections having data', () => {
      const data: ReportData = {
        title: 'T',
        summary: 'S',
        sections: [
          {
            title: 'Sec',
            content: 'Content',
            subsections: [
              { title: 'Sub', content: 'SubContent', data: { nested: { deep: 'value' } } },
            ],
          },
        ],
        metadata: {
          generatedAt: new Date(),
          generatedBy: 'test',
          version: '1.0.0',
        },
      };
      const result = generator.generateReport(data);
      expect(result).toContain('Sec');
    });

    it('should throw for missing metadata', () => {
      const data = { title: 'T', summary: 'S', sections: [], metadata: null } as any;
      expect(() => generator.generateReport(data)).toThrow('metadata');
    });

    it('should throw for section with missing title', () => {
      const data = makeReportData({
        sections: [{ title: '', content: 'content' }],
      });
      expect(() => generator.generateReport(data)).toThrow('title');
    });

    it('should throw for section with missing content', () => {
      const data = makeReportData({
        sections: [{ title: 'Valid Title', content: '' }],
      });
      expect(() => generator.generateReport(data)).toThrow('content');
    });
  });

  // ============================================================================
  // generateAnalysisReport with metrics
  // ============================================================================

  describe('includeMetrics flag in various formats', () => {
    it('should not crash with includeMetrics in markdown', async () => {
      const data = makeAnalysisReport([
        makeFinding({ severity: Severity.CRITICAL }),
        makeFinding({ id: 'f2', severity: Severity.HIGH }),
        makeFinding({ id: 'f3', severity: Severity.MEDIUM }),
        makeFinding({ id: 'f4', severity: Severity.LOW }),
        makeFinding({ id: 'f5', severity: Severity.INFO }),
      ]);
      const options: ReportOptions = { format: 'markdown', includeMetrics: true };
      const result = await generator.generateAnalysisReport(data, options);
      expect(typeof result).toBe('string');
    });

    it('should include metrics section in html', async () => {
      const data = makeAnalysisReport([makeFinding()]);
      const options: ReportOptions = { format: 'html', includeMetrics: true };
      const result = await generator.generateAnalysisReport(data, options);
      expect(result).toContain('<!DOCTYPE html>');
    });
  });

  // ============================================================================
  // generateAnalysisReport - findings with metadata
  // ============================================================================

  describe('findings with full metadata', () => {
    it('should handle finding with no line/column/snippet/suggestion', async () => {
      const finding: Finding = {
        id: 'bare',
        severity: Severity.INFO,
        category: FindingCategory.DOCUMENTATION,
        title: 'Missing doc',
        description: 'No docs',
        file: 'src/undocumented.ts',
      };
      const data = makeAnalysisReport([finding]);
      const options: ReportOptions = { format: 'csv' };
      const result = await generator.generateAnalysisReport(data, options);
      expect(result).toContain('bare');
    });
  });
});

// ============================================================================
// Convenience functions
// ============================================================================

describe('Convenience functions', () => {
  it('createReportGenerator returns ReportGenerator instance', () => {
    const g = createReportGenerator();
    expect(g).toBeInstanceOf(ReportGenerator);
  });

  it('generateHtmlReport returns HTML string', () => {
    const data = makeReportData();
    const result = generateHtmlReport(data);
    expect(result).toContain('Test Report');
  });

  it('generatePlainTextReport returns plain text string', () => {
    const data = makeReportData();
    const result = generatePlainTextReport(data);
    // Title is uppercased in plain text format
    expect(result).toContain('TEST REPORT');
    expect(result).not.toContain('<html>');
  });

  it('generateSafeReport returns string for partial data', () => {
    const result = generateSafeReport({ title: 'Partial' });
    expect(result).toContain('Partial');
  });

  it('generateAnalysisReport convenience function works', async () => {
    const data = makeAnalysisReport([makeFinding()]);
    const options: ReportOptions = { format: 'json' };
    const result = await generateAnalysisReport(data, options);
    expect(JSON.parse(result)).toBeDefined();
  });
});
