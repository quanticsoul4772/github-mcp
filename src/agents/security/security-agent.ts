import { AbstractBaseAgent } from '../base/base-agent.js';
import { AnalysisContext, AnalysisResult, Finding } from '../types/agent-interfaces.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Agent for security vulnerability analysis
 */
export class SecurityAgent extends AbstractBaseAgent {
  public readonly name = 'security';
  public readonly version = '1.0.0';
  public readonly description = 'Security vulnerability and best practices analysis';

  private readonly supportedExtensions = ['ts', 'js', 'tsx', 'jsx', 'json'];

  // Common security patterns to detect
  private readonly securityPatterns = {
    // Code injection vulnerabilities
    codeInjection: [
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(\s*['"`][^'"`]*\$\{/,
      /setInterval\s*\(\s*['"`][^'"`]*\$\{/,
    ],

    // XSS vulnerabilities
    xss: [
      /innerHTML\s*=/,
      /outerHTML\s*=/,
      /document\.write\s*\(/,
      /\.html\s*\(/,
      /dangerouslySetInnerHTML/,
    ],

    // SQL injection (for Node.js backends)
    sqlInjection: [
      /query\s*\(\s*['"`][^'"`]*\$\{/,
      /execute\s*\(\s*['"`][^'"`]*\$\{/,
      /SELECT\s+.*\$\{/i,
      /INSERT\s+.*\$\{/i,
      /UPDATE\s+.*\$\{/i,
      /DELETE\s+.*\$\{/i,
    ],

    // Insecure randomness
    weakRandom: [/Math\.random\s*\(/],

    // Hardcoded secrets
    secrets: [
      /password\s*[:=]\s*['"`][^'"`]+['"`]/i,
      /api[_-]?key\s*[:=]\s*['"`][^'"`]+['"`]/i,
      /secret\s*[:=]\s*['"`][^'"`]+['"`]/i,
      /token\s*[:=]\s*['"`][^'"`]+['"`]/i,
      /private[_-]?key\s*[:=]\s*['"`][^'"`]+['"`]/i,
    ],

    // Insecure HTTP
    insecureHttp: [
      /http:\/\/(?!localhost|127\.0\.0\.1)/,
      /fetch\s*\(\s*['"`]http:/,
      /axios\s*\.\s*get\s*\(\s*['"`]http:/,
    ],

    // File system vulnerabilities
    pathTraversal: [
      /\.\.\//,
      /path\.join\s*\([^)]*\.\./,
      /fs\.readFile\s*\([^)]*\.\./,
      /fs\.writeFile\s*\([^)]*\.\./,
    ],
  };

  public canHandle(fileType: string): boolean {
    return this.supportedExtensions.includes(fileType.toLowerCase());
  }

  public getPriority(): number {
    return 15; // High priority for security
  }

  public async analyze(context: AnalysisContext): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    const metrics: Record<string, number> = {
      filesAnalyzed: 0,
      vulnerabilities: 0,
      criticalIssues: 0,
      securityScore: 100,
    };

    try {
      const targetFiles = this.filterFiles(context.files, context);
      this.log('info', `Analyzing security in ${targetFiles.length} files`);

      // Analyze package.json for vulnerable dependencies
      findings.push(...(await this.analyzeDependencies(context)));

      // Analyze source files for security issues
      for (const file of targetFiles) {
        const filePath = path.resolve(context.projectPath, file);
        const content = await this.readFile(filePath);

        if (content === null) {
          continue;
        }

        metrics.filesAnalyzed++;

        // Security pattern analysis
        findings.push(...(await this.analyzeSecurityPatterns(file, content)));

        // Authentication and authorization analysis
        findings.push(...(await this.analyzeAuthSecurity(file, content)));

        // Data validation analysis
        findings.push(...(await this.analyzeDataValidation(file, content)));

        // Configuration security
        findings.push(...(await this.analyzeConfigSecurity(file, content)));
      }

      // Calculate security metrics
      metrics.vulnerabilities = findings.length;
      metrics.criticalIssues = findings.filter(f => f.severity === 'critical').length;
      metrics.securityScore = this.calculateSecurityScore(findings);

      const recommendations = this.generateRecommendations(findings, metrics);

      return this.createResult('success', findings, metrics, recommendations);
    } catch (error) {
      this.log('error', 'Security analysis failed', error);
      return this.createResult('error', [
        this.createFinding(
          'critical',
          'analysis-error',
          `Security analysis failed: ${error instanceof Error ? error.message : String(error)}`
        ),
      ]);
    }
  }

  /**
   * Analyze dependencies for known vulnerabilities
   */
  private async analyzeDependencies(context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const packageJsonPath = path.join(context.projectPath, 'package.json');

    if (await this.fileExists(packageJsonPath)) {
      const content = await this.readFile(packageJsonPath);
      if (content) {
        try {
          const packageJson = JSON.parse(content);

          // Check for known vulnerable packages (simplified list)
          const vulnerablePackages = ['lodash', 'moment', 'request', 'node-uuid', 'validator'];

          const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
          };

          for (const [pkg, version] of Object.entries(allDeps)) {
            if (vulnerablePackages.includes(pkg)) {
              findings.push(
                this.createFinding(
                  'medium',
                  'vulnerable-dependency',
                  `Potentially vulnerable dependency: ${pkg}@${version}`,
                  {
                    file: 'package.json',
                    fix: `Update ${pkg} to latest secure version or find alternative`,
                  }
                )
              );
            }

            // Check for wildcard versions
            if (typeof version === 'string' && version.includes('*')) {
              findings.push(
                this.createFinding(
                  'medium',
                  'dependency-version',
                  `Wildcard version for ${pkg}: ${version}`,
                  {
                    file: 'package.json',
                    fix: 'Use specific version numbers for better security',
                  }
                )
              );
            }
          }

          // Check for missing package-lock.json
          const lockFilePath = path.join(context.projectPath, 'package-lock.json');
          if (!(await this.fileExists(lockFilePath))) {
            findings.push(
              this.createFinding('medium', 'missing-lockfile', 'Missing package-lock.json file', {
                fix: 'Commit package-lock.json to ensure consistent dependency versions',
              })
            );
          }
        } catch (error) {
          findings.push(
            this.createFinding('low', 'package-analysis', 'Could not parse package.json', {
              file: 'package.json',
            })
          );
        }
      }
    }

    return findings;
  }

  /**
   * Analyze security patterns in code
   */
  private async analyzeSecurityPatterns(file: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check each security pattern category
      for (const [category, patterns] of Object.entries(this.securityPatterns)) {
        for (const pattern of patterns) {
          if (pattern.test(line)) {
            const severity = this.getSeverityForCategory(category);
            const message = this.getMessageForCategory(category);
            const fix = this.getFixForCategory(category);

            findings.push(
              this.createFinding(severity, 'security-pattern', message, {
                file,
                line: lineNumber,
                evidence: line.trim(),
                fix,
              })
            );
          }
        }
      }

      // Check for console.log with sensitive data
      if (line.includes('console.log') && this.containsSensitiveData(line)) {
        findings.push(
          this.createFinding('medium', 'data-exposure', 'Console.log may expose sensitive data', {
            file,
            line: lineNumber,
            evidence: line.trim(),
            fix: 'Remove console.log or sanitize sensitive data',
          })
        );
      }

      // Check for TODO/FIXME with security implications
      if (
        (line.includes('TODO') || line.includes('FIXME')) &&
        (line.toLowerCase().includes('security') || line.toLowerCase().includes('auth'))
      ) {
        findings.push(
          this.createFinding('medium', 'security-todo', 'Security-related TODO/FIXME found', {
            file,
            line: lineNumber,
            evidence: line.trim(),
            fix: 'Address security-related TODO items promptly',
          })
        );
      }
    }

    return findings;
  }

  /**
   * Analyze authentication and authorization security
   */
  private async analyzeAuthSecurity(file: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for weak authentication
      if (line.includes('password') && line.includes('==') && !line.includes('hash')) {
        findings.push(
          this.createFinding('critical', 'weak-auth', 'Plain text password comparison detected', {
            file,
            line: lineNumber,
            fix: 'Use secure password hashing (bcrypt, scrypt, etc.)',
          })
        );
      }

      // Check for missing authentication
      if (
        line.includes('app.') &&
        (line.includes('.get') || line.includes('.post')) &&
        !line.includes('auth') &&
        !line.includes('middleware')
      ) {
        findings.push(
          this.createFinding('medium', 'missing-auth', 'Route without authentication middleware', {
            file,
            line: lineNumber,
            evidence: line.trim(),
            fix: 'Add authentication middleware to protected routes',
          })
        );
      }

      // Check for JWT without expiration
      if (line.includes('jwt.sign') && !line.includes('expiresIn')) {
        findings.push(
          this.createFinding('medium', 'jwt-security', 'JWT token without expiration', {
            file,
            line: lineNumber,
            fix: 'Add expiresIn option to JWT tokens',
          })
        );
      }

      // Check for session security
      if (line.includes('session') && line.includes('secure') && line.includes('false')) {
        findings.push(
          this.createFinding('high', 'session-security', 'Session cookie not marked as secure', {
            file,
            line: lineNumber,
            fix: 'Set secure: true for session cookies in production',
          })
        );
      }
    }

    return findings;
  }

  /**
   * Analyze data validation security
   */
  private async analyzeDataValidation(file: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for missing input validation
      if (
        (line.includes('req.body') || line.includes('req.query') || line.includes('req.params')) &&
        !this.hasValidation(content, i)
      ) {
        findings.push(
          this.createFinding('high', 'missing-validation', 'User input used without validation', {
            file,
            line: lineNumber,
            evidence: line.trim(),
            fix: 'Add input validation before using user data',
          })
        );
      }

      // Check for regex without anchors (ReDoS vulnerability)
      const regexMatch = line.match(/new RegExp\(['"`]([^'"`]+)['"`]\)/);
      if (regexMatch && !regexMatch[1].startsWith('^') && !regexMatch[1].endsWith('$')) {
        findings.push(
          this.createFinding(
            'medium',
            'regex-security',
            'Regular expression without anchors may be vulnerable to ReDoS',
            {
              file,
              line: lineNumber,
              evidence: regexMatch[1],
              fix: 'Add ^ and $ anchors to regex patterns',
            }
          )
        );
      }

      // Check for unsafe JSON parsing
      if (line.includes('JSON.parse') && !line.includes('try')) {
        findings.push(
          this.createFinding('medium', 'unsafe-parsing', 'JSON.parse without error handling', {
            file,
            line: lineNumber,
            fix: 'Wrap JSON.parse in try-catch block',
          })
        );
      }
    }

    return findings;
  }

  /**
   * Analyze configuration security
   */
  private async analyzeConfigSecurity(file: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Check for environment variable usage
    if (file.endsWith('.env') || file.includes('config')) {
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;

        // Check for hardcoded secrets in config files
        if (line.includes('=') && this.containsSecret(line)) {
          findings.push(
            this.createFinding(
              'critical',
              'hardcoded-secret',
              'Hardcoded secret in configuration file',
              {
                file,
                line: lineNumber,
                evidence: line.split('=')[0] + '=***',
                fix: 'Use environment variables for secrets',
              }
            )
          );
        }

        // Check for debug mode in production
        if (line.toLowerCase().includes('debug') && line.includes('true')) {
          findings.push(
            this.createFinding('medium', 'debug-mode', 'Debug mode enabled', {
              file,
              line: lineNumber,
              fix: 'Disable debug mode in production',
            })
          );
        }
      }
    }

    // Check for CORS configuration
    if (content.includes('cors') || content.includes('Access-Control-Allow-Origin')) {
      if (content.includes('*')) {
        findings.push(
          this.createFinding('high', 'cors-wildcard', 'CORS configured with wildcard (*)', {
            file,
            fix: 'Specify allowed origins instead of using wildcard',
          })
        );
      }
    }

    return findings;
  }

  /**
   * Helper methods
   */
  private getSeverityForCategory(category: string): Finding['severity'] {
    const severityMap: Record<string, Finding['severity']> = {
      codeInjection: 'critical',
      xss: 'high',
      sqlInjection: 'critical',
      weakRandom: 'medium',
      secrets: 'critical',
      insecureHttp: 'medium',
      pathTraversal: 'high',
    };
    return severityMap[category] || 'medium';
  }

  private getMessageForCategory(category: string): string {
    const messageMap: Record<string, string> = {
      codeInjection: 'Code injection vulnerability detected',
      xss: 'Cross-site scripting (XSS) vulnerability detected',
      sqlInjection: 'SQL injection vulnerability detected',
      weakRandom: 'Weak random number generation',
      secrets: 'Hardcoded secret detected',
      insecureHttp: 'Insecure HTTP connection',
      pathTraversal: 'Path traversal vulnerability detected',
    };
    return messageMap[category] || 'Security issue detected';
  }

  private getFixForCategory(category: string): string {
    const fixMap: Record<string, string> = {
      codeInjection: 'Avoid eval() and Function() constructor. Use safer alternatives.',
      xss: 'Sanitize user input and use textContent instead of innerHTML',
      sqlInjection: 'Use parameterized queries or prepared statements',
      weakRandom: 'Use crypto.randomBytes() for cryptographic randomness',
      secrets: 'Move secrets to environment variables',
      insecureHttp: 'Use HTTPS for all external communications',
      pathTraversal: 'Validate and sanitize file paths',
    };
    return fixMap[category] || 'Review and fix security issue';
  }

  private containsSensitiveData(line: string): boolean {
    const sensitiveKeywords = [
      'password',
      'token',
      'key',
      'secret',
      'auth',
      'credential',
      'ssn',
      'social',
      'credit',
      'card',
      'email',
      'phone',
    ];

    return sensitiveKeywords.some(keyword => line.toLowerCase().includes(keyword));
  }

  private containsSecret(line: string): boolean {
    const secretPatterns = [
      /[a-zA-Z0-9]{32,}/, // Long alphanumeric strings
      /sk_[a-zA-Z0-9]+/, // Stripe secret keys
      /pk_[a-zA-Z0-9]+/, // Stripe public keys
      /AKIA[0-9A-Z]{16}/, // AWS access keys
      /ghp_[a-zA-Z0-9]{36}/, // GitHub personal access tokens
    ];

    return secretPatterns.some(pattern => pattern.test(line));
  }

  private hasValidation(content: string, lineIndex: number): boolean {
    // Simple check for validation keywords near the line
    const contextLines = content.split('\n').slice(Math.max(0, lineIndex - 5), lineIndex + 5);
    const validationKeywords = ['validate', 'joi', 'yup', 'check', 'sanitize', 'escape'];

    return contextLines.some(line =>
      validationKeywords.some(keyword => line.toLowerCase().includes(keyword))
    );
  }

  private calculateSecurityScore(findings: Finding[]): number {
    let score = 100;

    findings.forEach(finding => {
      switch (finding.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    });

    return Math.max(0, score);
  }

  private generateRecommendations(findings: Finding[], metrics: Record<string, number>): string[] {
    const recommendations: string[] = [];

    if (metrics.criticalIssues > 0) {
      recommendations.push('Address critical security vulnerabilities immediately');
    }

    if (findings.some(f => f.category === 'hardcoded-secret')) {
      recommendations.push('Move all secrets to environment variables');
    }

    if (findings.some(f => f.category === 'vulnerable-dependency')) {
      recommendations.push('Update vulnerable dependencies to secure versions');
    }

    if (findings.some(f => f.category === 'missing-validation')) {
      recommendations.push('Implement input validation for all user data');
    }

    if (metrics.securityScore < 80) {
      recommendations.push('Conduct a comprehensive security review');
    }

    if (findings.some(f => f.category === 'weak-auth')) {
      recommendations.push('Implement secure authentication mechanisms');
    }

    return recommendations;
  }
}
