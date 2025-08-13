/**
 * Agents System - Main exports
 */

// Core types and interfaces
export * from './types.js';

// Base coordinator
export * from './base/coordinator.js';

// Analysis agents
export * from './analysis/static-analysis.js';

// Reporting
export * from './reporting/report-generator.js';

// Re-export commonly used items
export {
  BaseAgent,
  Severity,
  FindingCategory,
  type AnalysisContext,
  type AnalysisReport,
  type CoordinationResult,
  type Finding
} from './types.js';

export {
  AgentCoordinator,
  defaultCoordinator
} from './base/coordinator.js';

export {
  StaticAnalysisAgent
} from './analysis/static-analysis.js';

export {
  ReportGenerator,
  createReportGenerator,
  generateAnalysisReport,
  type ReportOptions
} from './reporting/report-generator.js';