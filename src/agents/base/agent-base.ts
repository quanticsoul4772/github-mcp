/**
 * Base class for all code analysis agents
 */

import { 
  CodeAnalysisAgent, 
  AgentConfig, 
  AnalysisTarget, 
  AnalysisReport, 
  AgentHealth,
  AgentCapabilities,
  Severity,
  FindingCategory,
  Finding
} from '../types.js';
import { logger } from '../../logger.js';
import { performance } from 'perf_hooks';

/**
 * Default agent configuration
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabled: true,
  depth: 'deep',
  maxFindings: 1000,
  minSeverity: Severity.INFO,
  includeCategories: Object.values(FindingCategory),
  excludeCategories: [],
  customRules: {},
  timeout: 300000, // 5 minutes
  enableCache: true
};

/**
 * Base implementation for code analysis agents
 */
export abstract class BaseAgent implements CodeAnalysisAgent {
  protected config: AgentConfig;
  protected lastHealth: AgentHealth;
  protected analysisCount: number = 0;
  protected totalAnalysisTime: number = 0;
  protected successCount: number = 0;

  constructor(
    public readonly name: string,
    public readonly version: string,
    public readonly description: string,
    public readonly capabilities: AgentCapabilities,
    initialConfig?: Partial<AgentConfig>
  ) {
    this.config = { ...DEFAULT_AGENT_CONFIG, ...initialConfig };
    this.lastHealth = {
      healthy: true,
      status: 'Initialized',
      lastCheck: new Date()
    };
  }

  /**
   * Configure the agent
   */
  configure(config: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug(`Agent ${this.name} configured`, { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Analyze the specified target
   */
  async analyze(target: AnalysisTarget): Promise<AnalysisReport> {
    const startTime = new Date();
    const perfStart = performance.now();

    try {
      // Validate target
      if (!this.canAnalyze(target)) {
        throw new Error(`Agent ${this.name} cannot analyze target: ${target.path}`);
      }

      // Check if agent is enabled
      if (!this.config.enabled) {
        throw new Error(`Agent ${this.name} is disabled`);
      }

      logger.info(`Starting analysis with ${this.name}`, { target });

      // Perform the actual analysis (implemented by subclasses)
      const findings = await this.performAnalysis(target);

      // Filter findings based on configuration
      const filteredFindings = this.filterFindings(findings);

      const endTime = new Date();
      const duration = performance.now() - perfStart;

      // Update metrics
      this.analysisCount++;
      this.totalAnalysisTime += duration;
      this.successCount++;

      // Create report
      const report: AnalysisReport = {
        agentName: this.name,
        agentVersion: this.version,
        target,
        startTime,
        endTime,
        duration,
        findings: filteredFindings,
        summary: this.generateSummary(filteredFindings, target),
        config: this.config
      };

      logger.info(`Analysis completed by ${this.name}`, {
        duration,
        findingsCount: filteredFindings.length,
        target: target.path
      });

      return report;

    } catch (error) {
      const endTime = new Date();
      const duration = performance.now() - perfStart;

      this.analysisCount++;
      this.totalAnalysisTime += duration;

      logger.error(`Analysis failed in ${this.name}`, {
        error: error instanceof Error ? error.message : String(error),
        target: target.path,
        duration
      });

      // Return error report
      return {
        agentName: this.name,
        agentVersion: this.version,
        target,
        startTime,
        endTime,
        duration,
        findings: [],
        summary: {
          totalFindings: 0,
          findingsBySeverity: {} as Record<Severity, number>,
          findingsByCategory: {} as Record<FindingCategory, number>,
          filesAnalyzed: 0,
          linesAnalyzed: 0
        },
        config: this.config,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Validate if the agent can analyze the given target
   */
  canAnalyze(target: AnalysisTarget): boolean {
    // Basic validation - subclasses can override for more specific checks
    if (!target.path) {
      return false;
    }

    // Check if target type is supported
    if (target.type === 'file') {
      const extension = target.path.split('.').pop()?.toLowerCase();
      return extension ? this.capabilities.supportedFileTypes.includes(extension) : false;
    }

    return true;
  }

  /**
   * Get health status of the agent
   */
  async getHealth(): Promise<AgentHealth> {
    try {
      const now = new Date();
      const avgAnalysisTime = this.analysisCount > 0 ? this.totalAnalysisTime / this.analysisCount : 0;
      const successRate = this.analysisCount > 0 ? this.successCount / this.analysisCount : 1;

      // Perform health check (can be overridden by subclasses)
      const isHealthy = await this.performHealthCheck();

      this.lastHealth = {
        healthy: isHealthy,
        status: isHealthy ? 'Healthy' : 'Unhealthy',
        lastCheck: now,
        metrics: {
          avgAnalysisTime,
          successRate,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };

      return this.lastHealth;
    } catch (error) {
      this.lastHealth = {
        healthy: false,
        status: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: new Date()
      };
      return this.lastHealth;
    }
  }

  /**
   * Abstract method for performing the actual analysis
   * Must be implemented by subclasses
   */
  protected abstract performAnalysis(target: AnalysisTarget): Promise<Finding[]>;

  /**
   * Perform health check - can be overridden by subclasses
   */
  protected async performHealthCheck(): Promise<boolean> {
    // Default implementation - just check if agent is enabled
    return this.config.enabled;
  }

  /**
   * Filter findings based on agent configuration
   */
  protected filterFindings(findings: Finding[]): Finding[] {
    let filtered = findings;

    // Filter by severity
    if (this.config.minSeverity) {
      const severityOrder = [Severity.INFO, Severity.LOW, Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL];
      const minIndex = severityOrder.indexOf(this.config.minSeverity);
      filtered = filtered.filter(f => severityOrder.indexOf(f.severity) >= minIndex);
    }

    // Filter by categories
    if (this.config.includeCategories && this.config.includeCategories.length > 0) {
      filtered = filtered.filter(f => this.config.includeCategories!.includes(f.category));
    }

    if (this.config.excludeCategories && this.config.excludeCategories.length > 0) {
      filtered = filtered.filter(f => !this.config.excludeCategories!.includes(f.category));
    }

    // Limit number of findings
    if (this.config.maxFindings && filtered.length > this.config.maxFindings) {
      // Sort by severity (critical first) and take top N
      const severityOrder = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO];
      filtered.sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));
      filtered = filtered.slice(0, this.config.maxFindings);
    }

    return filtered;
  }

  /**
   * Generate summary statistics for findings
   */
  protected generateSummary(findings: Finding[], target: AnalysisTarget): AnalysisReport['summary'] {
    const findingsBySeverity = {} as Record<Severity, number>;
    const findingsByCategory = {} as Record<FindingCategory, number>;

    // Initialize counters
    Object.values(Severity).forEach(severity => {
      findingsBySeverity[severity] = 0;
    });
    Object.values(FindingCategory).forEach(category => {
      findingsByCategory[category] = 0;
    });

    // Count findings
    findings.forEach(finding => {
      findingsBySeverity[finding.severity]++;
      findingsByCategory[finding.category]++;
    });

    return {
      totalFindings: findings.length,
      findingsBySeverity,
      findingsByCategory,
      filesAnalyzed: this.countFilesAnalyzed(target),
      linesAnalyzed: 0 // Will be updated by subclasses if they track this
    };
  }

  /**
   * Count files that would be analyzed for the given target
   */
  protected countFilesAnalyzed(target: AnalysisTarget): number {
    // Basic implementation - subclasses should override for accurate counting
    if (target.type === 'file') {
      return 1;
    }
    return 0; // Directory/project analysis should be counted by subclasses
  }

  /**
   * Create a finding with consistent ID generation
   */
  protected createFinding(
    severity: Severity,
    category: FindingCategory,
    title: string,
    description: string,
    file: string,
    line?: number,
    column?: number,
    snippet?: string,
    suggestion?: string,
    rule?: string,
    metadata?: Record<string, any>
  ): Finding {
    // Generate consistent ID based on content
    const id = this.generateFindingId(file, line, column, rule, title);

    return {
      id,
      severity,
      category,
      title,
      description,
      file,
      line,
      column,
      snippet,
      suggestion,
      rule,
      metadata
    };
  }

  /**
   * Generate a consistent ID for a finding
   */
  protected generateFindingId(
    file: string,
    line?: number,
    column?: number,
    rule?: string,
    title?: string
  ): string {
    const parts = [
      this.name,
      file,
      line?.toString() || '0',
      column?.toString() || '0',
      rule || 'unknown',
      title || 'finding'
    ];
    
    // Create a simple hash of the parts
    const content = parts.join('|');
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `${this.name}-${Math.abs(hash).toString(16)}`;
  }

  /**
   * Utility method to read file content safely
   */
  protected async readFileContent(filePath: string): Promise<string> {
    try {
      const fs = await import('fs/promises');
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      logger.error(`Failed to read file: ${filePath}`, { error });
      throw new Error(`Cannot read file: ${filePath}`);
    }
  }

  /**
   * Utility method to check if file exists
   */
  protected async fileExists(filePath: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Utility method to get file stats
   */
  protected async getFileStats(filePath: string) {
    try {
      const fs = await import('fs/promises');
      return await fs.stat(filePath);
    } catch (error) {
      logger.error(`Failed to get file stats: ${filePath}`, { error });
      return null;
    }
  }
}