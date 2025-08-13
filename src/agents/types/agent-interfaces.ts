/**
 * Core interfaces for the agent-based code analysis system
 */

export interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  rule?: string;
  fix?: string;
  evidence?: string;
  references?: string[];
}

export interface AnalysisResult {
  agentName: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error';
  findings: Finding[];
  metrics?: Record<string, number>;
  recommendations?: string[];
  executionTime?: number;
  filesAnalyzed?: number;
}

export interface GitContext {
  branch: string;
  commit: string;
  changedFiles: string[];
  author: string;
  timestamp: Date;
}

export interface AgentConfiguration {
  enabled: boolean;
  priority: number;
  timeout: number;
  options: Record<string, any>;
}

export interface AnalysisContext {
  projectPath: string;
  files: string[];
  previousResults?: Map<string, AnalysisResult>;
  configuration?: Map<string, AgentConfiguration>;
  gitContext?: GitContext;
  targetFiles?: string[];
  excludePatterns?: string[];
}

export interface BaseAgent {
  name: string;
  version: string;
  description: string;
  
  /**
   * Analyze the given context and return results
   */
  analyze(context: AnalysisContext): Promise<AnalysisResult>;
  
  /**
   * Check if this agent can handle the given file type
   */
  canHandle(fileType: string): boolean;
  
  /**
   * Get list of other agents this agent depends on
   */
  getDependencies(): string[];
  
  /**
   * Get execution priority (lower numbers run first)
   */
  getPriority(): number;
  
  /**
   * Validate configuration for this agent
   */
  validateConfiguration(config: AgentConfiguration): boolean;
  
  /**
   * Get default configuration for this agent
   */
  getDefaultConfiguration(): AgentConfiguration;
}

export interface AgentRegistry {
  register(agent: BaseAgent): void;
  unregister(agentName: string): void;
  getAgent(name: string): BaseAgent | undefined;
  getAllAgents(): BaseAgent[];
  getAgentsByPriority(): BaseAgent[];
}

export interface AnalysisReport {
  summary: {
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
    infoFindings: number;
    agentsRun: number;
    totalExecutionTime: number;
    filesAnalyzed: number;
  };
  agentResults: AnalysisResult[];
  findings: Finding[];
  recommendations: string[];
  timestamp: Date;
  projectPath: string;
  gitContext?: GitContext;
}

export interface AgentCoordinator {
  /**
   * Run analysis with all registered agents
   */
  runFullAnalysis(context: AnalysisContext): Promise<AnalysisReport>;
  
  /**
   * Run analysis with specific agents
   */
  runSelectedAgents(agentNames: string[], context: AnalysisContext): Promise<AnalysisReport>;
  
  /**
   * Run a single agent
   */
  runSingleAgent(agentName: string, context: AnalysisContext): Promise<AnalysisResult>;
  
  /**
   * Get analysis report from previous results
   */
  generateReport(results: AnalysisResult[], context: AnalysisContext): AnalysisReport;
}

export type AgentEventType = 'agent-start' | 'agent-complete' | 'agent-error' | 'analysis-start' | 'analysis-complete';

export interface AgentEvent {
  type: AgentEventType;
  agentName?: string;
  timestamp: Date;
  data?: any;
  error?: Error;
}

export interface AgentEventListener {
  (event: AgentEvent): void;
}