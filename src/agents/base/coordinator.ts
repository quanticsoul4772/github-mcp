/**
 * Agent coordinator for orchestrating multiple analysis agents
 */

import {
  CodeAnalysisAgent,
  CoordinationRequest,
  CoordinationResult,
  AnalysisReport,
  Finding,
  Severity,
  FindingCategory,
  AgentRegistry
} from '../types.js';
import { logger } from '../../logger.js';
import { performance } from 'perf_hooks';

/**
 * Registry implementation for managing agents
 */
export class DefaultAgentRegistry implements AgentRegistry {
  private agents = new Map<string, CodeAnalysisAgent>();

  register(agent: CodeAnalysisAgent): void {
    this.agents.set(agent.name, agent);
    logger.info(`Registered agent: ${agent.name}`, { version: agent.version });
  }

  unregister(name: string): void {
    if (this.agents.delete(name)) {
      logger.info(`Unregistered agent: ${name}`);
    }
  }

  get(name: string): CodeAnalysisAgent | undefined {
    return this.agents.get(name);
  }

  getAll(): CodeAnalysisAgent[] {
    return Array.from(this.agents.values());
  }

  getByCapability(capability: keyof import('../types.js').AgentCapabilities): CodeAnalysisAgent[] {
    return this.getAll().filter(agent => {
      const cap = agent.capabilities[capability];
      return Array.isArray(cap) ? cap.length > 0 : Boolean(cap);
    });
  }
}

/**
 * Coordinator for orchestrating multiple analysis agents
 */
export class AgentCoordinator {
  private registry: AgentRegistry;

  constructor(registry?: AgentRegistry) {
    this.registry = registry || new DefaultAgentRegistry();
  }

  /**
   * Register an agent with the coordinator
   */
  registerAgent(agent: CodeAnalysisAgent): void {
    this.registry.register(agent);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(name: string): void {
    this.registry.unregister(name);
  }

  /**
   * Get all registered agents
   */
  getAgents(): CodeAnalysisAgent[] {
    return this.registry.getAll();
  }

  /**
   * Get agent by name
   */
  getAgent(name: string): CodeAnalysisAgent | undefined {
    return this.registry.get(name);
  }

  /**
   * Coordinate analysis across multiple agents
   */
  async coordinate(request: CoordinationRequest): Promise<CoordinationResult> {
    const startTime = performance.now();
    
    try {
      logger.info('Starting coordinated analysis', {
        target: request.target,
        requestedAgents: request.agents,
        parallel: request.parallel
      });

      // Determine which agents to use
      const agentsToUse = this.selectAgents(request);
      
      if (agentsToUse.length === 0) {
        throw new Error('No suitable agents found for the analysis target');
      }

      // Configure agents if global config provided
      if (request.config) {
        agentsToUse.forEach(agent => {
          agent.configure(request.config!);
        });
      }

      // Run analysis
      const reports = request.parallel 
        ? await this.runParallelAnalysis(agentsToUse, request)
        : await this.runSequentialAnalysis(agentsToUse, request);

      // Consolidate findings
      const consolidatedFindings = this.consolidateFindings(reports);

      // Generate summary
      const summary = this.generateCoordinationSummary(reports, consolidatedFindings);

      const totalDuration = performance.now() - startTime;

      logger.info('Coordinated analysis completed', {
        agentsUsed: agentsToUse.map(a => a.name),
        totalFindings: consolidatedFindings.length,
        duration: totalDuration
      });

      return {
        reports,
        consolidatedFindings,
        summary: {
          ...summary,
          totalDuration
        }
      };

    } catch (error) {
      logger.error('Coordinated analysis failed', {
        error: error instanceof Error ? error.message : String(error),
        target: request.target
      });

      return {
        reports: [],
        consolidatedFindings: [],
        summary: {
          totalFindings: 0,
          findingsBySeverity: {} as Record<Severity, number>,
          findingsByCategory: {} as Record<FindingCategory, number>,
          agentsUsed: [],
          totalDuration: performance.now() - startTime
        },
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Select agents for the coordination request
   */
  private selectAgents(request: CoordinationRequest): CodeAnalysisAgent[] {
    const allAgents = this.registry.getAll();

    // If specific agents requested, use those
    if (request.agents && request.agents.length > 0) {
      return request.agents
        .map(name => this.registry.get(name))
        .filter((agent): agent is CodeAnalysisAgent => {
          if (!agent) {
            logger.warn(`Requested agent not found: ${name}`);
            return false;
          }
          return agent.canAnalyze(request.target);
        });
    }

    // Otherwise, use all agents that can analyze the target
    return allAgents.filter(agent => 
      agent.canAnalyze(request.target) && 
      agent.getConfig().enabled
    );
  }

  /**
   * Run analysis in parallel
   */
  private async runParallelAnalysis(
    agents: CodeAnalysisAgent[], 
    request: CoordinationRequest
  ): Promise<AnalysisReport[]> {
    const timeout = request.timeout || 300000; // 5 minutes default

    const analysisPromises = agents.map(async (agent) => {
      try {
        return await this.withTimeout(
          agent.analyze(request.target),
          timeout,
          `Agent ${agent.name} timed out`
        );
      } catch (error) {
        logger.error(`Agent ${agent.name} failed`, {
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Return empty report for failed agent
        return {
          agentName: agent.name,
          agentVersion: agent.version,
          target: request.target,
          startTime: new Date(),
          endTime: new Date(),
          duration: 0,
          findings: [],
          summary: {
            totalFindings: 0,
            findingsBySeverity: {} as Record<Severity, number>,
            findingsByCategory: {} as Record<FindingCategory, number>,
            filesAnalyzed: 0,
            linesAnalyzed: 0
          },
          config: agent.getConfig(),
          errors: [error instanceof Error ? error.message : String(error)]
        };
      }
    });

    return await Promise.all(analysisPromises);
  }

  /**
   * Run analysis sequentially
   */
  private async runSequentialAnalysis(
    agents: CodeAnalysisAgent[], 
    request: CoordinationRequest
  ): Promise<AnalysisReport[]> {
    const reports: AnalysisReport[] = [];
    const timeout = request.timeout || 300000; // 5 minutes default

    for (const agent of agents) {
      try {
        logger.debug(`Running analysis with ${agent.name}`);
        
        const report = await this.withTimeout(
          agent.analyze(request.target),
          timeout,
          `Agent ${agent.name} timed out`
        );
        
        reports.push(report);
      } catch (error) {
        logger.error(`Agent ${agent.name} failed`, {
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Continue with other agents even if one fails
        reports.push({
          agentName: agent.name,
          agentVersion: agent.version,
          target: request.target,
          startTime: new Date(),
          endTime: new Date(),
          duration: 0,
          findings: [],
          summary: {
            totalFindings: 0,
            findingsBySeverity: {} as Record<Severity, number>,
            findingsByCategory: {} as Record<FindingCategory, number>,
            filesAnalyzed: 0,
            linesAnalyzed: 0
          },
          config: agent.getConfig(),
          errors: [error instanceof Error ? error.message : String(error)]
        });
      }
    }

    return reports;
  }

  /**
   * Consolidate findings from multiple reports
   */
  private consolidateFindings(reports: AnalysisReport[]): Finding[] {
    const allFindings: Finding[] = [];
    const seenFindings = new Set<string>();

    for (const report of reports) {
      for (const finding of report.findings) {
        // Create a unique key for deduplication
        const key = this.createFindingKey(finding);
        
        if (!seenFindings.has(key)) {
          seenFindings.add(key);
          allFindings.push(finding);
        } else {
          // If we've seen this finding before, we might want to merge metadata
          const existingIndex = allFindings.findIndex(f => this.createFindingKey(f) === key);
          if (existingIndex >= 0) {
            const existing = allFindings[existingIndex];
            // Merge metadata from multiple agents
            if (finding.metadata && existing.metadata) {
              existing.metadata = { ...existing.metadata, ...finding.metadata };
            }
          }
        }
      }
    }

    // Sort by severity (critical first)
    const severityOrder = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO];
    allFindings.sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));

    return allFindings;
  }

  /**
   * Create a unique key for finding deduplication
   */
  private createFindingKey(finding: Finding): string {
    return `${finding.file}:${finding.line || 0}:${finding.column || 0}:${finding.category}:${finding.title}`;
  }

  /**
   * Generate coordination summary
   */
  private generateCoordinationSummary(
    reports: AnalysisReport[], 
    consolidatedFindings: Finding[]
  ) {
    const findingsBySeverity = {} as Record<Severity, number>;
    const findingsByCategory = {} as Record<FindingCategory, number>;

    // Initialize counters
    Object.values(Severity).forEach(severity => {
      findingsBySeverity[severity] = 0;
    });
    Object.values(FindingCategory).forEach(category => {
      findingsByCategory[category] = 0;
    });

    // Count consolidated findings
    consolidatedFindings.forEach(finding => {
      findingsBySeverity[finding.severity]++;
      findingsByCategory[finding.category]++;
    });

    return {
      totalFindings: consolidatedFindings.length,
      findingsBySeverity,
      findingsByCategory,
      agentsUsed: reports.map(r => r.agentName)
    };
  }

  /**
   * Utility method to add timeout to promises
   */
  private async withTimeout<T>(
    promise: Promise<T>, 
    timeoutMs: number, 
    timeoutMessage: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Get health status of all agents
   */
  async getAgentsHealth(): Promise<Record<string, import('../types.js').AgentHealth>> {
    const agents = this.registry.getAll();
    const healthPromises = agents.map(async (agent) => {
      try {
        const health = await agent.getHealth();
        return [agent.name, health] as const;
      } catch (error) {
        return [agent.name, {
          healthy: false,
          status: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
          lastCheck: new Date()
        }] as const;
      }
    });

    const healthResults = await Promise.all(healthPromises);
    return Object.fromEntries(healthResults);
  }

  /**
   * Run a quick health check on all agents
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    agentCount: number;
    healthyAgents: number;
    unhealthyAgents: string[];
  }> {
    const healthStatuses = await this.getAgentsHealth();
    const agents = Object.keys(healthStatuses);
    const healthyAgents = agents.filter(name => healthStatuses[name].healthy);
    const unhealthyAgents = agents.filter(name => !healthStatuses[name].healthy);

    return {
      healthy: unhealthyAgents.length === 0,
      agentCount: agents.length,
      healthyAgents: healthyAgents.length,
      unhealthyAgents
    };
  }
}