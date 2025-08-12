/**
 * Basic usage examples for the code analysis agent system
 */

import { AgentCoordinator } from '../base/coordinator.js';
import { StaticAnalysisAgent } from '../analysis/static-analysis.js';
import { ErrorDetectionAgent } from '../analysis/error-detection.js';
import { TestGenerationAgent } from '../testing/test-generation.js';
import { ReportGenerator } from '../reporting/report-generator.js';
import {
  AnalysisTarget,
  CoordinationRequest,
  TestGenerationRequest,
  Severity,
  FindingCategory
} from '../types.js';

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
    minSeverity: Severity.LOW
  });
  
  // Define analysis target
  const target: AnalysisTarget = {
    type: 'file',
    path: filePath,
    depth: 'deep'
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
  const coordinator = new AgentCoordinator();
  coordinator.registerAgent(new StaticAnalysisAgent());
  coordinator.registerAgent(new ErrorDetectionAgent());
  
  // Define analysis target
  const target: AnalysisTarget = {
    type: 'project',
    path: projectPath,
    depth: 'comprehensive',
    exclude: ['node_modules/**', 'dist/**', 'build/**']
  };
  
  // Create coordination request
  const request: CoordinationRequest = {
    target,
    parallel: true, // Run agents in parallel for speed
    config: {
      enabled: true,
      depth: 'comprehensive',
      maxFindings: 100,
      minSeverity: Severity.MEDIUM
    }
  };
  
  try {
    // Run coordinated analysis
    const result = await coordinator.coordinate(request);
    
    console.log(`✅ Coordinated analysis completed in ${result.summary.totalDuration}ms`);
    console.log(`🤖 Agents used: ${result.summary.agentsUsed.join(', ')}`);
    console.log(`📊 Total findings: ${result.summary.totalFindings}`);
    
    // Show severity breakdown
    console.log('\\n📈 Severity Breakdown:');
    console.log(`🔴 Critical: ${result.summary.findingsBySeverity[Severity.CRITICAL] || 0}`);
    console.log(`🟠 High: ${result.summary.findingsBySeverity[Severity.HIGH] || 0}`);
    console.log(`🟡 Medium: ${result.summary.findingsBySeverity[Severity.MEDIUM] || 0}`);
    console.log(`🔵 Low: ${result.summary.findingsBySeverity[Severity.LOW] || 0}`);
    console.log(`⚪ Info: ${result.summary.findingsBySeverity[Severity.INFO] || 0}`);
    
    // Show category breakdown
    console.log('\\n🏷️ Category Breakdown:');
    Object.entries(result.summary.findingsByCategory).forEach(([category, count]) => {
      if (count > 0) {
        console.log(`   ${category.replace(/_/g, ' ')}: ${count}`);
      }
    });
    
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
      branches: 70
    }
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
  
  const reportOptions = {
    format,
    outputPath,
    includeDetails: true,
    groupBy: 'severity' as const,
    sortBy: 'severity' as const,
    includeRecommendations: true
  };
  
  try {
    const report = await reportGenerator.generateReport(result, reportOptions);
    
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
  
  const coordinator = new AgentCoordinator();
  coordinator.registerAgent(new StaticAnalysisAgent());
  coordinator.registerAgent(new ErrorDetectionAgent());
  
  const target: AnalysisTarget = {
    type: 'directory',
    path: targetPath,
    depth: 'shallow'
  };
  
  const request: CoordinationRequest = {
    target,
    parallel: true,
    config: {
      enabled: true,
      depth: 'shallow',
      maxFindings: 20,
      minSeverity: Severity.MEDIUM,
      includeCategories: [
        FindingCategory.SECURITY_VULNERABILITY,
        FindingCategory.RUNTIME_ERROR
      ]
    }
  };
  
  try {
    const result = await coordinator.coordinate(request);
    
    const securityFindings = result.consolidatedFindings.filter(
      f => f.category === FindingCategory.SECURITY_VULNERABILITY
    );
    
    console.log(`🔍 Security scan completed in ${result.summary.totalDuration}ms`);
    console.log(`🚨 Security issues found: ${securityFindings.length}`);
    
    if (securityFindings.length > 0) {
      console.log('\\n⚠️ Security Issues:');
      securityFindings.forEach((finding, index) => {
        console.log(`${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title}`);
        console.log(`   📍 ${finding.file}:${finding.line}`);
        console.log(`   💡 ${finding.suggestion || 'Review and fix this security issue'}`);
        console.log('');
      });
    } else {
      console.log('✅ No obvious security issues found in quick scan');
      console.log('💡 Consider running a comprehensive analysis for thorough security review');
    }
    
    return {
      totalFindings: result.summary.totalFindings,
      securityFindings: securityFindings.length,
      findings: securityFindings
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
  
  const coordinator = new AgentCoordinator();
  coordinator.registerAgent(new StaticAnalysisAgent());
  coordinator.registerAgent(new ErrorDetectionAgent());
  coordinator.registerAgent(new TestGenerationAgent());
  
  try {
    const health = await coordinator.getAgentsHealth();
    const summary = await coordinator.healthCheck();
    
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
        console.log(`      Memory Usage: ${Math.round(status.metrics.memoryUsage / 1024 / 1024)}MB`);
      }
    });
    
    if (summary.unhealthyAgents.length > 0) {
      console.log('\\n⚠️ Unhealthy Agents:');
      summary.unhealthyAgents.forEach(agent => {
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

// Export all examples for individual use
export {
  analyzeFile,
  analyzeProject,
  generateTestsForFile,
  generateAnalysisReport,
  quickSecurityScan,
  monitorAgentHealth
};