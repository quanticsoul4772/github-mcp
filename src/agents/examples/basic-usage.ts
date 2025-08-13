/**
 * Basic usage examples for the agents system
 */

import {
  AgentCoordinator,
  StaticAnalysisAgent,
  ReportGenerator,
  AnalysisContext,
  Severity,
  FindingCategory
} from '../index.js';

/**
 * Example 1: Basic analysis with a single agent
 */
export async function basicAnalysisExample() {
  // Create a coordinator
  const coordinator = new AgentCoordinator();
  
  // Create and register an agent
  const staticAgent = new StaticAnalysisAgent();
  coordinator.registerAgent(staticAgent);
  
  // Define what to analyze
  const context: AnalysisContext = {
    repositoryPath: './src',
    excludePatterns: ['*.test.ts', 'node_modules'],
    includePatterns: ['**/*.ts', '**/*.js']
  };
  
  // Run the analysis
  const result = await coordinator.runAnalysis(context);
  
  // Generate a simple console report
  const reportGenerator = new ReportGenerator();
  const report = await reportGenerator.generateReport(result, {
    format: 'console',
    includeDetails: false
  });
  
  console.log(report);
  return result;
}

/**
 * Example 2: Analysis with custom filtering and reporting
 */
export async function filteredAnalysisExample() {
  const coordinator = new AgentCoordinator();
  const staticAgent = new StaticAnalysisAgent();
  coordinator.registerAgent(staticAgent);
  
  const context: AnalysisContext = {
    repositoryPath: './src',
    files: [
      'src/index.ts',
      'src/tools/issues.ts',
      'src/tools/pull-requests.ts'
    ]
  };
  
  const result = await coordinator.runAnalysis(context);
  
  // Generate report with only critical and high severity issues
  const reportGenerator = new ReportGenerator();
  const report = await reportGenerator.generateReport(result, {
    format: 'markdown',
    includeDetails: true,
    filterSeverity: [Severity.CRITICAL, Severity.HIGH],
    groupBy: 'severity',
    sortBy: 'severity',
    includeRecommendations: true
  });
  
  console.log('Critical and High Severity Issues:');
  console.log(report);
  
  return result;
}

/**
 * Example 3: Multiple report formats
 */
export async function multipleReportsExample() {
  const coordinator = new AgentCoordinator();
  const staticAgent = new StaticAnalysisAgent();
  coordinator.registerAgent(staticAgent);
  
  const context: AnalysisContext = {
    repositoryPath: './src',
    excludePatterns: ['*.test.ts', '*.spec.ts', 'node_modules']
  };
  
  const result = await coordinator.runAnalysis(context);
  const reportGenerator = new ReportGenerator();
  
  // Generate multiple report formats
  const reports = await Promise.all([
    // JSON for programmatic use
    reportGenerator.generateReport(result, {
      format: 'json',
      outputPath: './reports/analysis.json',
      includeDetails: true
    }),
    
    // Markdown for documentation
    reportGenerator.generateReport(result, {
      format: 'markdown',
      outputPath: './reports/analysis.md',
      includeDetails: true,
      includeRecommendations: true,
      groupBy: 'category'
    }),
    
    // HTML for viewing in browser
    reportGenerator.generateReport(result, {
      format: 'html',
      outputPath: './reports/analysis.html',
      includeDetails: true,
      groupBy: 'file'
    }),
    
    // CSV for spreadsheet analysis
    reportGenerator.generateReport(result, {
      format: 'csv',
      outputPath: './reports/findings.csv',
      filterSeverity: [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM]
    })
  ]);
  
  console.log('Generated reports:');
  console.log('- JSON: ./reports/analysis.json');
  console.log('- Markdown: ./reports/analysis.md');
  console.log('- HTML: ./reports/analysis.html');
  console.log('- CSV: ./reports/findings.csv');
  
  return { result, reports };
}

/**
 * Example 4: Custom analysis with specific focus
 */
export async function securityFocusedAnalysisExample() {
  const coordinator = new AgentCoordinator();
  const staticAgent = new StaticAnalysisAgent();
  coordinator.registerAgent(staticAgent);
  
  const context: AnalysisContext = {
    repositoryPath: './src',
    includePatterns: ['**/*.ts', '**/*.js'],
    excludePatterns: ['*.test.ts', '*.spec.ts']
  };
  
  const result = await coordinator.runAnalysis(context);
  
  // Filter for security issues only
  const securityFindings = result.consolidatedFindings.filter(
    finding => finding.category === FindingCategory.SECURITY
  );
  
  if (securityFindings.length > 0) {
    console.log(`🚨 Found ${securityFindings.length} security issues:`);
    
    securityFindings.forEach((finding, index) => {
      console.log(`\n${index + 1}. ${finding.title}`);
      console.log(`   File: ${finding.file}:${finding.line || '?'}`);
      console.log(`   Severity: ${finding.severity}`);
      console.log(`   Description: ${finding.description}`);
      
      if (finding.suggestion) {
        console.log(`   💡 Suggestion: ${finding.suggestion}`);
      }
    });
  } else {
    console.log('✅ No security issues found!');
  }
  
  return { result, securityFindings };
}