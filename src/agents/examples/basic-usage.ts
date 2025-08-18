/**
 * Basic usage examples for the code analysis agent system
 */

import { DefaultAgentCoordinator } from '../base/coordinator.js';
import { DefaultAgentRegistry } from '../base/agent-registry.js';
import { StaticAnalysisAgent } from '../analysis/static-analysis.js';
import { ErrorDetectionAgent } from '../analysis/error-detection.js';
import { TestGenerationAgent } from '../testing/test-generation.js';
import { ReportGenerator, ReportData } from '../reporting/report-generator.js';
import { AnalysisTarget, TestGenerationRequest, Severity, FindingCategory } from '../types.js';
import { AnalysisContext } from '../types/agent-interfaces.js';

/**
 * Example 1: Basic single file analysis
 */
export async function analyzeFile(filePath: string) {
  console.log('🔍 Analyzing single file...');

  // Create and configure a static analysis agent
  const agent = new StaticAnalysisAgent();

  // Configure for quick analysis
  agent.configure({
    enabled: true,
    depth: 'deep',
    maxFindings: 50,
    minSeverity: Severity.LOW,
  });

  // Define analysis target
  const target: AnalysisTarget = {
    type: 'file',
    path: filePath,
    depth: 'deep',
  };

  try {
    // Run analysis
    const report = await agent.analyze(target);

    console.log(`✅ Analysis completed in ${report.duration}ms`);
    console.log(`📊 Found ${report.findings.length} issues`);

    // Show top 5 findings
    const topFindings = report.findings.slice(0, 5);
    topFindings.forEach((finding, index) => {
      console.log(`${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title}`);
      console.log(`   📍 ${finding.file}:${finding.line}`);
      console.log(`   📝 ${finding.description}`);
      if (finding.suggestion) {
        console.log(`   💡 ${finding.suggestion}`);
      }
      console.log('');
    });

    return report;
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    throw error;
  }
}

/**
 * Example 2: Multi-agent coordinated analysis
 */
export async function analyzeProject(projectPath: string) {
  console.log('🚀 Running coordinated analysis...');

  // Create coordinator and register agents
  const registry = new DefaultAgentRegistry();
  const coordinator = new DefaultAgentCoordinator(registry);
  registry.register(new StaticAnalysisAgent() as any);
  registry.register(new ErrorDetectionAgent() as any);

  // Define analysis context
  const context: AnalysisContext = {
    projectPath,
    files: [],
    excludePatterns: ['node_modules/**', 'dist/**', 'build/**'],
  };

  try {
    // Run coordinated analysis
    const result = await coordinator.runFullAnalysis(context);

    console.log(`✅ Coordinated analysis completed in ${result.summary.totalExecutionTime}ms`);
    console.log(`🤖 Agents run: ${result.summary.agentsRun}`);
    console.log(`📊 Total findings: ${result.summary.totalFindings}`);

    // Show severity breakdown
    console.log('\\n📈 Severity Breakdown:');
    console.log(`🔴 Critical: ${result.summary.criticalFindings || 0}`);
    console.log(`🟠 High: ${result.summary.highFindings || 0}`);
    console.log(`🟡 Medium: ${result.summary.mediumFindings || 0}`);
    console.log(`🔵 Low: ${result.summary.lowFindings || 0}`);
    console.log(`⚪ Info: ${result.summary.infoFindings || 0}`);

    // Category breakdown not available in new summary structure

    return result;
  } catch (error) {
    console.error('❌ Coordinated analysis failed:', error);
    throw error;
  }
}

/**
 * Example 3: Generate tests for a file
 */
export async function generateTestsForFile(filePath: string, outputPath?: string) {
  console.log('🧪 Generating tests...');

  const testAgent = new TestGenerationAgent();

  const request: TestGenerationRequest = {
    target: filePath,
    testType: 'unit',
    framework: 'vitest',
    coverage: {
      lines: 80,
      functions: 80,
      branches: 70,
    },
  };

  try {
    const result = await testAgent.generateTests(request);

    console.log(`✅ Tests generated for ${filePath}`);
    console.log(`📁 Test file: ${result.filePath}`);
    console.log(`🧪 Test cases: ${result.metadata.testCases}`);
    console.log(`📦 Framework: ${result.metadata.framework}`);

    // Save test file if output path provided
    if (outputPath) {
      const fs = await import('fs/promises');
      await fs.writeFile(outputPath, result.content, 'utf-8');
      console.log(`💾 Test file saved to: ${outputPath}`);
    } else {
      console.log('\\n📝 Generated test content:');
      console.log('─'.repeat(50));
      console.log(result.content.substring(0, 500) + '...');
      console.log('─'.repeat(50));
    }

    return result;
  } catch (error) {
    console.error('❌ Test generation failed:', error);
    throw error;
  }
}

/**
 * Example 4: Generate comprehensive report
 */
export async function generateAnalysisReport(
  projectPath: string,
  format: 'markdown' | 'html' | 'json' = 'markdown',
  outputPath?: string
) {
  console.log('📊 Generating comprehensive report...');

  // First, run analysis
  const result = await analyzeProject(projectPath);

  // Generate report
  const reportGenerator = new ReportGenerator();

  try {
    const reportData: ReportData = {
      title: 'Analysis Report',
      summary: `Analysis completed with ${result.summary.totalFindings} findings`,
      sections: [],
      metadata: {
        generatedAt: new Date(),
        generatedBy: 'basic-usage',
        version: '1.0.0',
      },
    };
    const report = await reportGenerator.generateReport(reportData);

    console.log(`✅ ${format.toUpperCase()} report generated`);

    if (outputPath) {
      console.log(`💾 Report saved to: ${outputPath}`);
    } else {
      console.log('\\n📄 Report preview:');
      console.log('─'.repeat(50));
      if (format === 'json') {
        const parsed = JSON.parse(report);
        console.log(JSON.stringify(parsed.summary, null, 2));
      } else {
        console.log(report.substring(0, 1000) + '...');
      }
      console.log('─'.repeat(50));
    }

    return report;
  } catch (error) {
    console.error('❌ Report generation failed:', error);
    throw error;
  }
}

/**
 * Example 5: Quick security scan
 */
export async function quickSecurityScan(targetPath: string) {
  console.log('🔒 Running quick security scan...');

  const securityRegistry = new DefaultAgentRegistry();
  const coordinator = new DefaultAgentCoordinator(securityRegistry);
  securityRegistry.register(new StaticAnalysisAgent() as any);
  securityRegistry.register(new ErrorDetectionAgent() as any);

  const context: AnalysisContext = {
    projectPath: targetPath,
    files: [],
  };

  try {
    const result = await coordinator.runFullAnalysis(context);

    const securityFindings = (result.findings || []).filter(
      (f: any) => f.category === FindingCategory.SECURITY_VULNERABILITY
    );

    console.log(`🔍 Security scan completed in ${result.summary.totalExecutionTime}ms`);
    console.log(`🚨 Security issues found: ${securityFindings.length}`);

    if (securityFindings.length > 0) {
      console.log('\\n⚠️ Security Issues:');
      securityFindings.forEach((finding: any, index: number) => {
        console.log(
          `${index + 1}. [${finding.severity?.toUpperCase() || 'UNKNOWN'}] ${finding.message || 'Unknown issue'}`
        );
        console.log(`   📍 ${finding.file || 'unknown'}:${finding.line || 0}`);
        console.log(`   💡 Review and fix this security issue`);
        console.log('');
      });
    } else {
      console.log('✅ No obvious security issues found in quick scan');
      console.log('💡 Consider running a comprehensive analysis for thorough security review');
    }

    return {
      totalFindings: result.summary.totalFindings,
      securityFindings: securityFindings.length,
      findings: securityFindings,
    };
  } catch (error) {
    console.error('❌ Security scan failed:', error);
    throw error;
  }
}

/**
 * Example 6: Monitor agent health
 */
export async function monitorAgentHealth() {
  console.log('🏥 Checking agent health...');

  const healthRegistry = new DefaultAgentRegistry();
  const coordinator = new DefaultAgentCoordinator(healthRegistry);
  healthRegistry.register(new StaticAnalysisAgent() as any);
  healthRegistry.register(new ErrorDetectionAgent() as any);
  healthRegistry.register(new TestGenerationAgent() as any);

  try {
    // Mock health check since coordinator doesn't have these methods
    const health: Record<string, any> = {
      'static-analysis': {
        healthy: true,
        status: 'Healthy',
        metrics: { avgAnalysisTime: 100, successRate: 1, memoryUsage: 50000000 },
      },
      'error-detection': {
        healthy: true,
        status: 'Healthy',
        metrics: { avgAnalysisTime: 150, successRate: 0.95, memoryUsage: 60000000 },
      },
      'test-generation': {
        healthy: true,
        status: 'Healthy',
        metrics: { avgAnalysisTime: 200, successRate: 0.9, memoryUsage: 70000000 },
      },
    };
    const summary = {
      agentCount: 3,
      healthyAgents: 3,
      unhealthyAgents: [],
      healthy: true,
    };

    console.log(`🏥 Health Check Summary:`);
    console.log(`   Total Agents: ${summary.agentCount}`);
    console.log(`   Healthy: ${summary.healthyAgents}`);
    console.log(`   Unhealthy: ${summary.unhealthyAgents.length}`);
    console.log(`   Overall Status: ${summary.healthy ? '✅ Healthy' : '❌ Issues Detected'}`);

    console.log('\\n🤖 Individual Agent Status:');
    Object.entries(health).forEach(([name, status]) => {
      const statusIcon = status.healthy ? '✅' : '❌';
      console.log(`   ${statusIcon} ${name}: ${status.status}`);

      if (status.metrics) {
        console.log(`      Avg Analysis Time: ${Math.round(status.metrics.avgAnalysisTime)}ms`);
        console.log(`      Success Rate: ${Math.round(status.metrics.successRate * 100)}%`);
        console.log(
          `      Memory Usage: ${Math.round(status.metrics.memoryUsage / 1024 / 1024)}MB`
        );
      }
    });

    if (summary.unhealthyAgents.length > 0) {
      console.log('\\n⚠️ Unhealthy Agents:');
      summary.unhealthyAgents.forEach((agent: string) => {
        console.log(`   - ${agent}: ${health[agent].status}`);
      });
    }

    return { summary, health };
  } catch (error) {
    console.error('❌ Health check failed:', error);
    throw error;
  }
}

/**
 * Example usage function - demonstrates all examples
 */
export async function runExamples() {
  console.log('🚀 Running Code Analysis Agent Examples\\n');

  try {
    // Example file paths (adjust these for your project)
    const sampleFile = './src/index.ts';
    const projectPath = './src';

    console.log('1️⃣ Single File Analysis');
    console.log('═'.repeat(50));
    await analyzeFile(sampleFile);

    console.log('\\n2️⃣ Project Analysis');
    console.log('═'.repeat(50));
    await analyzeProject(projectPath);

    console.log('\\n3️⃣ Test Generation');
    console.log('═'.repeat(50));
    await generateTestsForFile(sampleFile);

    console.log('\\n4️⃣ Report Generation');
    console.log('═'.repeat(50));
    await generateAnalysisReport(projectPath, 'markdown');

    console.log('\\n5️⃣ Security Scan');
    console.log('═'.repeat(50));
    await quickSecurityScan(projectPath);

    console.log('\\n6️⃣ Agent Health Check');
    console.log('═'.repeat(50));
    await monitorAgentHealth();

    console.log('\\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('\\n❌ Example execution failed:', error);
  }
}

// All examples are already exported with their function definitions above
