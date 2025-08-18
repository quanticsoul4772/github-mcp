import { AbstractBaseAgent } from '../base/base-agent.js';
import { AnalysisContext, AnalysisResult, Finding } from '../types/agent-interfaces.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Agent for TypeScript type safety analysis
 */
export class TypeSafetyAgent extends AbstractBaseAgent {
  public readonly name = 'type-safety';
  public readonly version = '1.0.0';
  public readonly description = 'TypeScript type safety and type coverage analysis';

  private readonly supportedExtensions = ['ts', 'tsx'];

  public canHandle(fileType: string): boolean {
    return this.supportedExtensions.includes(fileType.toLowerCase());
  }

  public getPriority(): number {
    return 20; // Run after basic code analysis
  }

  public async analyze(context: AnalysisContext): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    const metrics: Record<string, number> = {
      filesAnalyzed: 0,
      typeAnnotations: 0,
      anyTypes: 0,
      typeCoverage: 0,
      interfaceViolations: 0,
    };

    try {
      const targetFiles = this.filterFiles(context.files, context);
      this.log('info', `Analyzing type safety in ${targetFiles.length} TypeScript files`);

      // Check for tsconfig.json
      const tsconfigPath = path.join(context.projectPath, 'tsconfig.json');
      const hasTsConfig = await this.fileExists(tsconfigPath);

      if (!hasTsConfig) {
        findings.push(
          this.createFinding('high', 'configuration', 'Missing tsconfig.json file', {
            fix: 'Create tsconfig.json with strict type checking enabled',
          })
        );
      } else {
        findings.push(...(await this.analyzeTsConfig(tsconfigPath)));
      }

      for (const file of targetFiles) {
        const filePath = path.resolve(context.projectPath, file);
        const content = await this.readFile(filePath);

        if (content === null) {
          continue;
        }

        metrics.filesAnalyzed++;

        // Type annotation analysis
        findings.push(...(await this.analyzeTypeAnnotations(file, content)));

        // Any type usage analysis
        findings.push(...(await this.analyzeAnyTypes(file, content)));

        // Interface and type definition analysis
        findings.push(...(await this.analyzeInterfaces(file, content)));

        // Generic type usage
        findings.push(...(await this.analyzeGenerics(file, content)));

        // Null safety analysis
        findings.push(...(await this.analyzeNullSafety(file, content)));
      }

      // Calculate type coverage
      metrics.typeCoverage = this.calculateTypeCoverage(metrics);

      const recommendations = this.generateRecommendations(findings, metrics);

      return this.createResult('success', findings, metrics, recommendations);
    } catch (error) {
      this.log('error', 'Type safety analysis failed', error);
      return this.createResult('error', [
        this.createFinding(
          'critical',
          'analysis-error',
          `Type safety analysis failed: ${error instanceof Error ? error.message : String(error)}`
        ),
      ]);
    }
  }

  /**
   * Analyze TypeScript configuration
   */
  private async analyzeTsConfig(tsconfigPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      const content = await this.readFile(tsconfigPath);
      if (!content) return findings;

      const config = JSON.parse(content);
      const compilerOptions = config.compilerOptions || {};

      // Check for strict mode
      if (!compilerOptions.strict) {
        findings.push(
          this.createFinding('high', 'configuration', 'TypeScript strict mode is not enabled', {
            file: 'tsconfig.json',
            fix: 'Enable "strict": true in compilerOptions',
          })
        );
      }

      // Check for noImplicitAny
      if (compilerOptions.noImplicitAny === false) {
        findings.push(
          this.createFinding('medium', 'configuration', 'noImplicitAny is disabled', {
            file: 'tsconfig.json',
            fix: 'Enable "noImplicitAny": true in compilerOptions',
          })
        );
      }

      // Check for strictNullChecks
      if (compilerOptions.strictNullChecks === false) {
        findings.push(
          this.createFinding('medium', 'configuration', 'strictNullChecks is disabled', {
            file: 'tsconfig.json',
            fix: 'Enable "strictNullChecks": true in compilerOptions',
          })
        );
      }

      // Check for noImplicitReturns
      if (!compilerOptions.noImplicitReturns) {
        findings.push(
          this.createFinding('medium', 'configuration', 'noImplicitReturns is not enabled', {
            file: 'tsconfig.json',
            fix: 'Enable "noImplicitReturns": true in compilerOptions',
          })
        );
      }
    } catch (error) {
      findings.push(
        this.createFinding('medium', 'configuration', 'Invalid tsconfig.json format', {
          file: 'tsconfig.json',
        })
      );
    }

    return findings;
  }

  /**
   * Analyze type annotations
   */
  private async analyzeTypeAnnotations(file: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Function parameters without types
      const functionMatch = line.match(/function\s+\w+\s*\(([^)]*)\)/);
      if (functionMatch) {
        const params = functionMatch[1];
        if (params && !params.includes(':') && params.trim() !== '') {
          findings.push(
            this.createFinding(
              'medium',
              'type-annotation',
              'Function parameter missing type annotation',
              {
                file,
                line: lineNumber,
                fix: 'Add type annotations to function parameters',
              }
            )
          );
        }
      }

      // Arrow functions without return types
      const arrowFunctionMatch = line.match(/=\s*\([^)]*\)\s*=>/);
      if (arrowFunctionMatch && !line.includes('):')) {
        findings.push(
          this.createFinding(
            'low',
            'type-annotation',
            'Arrow function missing return type annotation',
            {
              file,
              line: lineNumber,
              fix: 'Add return type annotation to arrow function',
            }
          )
        );
      }

      // Variables without explicit types (when not obvious)
      const varMatch = line.match(/(?:let|const|var)\s+(\w+)\s*=/);
      if (varMatch && !line.includes(':') && !this.hasObviousType(line)) {
        findings.push(
          this.createFinding(
            'low',
            'type-annotation',
            `Variable '${varMatch[1]}' could benefit from explicit type annotation`,
            {
              file,
              line: lineNumber,
              fix: 'Add explicit type annotation',
            }
          )
        );
      }
    }

    return findings;
  }

  /**
   * Analyze usage of 'any' type
   */
  private async analyzeAnyTypes(file: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Direct 'any' usage
      if (line.includes(': any') || line.includes('<any>') || line.includes('any[]')) {
        findings.push(
          this.createFinding('medium', 'any-type', 'Usage of "any" type reduces type safety', {
            file,
            line: lineNumber,
            evidence: line.trim(),
            fix: 'Replace "any" with specific type or use unknown/object',
          })
        );
      }

      // Implicit any (when noImplicitAny is disabled)
      if (line.includes('function') && line.includes('(') && !line.includes(':')) {
        const hasParams = line.match(/\(([^)]+)\)/);
        if (hasParams && hasParams[1].trim() && !hasParams[1].includes(':')) {
          findings.push(
            this.createFinding(
              'medium',
              'implicit-any',
              'Function parameter has implicit any type',
              {
                file,
                line: lineNumber,
                fix: 'Add explicit type annotation',
              }
            )
          );
        }
      }
    }

    return findings;
  }

  /**
   * Analyze interfaces and type definitions
   */
  private async analyzeInterfaces(file: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    let inInterface = false;
    let interfaceName = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Interface declarations
      const interfaceMatch = line.match(/interface\s+(\w+)/);
      if (interfaceMatch) {
        inInterface = true;
        interfaceName = interfaceMatch[1];

        // Check naming convention
        if (!interfaceName.match(/^[A-Z]/)) {
          findings.push(
            this.createFinding(
              'low',
              'naming-convention',
              `Interface '${interfaceName}' should start with uppercase letter`,
              { file, line: lineNumber }
            )
          );
        }
      }

      // Interface properties without types
      if (inInterface && line.includes(':') && !line.includes('//')) {
        const propertyMatch = line.match(/(\w+)\s*:\s*;/);
        if (propertyMatch) {
          findings.push(
            this.createFinding(
              'high',
              'interface-definition',
              `Interface property '${propertyMatch[1]}' missing type`,
              { file, line: lineNumber }
            )
          );
        }
      }

      // End of interface
      if (inInterface && line.includes('}') && !line.includes('{')) {
        inInterface = false;
        interfaceName = '';
      }

      // Type assertions that could be unsafe
      if (line.includes(' as ') || (line.includes('<') && line.includes('>'))) {
        findings.push(
          this.createFinding('medium', 'type-assertion', 'Type assertion found - verify safety', {
            file,
            line: lineNumber,
            evidence: line.trim(),
            fix: 'Consider using type guards instead of assertions',
          })
        );
      }
    }

    return findings;
  }

  /**
   * Analyze generic type usage
   */
  private async analyzeGenerics(file: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Generic functions without constraints
      const genericMatch = line.match(/function\s+\w+<([^>]+)>/);
      if (genericMatch) {
        const generics = genericMatch[1];
        if (!generics.includes('extends')) {
          findings.push(
            this.createFinding(
              'low',
              'generic-constraint',
              'Generic type parameter without constraints',
              {
                file,
                line: lineNumber,
                fix: 'Consider adding constraints to generic type parameters',
              }
            )
          );
        }
      }

      // Unused generic parameters
      const functionGenericMatch = line.match(/function\s+\w+<([^>]+)>\s*\([^)]*\)/);
      if (functionGenericMatch) {
        const generics = functionGenericMatch[1].split(',').map(g => g.trim().split(' ')[0]);
        const functionBody = content.substring(content.indexOf(line));

        generics.forEach(generic => {
          if (!functionBody.includes(generic)) {
            findings.push(
              this.createFinding(
                'medium',
                'unused-generic',
                `Unused generic type parameter '${generic}'`,
                { file, line: lineNumber }
              )
            );
          }
        });
      }
    }

    return findings;
  }

  /**
   * Analyze null safety
   */
  private async analyzeNullSafety(file: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Potential null/undefined access
      if (line.includes('.') && !line.includes('?.') && !line.includes('!.')) {
        const nullableAccess = line.match(/(\w+)\.(\w+)/);
        if (nullableAccess && this.couldBeNullable(nullableAccess[1], content)) {
          findings.push(
            this.createFinding(
              'medium',
              'null-safety',
              `Potential null/undefined access on '${nullableAccess[1]}'`,
              {
                file,
                line: lineNumber,
                fix: 'Use optional chaining (?.) or null check',
              }
            )
          );
        }
      }

      // Non-null assertion operator usage
      if (line.includes('!.') || line.includes('!)')) {
        findings.push(
          this.createFinding('medium', 'non-null-assertion', 'Non-null assertion operator used', {
            file,
            line: lineNumber,
            evidence: line.trim(),
            fix: 'Consider proper null checking instead of assertion',
          })
        );
      }

      // Equality checks that should use strict equality
      if (line.includes('== null') || line.includes('!= null')) {
        findings.push(
          this.createFinding(
            'low',
            'equality-check',
            'Use strict equality (=== null) for null checks',
            { file, line: lineNumber }
          )
        );
      }
    }

    return findings;
  }

  /**
   * Helper methods
   */
  private hasObviousType(line: string): boolean {
    return (
      line.includes('"') ||
      line.includes("'") ||
      line.includes('true') ||
      line.includes('false') ||
      /\d+/.test(line) ||
      line.includes('[]') ||
      line.includes('{}') ||
      line.includes('new ')
    );
  }

  private couldBeNullable(variable: string, content: string): boolean {
    // Simple heuristic - check if variable could be null/undefined
    return (
      content.includes(`${variable} = null`) ||
      content.includes(`${variable} = undefined`) ||
      content.includes(`${variable}?`) ||
      content.includes(`${variable} | null`) ||
      content.includes(`${variable} | undefined`)
    );
  }

  private calculateTypeCoverage(metrics: Record<string, number>): number {
    if (metrics.filesAnalyzed === 0) return 0;

    // Simple calculation based on findings
    const totalTypeIssues = metrics.anyTypes + metrics.interfaceViolations;
    const coverage = Math.max(0, 100 - (totalTypeIssues / metrics.filesAnalyzed) * 10);
    return Math.round(coverage);
  }

  private generateRecommendations(findings: Finding[], metrics: Record<string, number>): string[] {
    const recommendations: string[] = [];

    if (findings.some(f => f.category === 'configuration')) {
      recommendations.push('Enable strict TypeScript compiler options for better type safety');
    }

    if (findings.some(f => f.category === 'any-type')) {
      recommendations.push('Replace "any" types with specific types to improve type safety');
    }

    if (findings.some(f => f.category === 'null-safety')) {
      recommendations.push(
        'Use optional chaining and proper null checks to prevent runtime errors'
      );
    }

    if (metrics.typeCoverage < 80) {
      recommendations.push('Improve type coverage by adding more explicit type annotations');
    }

    if (findings.some(f => f.category === 'type-assertion')) {
      recommendations.push('Review type assertions and consider using type guards for safer code');
    }

    return recommendations;
  }
}
