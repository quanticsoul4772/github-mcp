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
  
  // Fixed: Replace magic numbers with named constants
  private readonly LARGE_ORDER_THRESHOLD = 1000;
  private readonly MEDIUM_ORDER_THRESHOLD = 500;
  private readonly LARGE_ORDER_DISCOUNT = 0.15;
  private readonly MEDIUM_ORDER_DISCOUNT = 0.1;
  private readonly SMALL_ORDER_DISCOUNT = 0.05;

  constructor(initialValue: any) { // Should be typed
    this.value = initialValue;
  }

  // Fixed: Refactored to reduce complexity
  private isValidInput(a: number, b: number, c: string): boolean {
    return a > 0 && b > 0 && c.length > 0;
  }
  
  private calculateTestValue(a: number, b: number, c: string): number {
    const parsedC = parseInt(c) || 0;
    if (a % 2 === 0) {
      return a + b + parsedC;
    }
    return a - b + parsedC;
  }
  
  complexCalculation(a: number, b: number, c: string): number | null {
    // Early returns to reduce nesting
    if (a <= 0) {
      return null;
    }
    
    if (b <= 0) {
      return a;
    }
    
    if (c.length === 0) {
      return 0;
    }
    
    // Main calculation logic
    if (a > b) {
      if (c.includes('test')) {
        return this.calculateTestValue(a, b, c);
      }
      return a * b;
    }
    
    return b - a;
  }

  // Fixed: Added null checks and type guards
  unsafeOperation(data: any) {
    // Add null checks to prevent runtime errors
    if (data && data.property && data.property.value) {
      console.log(data.property.value);
    } else {
      console.log('Data or property is undefined');
    }
    
    // Add bounds check before array access
    if (data && data.items && Array.isArray(data.items) && data.items.length > 0) {
      return data.items[0];
    }
    return null;
  }

  // Fixed: Added proper async/await and error handling
  async fetchData(url: string) {
    try {
      const response = await fetch(url); // Fixed: Added await
      if (!response.ok) {
        throw new Error('HTTP error! status: ' + response.status);
      }
      return await response.json(); // Fixed: Added await and error handling
    } catch (error) {
      console.error('Failed to fetch data:', error);
      throw error;
    }
  }
  
  calculateDiscount(price: number): number {
    if (price > this.LARGE_ORDER_THRESHOLD) {
      return price * this.LARGE_ORDER_DISCOUNT;
    } else if (price > this.MEDIUM_ORDER_THRESHOLD) {
      return price * this.MEDIUM_ORDER_DISCOUNT;
    }
    return price * this.SMALL_ORDER_DISCOUNT;
  }

  // Security vulnerability fixed - use safer alternative
  evaluateExpression(expr: string): any {
    // Instead of eval, use a safe expression evaluator
    // For demo purposes, just parse and evaluate simple math expressions
    try {
      // Only allow numbers and basic math operators
      if (!/^[\d\s+\-*/().]+$/.test(expr)) {
        throw new Error('Invalid expression');
      }
      // Use Function constructor as a safer alternative for simple math
      return new Function('return ' + expr)();
    } catch (error) {
      console.error('Expression evaluation failed:', error);
      throw new Error('Failed to evaluate expression safely');
    }
  }

  // Fixed: Properly handle file resources
  openFile(filename: string) {
    const fs = require('fs');
    let file: number | null = null;
    try {
      file = fs.openSync(filename, 'r');
      // Process file here or return data instead of file descriptor
      const stats = fs.fstatSync(file);
      fs.closeSync(file); // Fixed: Properly close the file
      return stats;
    } catch (error) {
      if (file !== null) {
        fs.closeSync(file); // Ensure file is closed on error
      }
      throw error;
    }
  }
}

// Removed unused variable - was causing code quality issue

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