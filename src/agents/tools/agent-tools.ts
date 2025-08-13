/**
 * Agent Tools - Integration with GitHub MCP Server
 * 
 * This module provides tools that can be used by the MCP server
 * to expose agent functionality to clients.
 */

import { ToolConfig } from '../../types.js';
import { logger } from '../../logger.js';
import {
  AgentCoordinator,
  StaticAnalysisAgent,
  ReportGenerator,
  AnalysisContext,
  Severity,
  FindingCategory,
  type ReportOptions
} from '../index.js';

// Global coordinator instance
const globalCoordinator = new AgentCoordinator({
  maxConcurrency: 2,
  timeout: 300000, // 5 minutes
  retries: 1,
  failFast: false,
  deduplication: true
});

// Register default agents
const staticAnalysisAgent = new StaticAnalysisAgent();
globalCoordinator.registerAgent(staticAnalysisAgent);

/**
 * Create agent-related tools for the MCP server
 */
export function createAgentTools(): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // Tool: Run code analysis
  tools.push({
    tool: {
      name: 'run_code_analysis',
      description: 'Run code analysis on a repository or specific files using multiple agents',
      inputSchema: {
        type: 'object',
        properties: {
          repositoryPath: {
            type: 'string',
            description: 'Path to the repository or directory to analyze'
          },
          files: {
            type: 'array',
            description: 'Specific files to analyze (optional)',
            items: { type: 'string' }
          },
          excludePatterns: {
            type: 'array',
            description: 'Patterns to exclude from analysis',
            items: { type: 'string' }
          },
          includePatterns: {
            type: 'array',
            description: 'Patterns to include in analysis',
            items: { type: 'string' }
          },
          maxFileSize: {
            type: 'number',
            description: 'Maximum file size to analyze in bytes'
          },
          agents: {
            type: 'array',
            description: 'Specific agents to run (optional, runs all if not specified)',
            items: { type: 'string' }
          }
        },
        required: ['repositoryPath']
      }
    },
    handler: async (args: any) => {
      try {
        logger.info('Running code analysis', { args });

        const context: AnalysisContext = {
          repositoryPath: args.repositoryPath,
          files: args.files,
          excludePatterns: args.excludePatterns,
          includePatterns: args.includePatterns,
          maxFileSize: args.maxFileSize,
          timeout: 60000 // 1 minute per file
        };

        let result;
        if (args.agents && args.agents.length > 0) {
          result = await globalCoordinator.runAgents(args.agents, context);
        } else {
          result = await globalCoordinator.runAnalysis(context);
        }

        return {
          success: true,
          summary: result.summary,
          reports: result.reports.map(r => ({
            agentName: r.agentName,
            version: r.version,
            summary: r.summary,
            findingsCount: r.findings.length
          })),
          consolidatedFindings: result.consolidatedFindings.length,
          analysisTime: result.summary.totalDuration
        };

      } catch (error) {
        logger.error('Code analysis failed', { error });
        return {
          success: false,
          error: (error as Error).message
        };
      }
    }
  });

  // Tool: Generate analysis report
  tools.push({
    tool: {
      name: 'generate_analysis_report',
      description: 'Generate a formatted report from analysis results',
      inputSchema: {
        type: 'object',
        properties: {
          repositoryPath: {
            type: 'string',
            description: 'Path to the repository to analyze'
          },
          format: {
            type: 'string',
            description: 'Report format',
            enum: ['json', 'markdown', 'html', 'console', 'csv']
          },
          outputPath: {
            type: 'string',
            description: 'Path to save the report (optional)'
          },
          includeDetails: {
            type: 'boolean',
            description: 'Include detailed findings in the report'
          },
          groupBy: {
            type: 'string',
            description: 'Group findings by',
            enum: ['severity', 'category', 'file']
          },
          sortBy: {
            type: 'string',
            description: 'Sort findings by',
            enum: ['severity', 'category', 'file', 'line']
          },
          filterSeverity: {
            type: 'array',
            description: 'Filter by severity levels',
            items: {
              type: 'string',
              enum: ['critical', 'high', 'medium', 'low', 'info']
            }
          },
          filterCategory: {
            type: 'array',
            description: 'Filter by categories',
            items: {
              type: 'string',
              enum: [
                'security', 'performance', 'maintainability', 'reliability',
                'style', 'documentation', 'testing', 'accessibility',
                'compatibility', 'best_practices'
              ]
            }
          },
          includeRecommendations: {
            type: 'boolean',
            description: 'Include recommendations in the report'
          }
        },
        required: ['repositoryPath', 'format']
      }
    },
    handler: async (args: any) => {
      try {
        logger.info('Generating analysis report', { args });

        // First run the analysis
        const context: AnalysisContext = {
          repositoryPath: args.repositoryPath,
          timeout: 60000
        };

        const result = await globalCoordinator.runAnalysis(context);

        // Generate the report
        const reportGenerator = new ReportGenerator();
        const reportOptions: ReportOptions = {
          format: args.format,
          outputPath: args.outputPath,
          includeDetails: args.includeDetails ?? true,
          groupBy: args.groupBy,
          sortBy: args.sortBy,
          filterSeverity: args.filterSeverity,
          filterCategory: args.filterCategory,
          includeRecommendations: args.includeRecommendations ?? true
        };

        const report = await reportGenerator.generateReport(result, reportOptions);

        return {
          success: true,
          report: args.outputPath ? `Report saved to ${args.outputPath}` : report,
          summary: result.summary,
          findingsCount: result.consolidatedFindings.length,
          ...(args.outputPath && { filePath: args.outputPath })
        };

      } catch (error) {
        logger.error('Report generation failed', { error });
        return {
          success: false,
          error: (error as Error).message
        };
      }
    }
  });

  // Tool: List available agents
  tools.push({
    tool: {
      name: 'list_analysis_agents',
      description: 'List all available analysis agents and their capabilities',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      try {
        const agents = globalCoordinator.getRegisteredAgents();
        const capabilities = globalCoordinator.getAllCapabilities();

        return {
          success: true,
          agents: agents.map(agentName => ({
            name: agentName,
            capabilities: capabilities[agentName]
          }))
        };

      } catch (error) {
        logger.error('Failed to list agents', { error });
        return {
          success: false,
          error: (error as Error).message
        };
      }
    }
  });

  // Tool: Get analysis summary
  tools.push({
    tool: {
      name: 'get_analysis_summary',
      description: 'Get a quick summary of code analysis results',
      inputSchema: {
        type: 'object',
        properties: {
          repositoryPath: {
            type: 'string',
            description: 'Path to the repository to analyze'
          },
          focusArea: {
            type: 'string',
            description: 'Focus on specific area',
            enum: ['security', 'performance', 'maintainability', 'all']
          }
        },
        required: ['repositoryPath']
      }
    },
    handler: async (args: any) => {
      try {
        logger.info('Getting analysis summary', { args });

        const context: AnalysisContext = {
          repositoryPath: args.repositoryPath,
          timeout: 30000 // Shorter timeout for summary
        };

        const result = await globalCoordinator.runAnalysis(context);

        // Filter findings based on focus area
        let findings = result.consolidatedFindings;
        if (args.focusArea && args.focusArea !== 'all') {
          const categoryMap: Record<string, FindingCategory[]> = {
            security: [FindingCategory.SECURITY],
            performance: [FindingCategory.PERFORMANCE],
            maintainability: [FindingCategory.MAINTAINABILITY, FindingCategory.RELIABILITY]
          };

          const categories = categoryMap[args.focusArea] || [];
          findings = findings.filter(f => categories.includes(f.category));
        }

        // Group by severity
        const severityGroups = findings.reduce((acc, finding) => {
          acc[finding.severity] = (acc[finding.severity] || 0) + 1;
          return acc;
        }, {} as Record<Severity, number>);

        // Get top issues
        const categoryGroups = findings.reduce((acc, finding) => {
          acc[finding.category] = (acc[finding.category] || 0) + 1;
          return acc;
        }, {} as Record<FindingCategory, number>);

        const topIssues = Object.entries(categoryGroups)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([category, count]) => ({ category, count }));

        return {
          success: true,
          summary: {
            totalFindings: findings.length,
            filesAnalyzed: result.summary.agentsUsed.length > 0 ? result.reports[0].summary.filesAnalyzed : 0,
            analysisTime: result.summary.totalDuration,
            severityBreakdown: severityGroups,
            topIssues,
            focusArea: args.focusArea || 'all'
          },
          recommendations: findings.length > 0 ? [
            findings.filter(f => f.severity === Severity.CRITICAL).length > 0 
              ? 'Address critical security issues immediately'
              : null,
            findings.filter(f => f.severity === Severity.HIGH).length > 5
              ? 'Consider prioritizing high-severity issues'
              : null,
            findings.length > 50
              ? 'Large number of findings - consider focusing on specific categories'
              : null
          ].filter(Boolean) : ['No issues found - great job!']
        };

      } catch (error) {
        logger.error('Failed to get analysis summary', { error });
        return {
          success: false,
          error: (error as Error).message
        };
      }
    }
  });

  // Tool: Run security-focused analysis
  tools.push({
    tool: {
      name: 'run_security_analysis',
      description: 'Run analysis focused specifically on security issues',
      inputSchema: {
        type: 'object',
        properties: {
          repositoryPath: {
            type: 'string',
            description: 'Path to the repository to analyze'
          },
          includePatterns: {
            type: 'array',
            description: 'File patterns to include',
            items: { type: 'string' }
          },
          excludePatterns: {
            type: 'array',
            description: 'File patterns to exclude',
            items: { type: 'string' }
          }
        },
        required: ['repositoryPath']
      }
    },
    handler: async (args: any) => {
      try {
        logger.info('Running security analysis', { args });

        const context: AnalysisContext = {
          repositoryPath: args.repositoryPath,
          includePatterns: args.includePatterns || ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
          excludePatterns: args.excludePatterns || ['*.test.ts', '*.spec.ts', 'node_modules'],
          timeout: 60000
        };

        const result = await globalCoordinator.runAnalysis(context);

        // Filter for security findings only
        const securityFindings = result.consolidatedFindings.filter(
          finding => finding.category === FindingCategory.SECURITY
        );

        // Group by severity
        const severityGroups = securityFindings.reduce((acc, finding) => {
          acc[finding.severity] = (acc[finding.severity] || 0) + 1;
          return acc;
        }, {} as Record<Severity, number>);

        return {
          success: true,
          securitySummary: {
            totalSecurityIssues: securityFindings.length,
            criticalIssues: severityGroups[Severity.CRITICAL] || 0,
            highIssues: severityGroups[Severity.HIGH] || 0,
            mediumIssues: severityGroups[Severity.MEDIUM] || 0,
            lowIssues: severityGroups[Severity.LOW] || 0
          },
          findings: securityFindings.map(finding => ({
            id: finding.id,
            severity: finding.severity,
            title: finding.title,
            description: finding.description,
            file: finding.file,
            line: finding.line,
            rule: finding.rule,
            suggestion: finding.suggestion
          })),
          recommendations: securityFindings.length > 0 ? [
            'Review and fix all critical and high severity security issues',
            'Consider implementing automated security scanning in your CI/CD pipeline',
            'Regular security audits and code reviews are recommended'
          ] : [
            'No security issues detected in the analyzed code',
            'Continue following secure coding practices'
          ]
        };

      } catch (error) {
        logger.error('Security analysis failed', { error });
        return {
          success: false,
          error: (error as Error).message
        };
      }
    }
  });

  return tools;
}

/**
 * Get the global coordinator instance
 */
export function getGlobalCoordinator(): AgentCoordinator {
  return globalCoordinator;
}

/**
 * Register a new agent with the global coordinator
 */
export function registerGlobalAgent(agent: any, config?: any): void {
  globalCoordinator.registerAgent(agent, config);
}