import { AbstractBaseAgent } from '../base/base-agent.js';
import { AnalysisContext, AnalysisResult, Finding } from '../types/agent-interfaces.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Agent for static code analysis including syntax validation,
 * complexity analysis, and code quality checks
 */
export class CodeAnalysisAgent extends AbstractBaseAgent {
  public readonly name = 'code-analysis';
  public readonly version = '1.0.0';
  public readonly description = 'Static code analysis for syntax, complexity, and quality';

  private readonly supportedExtensions = ['ts', 'js', 'tsx', 'jsx', 'json'];

  public canHandle(fileType: string): boolean {
    return this.supportedExtensions.includes(fileType.toLowerCase());
  }

  public getPriority(): number {
    return 10; // High priority - run early
  }

  public async analyze(context: AnalysisContext): Promise<AnalysisResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const metrics: Record<string, number> = {
      filesAnalyzed: 0,
      linesOfCode: 0,
      complexityScore: 0,
      duplicateLines: 0
    };

    try {
      const targetFiles = this.filterFiles(context.files, context);
      this.log('info', `Analyzing ${targetFiles.length} files`);

      for (const file of targetFiles) {
        const filePath = path.resolve(context.projectPath, file);
        const content = await this.readFile(filePath);
        
        if (content === null) {
          findings.push(this.createFinding(
            'medium',
            'file-access',
            `Could not read file: ${file}`,
            { file }
          ));
          continue;
        }

        metrics.filesAnalyzed++;
        const lines = content.split('\n');
        metrics.linesOfCode += lines.length;

        // Syntax analysis
        findings.push(...await this.analyzeSyntax(file, content));
        
        // Complexity analysis
        findings.push(...await this.analyzeComplexity(file, content));
        
        // Code quality checks
        findings.push(...await this.analyzeCodeQuality(file, content));
        
        // Duplicate code detection
        findings.push(...await this.analyzeDuplicates(file, content));
      }

      // Calculate overall complexity score
      metrics.complexityScore = this.calculateOverallComplexity(findings);

      const recommendations = this.generateRecommendations(findings, metrics);

      return this.createResult('success', findings, metrics, recommendations);
      
    } catch (error) {
      this.log('error', 'Analysis failed', error);
      return this.createResult('error', [
        this.createFinding(
          'critical',
          'analysis-error',
          `Code analysis failed: ${error instanceof Error ? error.message : String(error)}`
        )
      ]);
    }
  }

  /**
   * Analyze syntax and basic structure
   */
  private async analyzeSyntax(file: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for common syntax issues
      if (this.isJavaScriptFile(file)) {
        // Missing semicolons (basic check)
        if (this.isMissingSemicolon(line)) {
          findings.push(this.createFinding(
            'low',
            'syntax',
            'Missing semicolon',
            { file, line: lineNumber, fix: 'Add semicolon at end of statement' }
          ));
        }

        // Unused variables (basic pattern matching)
        const unusedVar = this.findUnusedVariable(line);
        if (unusedVar) {
          findings.push(this.createFinding(
            'medium',
            'code-quality',
            `Potentially unused variable: ${unusedVar}`,
            { file, line: lineNumber, fix: 'Remove unused variable or use it' }
          ));
        }

        // Console.log statements (should be removed in production)
        if (line.includes('console.log') || line.includes('console.warn') || line.includes('console.error')) {
          findings.push(this.createFinding(
            'low',
            'code-quality',
            'Console statement found - consider removing for production',
            { file, line: lineNumber, fix: 'Remove console statement or use proper logging' }
          ));
        }
      }

      // Check for TODO/FIXME comments
      if (line.includes('TODO') || line.includes('FIXME') || line.includes('HACK')) {
        findings.push(this.createFinding(
          'info',
          'maintenance',
          'TODO/FIXME comment found',
          { file, line: lineNumber, evidence: line.trim() }
        ));
      }
    }

    return findings;
  }

  /**
   * Analyze code complexity
   */
  private async analyzeComplexity(file: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    let functionComplexity = 0;
    let nestingLevel = 0;
    let currentFunction = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Track function declarations
      const functionMatch = line.match(/(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:function|\([^)]*\)\s*=>))/);
      if (functionMatch) {
        currentFunction = functionMatch[1] || functionMatch[2] || 'anonymous';
        functionComplexity = 1; // Base complexity
      }

      // Track complexity-increasing constructs
      if (line.includes('if') || line.includes('else if') || line.includes('while') || 
          line.includes('for') || line.includes('switch') || line.includes('catch')) {
        functionComplexity++;
      }

      // Track nesting level
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      nestingLevel += openBraces - closeBraces;

      // Check for high complexity
      if (functionComplexity > 10) {
        findings.push(this.createFinding(
          'high',
          'complexity',
          `High cyclomatic complexity in function '${currentFunction}' (${functionComplexity})`,
          { 
            file, 
            line: lineNumber, 
            fix: 'Consider breaking down this function into smaller functions' 
          }
        ));
      }

      // Check for deep nesting
      if (nestingLevel > 4) {
        findings.push(this.createFinding(
          'medium',
          'complexity',
          `Deep nesting detected (level ${nestingLevel})`,
          { 
            file, 
            line: lineNumber, 
            fix: 'Consider extracting nested logic into separate functions' 
          }
        ));
      }

      // Reset function complexity when function ends
      if (line.includes('}') && nestingLevel === 0) {
        functionComplexity = 0;
        currentFunction = '';
      }
    }

    return findings;
  }

  /**
   * Analyze code quality issues
   */
  private async analyzeCodeQuality(file: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Long lines
      if (line.length > 120) {
        findings.push(this.createFinding(
          'low',
          'style',
          `Line too long (${line.length} characters)`,
          { file, line: lineNumber, fix: 'Break long line into multiple lines' }
        ));
      }

      // Magic numbers
      const magicNumber = this.findMagicNumber(line);
      if (magicNumber) {
        findings.push(this.createFinding(
          'medium',
          'maintainability',
          `Magic number found: ${magicNumber}`,
          { file, line: lineNumber, fix: 'Replace with named constant' }
        ));
      }

      // Empty catch blocks
      if (line.includes('catch') && lines[i + 1]?.trim() === '{' && lines[i + 2]?.trim() === '}') {
        findings.push(this.createFinding(
          'high',
          'error-handling',
          'Empty catch block',
          { file, line: lineNumber + 1, fix: 'Add proper error handling or logging' }
        ));
      }

      // Potential security issues
      if (line.includes('eval(') || line.includes('innerHTML') || line.includes('document.write')) {
        findings.push(this.createFinding(
          'high',
          'security',
          'Potentially unsafe operation detected',
          { file, line: lineNumber, evidence: line.trim() }
        ));
      }
    }

    return findings;
  }

  /**
   * Analyze for duplicate code
   */
  private async analyzeDuplicates(file: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Simple duplicate line detection
    const lineCount = new Map<string, number[]>();
    
    lines.forEach((line, index) => {
      if (line.length > 20) { // Only check substantial lines
        if (!lineCount.has(line)) {
          lineCount.set(line, []);
        }
        lineCount.get(line)!.push(index + 1);
      }
    });

    lineCount.forEach((lineNumbers, line) => {
      if (lineNumbers.length > 1) {
        findings.push(this.createFinding(
          'medium',
          'duplication',
          `Duplicate line found at lines: ${lineNumbers.join(', ')}`,
          { file, evidence: line, fix: 'Consider extracting to a function or constant' }
        ));
      }
    });

    return findings;
  }

  /**
   * Helper methods
   */
  private isJavaScriptFile(file: string): boolean {
    return /\.(js|jsx|ts|tsx)$/.test(file);
  }

  private isMissingSemicolon(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.length > 0 && 
           !trimmed.endsWith(';') && 
           !trimmed.endsWith('{') && 
           !trimmed.endsWith('}') &&
           !trimmed.startsWith('//') &&
           !trimmed.startsWith('*') &&
           /^(const|let|var|return|throw)\s/.test(trimmed);
  }

  private findUnusedVariable(line: string): string | null {
    const match = line.match(/(?:const|let|var)\s+(\w+)\s*=/);
    if (match && !line.includes(match[1], match.index! + match[0].length)) {
      return match[1];
    }
    return null;
  }

  private findMagicNumber(line: string): string | null {
    const numbers = line.match(/\b(\d{2,})\b/g);
    if (numbers) {
      // Filter out common non-magic numbers
      const magicNumbers = numbers.filter(num => 
        !['100', '200', '300', '400', '500', '1000'].includes(num)
      );
      return magicNumbers[0] || null;
    }
    return null;
  }

  private calculateOverallComplexity(findings: Finding[]): number {
    const complexityFindings = findings.filter(f => f.category === 'complexity');
    return complexityFindings.length;
  }

  private generateRecommendations(findings: Finding[], metrics: Record<string, number>): string[] {
    const recommendations: string[] = [];

    if (metrics.complexityScore > 5) {
      recommendations.push('Consider refactoring complex functions to improve maintainability');
    }

    if (findings.some(f => f.category === 'security')) {
      recommendations.push('Review and address security-related findings immediately');
    }

    if (findings.some(f => f.category === 'duplication')) {
      recommendations.push('Extract duplicate code into reusable functions or constants');
    }

    const errorFindings = findings.filter(f => f.severity === 'high' || f.severity === 'critical');
    if (errorFindings.length > 0) {
      recommendations.push(`Address ${errorFindings.length} high-priority issues first`);
    }

    return recommendations;
  }
}