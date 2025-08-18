/**
 * Core types and interfaces for the code analysis agent system
 */

/**
 * Severity levels for analysis findings
 */
export enum Severity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Categories of analysis findings
 */
export enum FindingCategory {
  SYNTAX_ERROR = 'syntax_error',
  TYPE_ERROR = 'type_error',
  RUNTIME_ERROR = 'runtime_error',
  SECURITY_VULNERABILITY = 'security_vulnerability',
  PERFORMANCE_ISSUE = 'performance_issue',
  CODE_SMELL = 'code_smell',
  BEST_PRACTICE = 'best_practice',
  MAINTAINABILITY = 'maintainability',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
}

/**
 * Analysis target specification
 */
export interface AnalysisTarget {
  /** Target type */
  type: 'file' | 'directory' | 'project';
  /** Path to analyze */
  path: string;
  /** Include patterns (glob) */
  include?: string[];
  /** Exclude patterns (glob) */
  exclude?: string[];
  /** Analysis depth */
  depth?: 'shallow' | 'deep' | 'comprehensive';
}

/**
 * Individual finding from analysis
 */
export interface Finding {
  /** Unique identifier for this finding */
  id: string;
  /** Severity level */
  severity: Severity;
  /** Category of the finding */
  category: FindingCategory;
  /** Human-readable title */
  title: string;
  /** Detailed description */
  description: string;
  /** File path where finding was detected */
  file: string;
  /** Line number (1-based) */
  line?: number;
  /** Column number (1-based) */
  column?: number;
  /** Code snippet showing the issue */
  snippet?: string;
  /** Suggested fix or remediation */
  suggestion?: string;
  /** Rule or check that generated this finding */
  rule?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Analysis report from an agent
 */
export interface AnalysisReport {
  /** Agent that generated this report */
  agentName: string;
  /** Agent version */
  agentVersion: string;
  /** Analysis target */
  target: AnalysisTarget;
  /** Timestamp when analysis started */
  startTime: Date;
  /** Timestamp when analysis completed */
  endTime: Date;
  /** Duration in milliseconds */
  duration: number;
  /** Analysis findings */
  findings: Finding[];
  /** Summary statistics */
  summary: {
    totalFindings: number;
    findingsBySeverity: Record<Severity, number>;
    findingsByCategory: Record<FindingCategory, number>;
    filesAnalyzed: number;
    linesAnalyzed: number;
  };
  /** Analysis configuration used */
  config: AgentConfig;
  /** Any errors encountered during analysis */
  errors?: string[];
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Configuration for agents
 */
export interface AgentConfig {
  /** Enable/disable the agent */
  enabled: boolean;
  /** Analysis depth */
  depth: 'shallow' | 'deep' | 'comprehensive';
  /** Maximum number of findings to report */
  maxFindings?: number;
  /** Minimum severity to report */
  minSeverity?: Severity;
  /** Categories to include */
  includeCategories?: FindingCategory[];
  /** Categories to exclude */
  excludeCategories?: FindingCategory[];
  /** Custom rules or patterns */
  customRules?: Record<string, any>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Enable caching */
  enableCache?: boolean;
  /** Additional agent-specific configuration */
  [key: string]: any;
}

/**
 * Agent capabilities
 */
export interface AgentCapabilities {
  /** Supported file types */
  supportedFileTypes: string[];
  /** Supported analysis types */
  analysisTypes: FindingCategory[];
  /** Whether agent can suggest fixes */
  canSuggestFixes: boolean;
  /** Whether agent can generate tests */
  canGenerateTests: boolean;
  /** Whether agent supports incremental analysis */
  supportsIncremental: boolean;
  /** Performance characteristics */
  performance: {
    /** Typical analysis speed (files per second) */
    speed: 'fast' | 'medium' | 'slow';
    /** Memory usage */
    memoryUsage: 'low' | 'medium' | 'high';
    /** CPU usage */
    cpuUsage: 'low' | 'medium' | 'high';
  };
}

/**
 * Base interface for all code analysis agents
 */
export interface CodeAnalysisAgent {
  /** Agent name */
  readonly name: string;
  /** Agent version */
  readonly version: string;
  /** Agent description */
  readonly description: string;
  /** Agent capabilities */
  readonly capabilities: AgentCapabilities;

  /**
   * Configure the agent
   */
  configure(config: Partial<AgentConfig>): void;

  /**
   * Get current configuration
   */
  getConfig(): AgentConfig;

  /**
   * Analyze the specified target
   */
  analyze(target: AnalysisTarget): Promise<AnalysisReport>;

  /**
   * Validate if the agent can analyze the given target
   */
  canAnalyze(target: AnalysisTarget): boolean;

  /**
   * Get health status of the agent
   */
  getHealth(): Promise<AgentHealth>;
}

/**
 * Agent health status
 */
export interface AgentHealth {
  /** Whether agent is healthy */
  healthy: boolean;
  /** Status message */
  status: string;
  /** Last check timestamp */
  lastCheck: Date;
  /** Performance metrics */
  metrics?: {
    /** Average analysis time */
    avgAnalysisTime: number;
    /** Success rate */
    successRate: number;
    /** Memory usage */
    memoryUsage: number;
  };
}

/**
 * Coordination request for multiple agents
 */
export interface CoordinationRequest {
  /** Target to analyze */
  target: AnalysisTarget;
  /** Agents to use (empty = all available) */
  agents?: string[];
  /** Global configuration overrides */
  config?: Partial<AgentConfig>;
  /** Whether to run agents in parallel */
  parallel?: boolean;
  /** Maximum time to wait for all agents */
  timeout?: number;
}

/**
 * Coordination result
 */
export interface CoordinationResult {
  /** Individual agent reports */
  reports: AnalysisReport[];
  /** Consolidated findings */
  consolidatedFindings: Finding[];
  /** Overall summary */
  summary: {
    totalFindings: number;
    findingsBySeverity: Record<Severity, number>;
    findingsByCategory: Record<FindingCategory, number>;
    agentsUsed: string[];
    totalDuration: number;
  };
  /** Any coordination errors */
  errors?: string[];
}

/**
 * Test generation request
 */
export interface TestGenerationRequest {
  /** Target file or function to generate tests for */
  target: string;
  /** Type of tests to generate */
  testType: 'unit' | 'integration' | 'e2e';
  /** Test framework to use */
  framework?: 'vitest' | 'jest' | 'mocha';
  /** Coverage requirements */
  coverage?: {
    /** Minimum line coverage percentage */
    lines?: number;
    /** Minimum function coverage percentage */
    functions?: number;
    /** Minimum branch coverage percentage */
    branches?: number;
  };
  /** Additional test configuration */
  config?: Record<string, any>;
}

/**
 * Generated test result
 */
export interface GeneratedTest {
  /** Test file path */
  filePath: string;
  /** Test content */
  content: string;
  /** Test metadata */
  metadata: {
    /** Framework used */
    framework: string;
    /** Number of test cases */
    testCases: number;
    /** Coverage targets */
    coverage: Record<string, number>;
    /** Dependencies required */
    dependencies: string[];
  };
}

/**
 * Fix suggestion
 */
export interface FixSuggestion {
  /** Finding ID this fix addresses */
  findingId: string;
  /** Fix description */
  description: string;
  /** Confidence level */
  confidence: 'low' | 'medium' | 'high';
  /** Type of fix */
  type: 'automatic' | 'manual' | 'refactor';
  /** Code changes */
  changes: {
    /** File to modify */
    file: string;
    /** Line range to replace */
    range: {
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
    /** New content */
    newContent: string;
    /** Original content */
    originalContent: string;
  }[];
  /** Additional notes */
  notes?: string;
}

/**
 * Agent registry interface
 */
export interface AgentRegistry {
  /** Register an agent */
  register(agent: CodeAnalysisAgent): void;

  /** Unregister an agent */
  unregister(name: string): void;

  /** Get agent by name */
  get(name: string): CodeAnalysisAgent | undefined;

  /** Get all registered agents */
  getAll(): CodeAnalysisAgent[];

  /** Get agents by capability */
  getByCapability(capability: keyof AgentCapabilities): CodeAnalysisAgent[];
}
