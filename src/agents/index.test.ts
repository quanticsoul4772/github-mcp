/**
 * Tests for agents/index.ts utility functions
 */
import { describe, it, expect } from 'vitest';
import {
  shouldSkipDirectory,
  shouldIncludeFile,
  generateTextReport,
  generateHtmlReport,
  createAgentSystem,
} from './index.js';

describe('shouldSkipDirectory', () => {
  it('should skip known directories', () => {
    expect(shouldSkipDirectory('node_modules')).toBe(true);
    expect(shouldSkipDirectory('.git')).toBe(true);
    expect(shouldSkipDirectory('dist')).toBe(true);
    expect(shouldSkipDirectory('build')).toBe(true);
    expect(shouldSkipDirectory('coverage')).toBe(true);
  });

  it('should not skip normal directories', () => {
    expect(shouldSkipDirectory('src')).toBe(false);
    expect(shouldSkipDirectory('lib')).toBe(false);
    expect(shouldSkipDirectory('test')).toBe(false);
  });
});

describe('shouldIncludeFile', () => {
  it('should include ts/js files by default', () => {
    expect(shouldIncludeFile('src/foo.ts')).toBe(true);
    expect(shouldIncludeFile('src/bar.js')).toBe(true);
    expect(shouldIncludeFile('src/app.tsx')).toBe(true);
    expect(shouldIncludeFile('src/app.jsx')).toBe(true);
    expect(shouldIncludeFile('package.json')).toBe(true);
  });

  it('should exclude files matching exclude patterns', () => {
    expect(shouldIncludeFile('src/foo.ts', undefined, ['\\.test\\.ts$'])).toBe(true);
    expect(shouldIncludeFile('src/foo.test.ts', undefined, ['\\.test\\.ts$'])).toBe(false);
  });

  it('should include files matching include patterns', () => {
    expect(shouldIncludeFile('src/foo.ts', ['\\.ts$'])).toBe(true);
    expect(shouldIncludeFile('src/bar.js', ['\\.ts$'])).toBe(false);
  });

  it('should return false for unknown extensions with no include patterns', () => {
    expect(shouldIncludeFile('README.md')).toBe(false);
    expect(shouldIncludeFile('image.png')).toBe(false);
  });

  it('should check exclude before include', () => {
    // excluded by pattern, even though it would match include
    expect(shouldIncludeFile('src/foo.ts', ['\\.ts$'], ['src/foo'])).toBe(false);
  });
});

describe('generateTextReport', () => {
  const makeReport = (findings: any[] = []) => ({
    summary: {
      totalFindings: findings.length,
      criticalFindings: 0,
      highFindings: 0,
      mediumFindings: 0,
      lowFindings: 0,
      filesAnalyzed: 2,
    },
    findings,
  });

  it('should produce a report with summary header', () => {
    const result = generateTextReport(makeReport());
    expect(result).toContain('ANALYSIS SUMMARY');
    expect(result).toContain('Total Findings: 0');
    expect(result).toContain('Files Analyzed: 2');
  });

  it('should include findings when present', () => {
    const report = makeReport([
      { message: 'No error handling', file: 'src/index.ts', line: 10, fix: 'Add try/catch' },
    ]);
    const result = generateTextReport(report);
    expect(result).toContain('FINDINGS');
    expect(result).toContain('No error handling');
    expect(result).toContain('src/index.ts:10');
    expect(result).toContain('Add try/catch');
  });

  it('should handle findings without file or fix', () => {
    const report = makeReport([{ message: 'Generic issue' }]);
    const result = generateTextReport(report);
    expect(result).toContain('Generic issue');
  });

  it('should handle finding with file but no line', () => {
    const report = makeReport([{ message: 'Issue', file: 'src/foo.ts' }]);
    const result = generateTextReport(report);
    expect(result).toContain('src/foo.ts');
    expect(result).not.toContain('src/foo.ts:');
  });
});

describe('generateHtmlReport', () => {
  const makeReport = (findings: any[] = []) => ({
    summary: {
      totalFindings: findings.length,
      criticalFindings: 1,
      highFindings: 2,
      mediumFindings: 3,
      lowFindings: 4,
      filesAnalyzed: 5,
    },
    findings,
  });

  it('should produce valid HTML with summary', () => {
    const result = generateHtmlReport(makeReport());
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('Code Analysis Report');
    expect(result).toContain('Total Findings:');
  });

  it('should render findings in HTML', () => {
    const report = makeReport([
      { message: 'SQL injection', severity: 'critical', file: 'src/db.ts', line: 5, fix: 'Use parameterized queries' },
    ]);
    const result = generateHtmlReport(report);
    expect(result).toContain('SQL injection');
    expect(result).toContain('critical');
    expect(result).toContain('src/db.ts:5');
    expect(result).toContain('Use parameterized queries');
  });

  it('should handle findings without file or fix', () => {
    const report = makeReport([{ message: 'Bare finding', severity: 'low' }]);
    const result = generateHtmlReport(report);
    expect(result).toContain('Bare finding');
  });
});

describe('createAgentSystem', () => {
  it('should return registry, coordinator, reportGenerator, and agents', () => {
    const system = createAgentSystem();
    expect(system.registry).toBeDefined();
    expect(system.coordinator).toBeDefined();
    expect(system.reportGenerator).toBeDefined();
    expect(Array.isArray(system.agents)).toBe(true);
    expect(system.agents.length).toBeGreaterThan(0);
  });
});
