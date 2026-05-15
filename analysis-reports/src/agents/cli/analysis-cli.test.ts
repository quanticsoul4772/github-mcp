/**
 * Tests for AnalysisCLI class
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { AnalysisCLI } from './analysis-cli.js';

const mockReport = {
  summary: {
    totalFindings: 2,
    criticalFindings: 0,
    highFindings: 1,
    mediumFindings: 1,
    lowFindings: 0,
    infoFindings: 0,
    filesAnalyzed: 1,
    totalExecutionTime: 50,
  },
  findings: [
    {
      id: 'f1',
      severity: 'high',
      category: 'bug',
      message: 'Potential null',
      file: 'src/a.ts',
      line: 5,
      title: 'Null dereference',
      suggestion: 'Add null check',
      evidence: 'const x = obj.prop',
    },
    {
      id: 'f2',
      severity: 'medium',
      category: 'style',
      message: 'Long line',
      file: 'src/b.ts',
      line: 10,
      title: 'Long line',
      suggestion: 'Wrap line',
    },
  ],
  agentResults: [
    { agentName: 'code-analysis', duration: 50, findings: [], errors: [] },
  ],
  recommendations: ['Consider adding error handling', 'Add more tests'],
};

describe('AnalysisCLI', () => {
  let cli: AnalysisCLI;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let tmpDir: string;

  beforeEach(async () => {
    cli = new AnalysisCLI();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as any);
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-test-'));
  });

  afterEach(async () => {
    exitSpy.mockRestore();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should construct without error', () => {
    expect(cli).toBeDefined();
  });

  // ============================================================
  // Private helper: shouldSkipDirectory
  // ============================================================
  describe('shouldSkipDirectory', () => {
    it('should skip node_modules and .git', () => {
      const skip = (cli as any).shouldSkipDirectory.bind(cli);
      expect(skip('node_modules')).toBe(true);
      expect(skip('.git')).toBe(true);
      expect(skip('dist')).toBe(true);
      expect(skip('build')).toBe(true);
      expect(skip('coverage')).toBe(true);
      expect(skip('.nyc_output')).toBe(true);
      expect(skip('.next')).toBe(true);
      expect(skip('.nuxt')).toBe(true);
      expect(skip('.vuepress')).toBe(true);
      expect(skip('.svn')).toBe(true);
      expect(skip('.hg')).toBe(true);
    });

    it('should not skip src or lib', () => {
      const skip = (cli as any).shouldSkipDirectory.bind(cli);
      expect(skip('src')).toBe(false);
      expect(skip('lib')).toBe(false);
    });
  });

  // ============================================================
  // Private helper: shouldIncludeFile
  // ============================================================
  describe('shouldIncludeFile', () => {
    it('should include .ts and .js files by default', () => {
      const include = (cli as any).shouldIncludeFile.bind(cli);
      expect(include('src/foo.ts')).toBe(true);
      expect(include('src/bar.js')).toBe(true);
      expect(include('src/app.tsx')).toBe(true);
      expect(include('src/app.jsx')).toBe(true);
      expect(include('package.json')).toBe(true);
    });

    it('should exclude files matching exclude patterns', () => {
      const include = (cli as any).shouldIncludeFile.bind(cli);
      expect(include('src/foo.test.ts', undefined, ['*.test.ts'])).toBe(false);
      expect(include('src/foo.ts', undefined, ['*.test.ts'])).toBe(true);
    });

    it('should use include patterns when provided', () => {
      const include = (cli as any).shouldIncludeFile.bind(cli);
      expect(include('src/foo.ts', ['*.ts'])).toBe(true);
      expect(include('src/bar.js', ['*.ts'])).toBe(false);
    });

    it('should return false for non-source files by default', () => {
      const include = (cli as any).shouldIncludeFile.bind(cli);
      expect(include('README.md')).toBe(false);
      expect(include('image.png')).toBe(false);
    });
  });

  // ============================================================
  // Private helper: getSeverityIcon
  // ============================================================
  describe('getSeverityIcon', () => {
    it('should return correct icons for known severities', () => {
      const icon = (cli as any).getSeverityIcon.bind(cli);
      expect(icon('critical')).toBe('🔴');
      expect(icon('high')).toBe('🟠');
      expect(icon('medium')).toBe('🟡');
      expect(icon('low')).toBe('🟢');
      expect(icon('info')).toBe('ℹ️');
    });

    it('should return fallback icon for unknown severity', () => {
      const icon = (cli as any).getSeverityIcon.bind(cli);
      expect(icon('unknown')).toBe('❓');
    });
  });

  // ============================================================
  // Private helper: directoryExists
  // ============================================================
  describe('directoryExists', () => {
    it('should return true for existing directory', async () => {
      const exists = (cli as any).directoryExists.bind(cli);
      expect(await exists(tmpDir)).toBe(true);
    });

    it('should return false for nonexistent path', async () => {
      const exists = (cli as any).directoryExists.bind(cli);
      expect(await exists('/nonexistent/path/that/does/not/exist')).toBe(false);
    });

    it('should return false for a file (not directory)', async () => {
      const filePath = path.join(tmpDir, 'file.txt');
      await fs.writeFile(filePath, 'content');
      const exists = (cli as any).directoryExists.bind(cli);
      expect(await exists(filePath)).toBe(false);
    });
  });

  // ============================================================
  // Private helper: loadConfiguration
  // ============================================================
  describe('loadConfiguration', () => {
    it('should load valid JSON config file', async () => {
      const configPath = path.join(tmpDir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify({ maxFindings: 100, depth: 'deep' }));
      const load = (cli as any).loadConfiguration.bind(cli);
      const result = await load(configPath);
      expect(result).toBeInstanceOf(Map);
      expect(result.get('maxFindings')).toBe(100);
    });

    it('should return empty map for missing config file', async () => {
      const load = (cli as any).loadConfiguration.bind(cli);
      const result = await load('/nonexistent/config.json');
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  // ============================================================
  // Private helper: formatJsonReport
  // ============================================================
  describe('formatJsonReport', () => {
    it('should return JSON string of report', () => {
      const format = (cli as any).formatJsonReport.bind(cli);
      const result = format(mockReport);
      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result);
      expect(parsed.summary.totalFindings).toBe(2);
    });
  });

  // ============================================================
  // Private helper: groupFindingsBySeverity
  // ============================================================
  describe('groupFindingsBySeverity', () => {
    it('should group findings by severity', () => {
      const group = (cli as any).groupFindingsBySeverity.bind(cli);
      const result = group(mockReport.findings);
      expect(result.high).toHaveLength(1);
      expect(result.medium).toHaveLength(1);
    });
  });

  // ============================================================
  // Private helper: discoverFiles
  // ============================================================
  describe('discoverFiles', () => {
    it('should find .ts files in a directory', async () => {
      await fs.writeFile(path.join(tmpDir, 'a.ts'), 'const x = 1;');
      await fs.writeFile(path.join(tmpDir, 'b.js'), 'const y = 2;');
      await fs.writeFile(path.join(tmpDir, 'README.md'), '# Doc');

      const discover = (cli as any).discoverFiles.bind(cli);
      const files = await discover(tmpDir);
      expect(files).toContain('a.ts');
      expect(files).toContain('b.js');
      expect(files).not.toContain('README.md');
    });

    it('should skip node_modules directory', async () => {
      const nmDir = path.join(tmpDir, 'node_modules');
      await fs.mkdir(nmDir);
      await fs.writeFile(path.join(nmDir, 'lib.js'), 'module.exports = {};');

      const discover = (cli as any).discoverFiles.bind(cli);
      const files = await discover(tmpDir);
      expect(files.every((f: string) => !f.startsWith('node_modules'))).toBe(true);
    });

    it('should filter with include patterns', async () => {
      await fs.writeFile(path.join(tmpDir, 'main.ts'), 'export {};');
      await fs.writeFile(path.join(tmpDir, 'main.test.ts'), 'test("x", () => {});');

      const discover = (cli as any).discoverFiles.bind(cli);
      const files = await discover(tmpDir, ['*.test.ts']);
      expect(files.some((f: string) => f.endsWith('.test.ts'))).toBe(true);
      expect(files.some((f: string) => f === 'main.ts')).toBe(false);
    });
  });

  // ============================================================
  // run() - success paths with mocked coordinator
  // ============================================================
  describe('run()', () => {
    beforeEach(() => {
      vi.spyOn((cli as any).coordinator, 'runFullAnalysis').mockResolvedValue(mockReport);
      vi.spyOn((cli as any).coordinator, 'runSelectedAgents').mockResolvedValue(mockReport);
    });

    it('should run analysis and exit with 0 when no critical findings', async () => {
      await fs.writeFile(path.join(tmpDir, 'a.ts'), 'const x = 1;');
      await expect(
        cli.run({ projectPath: tmpDir })
      ).rejects.toThrow('process.exit called');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should exit with 1 when critical findings present', async () => {
      vi.spyOn((cli as any).coordinator, 'runFullAnalysis').mockResolvedValue({
        ...mockReport,
        summary: { ...mockReport.summary, criticalFindings: 1 },
      });

      await fs.writeFile(path.join(tmpDir, 'a.ts'), 'const x = 1;');
      await expect(cli.run({ projectPath: tmpDir })).rejects.toThrow('process.exit called');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should run selected agents when agents option is provided', async () => {
      await fs.writeFile(path.join(tmpDir, 'a.ts'), 'const x = 1;');
      await expect(
        cli.run({ projectPath: tmpDir, agents: ['code-analysis'] })
      ).rejects.toThrow('process.exit called');
      expect((cli as any).coordinator.runSelectedAgents).toHaveBeenCalled();
    });

    it('should write output to file when output option provided', async () => {
      await fs.writeFile(path.join(tmpDir, 'a.ts'), 'const x = 1;');
      const outputPath = path.join(tmpDir, 'report.txt');
      await expect(
        cli.run({ projectPath: tmpDir, output: outputPath })
      ).rejects.toThrow('process.exit called');
      const written = await fs.readFile(outputPath, 'utf-8');
      expect(written.length).toBeGreaterThan(0);
    });

    it('should output JSON format', async () => {
      await fs.writeFile(path.join(tmpDir, 'a.ts'), 'const x = 1;');
      const outputPath = path.join(tmpDir, 'report.json');
      await expect(
        cli.run({ projectPath: tmpDir, format: 'json', output: outputPath })
      ).rejects.toThrow('process.exit called');
      const written = await fs.readFile(outputPath, 'utf-8');
      expect(() => JSON.parse(written)).not.toThrow();
    });

    it('should output HTML format', async () => {
      await fs.writeFile(path.join(tmpDir, 'a.ts'), 'const x = 1;');
      const outputPath = path.join(tmpDir, 'report.html');
      await expect(
        cli.run({ projectPath: tmpDir, format: 'html', output: outputPath })
      ).rejects.toThrow('process.exit called');
      const written = await fs.readFile(outputPath, 'utf-8');
      expect(written).toContain('<!DOCTYPE html>');
    });

    it('should fail when project path does not exist', async () => {
      await expect(
        cli.run({ projectPath: '/nonexistent/path/xyz' })
      ).rejects.toThrow('process.exit called');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should load config when config option provided', async () => {
      await fs.writeFile(path.join(tmpDir, 'a.ts'), 'const x = 1;');
      const configPath = path.join(tmpDir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify({ depth: 'shallow' }));
      await expect(
        cli.run({ projectPath: tmpDir, config: configPath })
      ).rejects.toThrow('process.exit called');
    });
  });
});
