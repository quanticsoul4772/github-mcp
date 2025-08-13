/**
 * Demo script showing how to use the agents system
 */

import { logger } from '../logger.js';
import {
  AgentCoordinator,
  StaticAnalysisAgent,
  ReportGenerator,
  AnalysisContext,
  Severity,
  FindingCategory
} from './index.js';

async function runDemo() {
  logger.info('Starting agents demo');

  try {
    // Create coordinator and agents
    const coordinator = new AgentCoordinator({
      maxConcurrency: 2,
      timeout: 60000, // 1 minute
      retries: 1,
      failFast: false,
      deduplication: true
    });

    // Register agents
    const staticAnalysisAgent = new StaticAnalysisAgent();
    coordinator.registerAgent(staticAnalysisAgent);

    logger.info('Registered agents', { 
      agents: coordinator.getRegisteredAgents(),
      capabilities: coordinator.getAllCapabilities()
    });

    // Set up analysis context
    const context: AnalysisContext = {
      repositoryPath: process.cwd(), // Analyze current directory
      excludePatterns: [
        'node_modules',
        'dist',
        'build',
        '*.test.ts',
        '*.spec.ts'
      ],
      includePatterns: [
        'src/**/*.ts',
        'src/**/*.js'
      ],
      maxFileSize: 1024 * 1024, // 1MB
      timeout: 30000 // 30 seconds
    };

    logger.info('Starting analysis', { context });

    // Run analysis
    const result = await coordinator.runAnalysis(context);

    logger.info('Analysis completed', {
      summary: result.summary,
      reportsCount: result.reports.length,
      findingsCount: result.consolidatedFindings.length
    });

    // Generate reports
    const reportGenerator = new ReportGenerator();

    // Console report
    console.log('\n' + '='.repeat(80));
    console.log('CONSOLE REPORT');
    console.log('='.repeat(80));
    
    const consoleReport = await reportGenerator.generateReport(result, {
      format: 'console',
      includeDetails: true,
      groupBy: 'severity',
      sortBy: 'severity',
      includeRecommendations: true
    });
    
    console.log(consoleReport);

    // Markdown report
    const markdownReport = await reportGenerator.generateReport(result, {
      format: 'markdown',
      outputPath: './analysis-report.md',
      includeDetails: true,
      groupBy: 'category',
      sortBy: 'severity',
      includeRecommendations: true,
      includeMetrics: true
    });

    logger.info('Markdown report generated', { path: './analysis-report.md' });

    // HTML report
    const htmlReport = await reportGenerator.generateReport(result, {
      format: 'html',
      outputPath: './analysis-report.html',
      includeDetails: true,
      groupBy: 'file',
      sortBy: 'severity'
    });

    logger.info('HTML report generated', { path: './analysis-report.html' });

    // JSON report
    const jsonReport = await reportGenerator.generateReport(result, {
      format: 'json',
      outputPath: './analysis-report.json',
      includeDetails: true
    });

    logger.info('JSON report generated', { path: './analysis-report.json' });

    // CSV report (findings only)
    const csvReport = await reportGenerator.generateReport(result, {
      format: 'csv',
      outputPath: './analysis-findings.csv',
      filterSeverity: [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM],
      sortBy: 'severity'
    });

    logger.info('CSV report generated', { path: './analysis-findings.csv' });

    // Demo running specific agents
    logger.info('Running specific agent demo');
    
    const specificResult = await coordinator.runAgent('static-analysis', context);
    
    logger.info('Specific agent completed', {
      agent: specificResult.agentName,
      findings: specificResult.findings.length,
      duration: specificResult.duration
    });

    // Demo filtering and grouping
    const criticalFindings = result.consolidatedFindings.filter(
      f => f.severity === Severity.CRITICAL
    );

    if (criticalFindings.length > 0) {
      logger.warn('Critical issues found', {
        count: criticalFindings.length,
        issues: criticalFindings.map(f => ({
          file: f.file,
          line: f.line,
          title: f.title,
          category: f.category
        }))
      });
    }

    // Group findings by category
    const findingsByCategory = result.consolidatedFindings.reduce((acc, finding) => {
      if (!acc[finding.category]) {
        acc[finding.category] = [];
      }
      acc[finding.category].push(finding);
      return acc;
    }, {} as Record<FindingCategory, typeof result.consolidatedFindings>);

    logger.info('Findings by category', {
      categories: Object.keys(findingsByCategory),
      counts: Object.entries(findingsByCategory).map(([category, findings]) => ({
        category,
        count: findings.length
      }))
    });

    logger.info('Demo completed successfully');

  } catch (error) {
    logger.error('Demo failed', { 
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    throw error;
  }
}

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(error => {
    console.error('Demo failed:', error);
    process.exit(1);
  });
}

export { runDemo };