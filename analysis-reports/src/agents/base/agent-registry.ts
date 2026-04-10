import { BaseAgent, AgentRegistry } from '../types/agent-interfaces.js';
import { logger } from '../../logger.js';

/**
 * Registry for managing analysis agents
 */
export class DefaultAgentRegistry implements AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map();

  /**
   * Register a new agent
   */
  public register(agent: BaseAgent): void {
    if (this.agents.has(agent.name)) {
      throw new Error(`Agent with name '${agent.name}' is already registered`);
    }

    this.agents.set(agent.name, agent);
    logger.info(`Registered agent: ${agent.name} v${agent.version}`);
  }

  /**
   * Unregister an agent
   */
  public unregister(agentName: string): void {
    if (!this.agents.has(agentName)) {
      throw new Error(`Agent with name '${agentName}' is not registered`);
    }

    this.agents.delete(agentName);
    logger.info(`Unregistered agent: ${agentName}`);
  }

  /**
   * Get a specific agent by name
   */
  public getAgent(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Get all registered agents
   */
  public getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents sorted by priority (lower numbers first)
   */
  public getAgentsByPriority(): BaseAgent[] {
    return this.getAllAgents().sort((a, b) => a.getPriority() - b.getPriority());
  }

  /**
   * Check if an agent is registered
   */
  public hasAgent(name: string): boolean {
    return this.agents.has(name);
  }

  /**
   * Get agent count
   */
  public getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Clear all agents
   */
  public clear(): void {
    this.agents.clear();
    logger.info('Cleared all agents from registry');
  }

  /**
   * Get agents that can handle a specific file type
   */
  public getAgentsForFileType(fileType: string): BaseAgent[] {
    return this.getAllAgents().filter(agent => agent.canHandle(fileType));
  }

  /**
   * Validate agent dependencies
   */
  public validateDependencies(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const agentNames = new Set(this.agents.keys());

    for (const agent of this.agents.values()) {
      const dependencies = agent.getDependencies();
      for (const dependency of dependencies) {
        if (!agentNames.has(dependency)) {
          errors.push(`Agent '${agent.name}' depends on '${dependency}' which is not registered`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get execution order based on dependencies and priorities
   */
  public getExecutionOrder(): BaseAgent[] {
    const agents = this.getAllAgents();
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: BaseAgent[] = [];

    const visit = (agent: BaseAgent): void => {
      if (visiting.has(agent.name)) {
        throw new Error(`Circular dependency detected involving agent '${agent.name}'`);
      }

      if (visited.has(agent.name)) {
        return;
      }

      visiting.add(agent.name);

      // Visit dependencies first
      for (const depName of agent.getDependencies()) {
        const depAgent = this.getAgent(depName);
        if (depAgent) {
          visit(depAgent);
        }
      }

      visiting.delete(agent.name);
      visited.add(agent.name);
      result.push(agent);
    };

    // Sort by priority first, then resolve dependencies
    const sortedAgents = agents.sort((a, b) => a.getPriority() - b.getPriority());

    for (const agent of sortedAgents) {
      visit(agent);
    }

    return result;
  }
}
