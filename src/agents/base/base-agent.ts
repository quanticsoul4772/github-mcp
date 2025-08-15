import { BaseAgent, AnalysisContext, AnalysisResult, AgentConfiguration, Finding } from '../types/agent-interfaces.js';

/**
 * Abstract base class for all analysis agents
 */
export abstract class AbstractBaseAgent implements BaseAgent {
  public abstract readonly name: string;
  public abstract readonly version: string;
  public abstract readonly description: string;

  /**
   * Analyze the given context and return results
   */
  public abstract analyze(context: AnalysisContext): Promise<AnalysisResult>;

  /**
   * Check if this agent can handle the given file type
   */
  public abstract canHandle(fileType: string): boolean;

  /**
   * Get list of other agents this agent depends on
   */
  public getDependencies(): string[] {
    return [];
  }

  /**
   * Get execution priority (lower numbers run first)
   */
  public getPriority(): number {
    return 100; // Default priority
  }

  /**
   * Validate configuration for this agent
   */
  public validateConfiguration(config: AgentConfiguration): boolean {
    return config && typeof config.enabled === 'boolean' && 
           typeof config.priority === 'number' && 
           typeof config.timeout === 'number';
  }

  /**
   * Get default configuration for this agent
   */
  public getDefaultConfiguration(): AgentConfiguration {
    return {
      enabled: true,
      priority: this.getPriority(),
      timeout: 30000, // 30 seconds
      options: {}
    };
  }

  /**
   * Create a standardized analysis result
   */
  protected createResult(
    status: 'success' | 'warning' | 'error',
    findings: Finding[] = [],
    metrics?: Record<string, number>,
    recommendations?: string[]
  ): AnalysisResult {
    return {
      agentName: this.name,
      timestamp: new Date(),
      status,
      findings,
      metrics,
      recommendations,
      filesAnalyzed: findings.filter(f => f.file).length
    };
  }

  /**
   * Create a standardized finding
   */
  protected createFinding(
    severity: Finding['severity'],
    category: string,
    message: string,
    options: Partial<Finding> = {}
  ): Finding {
    return {
      id: this.generateFindingId(),
      severity,
      category,
      message,
      ...options
    };
  }

  /**
   * Generate a unique finding ID
   */
  private generateFindingId(): string {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Filter files based on patterns and agent capabilities
   */
  protected filterFiles(files: string[], context: AnalysisContext): string[] {
    let filteredFiles = files.filter(file => this.canHandle(this.getFileExtension(file)));

    // Apply exclude patterns
    if (context.excludePatterns) {
      filteredFiles = filteredFiles.filter(file => 
        !context.excludePatterns!.some(pattern => 
          new RegExp(pattern).test(file)
        )
      );
    }

    // Apply target files filter
    if (context.targetFiles && context.targetFiles.length > 0) {
      filteredFiles = filteredFiles.filter(file => 
        context.targetFiles!.includes(file)
      );
    }

    return filteredFiles;
  }

  /**
   * Get file extension from file path
   */
  protected getFileExtension(filePath: string): string {
    const parts = filePath.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  /**
   * Check if a file exists and is readable
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
   * Read file content safely
   */
  protected async readFile(filePath: string): Promise<string | null> {
    try {
      const fs = await import('fs/promises');
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      console.warn(`Failed to read file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get relative path from project root
   */
  protected async getRelativePath(filePath: string, projectPath: string): Promise<string> {
    const path = await import('path');
    return path.relative(projectPath, filePath);
  }

  /**
   * Log agent activity
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${this.name}] ${message}`;
    
    switch (level) {
      case 'info':
        console.log(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      case 'error':
        console.error(logMessage, data || '');
        break;
    }
  }
}