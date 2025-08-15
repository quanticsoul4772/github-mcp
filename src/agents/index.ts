/**
 * Main entry point for the agent-based code analysis system
 * Exports all agents, types, and utilities
 */

// Core types and interfaces
export * from './types/agent-interfaces.js';

// Base classes
export * from './base/base-agent.js';
export * from './base/agent-registry.js';
export * from './base/coordinator.js';

// Analysis agents
export * from './analysis/code-analysis-agent.js';
export * from './analysis/type-safety-agent.js';
export * from './analysis/static-analysis.js';

// Testing agents
export * from './testing/testing-agent.js';

// Security agents
export * from './security/security-agent.js';

// Tools and utilities
export * from './tools/agent-tools.js';
export * from './reporting/report-generator.js';

// CLI
export * from './cli/analysis-cli.js';

// Examples
export * from './examples/example-usage.js';

// Import specific classes for the convenience function
import { DefaultAgentRegistry } from './base/agent-registry.js';
import { DefaultAgentCoordinator } from './base/coordinator.js';
import { CodeAnalysisAgent } from './analysis/code-analysis-agent.js';
import { TypeSafetyAgent } from './analysis/type-safety-agent.js';
import { TestingAgent } from './testing/testing-agent.js';
import { SecurityAgent } from './security/security-agent.js';

/**
 * Convenience function to create a fully configured agent system
 */
export function createAgentSystem() {
  const registry = new DefaultAgentRegistry();
  const coordinator = new DefaultAgentCoordinator(registry);
  
  // Register all available agents
  registry.register(new CodeAnalysisAgent());
  registry.register(new TypeSafetyAgent());
  registry.register(new TestingAgent());
  registry.register(new SecurityAgent());
  
  return {
    registry,
    coordinator,
    agents: registry.getAllAgents()
  };
}

/**
 * Quick analysis function for immediate use
 */
export async function quickAnalyze(
  projectPath: string,
  options: {
    agents?: string[];
    format?: 'json' | 'text' | 'html';
    output?: string;
    exclude?: string[];
    include?: string[];
  } = {}
) {
  const { coordinator } = createAgentSystem();
  
  // Discover files
  const files = await discoverFiles(projectPath, options.include, options.exclude);
  
  const context = {
    projectPath,
    files,
    excludePatterns: options.exclude
  };
  
  // Run analysis
  const report = options.agents && options.agents.length > 0
    ? await coordinator.runSelectedAgents(options.agents, context)
    : await coordinator.runFullAnalysis(context);
  
  // Format output
  if (options.format === 'json') {
    return JSON.stringify(report, null, 2);
  } else if (options.format === 'html') {
    return generateHtmlReport(report);
  } else {
    return generateTextReport(report);
  }
}

// Helper functions
async function discoverFiles(
  projectPath: string, 
  include?: string[], 
  exclude?: string[]
): Promise<string[]> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const files: string[] = [];
  
  const walk = async (dir: string): Promise<void> => {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(projectPath, fullPath);
        
        if (entry.isDirectory() && !shouldSkipDirectory(entry.name)) {
          await walk(fullPath);
        } else if (entry.isFile() && shouldIncludeFile(relativePath, include, exclude)) {
          files.push(relativePath);
        }
      }
    } catch {
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

function shouldIncludeFile(filePath: string, include?: string[], exclude?: string[]): boolean {
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

function generateTextReport(report: any): string {
  const { summary, findings } = report;
  
  let output = '\n📊 ANALYSIS SUMMARY\n';
  output += '═'.repeat(50) + '\n';
  output += `Total Findings: ${summary.totalFindings}\n`;
  output += `Critical: ${summary.criticalFindings}\n`;
  output += `High: ${summary.highFindings}\n`;
  output += `Medium: ${summary.mediumFindings}\n`;
  output += `Low: ${summary.lowFindings}\n`;
  output += `Files Analyzed: ${summary.filesAnalyzed}\n\n`;

  if (findings.length > 0) {
    output += '🔍 FINDINGS\n';
    output += '═'.repeat(50) + '\n';
    
    findings.forEach((finding: any) => {
      output += `• ${finding.message}\n`;
      if (finding.file) {
        output += `  📁 ${finding.file}${finding.line ? `:${finding.line}` : ''}\n`;
      }
      if (finding.fix) {
        output += `  🔧 ${finding.fix}\n`;
      }
      output += '\n';
    });
  }

  return output;
}

function generateHtmlReport(report: any): string {
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
           <strong>Low:</strong> ${summary.lowFindings}</p>
        <p><strong>Files Analyzed:</strong> ${summary.filesAnalyzed}</p>
    </div>

    <h2>Findings</h2>
    ${findings.map((finding: any) => `
        <div class="finding ${finding.severity}">
            <div><strong>${finding.message}</strong></div>
            ${finding.file ? `<div>📁 ${finding.file}${finding.line ? `:${finding.line}` : ''}</div>` : ''}
            ${finding.fix ? `<div><strong>Fix:</strong> ${finding.fix}</div>` : ''}
        </div>
    `).join('')}
</body>
</html>`;
}