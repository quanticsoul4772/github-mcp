import { createAgentSystem } from './build/agents/index.js';
import { ReportGenerator } from './build/agents/reporting/report-generator.js';
import fs from 'fs/promises';

const { coordinator, reportGenerator } = createAgentSystem();

console.log('Available agents:', coordinator.getAgents().map(a => a.name).join(', '));

const target = {
  type: 'project',
  path: process.env.TARGET_PATH || 'src/',
  depth: process.env.ANALYSIS_DEPTH || 'deep',
  exclude: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', '**/*.test.ts', '**/*.spec.ts']
};

console.log('Analysis target:', target);

try {
  // Run coordinated analysis
  const result = await coordinator.coordinate({
    target,
    parallel: true,
    config: {
      enabled: true,
      depth: target.depth,
      minSeverity: 'low',
      maxFindings: 200
    }
  });
  
  console.log(`\nAnalysis completed in ${Math.round(result.summary.totalDuration)}ms`);
  console.log(`Agents used: ${result.summary.agentsUsed.join(', ')}`);
  console.log(`Total findings: ${result.summary.totalFindings}`);
  
  // Generate reports
  const htmlReport = reportGenerator.generateReportSafe({
    title: 'Comprehensive Code Analysis',
    summary: `Analysis completed: ${result.summary.totalFindings} total findings across ${result.summary.agentsUsed?.join(', ') || 'all agents'}`,
    metadata: { generatedAt: new Date(), generatedBy: 'comprehensive-analysis', version: '1.0.0' },
  });
  await Promise.all([
    fs.writeFile('analysis-report.json', JSON.stringify({ summary: result.summary, findings: result.consolidatedFindings }, null, 2)),
    fs.writeFile('analysis-report.md', `# Comprehensive Code Analysis\n\n**Total findings:** ${result.summary.totalFindings}\n**Agents used:** ${result.summary.agentsUsed?.join(', ') || 'none'}\n`),
    fs.writeFile('analysis-report.html', htmlReport),
  ]);
  
  // Create summary for GitHub
  const summary = {
    totalFindings: result.summary.totalFindings,
    criticalFindings: result.summary.findingsBySeverity?.critical || 0,
    highFindings: result.summary.findingsBySeverity?.high || 0,
    mediumFindings: result.summary.findingsBySeverity?.medium || 0,
    lowFindings: result.summary.findingsBySeverity?.low || 0,
    agentsUsed: result.summary.agentsUsed,
    analysisTime: Math.round(result.summary.totalDuration),
    topIssues: Object.entries(result.summary.findingsByCategory)
      .filter(([_, count]) => count > 0)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category: category.replace(/_/g, ' '), count }))
  };
  
  await fs.writeFile('analysis-summary.json', JSON.stringify(summary, null, 2));
  
  console.log('\nReports generated:');
  console.log('- analysis-report.json (machine-readable)');
  console.log('- analysis-report.md (human-readable)');
  console.log('- analysis-report.html (web-viewable)');
  console.log('- analysis-summary.json (GitHub summary)');
  
  // Set exit code based on critical issues
  if (summary.criticalFindings > 20) {
    console.log(`\n❌ ${summary.criticalFindings} critical issues found!`);
    process.exit(1);
  } else if (summary.highFindings > 100) {
    console.log(`\n⚠️ ${summary.highFindings} high-priority issues found!`);
    process.exit(1);
  } else {
    console.log('\n✅ Analysis completed successfully');
  }
  
} catch (error) {
  console.error('Analysis failed:', error);
  process.exit(1);
}
