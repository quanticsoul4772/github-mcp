#!/usr/bin/env node
/**
 * Demonstration script for the code analysis agent system
 * Shows how to use the agents to analyze code and generate reports
 */

import { createAgentSystem, quickAnalyze } from './index.js';
import { 
  analyzeFile, 
  analyzeProject, 
  generateTestsForFile, 
  generateAnalysisReport,
  quickSecurityScan,
  monitorAgentHealth 
} from './examples/basic-usage.js';
import { AnalysisContext } from './types/agent-interfaces.js';
import { ReportData, ReportGenerator } from './reporting/report-generator.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Create a sample TypeScript file for demonstration
const SAMPLE_CODE = `
// Sample TypeScript file with various issues for demonstration
import { someUnusedImport } from './unused-module';

class Calculator {
  private value: number;

  constructor(initialValue: any) { // Should be typed
    this.value = initialValue;
  }

  // Function with high complexity
  complexCalculation(a: number, b: number, c: string): any {
    if (a > 0) {
      if (b > 0) {
        if (c.length > 0) {
          if (a > b) {
            if (c.includes('test')) {
              if (a % 2 === 0) {
                return a + b + parseInt(c);
              } else {
                return a - b + parseInt(c);
              }
            } else {
              return a * b;
            }
          } else {
            return b - a;
          }
        } else {
          return 0;
        }
      } else {
        return a;
      }
    } else {
      return null;
    }
  }

  // Potential null pointer error
  unsafeOperation(data: any) {
    console.log(data.property.value); // No null check
    return data.items[0]; // No bounds check
  }

  // Async function without proper error handling
  async fetchData(url: string) {
    const response = fetch(url); // Missing await
    return response.json(); // Potential error
  }

  // Function with magic numbers
  calculateDiscount(price: number): number {
    if (price > 1000) {
      return price * 0.15; // Magic number
    } else if (price > 500) {
      return price * 0.1; // Magic number
    }
    return price * 0.05; // Magic number
  }

  // Security vulnerability
  evaluateExpression(expr: string): any {
    return eval(expr); // Dangerous!
  }

  // Resource leak
  openFile(filename: string) {
    const fs = require('fs');
    const file = fs.openSync(filename, 'r');
    // Missing file.close()
    return file;
  }
}

// Unused variable
const unusedVariable = 'this is not used';

// TODO: Fix this function
function todoFunction() {
  // FIXME: This is broken
  return undefined;
}

export { Calculator };
`;

async function createSampleFile(): Promise<string> {
  const tempDir = './temp-demo';
  const sampleFile = path.join(tempDir, 'sample.ts');
  
  try {
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(sampleFile, SAMPLE_CODE);
    console.log(`📝 Created sample file: ${sampleFile}`);
    return sampleFile;
  } catch (error) {
    console.error('Failed to create sample file:', error);
    throw error;
  }
}

async function cleanupSampleFile(filePath: string): Promise<void> {
  try {
    const tempDir = path.dirname(filePath);
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log(`🧹 Cleaned up: ${tempDir}`);
  } catch (error) {
    console.error('Failed to cleanup:', error);
  }
}

async function runDemo() {
  console.log('🚀 Code Analysis Agent System Demo');
  console.log('═'.repeat(60));
  
  let sampleFile: string | null = null;
  
  try {
    // Create sample file
    sampleFile = await createSampleFile();
    
    console.log('\\n1️⃣ Quick Analysis Demo');
    console.log('─'.repeat(40));
    
    // Quick analysis
    const quickResult = await quickAnalyze(sampleFile, {
      format: 'text'
    });
    
    console.log('Quick analysis completed!');
    console.log(`Found ${(quickResult as any).analysis.summary.totalFindings} issues`);
    
    console.log('\\n2️⃣ Detailed Single File Analysis');
    console.log('─'.repeat(40));
    
    // Detailed analysis
    await analyzeFile(sampleFile);
    
    console.log('\\n3️⃣ Test Generation Demo');
    console.log('─'.repeat(40));
    
    // Generate tests
    await generateTestsForFile(sampleFile);
    
    console.log('\\n4️⃣ Security Scan Demo');
    console.log('─'.repeat(40));
    
    // Security scan
    const tempDir = path.dirname(sampleFile);
    await quickSecurityScan(tempDir);
    
    console.log('\\n5️⃣ Agent Health Monitoring');
    console.log('─'.repeat(40));
    
    // Health monitoring
    await monitorAgentHealth();
    
    console.log('\\n6️⃣ Report Generation Demo');
    console.log('─'.repeat(40));
    
    // Generate markdown report
    const reportPath = path.join(path.dirname(sampleFile), 'analysis-report.md');
    await generateAnalysisReport(tempDir, 'markdown', reportPath);
    
    console.log('\\n7️⃣ Agent System API Demo');
    console.log('─'.repeat(40));
    
    // Demonstrate the agent system API
    const { coordinator, registry, agents } = createAgentSystem();
    
    console.log(`🤖 Available agents: ${agents.map((a: any) => a.name).join(', ')}`);
    
    // Run coordinated analysis
    const context: AnalysisContext = {
      projectPath: path.dirname(sampleFile),
      files: [sampleFile]
    };
    const result = await coordinator.runFullAnalysis(context);
    
    console.log(`\\n📊 Coordinated Analysis Results:`);
    console.log(`   Total Findings: ${result.summary.totalFindings}`);
    console.log(`   Agents Run: ${result.summary.agentsRun}`);
    console.log(`   Analysis Time: ${Math.round(result.summary.totalExecutionTime)}ms`);
    
    // Generate JSON report
    const reportData: ReportData = {
      title: 'Demo Analysis Report',
      summary: `Analysis completed with ${result.summary.totalFindings} findings`,
      sections: [],
      metadata: {
        generatedAt: new Date(),
        generatedBy: 'demo',
        version: '1.0.0'
      }
    };
    const reportGenerator = new ReportGenerator();
    const jsonReport = await reportGenerator.generateReport(reportData);
    
    const summary = JSON.parse(jsonReport).summary;
    console.log(`\\n📈 Summary Statistics:`);
    console.log(`   Critical: ${summary.criticalFindings}`);
    console.log(`   High: ${summary.highFindings}`);
    console.log(`   Medium: ${summary.mediumFindings}`);
    console.log(`   Low: ${summary.lowFindings}`);
    console.log(`   Info: ${summary.infoFindings}`);
    
    console.log('\\n✅ Demo completed successfully!');
    console.log('\\n💡 Next Steps:');
    console.log('   - Integrate agents into your CI/CD pipeline');
    console.log('   - Customize agent configurations for your project');
    console.log('   - Create custom agents for specific analysis needs');
    console.log('   - Set up automated reporting and monitoring');
    
  } catch (error) {
    console.error('\\n❌ Demo failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (sampleFile) {
      await cleanupSampleFile(sampleFile);
    }
  }
}

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}

export { runDemo };