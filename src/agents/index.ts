/**
 * Main entry point for the agent system
 * Exports all agents, types, and utilities
 */

// Export types
export * from './types.js';

// Export base classes
export * from './base/agent-base.js';
export { AgentCoordinator, DefaultAgentRegistry } from './base/coordinator.js';

// Export analysis agents
export { StaticAnalysisAgent } from './analysis/static-analysis.js';
export { ErrorDetectionAgent } from './analysis/error-detection.js';

// Export testing agents
export { TestGenerationAgent } from './testing/test-generation.js';

// Export reporting
export { ReportGenerator } from './reporting/report-generator.js';

// Export tools
export { createAgentTools } from './tools/agent-tools.js';

// Export examples
export * from './examples/basic-usage.js';

// Import classes for the factory function
import { AgentCoordinator } from './base/coordinator.js';
import { StaticAnalysisAgent } from './analysis/static-analysis.js';
import { ErrorDetectionAgent } from './analysis/error-detection.js';
import { TestGenerationAgent } from './testing/test-generation.js';
import { ReportGenerator } from './reporting/report-generator.js';
import { createAgentTools } from './tools/agent-tools.js';

/**
 * Convenience function to create a fully configured agent system
 */
export function createAgentSystem() {
  const coordinator = new AgentCoordinator();
  
  // Register all available agents
  coordinator.registerAgent(new StaticAnalysisAgent());
  coordinator.registerAgent(new ErrorDetectionAgent());
  coordinator.registerAgent(new TestGenerationAgent());
  
  const reportGenerator = new ReportGenerator();
  
  return {
    coordinator,
    reportGenerator,
    agents: coordinator.getAgents(),
    tools: createAgentTools()
  };
}

/**
 * Quick analysis function for immediate use
 */
export async function quickAnalyze(
  targetPath: string,
  options: {
    type?: 'file' | 'directory' | 'project';
    agents?: string[];
    depth?: 'shallow' | 'deep' | 'comprehensive';
    parallel?: boolean;
    format?: 'json' | 'markdown' | 'console';
  } = {}
) {
  const { coordinator, reportGenerator } = createAgentSystem();
  
  const target = {
    type: options.type || 'file',
    path: targetPath,
    depth: options.depth || 'deep'
  };
  
  const request = {
    target,
    agents: options.agents,
    parallel: options.parallel !== false
  };
  
  // Run analysis
  const result = await coordinator.coordinate(request);
  
  // Generate report if format specified
  if (options.format) {
    const reportOptions = {
      format: options.format,
      includeDetails: true,
      includeRecommendations: true
    };
    
    const report = await reportGenerator.generateReport(result, reportOptions);
    
    return {
      analysis: result,
      report: options.format === 'json' ? JSON.parse(report) : report
    };
  }
  
  return { analysis: result };
}