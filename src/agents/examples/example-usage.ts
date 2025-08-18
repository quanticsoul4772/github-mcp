/**
 * Example usage of the Agent-Based Code Analysis System
 */

import { DefaultAgentCoordinator } from '../base/coordinator.js';
import { DefaultAgentRegistry } from '../base/agent-registry.js';
import { CodeAnalysisAgent } from '../analysis/code-analysis-agent.js';
import { TypeSafetyAgent } from '../analysis/type-safety-agent.js';
import { TestingAgent } from '../testing/testing-agent.js';
import { SecurityAgent } from '../security/security-agent.js';
import { AnalysisContext, AnalysisReport, AgentEvent } from '../types/agent-interfaces.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Example 1: Basic Analysis Setup
 */
export async function basicAnalysisExample(): Promise<void> {
  console.log('🔍 Basic Analysis Example');
  console.log('='.repeat(50));

  // Create registry and coordinator
  const registry = new DefaultAgentRegistry();
  const coordinator = new DefaultAgentCoordinator(registry);

  // Register agents
  registry.register(new CodeAnalysisAgent());
  registry.register(new TypeSafetyAgent());
  registry.register(new TestingAgent());
  registry.register(new SecurityAgent());

  console.log(`Registered ${registry.getAgentCount()} agents`);

  // Setup analysis context
  const context: AnalysisContext = {
    projectPath: process.cwd(),
    files: await discoverSourceFiles(process.cwd()),
    excludePatterns: ['node_modules/**', 'dist/**', '*.test.ts'],
  };

  console.log(`Found ${context.files.length} files to analyze`);

  // Run analysis
  const report = await coordinator.runFullAnalysis(context);

  // Display results
  displaySummary(report);
}

/**
 * Example 2: Selective Agent Analysis
 */
export async function selectiveAnalysisExample(): Promise<void> {
  console.log('\n🎯 Selective Analysis Example');
  console.log('='.repeat(50));

  const registry = new DefaultAgentRegistry();
  const coordinator = new DefaultAgentCoordinator(registry);

  // Register only specific agents
  registry.register(new SecurityAgent());
  registry.register(new TypeSafetyAgent());

  const context: AnalysisContext = {
    projectPath: process.cwd(),
    files: await discoverSourceFiles(process.cwd()),
  };

  // Run only security and type safety analysis
  const report = await coordinator.runSelectedAgents(['security', 'type-safety'], context);

  console.log(`Security Analysis: ${report.agentResults[0].findings.length} findings`);
  console.log(`Type Safety Analysis: ${report.agentResults[1].findings.length} findings`);
}

/**
 * Example 3: Event-Driven Analysis with Progress Tracking
 */
export async function eventDrivenAnalysisExample(): Promise<void> {
  console.log('\n📊 Event-Driven Analysis Example');
  console.log('='.repeat(50));

  const registry = new DefaultAgentRegistry();
  const coordinator = new DefaultAgentCoordinator(registry);

  // Register agents
  registry.register(new CodeAnalysisAgent());
  registry.register(new SecurityAgent());

  // Setup progress tracking
  let completedAgents = 0;
  const totalAgents = registry.getAgentCount();

  coordinator.addEventListener((event: AgentEvent) => {
    switch (event.type) {
      case 'analysis-start':
        console.log('🚀 Analysis started');
        break;

      case 'agent-start':
        console.log(`  ⏳ Starting ${event.agentName}...`);
        break;

      case 'agent-complete':
        completedAgents++;
        const progress = Math.round((completedAgents / totalAgents) * 100);
        console.log(`  ✅ ${event.agentName} completed [${progress}%]`);
        break;

      case 'agent-error':
        console.error(`  ❌ ${event.agentName} failed: ${event.error?.message}`);
        break;

      case 'analysis-complete':
        console.log('🎉 Analysis finished!');
        break;
    }
  });

  const context: AnalysisContext = {
    projectPath: process.cwd(),
    files: await discoverSourceFiles(process.cwd()),
  };

  await coordinator.runFullAnalysis(context);
}

/**
 * Example 4: Custom Configuration
 */
export async function customConfigurationExample(): Promise<void> {
  console.log('\n⚙️  Custom Configuration Example');
  console.log('='.repeat(50));

  const registry = new DefaultAgentRegistry();
  const coordinator = new DefaultAgentCoordinator(registry);

  registry.register(new CodeAnalysisAgent());
  registry.register(new SecurityAgent());

  // Custom configuration
  const configuration = new Map([
    [
      'code-analysis',
      {
        enabled: true,
        priority: 10,
        timeout: 60000,
        options: {
          maxComplexity: 15,
          checkConsoleStatements: false,
          maxLineLength: 100,
        },
      },
    ],
    [
      'security',
      {
        enabled: true,
        priority: 5,
        timeout: 45000,
        options: {
          checkHardcodedSecrets: true,
          checkDependencies: false,
        },
      },
    ],
  ]);

  const context: AnalysisContext = {
    projectPath: process.cwd(),
    files: await discoverSourceFiles(process.cwd()),
    configuration,
  };

  const report = await coordinator.runFullAnalysis(context);

  console.log('Analysis completed with custom configuration');
  displaySummary(report);
}

/**
 * Example 5: Analyzing Specific File Types
 */
export async function fileTypeAnalysisExample(): Promise<void> {
  console.log('\n📁 File Type Analysis Example');
  console.log('='.repeat(50));

  const registry = new DefaultAgentRegistry();
  const coordinator = new DefaultAgentCoordinator(registry);

  registry.register(new TypeSafetyAgent());
  registry.register(new SecurityAgent());

  // Analyze only TypeScript files
  const allFiles = await discoverSourceFiles(process.cwd());
  const tsFiles = allFiles.filter(file => file.endsWith('.ts') || file.endsWith('.tsx'));

  const context: AnalysisContext = {
    projectPath: process.cwd(),
    files: tsFiles,
    targetFiles: tsFiles,
  };

  console.log(`Analyzing ${tsFiles.length} TypeScript files`);

  const report = await coordinator.runFullAnalysis(context);
  displaySummary(report);
}

/**
 * Example 6: Generating Different Report Formats
 */
export async function reportFormatsExample(): Promise<void> {
  console.log('\n📄 Report Formats Example');
  console.log('='.repeat(50));

  const registry = new DefaultAgentRegistry();
  const coordinator = new DefaultAgentCoordinator(registry);

  registry.register(new CodeAnalysisAgent());
  registry.register(new SecurityAgent());

  const context: AnalysisContext = {
    projectPath: process.cwd(),
    files: await discoverSourceFiles(process.cwd()),
  };

  const report = await coordinator.runFullAnalysis(context);

  // Generate JSON report
  const jsonReport = JSON.stringify(report, null, 2);
  await fs.writeFile('analysis-report.json', jsonReport);
  console.log('📄 JSON report saved to analysis-report.json');

  // Generate HTML report
  const htmlReport = generateHtmlReport(report);
  await fs.writeFile('analysis-report.html', htmlReport);
  console.log('📄 HTML report saved to analysis-report.html');

  // Generate CSV summary
  const csvReport = generateCsvReport(report);
  await fs.writeFile('analysis-summary.csv', csvReport);
  console.log('📄 CSV summary saved to analysis-summary.csv');
}

/**
 * Example 7: Error Handling and Recovery
 */
export async function errorHandlingExample(): Promise<void> {
  console.log('\n🛡️  Error Handling Example');
  console.log('='.repeat(50));

  const registry = new DefaultAgentRegistry();
  const coordinator = new DefaultAgentCoordinator(registry);

  registry.register(new CodeAnalysisAgent());

  // Intentionally problematic context
  const context: AnalysisContext = {
    projectPath: '/nonexistent/path',
    files: ['nonexistent.ts'],
  };

  try {
    const report = await coordinator.runFullAnalysis(context);

    // Check for agent errors
    const failedAgents = report.agentResults.filter(result => result.status === 'error');

    if (failedAgents.length > 0) {
      console.log(`⚠️  ${failedAgents.length} agents encountered errors:`);
      failedAgents.forEach(result => {
        console.log(`  - ${result.agentName}: ${result.findings[0]?.message}`);
      });
    }

    console.log('✅ Analysis completed despite errors');
  } catch (error) {
    console.error('❌ Analysis failed completely:', error);
  }
}

/**
 * Helper Functions
 */

async function discoverSourceFiles(projectPath: string): Promise<string[]> {
  const files: string[] = [];

  const walk = async (dir: string): Promise<void> => {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(projectPath, fullPath);

        if (entry.isDirectory() && !shouldSkipDirectory(entry.name)) {
          await walk(fullPath);
        } else if (entry.isFile() && isSourceFile(entry.name)) {
          files.push(relativePath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  };

  await walk(projectPath);
  return files;
}

function shouldSkipDirectory(dirName: string): boolean {
  const skipDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];
  return skipDirs.includes(dirName);
}

function isSourceFile(fileName: string): boolean {
  const sourceExtensions = ['.ts', '.js', '.tsx', '.jsx', '.json'];
  return sourceExtensions.some(ext => fileName.endsWith(ext));
}

function displaySummary(report: AnalysisReport): void {
  const { summary } = report;

  console.log('\n📊 Analysis Summary:');
  console.log(`  Total Findings: ${summary.totalFindings}`);
  console.log(`  Critical: ${summary.criticalFindings}`);
  console.log(`  High: ${summary.highFindings}`);
  console.log(`  Medium: ${summary.mediumFindings}`);
  console.log(`  Low: ${summary.lowFindings}`);
  console.log(`  Files Analyzed: ${summary.filesAnalyzed}`);
  console.log(`  Execution Time: ${summary.totalExecutionTime}ms`);

  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => console.log(`  • ${rec}`));
  }
}

function generateHtmlReport(report: AnalysisReport): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        .finding { border-left: 4px solid #ccc; padding: 10px; margin: 10px 0; }
        .critical { border-left-color: #d32f2f; }
        .high { border-left-color: #f57c00; }
        .medium { border-left-color: #fbc02d; }
        .low { border-left-color: #388e3c; }
    </style>
</head>
<body>
    <h1>Code Analysis Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p>Total Findings: ${report.summary.totalFindings}</p>
        <p>Critical: ${report.summary.criticalFindings}</p>
        <p>Files Analyzed: ${report.summary.filesAnalyzed}</p>
    </div>
    <h2>Findings</h2>
    ${report.findings
      .map(
        finding => `
        <div class="finding ${finding.severity}">
            <strong>${finding.message}</strong>
            ${finding.file ? `<br>File: ${finding.file}` : ''}
        </div>
    `
      )
      .join('')}
</body>
</html>`;
}

function generateCsvReport(report: AnalysisReport): string {
  const headers = 'Severity,Category,Message,File,Line,Fix\n';
  const rows = report.findings
    .map(
      finding =>
        `"${finding.severity}","${finding.category}","${finding.message}","${finding.file || ''}","${finding.line || ''}","${finding.fix || ''}"`
    )
    .join('\n');

  return headers + rows;
}

/**
 * Run all examples
 */
export async function runAllExamples(): Promise<void> {
  console.log('🚀 Running Agent System Examples\n');

  try {
    await basicAnalysisExample();
    await selectiveAnalysisExample();
    await eventDrivenAnalysisExample();
    await customConfigurationExample();
    await fileTypeAnalysisExample();
    await reportFormatsExample();
    await errorHandlingExample();

    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('\n❌ Example execution failed:', error);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}
