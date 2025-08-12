/**
 * Static code analysis agent
 * Analyzes code for syntax errors, type issues, and code quality problems
 */

import { BaseAgent } from '../base/agent-base.js';
import {
  AnalysisTarget,
  Finding,
  Severity,
  FindingCategory,
  AgentCapabilities
} from '../types.js';
import { logger } from '../../logger.js';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Static analysis agent for TypeScript/JavaScript code
 */
export class StaticAnalysisAgent extends BaseAgent {
  constructor() {
    super(
      'static-analysis',
      '1.0.0',
      'Static code analysis for TypeScript and JavaScript',
      {
        supportedFileTypes: ['ts', 'tsx', 'js', 'jsx', 'mts', 'cts'],
        analysisTypes: [
          FindingCategory.SYNTAX_ERROR,
          FindingCategory.TYPE_ERROR,
          FindingCategory.CODE_SMELL,
          FindingCategory.BEST_PRACTICE,
          FindingCategory.MAINTAINABILITY
        ],
        canSuggestFixes: true,
        canGenerateTests: false,
        supportsIncremental: true,
        performance: {
          speed: 'fast',
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
          findings.push(this.createFinding(
            Severity.HIGH,
            FindingCategory.SYNTAX_ERROR,
            'Analysis Error',
            `Failed to analyze file: ${error instanceof Error ? error.message : String(error)}`,
            file,
            1,
            1,
            undefined,
            'Check file syntax and encoding',
            'analysis-error'
          ));
        }
      }
    }

    return findings;
  }

  /**
   * Analyze a single file
   */
  private async analyzeFile(filePath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    try {
      const content = await this.readFileContent(filePath);
      const lines = content.split('\n');

      // Basic syntax and pattern analysis
      findings.push(...await this.analyzeSyntax(filePath, content, lines));
      findings.push(...await this.analyzePatterns(filePath, content, lines));
      findings.push(...await this.analyzeComplexity(filePath, content, lines));
      findings.push(...await this.analyzeImports(filePath, content, lines));
      findings.push(...await this.analyzeNaming(filePath, content, lines));

      // TypeScript-specific analysis
      if (this.isTypeScriptFile(filePath)) {
        findings.push(...await this.analyzeTypeScript(filePath, content, lines));
      }

    } catch (error) {
      logger.error(`Error analyzing file ${filePath}`, { error });
      findings.push(this.createFinding(
        Severity.HIGH,
        FindingCategory.SYNTAX_ERROR,
        'File Read Error',
        `Cannot read or parse file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        1,
        1,
        undefined,
        'Check file permissions and encoding',
        'file-read-error'
      ));
    }

    return findings;
  }

  /**
   * Analyze syntax issues
   */
  private async analyzeSyntax(filePath: string, content: string, lines: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Check for common syntax issues
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Unclosed brackets/parentheses (basic check)
      const openBrackets = (line.match(/[{[(]/g) || []).length;
      const closeBrackets = (line.match(/[}\])]/g) || []).length;
      if (openBrackets > closeBrackets + 1) {
        findings.push(this.createFinding(
          Severity.HIGH,
          FindingCategory.SYNTAX_ERROR,
          'Potential Unclosed Bracket',
          'Line has more opening brackets than closing brackets',
          filePath,
          lineNumber,
          line.indexOf('{') + 1 || line.indexOf('(') + 1 || line.indexOf('[') + 1,
          line,
          'Check bracket matching',
          'unclosed-bracket'
        ));
      }

      // Missing semicolons (for JavaScript/TypeScript)
      if (this.isJavaScriptFile(filePath) || this.isTypeScriptFile(filePath)) {
        if (trimmedLine.length > 0 && 
            !trimmedLine.endsWith(';') && 
            !trimmedLine.endsWith('{') && 
            !trimmedLine.endsWith('}') &&
            !trimmedLine.startsWith('//') &&
            !trimmedLine.startsWith('/*') &&
            !trimmedLine.includes('//') &&
            /^(const|let|var|return|throw|break|continue)\s/.test(trimmedLine)) {
          findings.push(this.createFinding(
            Severity.LOW,
            FindingCategory.BEST_PRACTICE,
            'Missing Semicolon',
            'Statement should end with a semicolon',
            filePath,
            lineNumber,
            line.length,
            line,
            'Add semicolon at end of statement',
            'missing-semicolon'
          ));
        }
      }

      // TODO comments
      if (trimmedLine.includes('TODO') || trimmedLine.includes('FIXME') || trimmedLine.includes('HACK')) {
        findings.push(this.createFinding(
          Severity.LOW,
          FindingCategory.MAINTAINABILITY,
          'TODO Comment',
          'Code contains TODO/FIXME/HACK comment',
          filePath,
          lineNumber,
          line.indexOf('TODO') + 1 || line.indexOf('FIXME') + 1 || line.indexOf('HACK') + 1,
          line,
          'Address the TODO item or create a proper issue',
          'todo-comment'
        ));
      }

      // Console.log statements (should be removed in production)
      if (trimmedLine.includes('console.log') || trimmedLine.includes('console.debug')) {
        findings.push(this.createFinding(
          Severity.MEDIUM,
          FindingCategory.BEST_PRACTICE,
          'Console Statement',
          'Console statements should be removed from production code',
          filePath,
          lineNumber,
          line.indexOf('console.') + 1,
          line,
          'Use proper logging or remove console statements',
          'console-statement'
        ));
      }
    });

    return findings;
  }

  /**
   * Analyze code patterns and anti-patterns
   */
  private async analyzePatterns(filePath: string, content: string, lines: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Long lines
      if (line.length > 120) {
        findings.push(this.createFinding(
          Severity.LOW,
          FindingCategory.MAINTAINABILITY,
          'Long Line',
          `Line is ${line.length} characters long (recommended max: 120)`,
          filePath,
          lineNumber,
          121,
          line.substring(0, 150) + (line.length > 150 ? '...' : ''),
          'Break long line into multiple lines',
          'long-line'
        ));
      }

      // Deeply nested code
      const indentLevel = line.length - line.trimStart().length;
      if (indentLevel > 24) { // More than 6 levels of nesting (assuming 4-space indents)
        findings.push(this.createFinding(
          Severity.MEDIUM,
          FindingCategory.MAINTAINABILITY,
          'Deep Nesting',
          'Code is deeply nested, consider refactoring',
          filePath,
          lineNumber,
          1,
          line,
          'Extract nested logic into separate functions',
          'deep-nesting'
        ));
      }

      // Magic numbers
      const magicNumberRegex = /\b(?!0|1|2|10|100|1000)\d{2,}\b/g;
      const magicNumbers = trimmedLine.match(magicNumberRegex);
      if (magicNumbers && !trimmedLine.includes('//') && !trimmedLine.includes('const')) {
        magicNumbers.forEach(num => {
          findings.push(this.createFinding(
            Severity.LOW,
            FindingCategory.MAINTAINABILITY,
            'Magic Number',
            `Magic number ${num} should be replaced with a named constant`,
            filePath,
            lineNumber,
            line.indexOf(num) + 1,
            line,
            `Replace ${num} with a named constant`,
            'magic-number'
          ));
        });
      }

      // Empty catch blocks
      if (trimmedLine.includes('catch') && lines[index + 1]?.trim() === '}') {
        findings.push(this.createFinding(
          Severity.MEDIUM,
          FindingCategory.BEST_PRACTICE,
          'Empty Catch Block',
          'Empty catch block silently ignores errors',
          filePath,
          lineNumber,
          line.indexOf('catch') + 1,
          `${line}\n${lines[index + 1]}`,
          'Add proper error handling or logging',
          'empty-catch'
        ));
      }
    });

    return findings;
  }

  /**
   * Analyze code complexity
   */
  private async analyzeComplexity(filePath: string, content: string, lines: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Analyze function complexity
    const functions = this.extractFunctions(content);
    
    functions.forEach(func => {
      const complexity = this.calculateCyclomaticComplexity(func.body);
      
      if (complexity > 10) {
        findings.push(this.createFinding(
          complexity > 20 ? Severity.HIGH : Severity.MEDIUM,
          FindingCategory.MAINTAINABILITY,
          'High Complexity',
          `Function '${func.name}' has cyclomatic complexity of ${complexity} (recommended max: 10)`,
          filePath,
          func.line,
          1,
          func.signature,
          'Break down function into smaller, more focused functions',
          'high-complexity',
          { complexity, functionName: func.name }
        ));
      }

      // Check function length
      if (func.lineCount > 50) {
        findings.push(this.createFinding(
          func.lineCount > 100 ? Severity.HIGH : Severity.MEDIUM,
          FindingCategory.MAINTAINABILITY,
          'Long Function',
          `Function '${func.name}' is ${func.lineCount} lines long (recommended max: 50)`,
          filePath,
          func.line,
          1,
          func.signature,
          'Break down function into smaller functions',
          'long-function',
          { lineCount: func.lineCount, functionName: func.name }
        ));
      }
    });

    return findings;
  }

  /**
   * Analyze import statements
   */
  private async analyzeImports(filePath: string, content: string, lines: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Unused imports (basic check)
      if (trimmedLine.startsWith('import ') && !trimmedLine.includes('type')) {
        const importMatch = trimmedLine.match(/import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))/);
        if (importMatch) {
          const importedNames = importMatch[1] ? 
            importMatch[1].split(',').map(name => name.trim().split(' as ')[0]) :
            [importMatch[2] || importMatch[3]];

          importedNames.forEach(name => {
            if (name && !content.includes(name.trim()) && !content.includes(`${name.trim()}(`)) {
              findings.push(this.createFinding(
                Severity.LOW,
                FindingCategory.MAINTAINABILITY,
                'Unused Import',
                `Imported '${name.trim()}' appears to be unused`,
                filePath,
                lineNumber,
                line.indexOf(name) + 1,
                line,
                `Remove unused import '${name.trim()}'`,
                'unused-import'
              ));
            }
          });
        }
      }

      // Relative imports going up too many levels
      if (trimmedLine.includes('from \'../../../') || trimmedLine.includes('from "../../../')) {
        findings.push(this.createFinding(
          Severity.LOW,
          FindingCategory.MAINTAINABILITY,
          'Deep Relative Import',
          'Import path goes up too many directory levels',
          filePath,
          lineNumber,
          line.indexOf('../../../') + 1,
          line,
          'Consider using absolute imports or restructuring modules',
          'deep-relative-import'
        ));
      }
    });

    return findings;
  }

  /**
   * Analyze naming conventions
   */
  private async analyzeNaming(filePath: string, content: string, lines: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // Variable naming conventions
      const varDeclarations = line.match(/(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
      if (varDeclarations) {
        varDeclarations.forEach(declaration => {
          const varName = declaration.split(/\s+/)[1];
          
          // Check for single letter variables (except common ones like i, j, k)
          if (varName.length === 1 && !['i', 'j', 'k', 'x', 'y', 'z'].includes(varName)) {
            findings.push(this.createFinding(
              Severity.LOW,
              FindingCategory.MAINTAINABILITY,
              'Single Letter Variable',
              `Variable '${varName}' should have a more descriptive name`,
              filePath,
              lineNumber,
              line.indexOf(varName) + 1,
              line,
              'Use a more descriptive variable name',
              'single-letter-variable'
            ));
          }

          // Check for non-camelCase variables
          if (!/^[a-z][a-zA-Z0-9]*$/.test(varName) && !varName.startsWith('_') && varName.toUpperCase() !== varName) {
          if (!/^[a-z][a-zA-Z0-9]*$/.test(varName) && !varName.startsWith('_') && !varName.toUpperCase() === varName) {
            findings.push(this.createFinding(
              Severity.LOW,
              FindingCategory.BEST_PRACTICE,
              'Naming Convention',
              `Variable '${varName}' should use camelCase naming`,
              filePath,
              lineNumber,
              line.indexOf(varName) + 1,
              line,
              'Use camelCase naming convention',
              'naming-convention'
            ));
          }
        });
      }

      // Function naming
      const functionDeclarations = line.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
      if (functionDeclarations) {
        functionDeclarations.forEach(declaration => {
          const funcName = declaration.split(/\s+/)[1];
          
          if (!/^[a-z][a-zA-Z0-9]*$/.test(funcName)) {
            findings.push(this.createFinding(
              Severity.LOW,
              FindingCategory.BEST_PRACTICE,
              'Function Naming Convention',
              `Function '${funcName}' should use camelCase naming`,
              filePath,
              lineNumber,
              line.indexOf(funcName) + 1,
              line,
              'Use camelCase naming convention for functions',
              'function-naming-convention'
            ));
          }
        });
      }
    });

    return findings;
  }

  /**
   * Analyze TypeScript-specific issues
   */
  private async analyzeTypeScript(filePath: string, content: string, lines: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Use of 'any' type
      if (trimmedLine.includes(': any') || trimmedLine.includes('<any>') || trimmedLine.includes('any[]')) {
        findings.push(this.createFinding(
          Severity.MEDIUM,
          FindingCategory.TYPE_ERROR,
          'Use of Any Type',
          'Using \'any\' type defeats the purpose of TypeScript',
          filePath,
          lineNumber,
          line.indexOf('any') + 1,
          line,
          'Use specific types instead of \'any\'',
          'any-type'
        ));
      }

      // Non-null assertion operator
      if (trimmedLine.includes('!.') || trimmedLine.includes('!)')) {
        findings.push(this.createFinding(
          Severity.MEDIUM,
          FindingCategory.TYPE_ERROR,
          'Non-null Assertion',
          'Non-null assertion operator (!) can cause runtime errors',
          filePath,
          lineNumber,
          line.indexOf('!') + 1,
          line,
          'Use proper null checking instead of non-null assertion',
          'non-null-assertion'
        ));
      }

      // @ts-ignore comments
      if (trimmedLine.includes('@ts-ignore')) {
        findings.push(this.createFinding(
          Severity.MEDIUM,
          FindingCategory.TYPE_ERROR,
          'TypeScript Ignore',
          '@ts-ignore suppresses TypeScript errors and should be avoided',
          filePath,
          lineNumber,
          line.indexOf('@ts-ignore') + 1,
          line,
          'Fix the underlying TypeScript error instead of ignoring it',
          'ts-ignore'
        ));
      }
    });

    return findings;
  }

  /**
   * Find source files in directory
   */
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
          // Skip node_modules and other common directories
          if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            const subFiles = await this.findSourceFiles(fullPath, include, exclude);
            files.push(...subFiles);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).slice(1);
          if (this.capabilities.supportedFileTypes.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      logger.error(`Error reading directory: ${dirPath}`, { error });
    }
    
    return files;
  }

  /**
   * Extract functions from code
   */
  private extractFunctions(content: string): Array<{
    name: string;
    line: number;
    signature: string;
    body: string;
    lineCount: number;
  }> {
    const functions: Array<{
      name: string;
      line: number;
      signature: string;
      body: string;
      lineCount: number;
    }> = [];
    
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Match function declarations
      const functionMatch = line.match(/(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[:=]\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/);
      
      if (functionMatch) {
        const functionName = functionMatch[1] || functionMatch[2] || 'anonymous';
        const startLine = i + 1;
        
        // Find function body
        let braceCount = 0;
        let bodyStart = i;
        let bodyEnd = i;
        
        for (let j = i; j < lines.length; j++) {
          const currentLine = lines[j];
          braceCount += (currentLine.match(/{/g) || []).length;
          braceCount -= (currentLine.match(/}/g) || []).length;
          
          if (braceCount === 0 && j > i) {
            bodyEnd = j;
            break;
          }
        }
        
        const body = lines.slice(bodyStart, bodyEnd + 1).join('\n');
        const lineCount = bodyEnd - bodyStart + 1;
        
        functions.push({
          name: functionName,
          line: startLine,
          signature: line.trim(),
          body,
          lineCount
        });
      }
    }
    
    return functions;
  }

  /**
   * Calculate cyclomatic complexity
   */
  private calculateCyclomaticComplexity(code: string): number {
    let complexity = 1; // Base complexity
    
    // Count decision points
    const decisionKeywords = [
      'if', 'else if', 'while', 'for', 'switch', 'case', 'catch',
      '&&', '||', '?', '??'
    ];
    
    decisionKeywords.forEach(keyword => {
      const matches = code.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }

  /**
   * Check if file is TypeScript
   */
  private isTypeScriptFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.ts', '.tsx', '.mts', '.cts'].includes(ext);
  }

  /**
   * Check if file is JavaScript
   */
  private isJavaScriptFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.js', '.jsx', '.mjs', '.cjs'].includes(ext);
  }
}