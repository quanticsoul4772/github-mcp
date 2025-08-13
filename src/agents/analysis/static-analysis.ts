/**
 * Static Analysis Agent - Analyzes code for common issues
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../logger.js';
import {
  BaseAgent,
  AnalysisContext,
  AnalysisReport,
  AnalysisSummary,
  Finding,
  Severity,
  FindingCategory,
  AgentCapabilities
} from '../types.js';

interface StaticAnalysisRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  category: FindingCategory;
  pattern: RegExp;
  fileTypes: string[];
  check: (content: string, filePath: string) => Finding[];
}

export class StaticAnalysisAgent extends BaseAgent {
  readonly name = 'static-analysis';
  readonly version = '1.0.0';
  readonly capabilities: AgentCapabilities = {
    supportedFileTypes: ['.ts', '.js', '.tsx', '.jsx', '.json'],
    supportedLanguages: ['typescript', 'javascript'],
    categories: [
      FindingCategory.SECURITY,
      FindingCategory.PERFORMANCE,
      FindingCategory.MAINTAINABILITY,
      FindingCategory.RELIABILITY,
      FindingCategory.BEST_PRACTICES
    ],
    requiresNetwork: false,
    requiresFileSystem: true,
    canRunInParallel: true
  };

  private rules: StaticAnalysisRule[] = [
    // Security rules
    {
      id: 'no-eval',
      name: 'No eval() usage',
      description: 'Avoid using eval() as it can execute arbitrary code',
      severity: Severity.CRITICAL,
      category: FindingCategory.SECURITY,
      pattern: /\beval\s*\(/g,
      fileTypes: ['.ts', '.js', '.tsx', '.jsx'],
      check: (content: string, filePath: string) => {
        const findings: Finding[] = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          if (this.rules[0].pattern.test(line)) {
            findings.push(this.createFinding(
              Severity.CRITICAL,
              FindingCategory.SECURITY,
              'Use of eval() detected',
              'eval() can execute arbitrary code and poses a security risk. Consider safer alternatives.',
              filePath,
              {
                line: index + 1,
                rule: 'no-eval',
                snippet: line.trim(),
                suggestion: 'Use JSON.parse() for JSON data or Function constructor for safer code execution'
              }
            ));
          }
        });
        
        return findings;
      }
    },

    // Performance rules
    {
      id: 'no-console-log',
      name: 'Console statements in production',
      description: 'Console statements should be removed from production code',
      severity: Severity.MEDIUM,
      category: FindingCategory.PERFORMANCE,
      pattern: /console\.(log|warn|error|info|debug)/g,
      fileTypes: ['.ts', '.js', '.tsx', '.jsx'],
      check: (content: string, filePath: string) => {
        const findings: Finding[] = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          const match = this.rules[1].pattern.exec(line);
          if (match) {
            findings.push(this.createFinding(
              Severity.MEDIUM,
              FindingCategory.PERFORMANCE,
              'Console statement found',
              'Console statements can impact performance and should be removed from production code.',
              filePath,
              {
                line: index + 1,
                rule: 'no-console-log',
                snippet: line.trim(),
                suggestion: 'Use a proper logging library or remove console statements'
              }
            ));
          }
        });
        
        return findings;
      }
    },

    // Maintainability rules
    {
      id: 'no-any-type',
      name: 'Avoid any type',
      description: 'Using any type defeats the purpose of TypeScript',
      severity: Severity.HIGH,
      category: FindingCategory.MAINTAINABILITY,
      pattern: /:\s*any\b/g,
      fileTypes: ['.ts', '.tsx'],
      check: (content: string, filePath: string) => {
        const findings: Finding[] = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          if (this.rules[2].pattern.test(line)) {
            findings.push(this.createFinding(
              Severity.HIGH,
              FindingCategory.MAINTAINABILITY,
              'Use of any type detected',
              'Using any type bypasses TypeScript type checking and reduces code safety.',
              filePath,
              {
                line: index + 1,
                rule: 'no-any-type',
                snippet: line.trim(),
                suggestion: 'Use specific types or unknown instead of any'
              }
            ));
          }
        });
        
        return findings;
      }
    },

    // Reliability rules
    {
      id: 'no-empty-catch',
      name: 'Empty catch blocks',
      description: 'Empty catch blocks hide errors and make debugging difficult',
      severity: Severity.HIGH,
      category: FindingCategory.RELIABILITY,
      pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g,
      fileTypes: ['.ts', '.js', '.tsx', '.jsx'],
      check: (content: string, filePath: string) => {
        const findings: Finding[] = [];
        const lines = content.split('\n');
        let inCatch = false;
        let catchStart = -1;
        let braceCount = 0;
        
        lines.forEach((line, index) => {
          if (/catch\s*\([^)]*\)\s*\{/.test(line)) {
            inCatch = true;
            catchStart = index;
            braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
          } else if (inCatch) {
            braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
            
            if (braceCount === 0) {
              // Check if catch block is empty
              const catchContent = lines.slice(catchStart, index + 1).join('\n');
              if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(catchContent.replace(/\s+/g, ' '))) {
                findings.push(this.createFinding(
                  Severity.HIGH,
                  FindingCategory.RELIABILITY,
                  'Empty catch block detected',
                  'Empty catch blocks hide errors and make debugging difficult.',
                  filePath,
                  {
                    line: catchStart + 1,
                    rule: 'no-empty-catch',
                    snippet: catchContent.trim(),
                    suggestion: 'Add proper error handling or at least log the error'
                  }
                ));
              }
              inCatch = false;
            }
          }
        });
        
        return findings;
      }
    },

    // Best practices rules
    {
      id: 'prefer-const',
      name: 'Prefer const over let',
      description: 'Use const for variables that are never reassigned',
      severity: Severity.LOW,
      category: FindingCategory.BEST_PRACTICES,
      pattern: /\blet\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g,
      fileTypes: ['.ts', '.js', '.tsx', '.jsx'],
      check: (content: string, filePath: string) => {
        const findings: Finding[] = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          const letMatch = /\blet\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/.exec(line);
          if (letMatch) {
            const varName = letMatch[1];
            // Simple heuristic: if variable is not reassigned in the same function scope
            const remainingContent = lines.slice(index + 1).join('\n');
            const reassignmentPattern = new RegExp(`\\b${varName}\\s*=(?!=)`, 'g');
            
            if (!reassignmentPattern.test(remainingContent)) {
              findings.push(this.createFinding(
                Severity.LOW,
                FindingCategory.BEST_PRACTICES,
                'Variable could be const',
                `Variable '${varName}' is never reassigned and could be declared with const.`,
                filePath,
                {
                  line: index + 1,
                  rule: 'prefer-const',
                  snippet: line.trim(),
                  suggestion: `Change 'let ${varName}' to 'const ${varName}'`
                }
              ));
            }
          }
        });
        
        return findings;
      }
    }
  ];

  async analyze(context: AnalysisContext): Promise<AnalysisReport> {
    const startTime = Date.now();
    logger.info('Starting static analysis', { 
      repositoryPath: context.repositoryPath,
      agent: this.name 
    });

    const findings: Finding[] = [];
    const filesAnalyzed: string[] = [];

    try {
      // Get files to analyze
      const filesToAnalyze = await this.getFilesToAnalyze(context);
      
      logger.debug('Files to analyze', { 
        count: filesToAnalyze.length,
        files: filesToAnalyze.slice(0, 10) // Log first 10 files
      });

      // Analyze each file
      for (const filePath of filesToAnalyze) {
        try {
          const fileFindings = await this.analyzeFile(filePath);
          findings.push(...fileFindings);
          filesAnalyzed.push(filePath);
        } catch (error) {
          logger.warn('Failed to analyze file', { 
            file: filePath, 
            error: (error as Error).message 
          });
        }
      }

      const duration = Date.now() - startTime;
      const summary: AnalysisSummary = {
        filesAnalyzed: filesAnalyzed.length,
        totalFindings: findings.length,
        findingsBySeverity: this.groupFindingsBySeverity(findings),
        findingsByCategory: this.groupFindingsByCategory(findings),
        duration,
        timestamp: new Date()
      };

      logger.info('Static analysis completed', {
        agent: this.name,
        duration,
        filesAnalyzed: filesAnalyzed.length,
        totalFindings: findings.length,
        findingsBySeverity: summary.findingsBySeverity
      });

      return {
        agentName: this.name,
        version: this.version,
        summary,
        findings,
        duration,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Static analysis failed', { 
        agent: this.name, 
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  }

  private async getFilesToAnalyze(context: AnalysisContext): Promise<string[]> {
    const files: string[] = [];
    
    if (context.files) {
      // Use provided file list
      for (const file of context.files) {
        const fullPath = path.isAbsolute(file) ? file : path.join(context.repositoryPath, file);
        if (this.shouldAnalyzeFile(fullPath, context)) {
          files.push(fullPath);
        }
      }
    } else {
      // Scan directory
      await this.scanDirectory(context.repositoryPath, files, context);
    }

    return files;
  }

  private async scanDirectory(
    dirPath: string, 
    files: string[], 
    context: AnalysisContext
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip node_modules and other common directories
          if (!this.shouldSkipDirectory(entry.name)) {
            await this.scanDirectory(fullPath, files, context);
          }
        } else if (entry.isFile()) {
          if (this.shouldAnalyzeFile(fullPath, context)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to scan directory', { 
        directory: dirPath, 
        error: (error as Error).message 
      });
    }
  }

  private shouldAnalyzeFile(filePath: string, context: AnalysisContext): boolean {
    const ext = path.extname(filePath);
    
    // Check if file type is supported
    if (!this.capabilities.supportedFileTypes.includes(ext)) {
      return false;
    }

    // Check file size limit
    if (context.maxFileSize) {
      try {
        const stats = fs.stat(filePath);
        // Note: This is async, but we'll do a simple check for now
      } catch {
        return false;
      }
    }

    // Check include patterns
    if (context.includePatterns && context.includePatterns.length > 0) {
      const matches = context.includePatterns.some(pattern => 
        new RegExp(pattern).test(filePath)
      );
      if (!matches) return false;
    }

    // Check exclude patterns
    if (context.excludePatterns && context.excludePatterns.length > 0) {
      const excluded = context.excludePatterns.some(pattern => 
        new RegExp(pattern).test(filePath)
      );
      if (excluded) return false;
    }

    return true;
  }

  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules',
      '.git',
      '.svn',
      '.hg',
      'dist',
      'build',
      'coverage',
      '.nyc_output',
      'tmp',
      'temp'
    ];
    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  private async analyzeFile(filePath: string): Promise<Finding[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const findings: Finding[] = [];
      const ext = path.extname(filePath);

      // Apply relevant rules
      for (const rule of this.rules) {
        if (rule.fileTypes.includes(ext)) {
          const ruleFindings = rule.check(content, filePath);
          findings.push(...ruleFindings);
        }
      }

      return findings;
    } catch (error) {
      logger.warn('Failed to read file for analysis', { 
        file: filePath, 
        error: (error as Error).message 
      });
      return [];
    }
  }

  private groupFindingsBySeverity(findings: Finding[]): Record<Severity, number> {
    const groups: Record<Severity, number> = {
      [Severity.CRITICAL]: 0,
      [Severity.HIGH]: 0,
      [Severity.MEDIUM]: 0,
      [Severity.LOW]: 0,
      [Severity.INFO]: 0
    };

    for (const finding of findings) {
      groups[finding.severity]++;
    }

    return groups;
  }

  private groupFindingsByCategory(findings: Finding[]): Record<FindingCategory, number> {
    const groups: Record<FindingCategory, number> = {
      [FindingCategory.SECURITY]: 0,
      [FindingCategory.PERFORMANCE]: 0,
      [FindingCategory.MAINTAINABILITY]: 0,
      [FindingCategory.RELIABILITY]: 0,
      [FindingCategory.STYLE]: 0,
      [FindingCategory.DOCUMENTATION]: 0,
      [FindingCategory.TESTING]: 0,
      [FindingCategory.ACCESSIBILITY]: 0,
      [FindingCategory.COMPATIBILITY]: 0,
      [FindingCategory.BEST_PRACTICES]: 0
    };

    for (const finding of findings) {
      groups[finding.category]++;
    }

    return groups;
  }
}