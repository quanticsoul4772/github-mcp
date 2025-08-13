/**
 * Core types and interfaces for the agent system
 */

export enum Severity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum FindingCategory {
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  MAINTAINABILITY = 'maintainability',
  RELIABILITY = 'reliability',
  STYLE = 'style',
  DOCUMENTATION = 'documentation',
  TESTING = 'testing',
  ACCESSIBILITY = 'accessibility',
  COMPATIBILITY = 'compatibility',
  BEST_PRACTICES = 'best_practices'
}

export interface Finding {
  id: string;
  severity: Severity;
  category: FindingCategory;
  title: string;
  description: string;
  file: string;
  line?: number;
  column?: number;
  rule?: string;
  snippet?: string;
  suggestion?: string;
  metadata?: Record<string, any>;
}

export interface AnalysisSummary {
  filesAnalyzed: number;
  totalFindings: number;
  findingsBySeverity: Record<Severity, number>;
  findingsByCategory: Record<FindingCategory, number>;
  duration: number;
  timestamp: Date;
}

export interface AnalysisReport {
  agentName: string;
  version: string;
  summary: AnalysisSummary;
  findings: Finding[];
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface CoordinationSummary {
  totalDuration: number;
  agentsUsed: string[];
  totalFindings: number;
  consolidatedFindings: number;
  duplicatesRemoved: number;
  timestamp: Date;
}

export interface CoordinationResult {
  summary: CoordinationSummary;
  reports: AnalysisReport[];
  consolidatedFindings: Finding[];
  timestamp: Date;
}

export interface AgentConfig {
  name: string;
  version: string;
  enabled: boolean;
  priority: number;
  timeout?: number;
  retries?: number;
  options?: Record<string, any>;
}

export interface AnalysisContext {
  repositoryPath: string;
  files?: string[];
  excludePatterns?: string[];
  includePatterns?: string[];
  maxFileSize?: number;
  timeout?: number;
  metadata?: Record<string, any>;
}

export interface AgentCapabilities {
  supportedFileTypes: string[];
  supportedLanguages: string[];
  categories: FindingCategory[];
  requiresNetwork: boolean;
  requiresFileSystem: boolean;
  canRunInParallel: boolean;
}

export abstract class BaseAgent {
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly capabilities: AgentCapabilities;

  abstract analyze(context: AnalysisContext): Promise<AnalysisReport>;
  
  protected createFinding(
    severity: Severity,
    category: FindingCategory,
    title: string,
    description: string,
    file: string,
    options?: {
      line?: number;
      column?: number;
      rule?: string;
      snippet?: string;
      suggestion?: string;
      metadata?: Record<string, any>;
    }
  ): Finding {
    return {
      id: this.generateFindingId(),
      severity,
      category,
      title,
      description,
      file,
      ...options
    };
  }

  private generateFindingId(): string {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}