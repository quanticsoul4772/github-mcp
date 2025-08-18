/**
 * Error detection agent
 * Analyzes code for potential runtime errors and edge cases
 */

import { BaseAgent } from '../base/agent-base.js';
import { AnalysisTarget, Finding, Severity, FindingCategory, AgentCapabilities } from '../types.js';
import { logger } from '../../logger.js';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Error detection agent for identifying potential runtime errors
 */
export class ErrorDetectionAgent extends BaseAgent {
  constructor() {
    super('error-detection', '1.0.0', 'Detects potential runtime errors and edge cases in code', {
      supportedFileTypes: ['ts', 'tsx', 'js', 'jsx', 'mts', 'cts'],
      analysisTypes: [
        FindingCategory.RUNTIME_ERROR,
        FindingCategory.TYPE_ERROR,
        FindingCategory.BEST_PRACTICE,
      ],
      canSuggestFixes: true,
      canGenerateTests: false,
      supportsIncremental: true,
      performance: {
        speed: 'medium',
        memoryUsage: 'medium',
        cpuUsage: 'medium',
      },
    });
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
   * Analyze a single file for potential errors
   */
  private async analyzeFile(filePath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      const content = await this.readFileContent(filePath);
      const lines = content.split('\n');

      // Analyze different types of potential errors
      findings.push(...(await this.analyzeNullPointerErrors(filePath, content, lines)));
      findings.push(...(await this.analyzeArrayErrors(filePath, content, lines)));
      findings.push(...(await this.analyzeAsyncErrors(filePath, content, lines)));
      findings.push(...(await this.analyzeTypeErrors(filePath, content, lines)));
      findings.push(...(await this.analyzeResourceLeaks(filePath, content, lines)));
      findings.push(...(await this.analyzeErrorHandling(filePath, content, lines)));
      findings.push(...(await this.analyzeSecurityVulnerabilities(filePath, content, lines)));
    } catch (error) {
      logger.error(`Error analyzing file ${filePath}`, { error });
    }

    return findings;
  }

  /**
   * Analyze potential null pointer errors
   */
  private async analyzeNullPointerErrors(
    filePath: string,
    content: string,
    lines: string[]
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Direct property access without null check
      const propertyAccessRegex = /(\w+)\.(\w+)/g;
      let match;
      while ((match = propertyAccessRegex.exec(line)) !== null) {
        const variable = match[1];
        const property = match[2];

        // Check if variable might be null/undefined
        if (this.mightBeNullish(variable, content, lines, index)) {
          findings.push(
            this.createFinding(
              Severity.HIGH,
              FindingCategory.RUNTIME_ERROR,
              'Potential Null Pointer Error',
              `Property access on '${variable}' which might be null or undefined`,
              filePath,
              lineNumber,
              match.index! + 1,
              line,
              `Add null check: ${variable}?.${property} or if (${variable}) { ${variable}.${property} }`,
              'null-pointer-error',
              { variable, property }
            )
          );
        }
      }

      // Array access without bounds check
      const arrayAccessRegex = /(\w+)\[([^\]]+)\]/g;
      while ((match = arrayAccessRegex.exec(line)) !== null) {
        const arrayName = match[1];
        const index = match[2];

        if (!this.hasArrayBoundsCheck(arrayName, index, lines, lineNumber - 1)) {
          findings.push(
            this.createFinding(
              Severity.MEDIUM,
              FindingCategory.RUNTIME_ERROR,
              'Unchecked Array Access',
              `Array access without bounds checking on '${arrayName}[${index}]'`,
              filePath,
              lineNumber,
              match.index! + 1,
              line,
              `Add bounds check: if (${index} >= 0 && ${index} < ${arrayName}.length)`,
              'unchecked-array-access',
              { arrayName, index }
            )
          );
        }
      }

      // Function calls on potentially undefined objects
      const methodCallRegex = /(\w+)\.(\w+)\(/g;
      while ((match = methodCallRegex.exec(line)) !== null) {
        const object = match[1];
        const method = match[2];

        if (this.mightBeNullish(object, content, lines, index)) {
          findings.push(
            this.createFinding(
              Severity.HIGH,
              FindingCategory.RUNTIME_ERROR,
              'Method Call on Null Object',
              `Method call on '${object}' which might be null or undefined`,
              filePath,
              lineNumber,
              match.index! + 1,
              line,
              `Add null check: ${object}?.${method}() or if (${object}) { ${object}.${method}() }`,
              'method-call-null-object',
              { object, method }
            )
          );
        }
      }
    });

    return findings;
  }

  /**
   * Analyze array-related errors
   */
  private async analyzeArrayErrors(
    filePath: string,
    content: string,
    lines: string[]
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // Array methods that might fail
      if (line.includes('.pop()') || line.includes('.shift()')) {
        const methodMatch = line.match(/(\w+)\.(pop|shift)\(\)/);
        if (methodMatch) {
          const arrayName = methodMatch[1];
          findings.push(
            this.createFinding(
              Severity.MEDIUM,
              FindingCategory.RUNTIME_ERROR,
              'Array Method on Empty Array',
              `${methodMatch[2]}() returns undefined on empty arrays`,
              filePath,
              lineNumber,
              line.indexOf(methodMatch[0]) + 1,
              line,
              `Check array length: if (${arrayName}.length > 0) { ${arrayName}.${methodMatch[2]}() }`,
              'array-method-empty'
            )
          );
        }
      }

      // Array.find() without null check
      if (line.includes('.find(')) {
        const findMatch = line.match(/(\w+)\.find\(/);
        if (findMatch && !line.includes('?.') && !this.hasNullCheckAfter(lines, index)) {
          findings.push(
            this.createFinding(
              Severity.MEDIUM,
              FindingCategory.RUNTIME_ERROR,
              'Array.find() Without Null Check',
              'Array.find() can return undefined if no element is found',
              filePath,
              lineNumber,
              line.indexOf('.find(') + 1,
              line,
              'Check result for undefined or use optional chaining',
              'array-find-no-check'
            )
          );
        }
      }

      // Infinite loop potential in array operations
      if (line.includes('while') && line.includes('.length')) {
        const whileMatch = line.match(/while\s*\([^)]*(\w+)\.length/);
        if (whileMatch) {
          const arrayName = whileMatch[1];
          // Check if array is modified in loop
          const loopBody = this.extractLoopBody(lines, index);
          if (
            !loopBody.includes(`${arrayName}.pop()`) &&
            !loopBody.includes(`${arrayName}.shift()`) &&
            !loopBody.includes(`${arrayName}.splice(`)
          ) {
            findings.push(
              this.createFinding(
                Severity.HIGH,
                FindingCategory.RUNTIME_ERROR,
                'Potential Infinite Loop',
                `While loop condition depends on array length but array is not modified in loop`,
                filePath,
                lineNumber,
                line.indexOf('while') + 1,
                line,
                'Ensure array is modified in loop or use different loop condition',
                'infinite-loop-array'
              )
            );
          }
        }
      }
    });

    return findings;
  }

  /**
   * Analyze async/await related errors
   */
  private async analyzeAsyncErrors(
    filePath: string,
    content: string,
    lines: string[]
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Async function without await
      if (trimmedLine.includes('async ') && trimmedLine.includes('function')) {
        const functionBody = this.extractFunctionBody(lines, index);
        if (!functionBody.includes('await') && !functionBody.includes('return Promise')) {
          findings.push(
            this.createFinding(
              Severity.LOW,
              FindingCategory.BEST_PRACTICE,
              'Async Function Without Await',
              'Async function does not use await or return Promise',
              filePath,
              lineNumber,
              line.indexOf('async') + 1,
              line,
              'Remove async keyword or add await/Promise usage',
              'async-no-await'
            )
          );
        }
      }

      // Promise without catch
      if (line.includes('.then(') && !this.hasPromiseCatch(lines, index)) {
        findings.push(
          this.createFinding(
            Severity.MEDIUM,
            FindingCategory.RUNTIME_ERROR,
            'Promise Without Error Handling',
            'Promise chain lacks error handling (.catch())',
            filePath,
            lineNumber,
            line.indexOf('.then(') + 1,
            line,
            'Add .catch() to handle promise rejections',
            'promise-no-catch'
          )
        );
      }

      // Await in non-async function
      if (line.includes('await ') && !this.isInAsyncFunction(lines, index)) {
        findings.push(
          this.createFinding(
            Severity.HIGH,
            FindingCategory.SYNTAX_ERROR,
            'Await in Non-Async Function',
            'await can only be used inside async functions',
            filePath,
            lineNumber,
            line.indexOf('await') + 1,
            line,
            'Add async keyword to function or remove await',
            'await-non-async'
          )
        );
      }

      // Floating promises (not awaited or handled)
      const promiseCallRegex = /(\w+\([^)]*\))\s*;/;
      const match = promiseCallRegex.exec(trimmedLine);
      if (
        match &&
        this.looksLikePromiseCall(match[1]) &&
        !trimmedLine.includes('await') &&
        !trimmedLine.includes('.then(') &&
        !trimmedLine.includes('.catch(')
      ) {
        findings.push(
          this.createFinding(
            Severity.MEDIUM,
            FindingCategory.RUNTIME_ERROR,
            'Floating Promise',
            'Promise is not awaited or handled, potential unhandled rejection',
            filePath,
            lineNumber,
            1,
            line,
            'Add await or .catch() to handle the promise',
            'floating-promise'
          )
        );
      }
    });

    return findings;
  }

  /**
   * Analyze type-related errors
   */
  private async analyzeTypeErrors(
    filePath: string,
    content: string,
    lines: string[]
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    if (!this.isTypeScriptFile(filePath)) {
      return findings; // Skip for non-TypeScript files
    }

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // Type assertions that might be unsafe
      const typeAssertionRegex = /(\w+)\s+as\s+(\w+)/g;
      let match;
      while ((match = typeAssertionRegex.exec(line)) !== null) {
        const variable = match[1];
        const targetType = match[2];

        findings.push(
          this.createFinding(
            Severity.MEDIUM,
            FindingCategory.TYPE_ERROR,
            'Unsafe Type Assertion',
            `Type assertion '${variable} as ${targetType}' might be unsafe`,
            filePath,
            lineNumber,
            match.index! + 1,
            line,
            'Use type guards or proper type checking instead of assertions',
            'unsafe-type-assertion',
            { variable, targetType }
          )
        );
      }

      // Implicit any returns
      if (line.includes('function ') && !line.includes(': ') && !line.includes('void')) {
        const functionMatch = line.match(/function\s+(\w+)/);
        if (functionMatch) {
          findings.push(
            this.createFinding(
              Severity.LOW,
              FindingCategory.TYPE_ERROR,
              'Missing Return Type',
              `Function '${functionMatch[1]}' lacks explicit return type annotation`,
              filePath,
              lineNumber,
              line.indexOf(functionMatch[1]) + 1,
              line,
              'Add explicit return type annotation',
              'missing-return-type'
            )
          );
        }
      }
    });

    return findings;
  }

  /**
   * Analyze resource leaks
   */
  private async analyzeResourceLeaks(
    filePath: string,
    content: string,
    lines: string[]
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // File operations without proper cleanup
      if (
        line.includes('fs.open') ||
        line.includes('createReadStream') ||
        line.includes('createWriteStream')
      ) {
        const hasCleanup = this.hasResourceCleanup(lines, index, ['close', 'end', 'destroy']);
        if (!hasCleanup) {
          findings.push(
            this.createFinding(
              Severity.MEDIUM,
              FindingCategory.RUNTIME_ERROR,
              'Resource Leak',
              'File resource opened without proper cleanup',
              filePath,
              lineNumber,
              1,
              line,
              'Ensure file resources are properly closed',
              'resource-leak-file'
            )
          );
        }
      }

      // Event listeners without cleanup
      if (line.includes('addEventListener') || line.includes('.on(')) {
        const hasRemoval = this.hasResourceCleanup(lines, index, [
          'removeEventListener',
          'off',
          'removeAllListeners',
        ]);
        if (!hasRemoval) {
          findings.push(
            this.createFinding(
              Severity.LOW,
              FindingCategory.RUNTIME_ERROR,
              'Event Listener Leak',
              'Event listener added without corresponding removal',
              filePath,
              lineNumber,
              1,
              line,
              'Remove event listeners to prevent memory leaks',
              'event-listener-leak'
            )
          );
        }
      }

      // Timers without cleanup
      if (line.includes('setInterval') || line.includes('setTimeout')) {
        const hasCleanup = this.hasResourceCleanup(lines, index, ['clearInterval', 'clearTimeout']);
        if (!hasCleanup && line.includes('setInterval')) {
          findings.push(
            this.createFinding(
              Severity.MEDIUM,
              FindingCategory.RUNTIME_ERROR,
              'Timer Leak',
              'setInterval without corresponding clearInterval',
              filePath,
              lineNumber,
              line.indexOf('setInterval') + 1,
              line,
              'Clear intervals to prevent memory leaks',
              'timer-leak'
            )
          );
        }
      }
    });

    return findings;
  }

  /**
   * Analyze error handling patterns
   */
  private async analyzeErrorHandling(
    filePath: string,
    content: string,
    lines: string[]
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Try blocks without catch
      if (trimmedLine.startsWith('try {')) {
        const hasCatch = this.hasCatchBlock(lines, index);
        if (!hasCatch) {
          findings.push(
            this.createFinding(
              Severity.HIGH,
              FindingCategory.RUNTIME_ERROR,
              'Try Without Catch',
              'Try block without catch or finally block',
              filePath,
              lineNumber,
              1,
              line,
              'Add catch block to handle potential errors',
              'try-no-catch'
            )
          );
        }
      }

      // Generic error catching
      if (
        trimmedLine.includes('catch (') &&
        (trimmedLine.includes('catch (e)') || trimmedLine.includes('catch (error)'))
      ) {
        const catchBody = this.extractCatchBody(lines, index);
        if (
          !catchBody.includes('console.') &&
          !catchBody.includes('logger.') &&
          !catchBody.includes('throw')
        ) {
          findings.push(
            this.createFinding(
              Severity.MEDIUM,
              FindingCategory.BEST_PRACTICE,
              'Silent Error Handling',
              'Error is caught but not logged or re-thrown',
              filePath,
              lineNumber,
              line.indexOf('catch') + 1,
              line,
              'Log the error or re-throw if appropriate',
              'silent-error-handling'
            )
          );
        }
      }

      // Throwing non-Error objects
      if (
        trimmedLine.includes('throw ') &&
        !trimmedLine.includes('new Error') &&
        !trimmedLine.includes('Error(')
      ) {
        const throwMatch = trimmedLine.match(/throw\s+([^;]+)/);
        if (throwMatch && !throwMatch[1].includes('Error')) {
          findings.push(
            this.createFinding(
              Severity.MEDIUM,
              FindingCategory.BEST_PRACTICE,
              'Non-Error Thrown',
              'Throwing non-Error object, should throw Error instances',
              filePath,
              lineNumber,
              line.indexOf('throw') + 1,
              line,
              'Throw Error instances: throw new Error(message)',
              'non-error-thrown'
            )
          );
        }
      }
    });

    return findings;
  }

  /**
   * Analyze basic security vulnerabilities
   */
  private async analyzeSecurityVulnerabilities(
    filePath: string,
    content: string,
    lines: string[]
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // eval() usage
      if (line.includes('eval(')) {
        findings.push(
          this.createFinding(
            Severity.HIGH,
            FindingCategory.SECURITY_VULNERABILITY,
            'Use of eval()',
            'eval() can execute arbitrary code and is a security risk',
            filePath,
            lineNumber,
            line.indexOf('eval(') + 1,
            line,
            'Avoid eval(), use safer alternatives like JSON.parse()',
            'eval-usage'
          )
        );
      }

      // innerHTML with user input
      if (
        line.includes('innerHTML') &&
        (line.includes('+') || line.includes('${') || line.includes('concat'))
      ) {
        findings.push(
          this.createFinding(
            Severity.HIGH,
            FindingCategory.SECURITY_VULNERABILITY,
            'Potential XSS',
            'innerHTML with dynamic content can lead to XSS vulnerabilities',
            filePath,
            lineNumber,
            line.indexOf('innerHTML') + 1,
            line,
            'Use textContent or properly sanitize HTML content',
            'potential-xss'
          )
        );
      }

      // Hardcoded credentials
      const credentialPatterns = [
        /password\s*[:=]\s*["'][^"']+["']/i,
        /api[_-]?key\s*[:=]\s*["'][^"']+["']/i,
        /secret\s*[:=]\s*["'][^"']+["']/i,
        /token\s*[:=]\s*["'][^"']+["']/i,
      ];

      credentialPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          findings.push(
            this.createFinding(
              Severity.HIGH,
              FindingCategory.SECURITY_VULNERABILITY,
              'Hardcoded Credentials',
              'Hardcoded credentials found in source code',
              filePath,
              lineNumber,
              1,
              line.replace(/["'][^"']+["']/g, '"***"'), // Mask the actual value
              'Use environment variables or secure configuration',
              'hardcoded-credentials'
            )
          );
        }
      });
    });

    return findings;
  }

  // Helper methods

  private mightBeNullish(
    variable: string,
    content: string,
    lines: string[],
    currentIndex: number
  ): boolean {
    // Simple heuristic: check if variable is assigned from potentially null sources
    const nullishSources = [
      `${variable} = null`,
      `${variable} = undefined`,
      `${variable} = document.getElementById`,
      `${variable} = document.querySelector`,
      `${variable} = find(`,
      `${variable} = .*\\.find\\(`,
    ];

    return nullishSources.some(
      pattern =>
        new RegExp(pattern).test(content) ||
        lines.slice(0, currentIndex).some(line => new RegExp(pattern).test(line))
    );
  }

  private hasArrayBoundsCheck(
    arrayName: string,
    index: string,
    lines: string[],
    currentIndex: number
  ): boolean {
    // Look for bounds check in nearby lines
    const checkPattern = new RegExp(
      `${index}\\s*[<>=].*${arrayName}\\.length|${arrayName}\\.length\\s*[<>=].*${index}`
    );

    for (
      let i = Math.max(0, currentIndex - 3);
      i <= Math.min(lines.length - 1, currentIndex + 1);
      i++
    ) {
      if (checkPattern.test(lines[i])) {
        return true;
      }
    }
    return false;
  }

  private hasNullCheckAfter(lines: string[], currentIndex: number): boolean {
    // Check next few lines for null checks
    for (let i = currentIndex + 1; i < Math.min(lines.length, currentIndex + 3); i++) {
      if (lines[i].includes('if (') && (lines[i].includes('!==') || lines[i].includes('!='))) {
        return true;
      }
    }
    return false;
  }

  private extractLoopBody(lines: string[], startIndex: number): string {
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

  private extractFunctionBody(lines: string[], startIndex: number): string {
    return this.extractLoopBody(lines, startIndex);
  }

  private hasPromiseCatch(lines: string[], currentIndex: number): boolean {
    // Look for .catch() in the same statement or following lines
    for (let i = currentIndex; i < Math.min(lines.length, currentIndex + 5); i++) {
      if (lines[i].includes('.catch(')) {
        return true;
      }
    }
    return false;
  }

  private isInAsyncFunction(lines: string[], currentIndex: number): boolean {
    // Look backwards for async function declaration
    for (let i = currentIndex; i >= 0; i--) {
      const line = lines[i];
      if (line.includes('async ') && (line.includes('function') || line.includes('=>'))) {
        return true;
      }
      if (line.includes('function ') && !line.includes('async')) {
        return false;
      }
    }
    return false;
  }

  private looksLikePromiseCall(call: string): boolean {
    // Heuristic: function calls that commonly return promises
    const promiseIndicators = [
      'fetch(',
      'axios.',
      'request(',
      'query(',
      'save(',
      'update(',
      'delete(',
      'create(',
      'find(',
      'exec(',
      'then(',
      'async',
      'Promise',
    ];

    return promiseIndicators.some(indicator => call.includes(indicator));
  }

  private hasResourceCleanup(
    lines: string[],
    startIndex: number,
    cleanupMethods: string[]
  ): boolean {
    // Look for cleanup methods in the rest of the function/block
    const remainingLines = lines.slice(startIndex).join('\n');
    return cleanupMethods.some(method => remainingLines.includes(method));
  }

  private hasCatchBlock(lines: string[], tryIndex: number): boolean {
    let braceCount = 0;

    for (let i = tryIndex; i < lines.length; i++) {
      const line = lines[i];
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      if (line.trim().startsWith('catch (') || line.trim().startsWith('finally')) {
        return true;
      }

      if (braceCount === 0 && i > tryIndex) {
        break;
      }
    }

    return false;
  }

  private extractCatchBody(lines: string[], catchIndex: number): string {
    return this.extractLoopBody(lines, catchIndex);
  }

  private isTypeScriptFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.ts', '.tsx', '.mts', '.cts'].includes(ext);
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
}
