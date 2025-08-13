/**
 * Main exports for the code analysis agent system
 */

// Core types and interfaces
export * from './types.js';

// Base classes
export { BaseAgent, DEFAULT_AGENT_CONFIG } from './base/agent-base.js';
export { AgentCoordinator, DefaultAgentRegistry } from './base/coordinator.js';

// Analysis agents
export { StaticAnalysisAgent } from './analysis/static-analysis.js';
export { ErrorDetectionAgent } from './analysis/error-detection.js';

// Testing agents
export { TestGenerationAgent } from './testing/test-generation.js';

// Reporting
export { ReportGenerator } from './reporting/report-generator.js';
export type { ReportOptions, ReportSummary } from './reporting/report-generator.js';

// MCP Tools
export { createAgentTools } from './tools/agent-tools.js';

// Examples
export * from './examples/basic-usage.js';

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