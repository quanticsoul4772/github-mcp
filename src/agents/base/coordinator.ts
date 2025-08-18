import {
  AgentCoordinator,
  AnalysisContext,
  AnalysisResult,
  AnalysisReport,
  AgentEvent,
  AgentEventListener,
  BaseAgent,
} from '../types/agent-interfaces.js';
import { DefaultAgentRegistry } from './agent-registry.js';

// CoordinationResult type for workflow compatibility
export interface CoordinationResult {
  summary: {
    totalFindings: number;
    agentsUsed: string[];
    totalDuration: number;
    findingsBySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      info: number;
    };
    findingsByCategory: Record<string, number>;
  };
  reports: Array<{
    agentName: string;
    summary: {
      filesAnalyzed: number;
      totalFindings: number;
      duration: number;
    };
    findings: any[];
    duration: number;
  }>;
  consolidatedFindings: any[];
}

// Re-export the interface
export type { AgentCoordinator };

/**
 * Main coordinator for orchestrating agent-based code analysis
 */
export class DefaultAgentCoordinator implements AgentCoordinator {
  private registry: DefaultAgentRegistry;
  private eventListeners: AgentEventListener[] = [];

  constructor(registry?: DefaultAgentRegistry) {
    this.registry = registry || new DefaultAgentRegistry();
  }

  /**
   * Add event listener
   */
  public addEventListener(listener: AgentEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(listener: AgentEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: AgentEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }

  /**
   * Run analysis with all registered agents
   */
  public async runFullAnalysis(context: AnalysisContext): Promise<AnalysisReport> {
    this.emitEvent({
      type: 'analysis-start',
      timestamp: new Date(),
      data: { context },
    });

    const startTime = Date.now();
    const agents = this.registry.getExecutionOrder();
    const results: AnalysisResult[] = [];

    console.log(`Starting full analysis with ${agents.length} agents...`);

    for (const agent of agents) {
      try {
        const result = await this.runSingleAgentInternal(agent, context);
        results.push(result);

        // Add result to context for dependent agents
        if (!context.previousResults) {
          context.previousResults = new Map();
        }
        context.previousResults.set(agent.name, result);
      } catch (error) {
        console.error(`Agent ${agent.name} failed:`, error);
        results.push({
          agentName: agent.name,
          timestamp: new Date(),
          status: 'error',
          findings: [
            {
              id: `${agent.name}-error-${Date.now()}`,
              severity: 'critical',
              category: 'agent-error',
              message: `Agent execution failed: ${error instanceof Error ? error.message : String(error)}`,
              evidence: error instanceof Error ? error.stack : undefined,
            },
          ],
        });
      }
    }

    const report = this.generateReport(results, context);
    report.summary.totalExecutionTime = Date.now() - startTime;

    this.emitEvent({
      type: 'analysis-complete',
      timestamp: new Date(),
      data: { report },
    });

    console.log(`Analysis complete. Found ${report.summary.totalFindings} findings.`);
    return report;
  }

  /**
   * Run analysis with specific agents
   */
  public async runSelectedAgents(
    agentNames: string[],
    context: AnalysisContext
  ): Promise<AnalysisReport> {
    const agents = agentNames
      .map(name => this.registry.getAgent(name))
      .filter((agent): agent is BaseAgent => agent !== undefined);

    if (agents.length !== agentNames.length) {
      const missing = agentNames.filter(name => !this.registry.hasAgent(name));
      throw new Error(`Unknown agents: ${missing.join(', ')}`);
    }

    // Sort by priority and resolve dependencies
    const sortedAgents = agents.sort((a, b) => a.getPriority() - b.getPriority());
    const results: AnalysisResult[] = [];

    console.log(`Running selected agents: ${agentNames.join(', ')}`);

    for (const agent of sortedAgents) {
      const result = await this.runSingleAgentInternal(agent, context);
      results.push(result);

      if (!context.previousResults) {
        context.previousResults = new Map();
      }
      context.previousResults.set(agent.name, result);
    }

    return this.generateReport(results, context);
  }

  /**
   * Run a single agent
   */
  public async runSingleAgent(
    agentName: string,
    context: AnalysisContext
  ): Promise<AnalysisResult> {
    const agent = this.registry.getAgent(agentName);
    if (!agent) {
      throw new Error(`Agent '${agentName}' not found`);
    }

    return this.runSingleAgentInternal(agent, context);
  }

  /**
   * Internal method to run a single agent with event handling
   */
  private async runSingleAgentInternal(
    agent: BaseAgent,
    context: AnalysisContext
  ): Promise<AnalysisResult> {
    this.emitEvent({
      type: 'agent-start',
      agentName: agent.name,
      timestamp: new Date(),
    });

    const startTime = Date.now();

    try {
      console.log(`Running agent: ${agent.name}`);
      const result = await agent.analyze(context);
      result.executionTime = Date.now() - startTime;

      this.emitEvent({
        type: 'agent-complete',
        agentName: agent.name,
        timestamp: new Date(),
        data: { result },
      });

      console.log(`Agent ${agent.name} completed with ${result.findings.length} findings`);
      return result;
    } catch (error) {
      this.emitEvent({
        type: 'agent-error',
        agentName: agent.name,
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error(String(error)),
      });

      throw error;
    }
  }

  /**
   * Generate analysis report from results
   */
  public generateReport(results: AnalysisResult[], context: AnalysisContext): AnalysisReport {
    const allFindings = results.flatMap(result => result.findings);
    const recommendations = results.flatMap(result => result.recommendations || []);

    const summary = {
      totalFindings: allFindings.length,
      criticalFindings: allFindings.filter(f => f.severity === 'critical').length,
      highFindings: allFindings.filter(f => f.severity === 'high').length,
      mediumFindings: allFindings.filter(f => f.severity === 'medium').length,
      lowFindings: allFindings.filter(f => f.severity === 'low').length,
      infoFindings: allFindings.filter(f => f.severity === 'info').length,
      agentsRun: results.length,
      totalExecutionTime: results.reduce((sum, r) => sum + (r.executionTime || 0), 0),
      filesAnalyzed: new Set(allFindings.map(f => f.file).filter(Boolean)).size,
    };

    return {
      summary,
      agentResults: results,
      findings: allFindings,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      timestamp: new Date(),
      projectPath: context.projectPath,
      gitContext: context.gitContext,
    };
  }

  /**
   * Get the agent registry
   */
  public getRegistry(): DefaultAgentRegistry {
    return this.registry;
  }

  /**
   * Get all agents
   */
  public getAgents(): BaseAgent[] {
    return this.registry.getAllAgents();
  }

  /**
   * Coordinate analysis - wrapper method expected by workflow
   */
  public async coordinate(options: {
    target: {
      type: 'project' | 'file' | 'directory';
      path: string;
      depth?: string;
      exclude?: string[];
    };
    parallel?: boolean;
    config?: {
      enabled: boolean;
      depth: string;
      minSeverity?: string;
      maxFindings?: number;
      includeCategories?: string[];
    };
  }): Promise<CoordinationResult> {
    // Convert options to AnalysisContext
    const context: AnalysisContext = {
      projectPath: options.target.path,
      files: [], // Will be populated during discovery
      excludePatterns: options.target.exclude,
    };

    // Run the analysis
    const report = await this.runFullAnalysis(context);

    // Convert AnalysisReport to CoordinationResult format expected by workflow
    const result: CoordinationResult = {
      summary: {
        totalFindings: report.summary.totalFindings,
        agentsUsed: report.agentResults.map(r => r.agentName),
        totalDuration: report.summary.totalExecutionTime,
        findingsBySeverity: {
          critical: report.summary.criticalFindings,
          high: report.summary.highFindings,
          medium: report.summary.mediumFindings,
          low: report.summary.lowFindings,
          info: report.summary.infoFindings,
        },
        findingsByCategory: {},
      },
      reports: report.agentResults.map(r => ({
        agentName: r.agentName,
        summary: {
          filesAnalyzed: new Set(r.findings.map(f => f.file).filter(Boolean)).size,
          totalFindings: r.findings.length,
          duration: r.executionTime || 0,
        },
        findings: r.findings,
        duration: r.executionTime || 0,
      })),
      consolidatedFindings: report.findings,
    };

    // Populate findingsByCategory
    report.findings.forEach(finding => {
      if (finding.category) {
        result.summary.findingsByCategory[finding.category] =
          (result.summary.findingsByCategory[finding.category] || 0) + 1;
      }
    });

    return result;
  }

  /**
   * Validate all agent configurations
   */
  public validateConfigurations(context: AnalysisContext): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const agents = this.registry.getAllAgents();

    for (const agent of agents) {
      const config = context.configuration?.get(agent.name) || agent.getDefaultConfiguration();
      if (!agent.validateConfiguration(config)) {
        errors.push(`Invalid configuration for agent '${agent.name}'`);
      }
    }

    // Validate dependencies
    const depValidation = this.registry.validateDependencies();
    errors.push(...depValidation.errors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
