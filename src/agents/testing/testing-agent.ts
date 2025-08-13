import { AbstractBaseAgent } from '../base/base-agent.js';
import { AnalysisContext, AnalysisResult, Finding } from '../types/agent-interfaces.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Agent for test analysis including test coverage, quality, and completeness
 */
export class TestingAgent extends AbstractBaseAgent {
  public readonly name = 'testing';
  public readonly version = '1.0.0';
  public readonly description = 'Test coverage, quality, and completeness analysis';

  private readonly testFilePatterns = [
    /\.test\.(ts|js|tsx|jsx)$/,
    /\.spec\.(ts|js|tsx|jsx)$/,
    /__tests__\/.*\.(ts|js|tsx|jsx)$/
  ];

  private readonly sourceExtensions = ['ts', 'js', 'tsx', 'jsx'];

  public canHandle(fileType: string): boolean {
    return this.sourceExtensions.includes(fileType.toLowerCase());
  }

  public getPriority(): number {
    return 30; // Run after code and type analysis
  }

  public getDependencies(): string[] {
    return ['code-analysis']; // Depends on code analysis results
  }

  public async analyze(context: AnalysisContext): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    const metrics: Record<string, number> = {
      sourceFiles: 0,
      testFiles: 0,
      testCoverage: 0,
      missingTests: 0,
      testQualityScore: 0
    };

    try {
      const allFiles = context.files;
      const sourceFiles = this.getSourceFiles(allFiles);
      const testFiles = this.getTestFiles(allFiles);

      metrics.sourceFiles = sourceFiles.length;
      metrics.testFiles = testFiles.length;

      this.log('info', `Analyzing ${sourceFiles.length} source files and ${testFiles.length} test files`);

      // Analyze test coverage
      findings.push(...await this.analyzeTestCoverage(sourceFiles, testFiles, context));

      // Analyze test quality
      for (const testFile of testFiles) {
        findings.push(...await this.analyzeTestQuality(testFile, context));
      }

      // Analyze missing tests
      findings.push(...await this.analyzeMissingTests(sourceFiles, testFiles, context));

      // Check for test configuration
      findings.push(...await this.analyzeTestConfiguration(context));

      // Calculate metrics
      metrics.testCoverage = this.calculateTestCoverage(sourceFiles, testFiles);
      metrics.missingTests = findings.filter(f => f.category === 'missing-test').length;
      metrics.testQualityScore = this.calculateTestQualityScore(findings);

      const recommendations = this.generateRecommendations(findings, metrics);

      return this.createResult('success', findings, metrics, recommendations);
      
    } catch (error) {
      this.log('error', 'Testing analysis failed', error);
      return this.createResult('error', [
        this.createFinding(
          'critical',
          'analysis-error',
          `Testing analysis failed: ${error instanceof Error ? error.message : String(error)}`
        )
      ]);
    }
  }

  /**
   * Get source files (non-test files)
   */
  private getSourceFiles(files: string[]): string[] {
    return files.filter(file => {
      const isSourceFile = this.sourceExtensions.some(ext => file.endsWith(`.${ext}`));
      const isTestFile = this.testFilePatterns.some(pattern => pattern.test(file));
      return isSourceFile && !isTestFile;
    });
  }

  /**
   * Get test files
   */
  private getTestFiles(files: string[]): string[] {
    return files.filter(file => 
      this.testFilePatterns.some(pattern => pattern.test(file))
    );
  }

  /**
   * Analyze test coverage
   */
  private async analyzeTestCoverage(sourceFiles: string[], testFiles: string[], context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const testedFiles = new Set<string>();

    // Map test files to source files
    for (const testFile of testFiles) {
      const correspondingSource = this.findCorrespondingSourceFile(testFile, sourceFiles);
      if (correspondingSource) {
        testedFiles.add(correspondingSource);
      }
    }

    // Find untested source files
    for (const sourceFile of sourceFiles) {
      if (!testedFiles.has(sourceFile) && !this.isUtilityFile(sourceFile)) {
        findings.push(this.createFinding(
          'medium',
          'missing-test',
          `Source file has no corresponding test file`,
          { 
            file: sourceFile,
            fix: `Create test file for ${sourceFile}`
          }
        ));
      }
    }

    // Check for orphaned test files
    for (const testFile of testFiles) {
      const correspondingSource = this.findCorrespondingSourceFile(testFile, sourceFiles);
      if (!correspondingSource) {
        findings.push(this.createFinding(
          'low',
          'orphaned-test',
          'Test file has no corresponding source file',
          { 
            file: testFile,
            fix: 'Remove orphaned test file or create corresponding source file'
          }
        ));
      }
    }

    return findings;
  }

  /**
   * Analyze test quality
   */
  private async analyzeTestQuality(testFile: string, context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const filePath = path.resolve(context.projectPath, testFile);
    const content = await this.readFile(filePath);

    if (!content) {
      return findings;
    }

    const lines = content.split('\n');

    // Test structure analysis
    findings.push(...this.analyzeTestStructure(testFile, content));
    
    // Test assertions analysis
    findings.push(...this.analyzeTestAssertions(testFile, content));
    
    // Test isolation analysis
    findings.push(...this.analyzeTestIsolation(testFile, content));
    
    // Test naming analysis
    findings.push(...this.analyzeTestNaming(testFile, content));

    return findings;
  }

  /**
   * Analyze test structure
   */
  private analyzeTestStructure(file: string, content: string): Finding[] {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    let hasDescribe = false;
    let hasTest = false;
    let testCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for describe blocks
      if (line.includes('describe(')) {
        hasDescribe = true;
      }

      // Check for test cases
      if (line.includes('test(') || line.includes('it(')) {
        hasTest = true;
        testCount++;
      }

      // Check for empty test cases
      if ((line.includes('test(') || line.includes('it(')) && 
          lines[i + 1]?.trim() === '' && 
          lines[i + 2]?.trim() === '});') {
        findings.push(this.createFinding(
          'medium',
          'empty-test',
          'Empty test case found',
          { 
            file, 
            line: lineNumber,
            fix: 'Implement test logic or remove empty test'
          }
        ));
      }

      // Check for skipped tests
      if (line.includes('test.skip') || line.includes('it.skip') || line.includes('xtest') || line.includes('xit')) {
        findings.push(this.createFinding(
          'medium',
          'skipped-test',
          'Skipped test found',
          { 
            file, 
            line: lineNumber,
            evidence: line.trim(),
            fix: 'Implement or remove skipped test'
          }
        ));
      }

      // Check for focused tests (only)
      if (line.includes('test.only') || line.includes('it.only') || line.includes('fdescribe')) {
        findings.push(this.createFinding(
          'high',
          'focused-test',
          'Focused test found - may skip other tests',
          { 
            file, 
            line: lineNumber,
            evidence: line.trim(),
            fix: 'Remove .only to run all tests'
          }
        ));
      }
    }

    // Check overall structure
    if (!hasDescribe) {
      findings.push(this.createFinding(
        'low',
        'test-structure',
        'Test file missing describe block for organization',
        { 
          file,
          fix: 'Add describe block to organize tests'
        }
      ));
    }

    if (!hasTest) {
      findings.push(this.createFinding(
        'high',
        'test-structure',
        'Test file contains no test cases',
        { 
          file,
          fix: 'Add test cases or remove empty test file'
        }
      ));
    }

    if (testCount > 20) {
      findings.push(this.createFinding(
        'medium',
        'test-structure',
        `Large number of tests in single file (${testCount})`,
        { 
          file,
          fix: 'Consider splitting into multiple test files'
        }
      ));
    }

    return findings;
  }

  /**
   * Analyze test assertions
   */
  private analyzeTestAssertions(file: string, content: string): Finding[] {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    let inTest = false;
    let testName = '';
    let assertionCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Track test boundaries
      const testMatch = line.match(/(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/);
      if (testMatch) {
        inTest = true;
        testName = testMatch[1];
        assertionCount = 0;
      }

      if (inTest) {
        // Count assertions
        if (line.includes('expect(') || line.includes('assert')) {
          assertionCount++;
        }

        // Check for weak assertions
        if (line.includes('toBeTruthy()') || line.includes('toBeFalsy()')) {
          findings.push(this.createFinding(
            'low',
            'weak-assertion',
            'Weak assertion - consider more specific matcher',
            { 
              file, 
              line: lineNumber,
              evidence: line.trim(),
              fix: 'Use more specific assertion like toBe(), toEqual(), etc.'
            }
          ));
        }

        // Check for missing assertions
        if (line.includes('});') && assertionCount === 0) {
          findings.push(this.createFinding(
            'high',
            'missing-assertion',
            `Test '${testName}' has no assertions`,
            { 
              file, 
              line: lineNumber,
              fix: 'Add assertions to verify test behavior'
            }
          ));
          inTest = false;
        }

        // Check for too many assertions
        if (line.includes('});') && assertionCount > 5) {
          findings.push(this.createFinding(
            'medium',
            'too-many-assertions',
            `Test '${testName}' has many assertions (${assertionCount})`,
            { 
              file, 
              line: lineNumber,
              fix: 'Consider splitting into multiple focused tests'
            }
          ));
          inTest = false;
        }

        if (line.includes('});')) {
          inTest = false;
        }
      }
    }

    return findings;
  }

  /**
   * Analyze test isolation
   */
  private analyzeTestIsolation(file: string, content: string): Finding[] {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    let hasBeforeEach = false;
    let hasAfterEach = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      if (line.includes('beforeEach')) {
        hasBeforeEach = true;
      }

      if (line.includes('afterEach')) {
        hasAfterEach = true;
      }

      // Check for shared state
      if (line.includes('let ') && !line.includes('const ') && !line.includes('function')) {
        findings.push(this.createFinding(
          'medium',
          'shared-state',
          'Potential shared state between tests',
          { 
            file, 
            line: lineNumber,
            evidence: line.trim(),
            fix: 'Initialize state in beforeEach or use const for immutable values'
          }
        ));
      }

      // Check for setTimeout/setInterval without cleanup
      if (line.includes('setTimeout') || line.includes('setInterval')) {
        findings.push(this.createFinding(
          'medium',
          'async-cleanup',
          'Async operation without cleanup',
          { 
            file, 
            line: lineNumber,
            fix: 'Ensure timers are cleared in afterEach'
          }
        ));
      }
    }

    // Check for proper setup/teardown
    if (content.includes('mock') && !hasAfterEach) {
      findings.push(this.createFinding(
        'medium',
        'mock-cleanup',
        'Mocks used without afterEach cleanup',
        { 
          file,
          fix: 'Add afterEach to restore mocks'
        }
      ));
    }

    return findings;
  }

  /**
   * Analyze test naming
   */
  private analyzeTestNaming(file: string, content: string): Finding[] {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      const testMatch = line.match(/(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/);
      if (testMatch) {
        const testName = testMatch[1];

        // Check for vague test names
        if (testName.length < 10 || 
            testName.toLowerCase().includes('works') ||
            testName.toLowerCase().includes('test')) {
          findings.push(this.createFinding(
            'low',
            'test-naming',
            `Vague test name: "${testName}"`,
            { 
              file, 
              line: lineNumber,
              fix: 'Use descriptive test names that explain what is being tested'
            }
          ));
        }

        // Check for test names that don't follow convention
        if (!testName.startsWith('should ') && !testName.includes('when ') && !testName.includes('given ')) {
          findings.push(this.createFinding(
            'info',
            'test-naming',
            'Consider using BDD-style test naming (should/when/given)',
            { 
              file, 
              line: lineNumber,
              evidence: testName
            }
          ));
        }
      }
    }

    return findings;
  }

  /**
   * Analyze missing tests for source files
   */
  private async analyzeMissingTests(sourceFiles: string[], testFiles: string[], context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const sourceFile of sourceFiles) {
      if (this.isUtilityFile(sourceFile)) continue;

      const filePath = path.resolve(context.projectPath, sourceFile);
      const content = await this.readFile(filePath);

      if (!content) continue;

      // Check for exported functions/classes that should be tested
      const exports = this.findExports(content);
      const correspondingTest = this.findCorrespondingTestFile(sourceFile, testFiles);

      if (correspondingTest) {
        const testContent = await this.readFile(path.resolve(context.projectPath, correspondingTest));
        if (testContent) {
          for (const exportName of exports) {
            if (!testContent.includes(exportName)) {
              findings.push(this.createFinding(
                'medium',
                'untested-export',
                `Exported function/class '${exportName}' is not tested`,
                { 
                  file: sourceFile,
                  fix: `Add tests for ${exportName} in ${correspondingTest}`
                }
              ));
            }
          }
        }
      }
    }

    return findings;
  }

  /**
   * Analyze test configuration
   */
  private async analyzeTestConfiguration(context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Check for Jest configuration
    const jestConfigFiles = ['jest.config.js', 'jest.config.ts', 'jest.config.json'];
    let hasJestConfig = false;

    for (const configFile of jestConfigFiles) {
      const configPath = path.join(context.projectPath, configFile);
      if (await this.fileExists(configPath)) {
        hasJestConfig = true;
        break;
      }
    }

    // Check package.json for Jest config
    const packageJsonPath = path.join(context.projectPath, 'package.json');
    if (await this.fileExists(packageJsonPath)) {
      const packageContent = await this.readFile(packageJsonPath);
      if (packageContent) {
        const packageJson = JSON.parse(packageContent);
        if (packageJson.jest || packageJson.scripts?.test) {
          hasJestConfig = true;
        }
      }
    }

    if (!hasJestConfig) {
      findings.push(this.createFinding(
        'medium',
        'test-configuration',
        'No test framework configuration found',
        { 
          fix: 'Configure Jest or another test framework'
        }
      ));
    }

    return findings;
  }

  /**
   * Helper methods
   */
  private findCorrespondingSourceFile(testFile: string, sourceFiles: string[]): string | undefined {
    const testBaseName = testFile
      .replace(/\.test\.(ts|js|tsx|jsx)$/, '')
      .replace(/\.spec\.(ts|js|tsx|jsx)$/, '')
      .replace(/__tests__\//, '');

    return sourceFiles.find(sourceFile => {
      const sourceBaseName = sourceFile.replace(/\.(ts|js|tsx|jsx)$/, '');
      return sourceBaseName === testBaseName || sourceBaseName.endsWith(`/${testBaseName}`);
    });
  }

  private findCorrespondingTestFile(sourceFile: string, testFiles: string[]): string | undefined {
    const sourceBaseName = sourceFile.replace(/\.(ts|js|tsx|jsx)$/, '');
    
    return testFiles.find(testFile => {
      const testBaseName = testFile
        .replace(/\.test\.(ts|js|tsx|jsx)$/, '')
        .replace(/\.spec\.(ts|js|tsx|jsx)$/, '')
        .replace(/__tests__\//, '');
      
      return testBaseName === sourceBaseName || testBaseName.endsWith(`/${sourceBaseName}`);
    });
  }

  private isUtilityFile(file: string): boolean {
    const utilityPatterns = [
      /types?\.(ts|js)$/,
      /constants?\.(ts|js)$/,
      /config\.(ts|js)$/,
      /index\.(ts|js)$/
    ];

    return utilityPatterns.some(pattern => pattern.test(file));
  }

  private findExports(content: string): string[] {
    const exports: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      // Named exports
      const namedExportMatch = line.match(/export\s+(?:function|class|const|let|var)\s+(\w+)/);
      if (namedExportMatch) {
        exports.push(namedExportMatch[1]);
      }

      // Export statements
      const exportStatementMatch = line.match(/export\s*{\s*([^}]+)\s*}/);
      if (exportStatementMatch) {
        const exportNames = exportStatementMatch[1]
          .split(',')
          .map(name => name.trim().split(' as ')[0]);
        exports.push(...exportNames);
      }
    }

    return exports;
  }

  private calculateTestCoverage(sourceFiles: string[], testFiles: string[]): number {
    if (sourceFiles.length === 0) return 100;
    
    const testedFiles = testFiles.length;
    const totalFiles = sourceFiles.filter(f => !this.isUtilityFile(f)).length;
    
    return Math.round((testedFiles / totalFiles) * 100);
  }

  private calculateTestQualityScore(findings: Finding[]): number {
    const qualityIssues = findings.filter(f => 
      ['empty-test', 'missing-assertion', 'weak-assertion', 'focused-test'].includes(f.category)
    ).length;
    
    return Math.max(0, 100 - qualityIssues * 5);
  }

  private generateRecommendations(findings: Finding[], metrics: Record<string, number>): string[] {
    const recommendations: string[] = [];

    if (metrics.testCoverage < 80) {
      recommendations.push('Increase test coverage by adding tests for untested source files');
    }

    if (findings.some(f => f.category === 'missing-assertion')) {
      recommendations.push('Add assertions to tests that are missing them');
    }

    if (findings.some(f => f.category === 'focused-test')) {
      recommendations.push('Remove .only from tests to ensure all tests run');
    }

    if (findings.some(f => f.category === 'test-configuration')) {
      recommendations.push('Set up proper test framework configuration');
    }

    if (metrics.testQualityScore < 80) {
      recommendations.push('Improve test quality by addressing empty tests and weak assertions');
    }

    return recommendations;
  }
}