/**
 * Test generation agent
 * Generates comprehensive test cases for existing code
 */

import { BaseAgent } from '../base/agent-base.js';
import {
  AnalysisTarget,
  Finding,
  Severity,
  FindingCategory,
  AgentCapabilities,
  TestGenerationRequest,
  GeneratedTest
} from '../types.js';
import { logger } from '../../logger.js';
import * as path from 'path';
import * as fs from 'fs/promises';

interface FunctionInfo {
  name: string;
  parameters: string[];
  returnType: string;
  isAsync: boolean;
  line: number;
  signature: string;
  body: string;
  complexity: number;
}

interface ClassInfo {
  name: string;
  methods: FunctionInfo[];
  properties: string[];
  line: number;
}

/**
 * Test generation agent for creating comprehensive test suites
 */
export class TestGenerationAgent extends BaseAgent {
  constructor() {
    super(
      'test-generation',
      '1.0.0',
      'Generates comprehensive test cases for TypeScript and JavaScript code',
      {
        supportedFileTypes: ['ts', 'tsx', 'js', 'jsx', 'mts', 'cts'],
        analysisTypes: [
          FindingCategory.TESTING,
          FindingCategory.BEST_PRACTICE
        ],
        canSuggestFixes: false,
        canGenerateTests: true,
        supportsIncremental: true,
        performance: {
          speed: 'medium',
          memoryUsage: 'medium',
          cpuUsage: 'medium'
        }
      }
    );
  }

  protected async performAnalysis(target: AnalysisTarget): Promise<Finding[]> {
    const findings: Finding[] = [];

    if (target.type === 'file') {
      const fileFindings = await this.analyzeFile(target.path);
      findings.push(...fileFindings);
    } else if (target.type === 'directory' || target.type === 'project') {
      const files = await this.findSourceFiles(target.path, target.include, target.exclude);
      
      for (const file of files) {
        try {
          const fileFindings = await this.analyzeFile(file);
          findings.push(...fileFindings);
        } catch (error) {
          logger.error(`Failed to analyze file: ${file}`, { error });
        }
      }
    }

    return findings;
  }

  /**
   * Generate tests for a specific target
   */
  async generateTests(request: TestGenerationRequest): Promise<GeneratedTest> {
    try {
      logger.info('Generating tests', { target: request.target, testType: request.testType });

      const content = await this.readFileContent(request.target);
      const functions = this.extractFunctions(content);
      const classes = this.extractClasses(content);

      const testContent = await this.generateTestContent(
        request.target,
        functions,
        classes,
        request
      );

      const testFilePath = this.generateTestFilePath(request.target, request.framework || 'vitest');

      return {
        filePath: testFilePath,
        content: testContent,
        metadata: {
          framework: request.framework || 'vitest',
          testCases: functions.length + classes.reduce((sum, cls) => sum + cls.methods.length, 0),
          coverage: request.coverage || { lines: 80, functions: 80, branches: 80 },
          dependencies: this.extractTestDependencies(request.framework || 'vitest')
        }
      };

    } catch (error) {
      logger.error('Failed to generate tests', { error, target: request.target });
      throw error;
    }
  }

  /**
   * Analyze a file for test coverage gaps
   */
  private async analyzeFile(filePath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    try {
      const content = await this.readFileContent(filePath);
      const functions = this.extractFunctions(content);
      const classes = this.extractClasses(content);

      // Check if test file exists
      const testFilePath = this.findExistingTestFile(filePath);
      const hasTests = testFilePath ? await this.fileExists(testFilePath) : false;

      if (!hasTests) {
        findings.push(this.createFinding(
          Severity.MEDIUM,
          FindingCategory.TESTING,
          'Missing Test File',
          `No test file found for ${path.basename(filePath)}`,
          filePath,
          1,
          1,
          undefined,
          `Create test file: ${this.generateTestFilePath(filePath, 'vitest')}`,
          'missing-test-file'
        ));
      }

      // Analyze functions for test coverage
      functions.forEach(func => {
        if (func.complexity > 5) {
          findings.push(this.createFinding(
            Severity.MEDIUM,
            FindingCategory.TESTING,
            'Complex Function Needs Tests',
            `Function '${func.name}' has high complexity (${func.complexity}) and needs comprehensive tests`,
            filePath,
            func.line,
            1,
            func.signature,
            'Create unit tests covering all code paths',
            'complex-function-needs-tests',
            { functionName: func.name, complexity: func.complexity }
          ));
        }

        if (func.isAsync) {
          findings.push(this.createFinding(
            Severity.LOW,
            FindingCategory.TESTING,
            'Async Function Needs Error Tests',
            `Async function '${func.name}' should have tests for both success and error cases`,
            filePath,
            func.line,
            1,
            func.signature,
            'Add tests for promise resolution and rejection',
            'async-function-needs-error-tests',
            { functionName: func.name }
          ));
        }
      });

      // Analyze classes for test coverage
      classes.forEach(cls => {
        if (cls.methods.length > 0) {
          findings.push(this.createFinding(
            Severity.LOW,
            FindingCategory.TESTING,
            'Class Needs Tests',
            `Class '${cls.name}' with ${cls.methods.length} methods needs comprehensive tests`,
            filePath,
            cls.line,
            1,
            `class ${cls.name}`,
            'Create unit tests for all public methods',
            'class-needs-tests',
            { className: cls.name, methodCount: cls.methods.length }
          ));
        }
      });

      // Check for edge cases that need testing
      const edgeCases = this.identifyEdgeCases(content);
      edgeCases.forEach(edgeCase => {
        findings.push(this.createFinding(
          Severity.LOW,
          FindingCategory.TESTING,
          'Edge Case Needs Testing',
          edgeCase.description,
          filePath,
          edgeCase.line,
          1,
          edgeCase.code,
          edgeCase.suggestion,
          'edge-case-needs-testing'
        ));
      });

    } catch (error) {
      logger.error(`Error analyzing file ${filePath}`, { error });
    }

    return findings;
  }

  /**
   * Extract function information from code
   */
  private extractFunctions(content: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Match various function patterns
      const patterns = [
        /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/,
        /(?:export\s+)?const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[:=]\s*(?:async\s+)?\(([^)]*)\)(?:\s*:\s*([^=]+))?\s*=>/,
        /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*{/
      ];

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          const name = match[1];
          const params = match[2] ? match[2].split(',').map(p => p.trim()) : [];
          const returnType = match[3] ? match[3].trim() : 'any';
          const isAsync = line.includes('async');
          
          const functionBody = this.extractFunctionBody(lines, i);
          const complexity = this.calculateComplexity(functionBody);

          functions.push({
            name,
            parameters: params,
            returnType,
            isAsync,
            line: i + 1,
            signature: line.trim(),
            body: functionBody,
            complexity
          });
          break;
        }
      }
    }

    return functions;
  }

  /**
   * Extract class information from code
   */
  private extractClasses(content: string): ClassInfo[] {
    const classes: ClassInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const classMatch = line.match(/(?:export\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      
      if (classMatch) {
        const className = classMatch[1];
        const classBody = this.extractClassBody(lines, i);
        const methods = this.extractMethodsFromClass(classBody);
        const properties = this.extractPropertiesFromClass(classBody);

        classes.push({
          name: className,
          methods,
          properties,
          line: i + 1
        });
      }
    }

    return classes;
  }

  /**
   * Generate test content
   */
  private async generateTestContent(
    targetFile: string,
    functions: FunctionInfo[],
    classes: ClassInfo[],
    request: TestGenerationRequest
  ): Promise<string> {
    const framework = request.framework || 'vitest';
    const testType = request.testType;
    
    let content = this.generateTestHeader(targetFile, framework);
    
    // Generate imports
    content += this.generateImports(targetFile, functions, classes, framework);
    
    // Generate function tests
    for (const func of functions) {
      content += this.generateFunctionTests(func, framework, testType);
    }
    
    // Generate class tests
    for (const cls of classes) {
      content += this.generateClassTests(cls, framework, testType);
    }
    
    return content;
  }

  /**
   * Generate test file header
   */
  private generateTestHeader(targetFile: string, framework: string): string {
    const fileName = path.basename(targetFile);
    const date = new Date().toISOString().split('T')[0];
    
    return `/**
 * Test file for ${fileName}
 * Generated on ${date}
 * Framework: ${framework}
 */

`;
  }

  /**
   * Generate imports for test file
   */
  private generateImports(
    targetFile: string,
    functions: FunctionInfo[],
    classes: ClassInfo[],
    framework: string
  ): string {
    const relativePath = this.getRelativeImportPath(targetFile);
    const imports: string[] = [];
    
    // Framework imports
    if (framework === 'vitest') {
      imports.push("import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';");
    } else if (framework === 'jest') {
      imports.push("import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';");
    }
    
    // Target file imports
    const exportedItems = [
      ...functions.map(f => f.name),
      ...classes.map(c => c.name)
    ];
    
    if (exportedItems.length > 0) {
      imports.push(`import { ${exportedItems.join(', ')} } from '${relativePath}';`);
    }
    
    return imports.join('\n') + '\n\n';
  }

  /**
   * Generate tests for a function
   */
  private generateFunctionTests(func: FunctionInfo, framework: string, testType: string): string {
    let content = `describe('${func.name}', () => {\n`;
    
    // Basic functionality test
    content += `  it('should work with valid inputs', ${func.isAsync ? 'async ' : ''}() => {\n`;
    content += this.generateBasicFunctionTest(func);
    content += `  });\n\n`;
    
    // Error handling tests
    if (func.isAsync) {
      content += `  it('should handle errors properly', async () => {\n`;
      content += this.generateErrorTest(func);
      content += `  });\n\n`;
    }
    
    // Edge case tests
    content += this.generateEdgeCaseTests(func);
    
    // Parameter validation tests
    if (func.parameters.length > 0) {
      content += this.generateParameterTests(func);
    }
    
    content += `});\n\n`;
    return content;
  }

  /**
   * Generate tests for a class
   */
  private generateClassTests(cls: ClassInfo, framework: string, testType: string): string {
    let content = `describe('${cls.name}', () => {\n`;
    content += `  let instance: ${cls.name};\n\n`;
    
    content += `  beforeEach(() => {\n`;
    content += `    instance = new ${cls.name}();\n`;
    content += `  });\n\n`;
    
    content += `  it('should create an instance', () => {\n`;
    content += `    expect(instance).toBeInstanceOf(${cls.name});\n`;
    content += `  });\n\n`;
    
    // Generate tests for each method
    for (const method of cls.methods) {
      content += `  describe('${method.name}', () => {\n`;
      content += `    it('should work correctly', ${method.isAsync ? 'async ' : ''}() => {\n`;
      content += this.generateMethodTest(method);
      content += `    });\n`;
      content += `  });\n\n`;
    }
    
    content += `});\n\n`;
    return content;
  }

  /**
   * Generate basic function test
   */
  private generateBasicFunctionTest(func: FunctionInfo): string {
    const mockParams = this.generateMockParameters(func.parameters);
    const call = `${func.name}(${mockParams.join(', ')})`;
    
    if (func.isAsync) {
      return `    const result = await ${call};\n    expect(result).toBeDefined();\n`;
    } else {
      return `    const result = ${call};\n    expect(result).toBeDefined();\n`;
    }
  }

  /**
   * Generate error test for async functions
   */
  private generateErrorTest(func: FunctionInfo): string {
    const invalidParams = this.generateInvalidParameters(func.parameters);
    const call = `${func.name}(${invalidParams.join(', ')})`;
    
    return `    await expect(${call}).rejects.toThrow();\n`;
  }

  /**
   * Generate edge case tests
   */
  private generateEdgeCaseTests(func: FunctionInfo): string {
    let content = '';
    
    // Null/undefined tests
    if (func.parameters.length > 0) {
      content += `  it('should handle null/undefined inputs', ${func.isAsync ? 'async ' : ''}() => {\n`;
      content += `    // Test with null/undefined parameters\n`;
      content += `    // TODO: Add specific null/undefined test cases\n`;
      content += `  });\n\n`;
    }
    
    // Boundary value tests
    content += `  it('should handle boundary values', ${func.isAsync ? 'async ' : ''}() => {\n`;
    content += `    // Test with boundary values (empty arrays, zero, negative numbers, etc.)\n`;
    content += `    // TODO: Add specific boundary value test cases\n`;
    content += `  });\n\n`;
    
    return content;
  }

  /**
   * Generate parameter validation tests
   */
  private generateParameterTests(func: FunctionInfo): string {
    let content = '';
    
    func.parameters.forEach((param, index) => {
      content += `  it('should validate parameter ${index + 1} (${param})', () => {\n`;
      content += `    // Test parameter validation for ${param}\n`;
      content += `    // TODO: Add specific validation tests\n`;
      content += `  });\n\n`;
    });
    
    return content;
  }

  /**
   * Generate method test for class
   */
  private generateMethodTest(method: FunctionInfo): string {
    const mockParams = this.generateMockParameters(method.parameters);
    const call = `instance.${method.name}(${mockParams.join(', ')})`;
    
    if (method.isAsync) {
      return `      const result = await ${call};\n      expect(result).toBeDefined();\n`;
    } else {
      return `      const result = ${call};\n      expect(result).toBeDefined();\n`;
    }
  }

  /**
   * Generate mock parameters for testing
   */
  private generateMockParameters(parameters: string[]): string[] {
    return parameters.map(param => {
      const cleanParam = param.split(':')[0].trim();
      const type = param.includes(':') ? param.split(':')[1].trim() : 'any';
      
      // Generate mock values based on type
      if (type.includes('string')) return "'test'";
      if (type.includes('number')) return '42';
      if (type.includes('boolean')) return 'true';
      if (type.includes('array') || type.includes('[]')) return '[]';
      if (type.includes('object') || type === 'any') return '{}';
      
      return 'undefined';
    });
  }

  /**
   * Generate invalid parameters for error testing
   */
  private generateInvalidParameters(parameters: string[]): string[] {
    return parameters.map(() => 'null');
  }

  /**
   * Identify edge cases that need testing
   */
  private identifyEdgeCases(content: string): Array<{
    description: string;
    line: number;
    code: string;
    suggestion: string;
  }> {
    const edgeCases: Array<{
      description: string;
      line: number;
      code: string;
      suggestion: string;
    }> = [];
    
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Array operations
      if (line.includes('.length') || line.includes('[') || line.includes('push') || line.includes('pop')) {
        edgeCases.push({
          description: 'Array operation needs edge case testing (empty array, bounds)',
          line: index + 1,
          code: line.trim(),
          suggestion: 'Test with empty arrays and boundary indices'
        });
      }
      
      // String operations
      if (line.includes('.substring') || line.includes('.slice') || line.includes('.charAt')) {
        edgeCases.push({
          description: 'String operation needs edge case testing (empty string, bounds)',
          line: index + 1,
          code: line.trim(),
          suggestion: 'Test with empty strings and boundary indices'
        });
      }
      
      // Division operations
      if (line.includes('/') && !line.includes('//') && !line.includes('/*')) {
        edgeCases.push({
          description: 'Division operation needs zero divisor testing',
          line: index + 1,
          code: line.trim(),
          suggestion: 'Test with zero divisor'
        });
      }
    });
    
    return edgeCases;
  }

  // Helper methods

  private extractFunctionBody(lines: string[], startIndex: number): string {
    let braceCount = 0;
    let body = '';
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      body += line + '\n';
      
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
      
      if (braceCount === 0 && i > startIndex) {
        break;
      }
    }
    
    return body;
  }

  private extractClassBody(lines: string[], startIndex: number): string {
    return this.extractFunctionBody(lines, startIndex);
  }

  private extractMethodsFromClass(classBody: string): FunctionInfo[] {
    return this.extractFunctions(classBody);
  }

  private extractPropertiesFromClass(classBody: string): string[] {
    const properties: string[] = [];
    const lines = classBody.split('\n');
    
    lines.forEach(line => {
      const propMatch = line.match(/^\s*(private|public|protected)?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[:=]/);
      if (propMatch) {
        properties.push(propMatch[2]);
      }
    });
    
    return properties;
  }

  private calculateComplexity(code: string): number {
    let complexity = 1;
    const decisionKeywords = ['if', 'else if', 'while', 'for', 'switch', 'case', 'catch', '&&', '||', '?'];
    
    decisionKeywords.forEach(keyword => {
      const matches = code.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }

  private generateTestFilePath(sourceFile: string, framework: string): string {
    const ext = path.extname(sourceFile);
    const baseName = path.basename(sourceFile, ext);
    const dir = path.dirname(sourceFile);
    
    return path.join(dir, `${baseName}.test${ext}`);
  }

  private findExistingTestFile(sourceFile: string): string | null {
    const ext = path.extname(sourceFile);
    const baseName = path.basename(sourceFile, ext);
    const dir = path.dirname(sourceFile);
    
    const possibleTestFiles = [
      path.join(dir, `${baseName}.test${ext}`),
      path.join(dir, `${baseName}.spec${ext}`),
      path.join(dir, '__tests__', `${baseName}.test${ext}`),
      path.join(dir, '__tests__', `${baseName}.spec${ext}`)
    ];
    
    // Return first existing file (this is a simplified check)
    return possibleTestFiles[0];
  }

  private getRelativeImportPath(targetFile: string): string {
    const ext = path.extname(targetFile);
    const baseName = path.basename(targetFile, ext);
    return `./${baseName}`;
  }

  private extractTestDependencies(framework: string): string[] {
    const baseDeps = [framework];
    
    if (framework === 'vitest') {
      baseDeps.push('@vitest/ui', '@vitest/coverage-v8');
    } else if (framework === 'jest') {
      baseDeps.push('@jest/globals', '@types/jest');
    }
    
    return baseDeps;
  }

  private async findSourceFiles(
    dirPath: string, 
    include?: string[], 
    exclude?: string[]
  ): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', 'coverage', '__tests__'].includes(entry.name)) {
            const subFiles = await this.findSourceFiles(fullPath, include, exclude);
            files.push(...subFiles);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).slice(1);
          if (this.capabilities.supportedFileTypes.includes(ext) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      logger.error(`Error reading directory: ${dirPath}`, { error });
    }
    
    return files;
  }
}

