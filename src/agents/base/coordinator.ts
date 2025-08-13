/**
 * Agent Coordinator - Manages multiple analysis agents
 */

import { logger } from '../../logger.js';
import {
  BaseAgent,
  AnalysisContext,
  AnalysisReport,
  CoordinationResult,
  CoordinationSummary,
  Finding,
  Severity,
  FindingCategory,
  AgentConfig
} from '../types.js';

export interface CoordinatorConfig {
  maxConcurrency: number;
  timeout: number;
  retries: number;
  failFast: boolean;
  deduplication: boolean;
}

export class AgentCoordinator {
  private agents: Map<string, BaseAgent> = new Map();
  private config: CoordinatorConfig;

  constructor(config: Partial<CoordinatorConfig> = {}) {
    this.config = {
      maxConcurrency: 3,
      timeout: 300000, // 5 minutes
      retries: 2,
      failFast: false,
      deduplication: true,
      ...config
    };
  }

  /**
   * Register an agent with the coordinator
   */
  registerAgent(agent: BaseAgent, config?: AgentConfig): void {
    logger.info('Registering agent', { 
      name: agent.name, 
      version: agent.version,
      capabilities: agent.capabilities 
    });
    
    this.agents.set(agent.name, agent);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentName: string): boolean {
    const removed = this.agents.delete(agentName);
    if (removed) {
      logger.info('Unregistered agent', { name: agentName });
    }
    return removed;
  }

  /**
   * Get list of registered agents
   */
  getRegisteredAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Run analysis with all registered agents
   */
  async runAnalysis(context: AnalysisContext): Promise<CoordinationResult> {
    const startTime = Date.now();
    logger.info('Starting coordinated analysis', { 
      agentCount: this.agents.size,
      context: {
        repositoryPath: context.repositoryPath,
        fileCount: context.files?.length,
        excludePatterns: context.excludePatterns?.length,
        includePatterns: context.includePatterns?.length
      }
    });

    const reports: AnalysisReport[] = [];
    const errors: Array<{ agent: string; error: Error }> = [];

    // Run agents in batches based on concurrency limit
    const agentEntries = Array.from(this.agents.entries());
    const batches = this.createBatches(agentEntries, this.config.maxConcurrency);

    for (const batch of batches) {
      const batchPromises = batch.map(([name, agent]) => 
        this.runAgentWithRetry(agent, context, name)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const agentName = batch[i][0];

        if (result.status === 'fulfilled') {
          reports.push(result.value);
          logger.info('Agent completed successfully', { 
            agent: agentName,
            findingsCount: result.value.findings.length,
            duration: result.value.duration
          });
        } else {
          const error = result.reason as Error;
          errors.push({ agent: agentName, error });
          logger.error('Agent failed', { 
            agent: agentName, 
            error: error.message,
            stack: error.stack
          });

          if (this.config.failFast) {
            throw new Error(`Agent ${agentName} failed: ${error.message}`);
          }
        }
      }
    }

    // Consolidate findings
    const consolidatedFindings = this.config.deduplication 
      ? this.deduplicateFindings(reports)
      : this.mergeFindings(reports);

    const totalDuration = Date.now() - startTime;
    const summary: CoordinationSummary = {
      totalDuration,
      agentsUsed: reports.map(r => r.agentName),
      totalFindings: reports.reduce((sum, r) => sum + r.findings.length, 0),
      consolidatedFindings: consolidatedFindings.length,
      duplicatesRemoved: reports.reduce((sum, r) => sum + r.findings.length, 0) - consolidatedFindings.length,
      timestamp: new Date()
    };

    const result: CoordinationResult = {
      summary,
      reports,
      consolidatedFindings,
      timestamp: new Date()
    };

    logger.info('Coordinated analysis completed', {
      duration: totalDuration,
      agentsRun: reports.length,
      agentsFailed: errors.length,
      totalFindings: summary.totalFindings,
      consolidatedFindings: summary.consolidatedFindings,
      duplicatesRemoved: summary.duplicatesRemoved
    });

    if (errors.length > 0) {
      logger.warn('Some agents failed during analysis', {
        failedAgents: errors.map(e => ({ agent: e.agent, error: e.error.message }))
      });
    }

    return result;
  }

  /**
   * Run a specific agent by name
   */
  async runAgent(agentName: string, context: AnalysisContext): Promise<AnalysisReport> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent '${agentName}' not found`);
    }

    logger.info('Running single agent', { agent: agentName });
    return this.runAgentWithRetry(agent, context, agentName);
  }

  /**
   * Run multiple specific agents
   */
  async runAgents(agentNames: string[], context: AnalysisContext): Promise<CoordinationResult> {
    const startTime = Date.now();
    const selectedAgents = new Map<string, BaseAgent>();

    // Validate and collect agents
    for (const name of agentNames) {
      const agent = this.agents.get(name);
      if (!agent) {
        throw new Error(`Agent '${name}' not found`);
      }
      selectedAgents.set(name, agent);
    }

    logger.info('Running selected agents', { 
      agents: agentNames,
      count: selectedAgents.size 
    });

    // Temporarily replace agents map
    const originalAgents = this.agents;
    this.agents = selectedAgents;

    try {
      const result = await this.runAnalysis(context);
      return result;
    } finally {
      // Restore original agents map
      this.agents = originalAgents;
    }
  }

  /**
   * Get agent capabilities
   */
  getAgentCapabilities(agentName: string) {
    const agent = this.agents.get(agentName);
    return agent?.capabilities;
  }

  /**
   * Get all agent capabilities
   */
  getAllCapabilities() {
    const capabilities: Record<string, any> = {};
    for (const [name, agent] of this.agents) {
      capabilities[name] = agent.capabilities;
    }
    return capabilities;
  }

  private async runAgentWithRetry(
    agent: BaseAgent, 
    context: AnalysisContext, 
    agentName: string
  ): Promise<AnalysisReport> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.retries + 1; attempt++) {
      try {
        logger.debug('Running agent attempt', { 
          agent: agentName, 
          attempt, 
          maxAttempts: this.config.retries + 1 
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Agent ${agentName} timed out after ${this.config.timeout}ms`));
          }, this.config.timeout);
        });

        const analysisPromise = agent.analyze(context);
        const result = await Promise.race([analysisPromise, timeoutPromise]);
        
        logger.debug('Agent completed successfully', { 
          agent: agentName, 
          attempt,
          findingsCount: result.findings.length 
        });
        
        return result;
      } catch (error) {
        lastError = error as Error;
        logger.warn('Agent attempt failed', { 
          agent: agentName, 
          attempt, 
          error: lastError.message 
        });

        if (attempt < this.config.retries + 1) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`Agent ${agentName} failed after ${this.config.retries + 1} attempts`);
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private mergeFindings(reports: AnalysisReport[]): Finding[] {
    const allFindings: Finding[] = [];
    for (const report of reports) {
      allFindings.push(...report.findings);
    }
    return allFindings;
  }

  private deduplicateFindings(reports: AnalysisReport[]): Finding[] {
    const allFindings = this.mergeFindings(reports);
    const uniqueFindings = new Map<string, Finding>();

    for (const finding of allFindings) {
      // Create a key based on file, line, category, and title
      const key = `${finding.file}:${finding.line || 0}:${finding.category}:${finding.title}`;
      
      const existing = uniqueFindings.get(key);
      if (!existing) {
        uniqueFindings.set(key, finding);
      } else {
        // Keep the finding with higher severity
        if (this.getSeverityWeight(finding.severity) > this.getSeverityWeight(existing.severity)) {
          uniqueFindings.set(key, finding);
        }
      }
    }

    return Array.from(uniqueFindings.values());
  }

  private getSeverityWeight(severity: Severity): number {
    const weights = {
      [Severity.CRITICAL]: 5,
      [Severity.HIGH]: 4,
      [Severity.MEDIUM]: 3,
      [Severity.LOW]: 2,
      [Severity.INFO]: 1
    };
    return weights[severity] || 0;
  }
}

/**
 * Default coordinator instance
 */
export const defaultCoordinator = new AgentCoordinator();