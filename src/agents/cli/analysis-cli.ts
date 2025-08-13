#!/usr/bin/env node

import { DefaultAgentCoordinator } from '../base/coordinator.js';
import { DefaultAgentRegistry } from '../base/agent-registry.js';
import { CodeAnalysisAgent } from '../analysis/code-analysis-agent.js';
import { TypeSafetyAgent } from '../analysis/type-safety-agent.js';
import { TestingAgent } from '../testing/testing-agent.js';
import { SecurityAgent } from '../security/security-agent.js';
import { AnalysisContext, AnalysisReport, AgentEvent } from '../types/agent-interfaces.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface CliOptions {
  projectPath: string;
  agents?: string[];
  output?: string;
  format?: 'json' | 'text' | 'html';
  verbose?: boolean;
  exclude?: string[];
  include?: string[];
  config?: string;
}

/**
 * Command-line interface for the code analysis system
 */
export class AnalysisCLI {
  private coordinator: DefaultAgentCoordinator;
  private registry: DefaultAgentRegistry;

  constructor() {
    this.registry = new DefaultAgentRegistry();
    this.coordinator = new DefaultAgentCoordinator(this.registry);
    this.setupAgents();
    this.setupEventListeners();
  }

  /**
   * Register all available agents
   */
  private setupAgents(): void {
    this.registry.register(new CodeAnalysisAgent());
    this.registry.register(new TypeSafetyAgent());
    this.registry.register(new TestingAgent());
    this.registry.register(new SecurityAgent());
  }

  /**
   * Setup event listeners for progress reporting
   */
  private setupEventListeners(): void {
    this.coordinator.addEventListener((event: AgentEvent) => {
      switch (event.type) {
        case 'analysis-start':
          console.log('🔍 Starting code analysis...');
          break;
        case 'agent-start':
          console.log(`  ▶️  Running ${event.agentName} agent...`);
          break;
        case 'agent-complete':
          const result = event.data?.result;
          if (result) {
            console.log(`  ✅ ${event.agentName} completed (${result.findings.length} findings)`);
          }
          break;
        case 'agent-error':
          console.error(`  ❌ ${event.agentName} failed: ${event.error?.message}`);
          break;
        case 'analysis-complete':
          console.log('✨ Analysis complete!');
          break;
      }
    });
  }

  /**
   * Run analysis with given options
   */
  public async run(options: CliOptions): Promise<void> {
    try {
      // Validate project path
      const projectPath = path.resolve(options.projectPath);
      if (!await this.directoryExists(projectPath)) {
        throw new Error(`Project path does not exist: ${projectPath}`);
      }

      // Discover files
      const files = await this.discoverFiles(projectPath, options.include, options.exclude);
      console.log(`📁 Found ${files.length} files to analyze`);

      // Load configuration
      const configuration = options.config ? 
        await this.loadConfiguration(options.config) : 
        new Map();

      // Create analysis context
      const context: AnalysisContext = {
        projectPath,
        files,
        configuration,
        excludePatterns: options.exclude
      };

      // Run analysis
      let report: AnalysisReport;
      if (options.agents && options.agents.length > 0) {
        report = await this.coordinator.runSelectedAgents(options.agents, context);
      } else {
        report = await this.coordinator.runFullAnalysis(context);
      }

      // Output results
      await this.outputReport(report, options);

      // Exit with appropriate code
      const exitCode = report.summary.criticalFindings > 0 ? 1 : 0;
      process.exit(exitCode);

    } catch (error) {
      console.error('❌ Analysis failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * Discover files in project directory
   */
  private async discoverFiles(
    projectPath: string, 
    include?: string[], 
    exclude?: string[]
  ): Promise<string[]> {
    const files: string[] = [];
    
    const walk = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(projectPath, fullPath);
        
        if (entry.isDirectory()) {
          // Skip common directories that shouldn't be analyzed
          if (!this.shouldSkipDirectory(entry.name)) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          if (this.shouldIncludeFile(relativePath, include, exclude)) {
            files.push(relativePath);
          }
        }
      }
    };

    await walk(projectPath);
    return files;
  }

  /**
   * Check if directory should be skipped
   */
  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules', '.git', '.svn', '.hg',
      'dist', 'build', 'coverage', '.nyc_output',
      '.next', '.nuxt', '.vuepress'
    ];
    return skipDirs.includes(dirName);
  }

  /**
   * Check if file should be included in analysis
   */
  private shouldIncludeFile(filePath: string, include?: string[], exclude?: string[]): boolean {
    // Check exclude patterns first
    if (exclude) {
      for (const pattern of exclude) {
        if (new RegExp(pattern).test(filePath)) {
          return false;
        }
      }
    }

    // Check include patterns
    if (include && include.length > 0) {
      return include.some(pattern => new RegExp(pattern).test(filePath));
    }

    // Default: include common source file extensions
    const sourceExtensions = ['.ts', '.js', '.tsx', '.jsx', '.json'];
    return sourceExtensions.some(ext => filePath.endsWith(ext));
  }

  /**
   * Load configuration from file
   */
  private async loadConfiguration(configPath: string): Promise<Map<string, any>> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      return new Map(Object.entries(config));
    } catch (error) {
      console.warn(`Warning: Could not load configuration from ${configPath}`);
      return new Map();
    }
  }

  /**
   * Output analysis report
   */
  private async outputReport(report: AnalysisReport, options: CliOptions): Promise<void> {
    const format = options.format || 'text';
    
    let output: string;
    switch (format) {
      case 'json':
        output = this.formatJsonReport(report);
        break;
      case 'html':
        output = this.formatHtmlReport(report);
        break;
      default:
        output = this.formatTextReport(report, options.verbose);
        break;
    }

    if (options.output) {
      await fs.writeFile(options.output, output);
      console.log(`📄 Report saved to ${options.output}`);
    } else {
      console.log(output);
    }
  }

  /**
   * Format report as JSON
   */
  private formatJsonReport(report: AnalysisReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Format report as HTML
   */
  private formatHtmlReport(report: AnalysisReport): string {
    const { summary, findings } = report;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Code Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .finding { border-left: 4px solid #ccc; padding: 10px; margin: 10px 0; }
        .critical { border-left-color: #d32f2f; background: #ffebee; }
        .high { border-left-color: #f57c00; background: #fff3e0; }
        .medium { border-left-color: #fbc02d; background: #fffde7; }
        .low { border-left-color: #388e3c; background: #e8f5e8; }
        .info { border-left-color: #1976d2; background: #e3f2fd; }
        .severity { font-weight: bold; text-transform: uppercase; }
        .file { color: #666; font-size: 0.9em; }
        .evidence { background: #f5f5f5; padding: 5px; font-family: monospace; margin: 5px 0; }
    </style>
</head>
<body>
    <h1>Code Analysis Report</h1>
    
    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Total Findings:</strong> ${summary.totalFindings}</p>
        <p><strong>Critical:</strong> ${summary.criticalFindings} | 
           <strong>High:</strong> ${summary.highFindings} | 
           <strong>Medium:</strong> ${summary.mediumFindings} | 
           <strong>Low:</strong> ${summary.lowFindings} | 
           <strong>Info:</strong> ${summary.infoFindings}</p>
        <p><strong>Files Analyzed:</strong> ${summary.filesAnalyzed}</p>
        <p><strong>Execution Time:</strong> ${summary.totalExecutionTime}ms</p>
    </div>

    <h2>Findings</h2>
    ${findings.map(finding => `
        <div class="finding ${finding.severity}">
            <div class="severity">${finding.severity}</div>
            <div><strong>${finding.message}</strong></div>
            ${finding.file ? `<div class="file">📁 ${finding.file}${finding.line ? `:${finding.line}` : ''}</div>` : ''}
            ${finding.evidence ? `<div class="evidence">${finding.evidence}</div>` : ''}
            ${finding.fix ? `<div><strong>Fix:</strong> ${finding.fix}</div>` : ''}
        </div>
    `).join('')}
</body>
</html>`;
  }

  /**
   * Format report as text
   */
  private formatTextReport(report: AnalysisReport, verbose?: boolean): string {
    const { summary, findings, recommendations } = report;
    
    let output = '\n📊 ANALYSIS SUMMARY\n';
    output += '═'.repeat(50) + '\n';
    output += `Total Findings: ${summary.totalFindings}\n`;
    output += `  🔴 Critical: ${summary.criticalFindings}\n`;
    output += `  🟠 High: ${summary.highFindings}\n`;
    output += `  🟡 Medium: ${summary.mediumFindings}\n`;
    output += `  🟢 Low: ${summary.lowFindings}\n`;
    output += `  ℹ️  Info: ${summary.infoFindings}\n`;
    output += `Files Analyzed: ${summary.filesAnalyzed}\n`;
    output += `Execution Time: ${summary.totalExecutionTime}ms\n\n`;

    if (findings.length > 0) {
      output += '🔍 FINDINGS\n';
      output += '═'.repeat(50) + '\n';

      const groupedFindings = this.groupFindingsBySeverity(findings);
      
      for (const [severity, severityFindings] of Object.entries(groupedFindings)) {
        if (severityFindings.length > 0) {
          output += `\n${this.getSeverityIcon(severity)} ${severity.toUpperCase()} (${severityFindings.length})\n`;
          output += '─'.repeat(30) + '\n';
          
          for (const finding of severityFindings) {
            output += `• ${finding.message}\n`;
            if (finding.file) {
              output += `  📁 ${finding.file}${finding.line ? `:${finding.line}` : ''}\n`;
            }
            if (verbose && finding.evidence) {
              output += `  💡 ${finding.evidence}\n`;
            }
            if (finding.fix) {
              output += `  🔧 ${finding.fix}\n`;
            }
            output += '\n';
          }
        }
      }
    }

    if (recommendations.length > 0) {
      output += '💡 RECOMMENDATIONS\n';
      output += '═'.repeat(50) + '\n';
      for (const recommendation of recommendations) {
        output += `• ${recommendation}\n`;
      }
      output += '\n';
    }

    return output;
  }

  /**
   * Group findings by severity
   */
  private groupFindingsBySeverity(findings: any[]): Record<string, any[]> {
    return findings.reduce((groups, finding) => {
      const severity = finding.severity;
      if (!groups[severity]) {
        groups[severity] = [];
      }
      groups[severity].push(finding);
      return groups;
    }, {});
  }

  /**
   * Get emoji icon for severity
   */
  private getSeverityIcon(severity: string): string {
    const icons: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
      info: 'ℹ️'
    };
    return icons[severity] || '❓';
  }

  /**
   * Check if directory exists
   */
  private async directoryExists(path: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    projectPath: process.cwd()
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--path':
      case '-p':
        options.projectPath = args[++i];
        break;
      case '--agents':
      case '-a':
        options.agents = args[++i].split(',');
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--format':
      case '-f':
        options.format = args[++i] as 'json' | 'text' | 'html';
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--exclude':
      case '-e':
        options.exclude = args[++i].split(',');
        break;
      case '--include':
      case '-i':
        options.include = args[++i].split(',');
        break;
      case '--config':
      case '-c':
        options.config = args[++i];
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('-')) {
          options.projectPath = arg;
        }
        break;
    }
  }

  return options;
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log(`
🔍 Code Analysis CLI

Usage: analysis-cli [options] [project-path]

Options:
  -p, --path <path>        Project path to analyze (default: current directory)
  -a, --agents <agents>    Comma-separated list of agents to run
  -o, --output <file>      Output file path
  -f, --format <format>    Output format: text, json, html (default: text)
  -v, --verbose           Verbose output
  -e, --exclude <patterns> Comma-separated exclude patterns
  -i, --include <patterns> Comma-separated include patterns
  -c, --config <file>      Configuration file path
  -h, --help              Show this help

Available Agents:
  - code-analysis         Static code analysis
  - type-safety          TypeScript type safety
  - testing              Test coverage and quality
  - security             Security vulnerability analysis

Examples:
  analysis-cli                                    # Analyze current directory
  analysis-cli /path/to/project                   # Analyze specific project
  analysis-cli --agents security,type-safety     # Run specific agents
  analysis-cli --format json --output report.json # JSON output to file
  analysis-cli --exclude "*.test.ts,dist/*"      # Exclude patterns
`);
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new AnalysisCLI();
  const options = parseArgs();
  cli.run(options).catch(console.error);
}

export { AnalysisCLI };