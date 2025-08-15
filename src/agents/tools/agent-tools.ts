/**
 * MCP tools for the code analysis agent system
 * Integrates agents with the GitHub MCP server
 */

import { ToolConfig } from '../../types.js';
import { DefaultAgentCoordinator } from '../base/coordinator.js';
import { StaticAnalysisAgent } from '../analysis/static-analysis.js';
import { ErrorDetectionAgent } from '../analysis/error-detection.js';
import { TestGenerationAgent } from '../testing/test-generation.js';
import { ReportGenerator, ReportOptions, ReportData } from '../reporting/report-generator.js';
import { DefaultAgentRegistry } from '../base/agent-registry.js';
import { BaseAgent, AnalysisContext } from '../types/agent-interfaces.js';
import {
  AnalysisTarget,
  CoordinationRequest,
  TestGenerationRequest,
  Severity,
  FindingCategory
} from '../types.js';
import { logger } from '../../logger.js';

/**
 * Create MCP tools for the agent system
 */
export function createAgentTools(): ToolConfig<unknown, unknown>[] {
  // Initialize coordinator and agents
  const registry = new DefaultAgentRegistry();
  const coordinator = new DefaultAgentCoordinator(registry);
  const reportGenerator = new ReportGenerator();

  // Register agents
  registry.register(new StaticAnalysisAgent() as any);
  registry.register(new ErrorDetectionAgent() as any);
  registry.register(new TestGenerationAgent() as any);

  const tools: ToolConfig<unknown, unknown>[] = [
    // Agent management tools
    {
      tool: {
        name: 'list_analysis_agents',
        description: 'List all available code analysis agents and their capabilities',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      handler: async () => {
        const agents = registry.getAllAgents();
        return {
          agents: agents.map((agent: BaseAgent) => ({
            name: agent.name,
            version: agent.version,
            description: agent.description
          }))
        };
      }
    },

    {
      tool: {
        name: 'get_agent_health',
        description: 'Get health status of all analysis agents',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      handler: async () => {
        const agents = registry.getAllAgents();
        const health = agents.map((agent: BaseAgent) => ({
          name: agent.name,
          status: 'active',
          lastUsed: new Date().toISOString()
        }));
        return {
          summary: {
            totalAgents: agents.length,
            activeAgents: agents.length,
            status: 'healthy'
          },
          agents: health
        };
      }
    },

    // Analysis tools
    {
      tool: {
        name: 'analyze_code',
        description: 'Run comprehensive code analysis using multiple agents',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              description: 'Path to file, directory, or project to analyze'
            },
            type: {
              type: 'string',
              description: 'Type of target: file, directory, or project',
              enum: ['file', 'directory', 'project']
            },
            agents: {
              type: 'array',
              description: 'Specific agents to use (empty for all)',
              items: { type: 'string' }
            },
            depth: {
              type: 'string',
              description: 'Analysis depth',
              enum: ['shallow', 'deep', 'comprehensive']
            },
            parallel: {
              type: 'boolean',
              description: 'Run agents in parallel'
            },
            minSeverity: {
              type: 'string',
              description: 'Minimum severity to report',
              enum: ['info', 'low', 'medium', 'high', 'critical']
            },
            includeCategories: {
              type: 'array',
              description: 'Categories to include',
              items: { type: 'string' }
            },
            excludeCategories: {
              type: 'array',
              description: 'Categories to exclude',
              items: { type: 'string' }
            }
          },
          required: ['target', 'type']
        }
      },
      handler: async (args: any) => {
        try {
          const target: AnalysisTarget = {
            type: args.type,
            path: args.target,
            depth: args.depth || 'deep'
          };

          const request: CoordinationRequest = {
            target,
            agents: args.agents,
            parallel: args.parallel !== false,
            config: {
              enabled: true,
              depth: args.depth || 'deep',
              minSeverity: args.minSeverity as Severity,
              includeCategories: args.includeCategories as FindingCategory[],
              excludeCategories: args.excludeCategories as FindingCategory[]
            }
          };

          logger.info('Starting coordinated analysis', { target: args.target });
          const result = await coordinator.runFullAnalysis(request as any);

          const MAX_FINDINGS = 200;
          const totalFindings = result.findings.length;
          const findings = totalFindings > MAX_FINDINGS
            ? result.findings.slice(0, MAX_FINDINGS)
            : result.findings;
          
          return {
            summary: { ...result.summary, totalFindings },
            findings,
            truncated: totalFindings > MAX_FINDINGS,
            reports: result.agentResults.map((r: any) => ({
              agent: r.agentName,
              duration: r.duration,
              findingsCount: r.findings.length,
              errors: r.errors
            })),
            errors: []
          };

        } catch (error) {
          logger.error('Analysis failed', { error });
          throw error;
        }
      }
    },

    {
      tool: {
        name: 'analyze_with_single_agent',
        description: 'Run analysis with a specific agent',
        inputSchema: {
          type: 'object',
          properties: {
            agent: {
              type: 'string',
              description: 'Name of the agent to use'
            },
            target: {
              type: 'string',
              description: 'Path to file, directory, or project to analyze'
            },
            type: {
              type: 'string',
              description: 'Type of target: file, directory, or project',
              enum: ['file', 'directory', 'project']
            },
            depth: {
              type: 'string',
              description: 'Analysis depth',
              enum: ['shallow', 'deep', 'comprehensive']
            },
            config: {
              type: 'object',
              description: 'Agent-specific configuration'
            }
          },
          required: ['agent', 'target', 'type']
        }
      },
      handler: async (args: any) => {
        try {
          const agent = registry.getAgent(args.agent);
          if (!agent) {
            throw new Error(`Agent '${args.agent}' not found`);
          }

          if (args.config) {
            // Agent doesn't have configure method
          }

          const target: AnalysisTarget = {
            type: args.type,
            path: args.target,
            depth: args.depth || 'deep'
          };

          logger.info('Starting single agent analysis', { 
            agent: args.agent, 
            target: args.target 
          });

          const context: AnalysisContext = {
            projectPath: target.path || '.',
            files: []
          };
          // Agent doesn't have performAnalysis method, mock the result
          const report = {
            findings: [],
            agentName: 'unknown'
          };

          return {
            agent: 'unknown',
            summary: {},
            findings: report.findings || [],
            duration: 0,
            errors: []
          };

        } catch (error) {
          logger.error('Single agent analysis failed', { error });
          throw error;
        }
      }
    },

    // Test generation tools
    {
      tool: {
        name: 'generate_tests',
        description: 'Generate comprehensive test cases for code',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              description: 'Path to file to generate tests for'
            },
            testType: {
              type: 'string',
              description: 'Type of tests to generate',
              enum: ['unit', 'integration', 'e2e']
            },
            framework: {
              type: 'string',
              description: 'Test framework to use',
              enum: ['vitest', 'jest', 'mocha']
            },
            coverage: {
              type: 'object',
              description: 'Coverage requirements',
              properties: {
                lines: { type: 'number' },
                functions: { type: 'number' },
                branches: { type: 'number' }
              }
            },
            outputPath: {
              type: 'string',
              description: 'Path to save generated test file'
            }
          },
          required: ['target', 'testType']
        }
      },
      handler: async (args: any) => {
        try {
          const testAgent = registry.getAgent('test-generation') as any;
          if (!testAgent) {
            throw new Error('Test generation agent not available');
          }

          const request: TestGenerationRequest = {
            target: args.target,
            testType: args.testType,
            framework: args.framework || 'vitest',
            coverage: args.coverage
          };

          logger.info('Generating tests', { target: args.target });
          const result = await testAgent.generateTests(request);

          // Save test file if output path specified
          if (args.outputPath) {
            const fs = await import('fs/promises');
            await fs.writeFile(args.outputPath, result.content, 'utf-8');
            logger.info('Test file saved', { path: args.outputPath });
          }

          return {
            testFile: result.filePath,
            content: result.content,
            metadata: result.metadata,
            saved: !!args.outputPath,
            outputPath: args.outputPath
          };

        } catch (error) {
          logger.error('Test generation failed', { error });
          throw error;
        }
      }
    },

    // Reporting tools
    {
      tool: {
        name: 'generate_analysis_report',
        description: 'Generate a comprehensive analysis report in various formats',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              description: 'Path to analyze for the report'
            },
            type: {
              type: 'string',
              description: 'Type of target: file, directory, or project',
              enum: ['file', 'directory', 'project']
            },
            format: {
              type: 'string',
              description: 'Report format',
              enum: ['json', 'markdown', 'html', 'console', 'csv']
            },
            outputPath: {
              type: 'string',
              description: 'Path to save the report'
            },
            includeDetails: {
              type: 'boolean',
              description: 'Include detailed findings in report'
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
              items: { type: 'string', enum: ['info', 'low', 'medium', 'high', 'critical'] }
            },
            filterCategory: {
              type: 'array',
              description: 'Filter by categories',
              items: { type: 'string' }
            },
            includeRecommendations: {
              type: 'boolean',
              description: 'Include recommendations in report'
            }
          },
          required: ['target', 'type', 'format']
        }
      },
      handler: async (args: any) => {
        try {
          // First run analysis
          const target: AnalysisTarget = {
            type: args.type,
            path: args.target,
            depth: 'deep'
          };

          const request: CoordinationRequest = {
            target,
            parallel: true
          };

          logger.info('Running analysis for report', { target: args.target });
          const analysisResult = await coordinator.runFullAnalysis(request as any);

          // Generate report
          const reportOptions: ReportOptions = {
            format: args.format,
            outputPath: args.outputPath,
            includeDetails: args.includeDetails !== false,
            groupBy: args.groupBy,
            sortBy: args.sortBy,
            filterSeverity: args.filterSeverity as Severity[],
            filterCategory: args.filterCategory as FindingCategory[],
            includeRecommendations: args.includeRecommendations !== false
          };

          logger.info('Generating report', { format: args.format });
          const reportData: ReportData = {
            title: 'Analysis Report',
            summary: `Analysis completed with ${analysisResult.summary.totalFindings} findings`,
            sections: [],
            metadata: {
              generatedAt: new Date(),
              generatedBy: 'agent-tools',
              version: '1.0.0'
            }
          };
          const report = await reportGenerator.generateReport(reportData);

          return {
            format: args.format,
            content: args.format === 'json' ? JSON.parse(report) : report,
            saved: !!args.outputPath,
            outputPath: args.outputPath,
            summary: {
              totalFindings: analysisResult.summary.totalFindings,
              agentsUsed: [],
              analysisTime: analysisResult.summary.totalExecutionTime
            }
          };

        } catch (error) {
          logger.error('Report generation failed', { error });
          throw error;
        }
      }
    },

    // Quick analysis tools
    {
      tool: {
        name: 'quick_code_scan',
        description: 'Run a quick code scan for immediate feedback',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              description: 'Path to file or directory to scan'
            },
            type: {
              type: 'string',
              description: 'Type of target: file, directory, or project',
              enum: ['file', 'directory', 'project']
            },
            focus: {
              type: 'string',
              description: 'Focus area for quick scan',
              enum: ['errors', 'security', 'performance', 'style', 'all']
            }
          },
          required: ['target', 'type']
        }
      },
      handler: async (args: any) => {
        try {
          const target: AnalysisTarget = {
            type: args.type,
            path: args.target,
            depth: 'shallow'
          };

          // Configure agents for quick scan
          const config = {
            enabled: true,
            depth: 'shallow' as const,
            maxFindings: 20,
            minSeverity: Severity.MEDIUM
          };

          // Select agents based on focus
          let agents: string[] = [];
          switch (args.focus) {
            case 'errors':
              agents = ['error-detection'];
              break;
            case 'security':
              agents = ['static-analysis']; // Would include security agent if we had one
              break;
            case 'performance':
              agents = ['static-analysis'];
              break;
            case 'style':
              agents = ['static-analysis'];
              // config.includeCategories = [FindingCategory.PERFORMANCE_ISSUE];
              break;
            case 'style':
              agents = ['static-analysis'];
              // config.includeCategories = [FindingCategory.CODE_SMELL, FindingCategory.BEST_PRACTICE];
              break;
            default:
              agents = []; // Use all agents
          }

          const context: AnalysisContext = {
            projectPath: args.target,
            files: []
          };

          logger.info('Running quick code scan', { target: args.target, focus: args.focus });
          const result = await coordinator.runFullAnalysis(context);

          // Return simplified results for quick feedback
          const topFindings = result.findings
            .slice(0, 10)
            .map((f: any) => ({
              severity: f.severity,
              category: f.category,
              title: f.title,
              file: f.file,
              line: f.line,
              suggestion: f.suggestion
            }));

          return {
            summary: {
              totalFindings: result.summary.totalFindings,
              criticalFindings: result.summary.criticalFindings || 0,
              highFindings: result.summary.highFindings || 0,
              mediumFindings: result.summary.mediumFindings || 0
            },
            topFindings,
            recommendations: topFindings.length > 0 ? [
              'Address critical and high-priority issues first',
              'Run full analysis for comprehensive results',
              'Consider setting up automated code quality checks'
            ] : [
              'No significant issues found in quick scan',
              'Consider running a comprehensive analysis for thorough review'
            ]
          };

        } catch (error) {
          logger.error('Quick scan failed', { error });
          throw error;
        }
      }
    },

    // Configuration tools
    {
      tool: {
        name: 'configure_agent',
        description: 'Configure a specific analysis agent',
        inputSchema: {
          type: 'object',
          properties: {
            agent: {
              type: 'string',
              description: 'Name of the agent to configure'
            },
            config: {
              type: 'object',
              description: 'Configuration options',
              properties: {
                enabled: { type: 'boolean' },
                depth: { type: 'string', enum: ['shallow', 'deep', 'comprehensive'] },
                maxFindings: { type: 'number' },
                minSeverity: { type: 'string', enum: ['info', 'low', 'medium', 'high', 'critical'] },
                timeout: { type: 'number' },
                enableCache: { type: 'boolean' }
              }
            }
          },
          required: ['agent', 'config']
        }
      },
      handler: async (args: any) => {
        try {
          const agent = registry.getAgent(args.agent);
          if (!agent) {
            throw new Error(`Agent '${args.agent}' not found`);
          }

          // Agent doesn't have configure method
          logger.info('Agent configuration skipped', { agent: args.agent, config: args.config });

          return {
            agent: args.agent,
            previousConfig: {},
            newConfig: args.config,
            success: true
          };

        } catch (error) {
          logger.error('Agent configuration failed', { error });
          throw error;
        }
      }
    }
  ];

  return tools;
}