/**
 * Analysis Report Generator
 * 
 * This module provides report generation capabilities for code analysis results.
 * It supports multiple output formats and includes comprehensive statistics.
 */

import {
  AnalysisReport,
  CoordinationResult,
  Finding,
  Severity,
  FindingCategory
} from '../types.js';
import { logger } from '../../logger.js';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface ReportOptions {
  format: 'json' | 'markdown' | 'html' | 'console' | 'csv';
  outputPath?: string;
  includeDetails?: boolean;
  groupBy?: 'severity' | 'category' | 'file';
  sortBy?: 'severity' | 'category' | 'file' | 'line';
  filterSeverity?: Severity[];
  filterCategory?: FindingCategory[];
  includeMetrics?: boolean;
  includeRecommendations?: boolean;
}

export interface ReportSummary {
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  infoFindings: number;
  filesAnalyzed: number;
  agentsUsed: string[];
  analysisTime: number;
  topIssues: Array<{
    category: FindingCategory;
    count: number;
    severity: Severity;
  }>;
}

/**
 * Report Generator for Analysis Results
 * 
 * Generates comprehensive reports from code analysis results in multiple formats.
 * Includes statistics, findings, and recommendations.
 */
export class ReportGenerator {
  /**
   * Generate a report from analysis results
   */
  async generateReport(
    data: AnalysisReport | CoordinationResult,
    options: ReportOptions
  ): Promise<string> {
    try {
      logger.info('Generating analysis report', { format: options.format });

      const summary = this.generateSummary(data);
      const findings = this.extractFindings(data);
      const filteredFindings = this.filterFindings(findings, options);
      const groupedFindings = this.groupFindings(filteredFindings, options.groupBy);

      let report: string;

      switch (options.format) {
        case 'json':
          report = this.generateJsonReport(data, summary, filteredFindings, options);
          break;
        case 'markdown':
          report = this.generateMarkdownReport(data, summary, groupedFindings, options);
          break;
        case 'html':
          report = this.generateHtmlReport(data, summary, groupedFindings, options);
          break;
        case 'console':
          report = this.generateConsoleReport(data, summary, groupedFindings, options);
          break;
        case 'csv':
          report = this.generateCsvReport(filteredFindings, options);
          break;
        default:
          throw new Error(`Unsupported report format: ${options.format}`);
      }

      // Save to file if output path specified
      if (options.outputPath) {
        await this.saveReport(report, options.outputPath);
        logger.info('Report saved', { path: options.outputPath });
      }

      return report;

    } catch (error) {
      logger.error('Failed to generate analysis report', { error });
      throw error;
    }
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(data: AnalysisReport | CoordinationResult): ReportSummary {
    const findings = this.extractFindings(data);
    const isCoordination = 'reports' in data;

    const severityCounts = {
      [Severity.CRITICAL]: 0,
      [Severity.HIGH]: 0,
      [Severity.MEDIUM]: 0,
      [Severity.LOW]: 0,
      [Severity.INFO]: 0
    };

    const categoryCounts: Record<FindingCategory, number> = {} as Record<FindingCategory, number>;

    findings.forEach(finding => {
      severityCounts[finding.severity]++;
      categoryCounts[finding.category] = (categoryCounts[finding.category] || 0) + 1;
    });

    // Get top issues
    const topIssues = Object.entries(categoryCounts)
      .map(([category, count]) => ({
        category: category as FindingCategory,
        count,
        severity: this.getTypicalSeverityForCategory(category as FindingCategory, findings)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalFindings: findings.length,
      criticalFindings: severityCounts[Severity.CRITICAL],
      highFindings: severityCounts[Severity.HIGH],
      mediumFindings: severityCounts[Severity.MEDIUM],
      lowFindings: severityCounts[Severity.LOW],
      infoFindings: severityCounts[Severity.INFO],
      filesAnalyzed: isCoordination 
        ? data.reports.reduce((sum, r) => sum + r.summary.filesAnalyzed, 0)
        : data.summary.filesAnalyzed,
      agentsUsed: isCoordination 
        ? data.summary.agentsUsed 
        : [data.agentName],
      analysisTime: isCoordination 
        ? data.summary.totalDuration 
        : data.duration,
      topIssues
    };
  }

  /**
   * Extract findings from data
   */
  private extractFindings(data: AnalysisReport | CoordinationResult): Finding[] {
    if ('reports' in data) {
      return data.consolidatedFindings;
    }
    return data.findings;
  }

  /**
   * Filter findings based on options
   */
  private filterFindings(findings: Finding[], options: ReportOptions): Finding[] {
    let filtered = findings;

    if (options.filterSeverity && options.filterSeverity.length > 0) {
      filtered = filtered.filter(f => options.filterSeverity!.includes(f.severity));
    }

    if (options.filterCategory && options.filterCategory.length > 0) {
      filtered = filtered.filter(f => options.filterCategory!.includes(f.category));
    }

    // Sort findings
    if (options.sortBy) {
      filtered = this.sortFindings(filtered, options.sortBy);
    }

    return filtered;
  }

  /**
   * Group findings by specified criteria
   */
  private groupFindings(
    findings: Finding[], 
    groupBy?: 'severity' | 'category' | 'file'
  ): Record<string, Finding[]> {
    if (!groupBy) {
      return { all: findings };
    }

    const groups: Record<string, Finding[]> = {};

    findings.forEach(finding => {
      let key: string;
      
      switch (groupBy) {
        case 'severity':
          key = finding.severity;
          break;
        case 'category':
          key = finding.category;
          break;
        case 'file':
          key = finding.file;
          break;
        default:
          key = 'all';
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(finding);
    });

    return groups;
  }

  /**
   * Sort findings by specified criteria
   */
  private sortFindings(findings: Finding[], sortBy: string): Finding[] {
    const severityOrder = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO];
    const list = findings.slice();

    return list.sort((a, b) => {
      switch (sortBy) {
        case 'severity':
          return severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
        case 'category':
          return a.category.localeCompare(b.category);
        case 'file':
          return a.file.localeCompare(b.file);
        case 'line':
          if (a.file !== b.file) return a.file.localeCompare(b.file);
          return (a.line || 0) - (b.line || 0);
        default:
          return 0;
      }
    });
  }

  /**
   * Generate JSON report
   */
  private generateJsonReport(
    data: AnalysisReport | CoordinationResult,
    summary: ReportSummary,
    findings: Finding[],
    options: ReportOptions
  ): string {
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        format: 'json',
        version: '1.0.0'
      },
      summary,
      ...(options.includeDetails && { data }),
      findings: options.includeDetails ? findings : findings.map(f => ({
        id: f.id,
        severity: f.severity,
        category: f.category,
        title: f.title,
        file: f.file,
        line: f.line
      }))
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(
    data: AnalysisReport | CoordinationResult,
    summary: ReportSummary,
    groupedFindings: Record<string, Finding[]>,
    options: ReportOptions
  ): string {
    let report = '# Code Analysis Report\n\n';
    
    // Metadata
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Agents Used:** ${summary.agentsUsed.join(', ')}\n`;
    report += `**Analysis Time:** ${Math.round(summary.analysisTime)}ms\n\n`;

    // Summary
    report += '## Summary\n\n';
    report += `- **Total Findings:** ${summary.totalFindings}\n`;
    report += `- **Files Analyzed:** ${summary.filesAnalyzed}\n`;
    report += `- **Critical Issues:** ${summary.criticalFindings}\n`;
    report += `- **High Priority:** ${summary.highFindings}\n`;
    report += `- **Medium Priority:** ${summary.mediumFindings}\n`;
    report += `- **Low Priority:** ${summary.lowFindings}\n`;
    report += `- **Info:** ${summary.infoFindings}\n\n`;

    // Severity distribution chart
    report += '### Severity Distribution\n\n';
    report += '```\n';
    const maxCount = Math.max(
      summary.criticalFindings,
      summary.highFindings,
      summary.mediumFindings,
      summary.lowFindings,
      summary.infoFindings
    );
    
    if (maxCount > 0) {
      const severities = [
        { name: 'Critical', count: summary.criticalFindings, symbol: '🔴' },
        { name: 'High', count: summary.highFindings, symbol: '🟠' },
        { name: 'Medium', count: summary.mediumFindings, symbol: '🟡' },
        { name: 'Low', count: summary.lowFindings, symbol: '🔵' },
        { name: 'Info', count: summary.infoFindings, symbol: '⚪' }
      ];

      severities.forEach(sev => {
        const barLength = Math.round((sev.count / maxCount) * 20);
        const bar = '█'.repeat(barLength).padEnd(20, '░');
        report += `${sev.symbol} ${sev.name.padEnd(8)} │${bar}│ ${sev.count}\n`;
      });
    }
    report += '```\n\n';

    // Top issues
    if (summary.topIssues.length > 0) {
      report += '### Top Issues\n\n';
      summary.topIssues.forEach((issue, index) => {
        const emoji = this.getSeverityEmoji(issue.severity);
        report += `${index + 1}. ${emoji} **${issue.category.replace(/_/g, ' ')}** (${issue.count} occurrences)\n`;
      });
      report += '\n';
    }

    // Detailed findings
    if (options.includeDetails) {
      report += '## Detailed Findings\n\n';
      
      Object.entries(groupedFindings).forEach(([group, findings]) => {
        if (findings.length === 0) return;
        
        report += `### ${this.formatGroupName(group)}\n\n`;
        
        findings.forEach(finding => {
          const emoji = this.getSeverityEmoji(finding.severity);
          report += `#### ${emoji} ${finding.title}\n\n`;
          report += `- **File:** \`${finding.file}\`\n`;
          if (finding.line) report += `- **Line:** ${finding.line}\n`;
          report += `- **Severity:** ${finding.severity}\n`;
          report += `- **Category:** ${finding.category.replace(/_/g, ' ')}\n`;
          if (finding.rule) report += `- **Rule:** ${finding.rule}\n`;
          report += `\n**Description:** ${finding.description}\n\n`;
          
          if (finding.snippet) {
            report += '**Code:**\n```typescript\n';
            report += finding.snippet;
            report += '\n```\n\n';
          }
          
          if (finding.suggestion) {
            report += `**Suggestion:** ${finding.suggestion}\n\n`;
          }
          
          report += '---\n\n';
        });
      });
    }

    // Recommendations
    if (options.includeRecommendations) {
      report += this.generateRecommendations(summary);
    }

    return report;
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(
    data: AnalysisReport | CoordinationResult,
    summary: ReportSummary,
    groupedFindings: Record<string, Finding[]>,
    options: ReportOptions
  ): string {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Analysis Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #007acc; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; border-left: 4px solid #007acc; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007acc; }
        .stat-label { color: #666; margin-top: 5px; }
        .severity-critical { border-left-color: #dc3545; color: #dc3545; }
        .severity-high { border-left-color: #fd7e14; color: #fd7e14; }
        .severity-medium { border-left-color: #ffc107; color: #ffc107; }
        .severity-low { border-left-color: #17a2b8; color: #17a2b8; }
        .finding { background: #f8f9fa; margin: 15px 0; padding: 20px; border-radius: 6px; border-left: 4px solid #dee2e6; }
        .finding-title { font-weight: bold; margin-bottom: 10px; }
        .finding-meta { color: #666; font-size: 0.9em; margin-bottom: 10px; }
        .finding-description { margin-bottom: 15px; }
        .code-snippet { background: #f1f3f4; padding: 15px; border-radius: 4px; font-family: 'Courier New', monospace; overflow-x: auto; }
        .suggestion { background: #e7f3ff; padding: 15px; border-radius: 4px; border-left: 4px solid #007acc; }
        .chart { margin: 20px 0; }
        .bar { display: flex; align-items: center; margin: 5px 0; }
        .bar-label { width: 80px; font-size: 0.9em; }
        .bar-visual { flex: 1; height: 20px; background: #e9ecef; border-radius: 10px; margin: 0 10px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Code Analysis Report</h1>
        
        <div class="meta">
            <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
            <p><strong>Agents Used:</strong> ${summary.agentsUsed.join(', ')}</p>
            <p><strong>Analysis Time:</strong> ${Math.round(summary.analysisTime)}ms</p>
        </div>

        <h2>📊 Summary</h2>
        <div class="summary">
            <div class="stat-card">
                <div class="stat-number">${summary.totalFindings}</div>
                <div class="stat-label">Total Findings</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${summary.filesAnalyzed}</div>
                <div class="stat-label">Files Analyzed</div>
            </div>
            <div class="stat-card severity-critical">
                <div class="stat-number">${summary.criticalFindings}</div>
                <div class="stat-label">Critical</div>
            </div>
            <div class="stat-card severity-high">
                <div class="stat-number">${summary.highFindings}</div>
                <div class="stat-label">High</div>
            </div>
            <div class="stat-card severity-medium">
                <div class="stat-number">${summary.mediumFindings}</div>
                <div class="stat-label">Medium</div>
            </div>
            <div class="stat-card severity-low">
                <div class="stat-number">${summary.lowFindings}</div>
                <div class="stat-label">Low</div>
            </div>
        </div>`;

    // Add severity distribution chart
    const maxCount = Math.max(
      summary.criticalFindings,
      summary.highFindings,
      summary.mediumFindings,
      summary.lowFindings,
      summary.infoFindings
    );

    if (maxCount > 0) {
      html += `
        <h2>📈 Severity Distribution</h2>
        <div class="chart">`;

      const severities = [
        { name: 'Critical', count: summary.criticalFindings, color: '#dc3545' },
        { name: 'High', count: summary.highFindings, color: '#fd7e14' },
        { name: 'Medium', count: summary.mediumFindings, color: '#ffc107' },
        { name: 'Low', count: summary.lowFindings, color: '#17a2b8' },
        { name: 'Info', count: summary.infoFindings, color: '#6c757d' }
      ];

      severities.forEach(sev => {
        const percentage = (sev.count / maxCount) * 100;
        html += `
            <div class="bar">
                <div class="bar-label">${sev.name}</div>
                <div class="bar-visual">
                    <div class="bar-fill" style="width: ${percentage}%; background-color: ${sev.color};"></div>
                </div>
                <div style="width: 40px; text-align: right;">${sev.count}</div>
            </div>`;
      });

      html += `</div>`;
    }

    // Add detailed findings if requested
    if (options.includeDetails) {
      html += `<h2>🔍 Detailed Findings</h2>`;
      
      Object.entries(groupedFindings).forEach(([group, findings]) => {
        if (findings.length === 0) return;
        
        html += `<h3>${this.formatGroupName(group)}</h3>`;
        
        findings.forEach(finding => {
          const severityClass = `severity-${finding.severity}`;
          html += `
            <div class="finding ${severityClass}">
                <div class="finding-title">${this.getSeverityEmoji(finding.severity)} ${this.escapeHtml(finding.title)}</div>
                <div class="finding-meta">
                    📁 ${this.escapeHtml(finding.file)}${finding.line ? ` : ${finding.line}` : ''} | 
                    🏷️ ${finding.category.replace(/_/g, ' ')} | 
                    ⚠️ ${finding.severity}
                </div>
                <div class="finding-description">${this.escapeHtml(finding.description)}</div>`;
          
          if (finding.snippet) {
            html += `<div class="code-snippet">${this.escapeHtml(finding.snippet)}</div>`;
          }
          
          if (finding.suggestion) {
            html += `<div class="suggestion"><strong>💡 Suggestion:</strong> ${this.escapeHtml(finding.suggestion)}</div>`;
          }
          
          html += `</div>`;
        });
      });
    }

    html += `
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Generate console report
   */
  private generateConsoleReport(
    data: AnalysisReport | CoordinationResult,
    summary: ReportSummary,
    groupedFindings: Record<string, Finding[]>,
    options: ReportOptions
  ): string {
    let report = '';
    
    // Header
    report += '╔══════════════════════════════════════════════════════════════════════════════╗\n';
    report += '║                            CODE ANALYSIS REPORT                             ║\n';
    report += '╚══════════════════════════════════════════════════════════════════════════════╝\n\n';

    // Summary
    report += `📊 SUMMARY\n`;
    report += `${'─'.repeat(50)}\n`;
    report += `Total Findings:     ${summary.totalFindings}\n`;
    report += `Files Analyzed:     ${summary.filesAnalyzed}\n`;
    report += `Analysis Time:      ${Math.round(summary.analysisTime)}ms\n`;
    report += `Agents Used:        ${summary.agentsUsed.join(', ')}\n\n`;

    // Severity breakdown
    report += `🚨 SEVERITY BREAKDOWN\n`;
    report += `${'─'.repeat(50)}\n`;
    report += `🔴 Critical:        ${summary.criticalFindings}\n`;
    report += `🟠 High:            ${summary.highFindings}\n`;
    report += `🟡 Medium:          ${summary.mediumFindings}\n`;
    report += `🔵 Low:             ${summary.lowFindings}\n`;
    report += `⚪ Info:            ${summary.infoFindings}\n\n`;

    // Top issues
    if (summary.topIssues.length > 0) {
      report += `🎯 TOP ISSUES\n`;
      report += `${'─'.repeat(50)}\n`;
      summary.topIssues.forEach((issue, index) => {
        const emoji = this.getSeverityEmoji(issue.severity);
        report += `${index + 1}. ${emoji} ${issue.category.replace(/_/g, ' ')} (${issue.count})\n`;
      });
      report += '\n';
    }

    // Detailed findings
    if (options.includeDetails) {
      report += `🔍 DETAILED FINDINGS\n`;
      report += `${'═'.repeat(80)}\n\n`;
      
      Object.entries(groupedFindings).forEach(([group, findings]) => {
        if (findings.length === 0) return;
        
        report += `📁 ${this.formatGroupName(group).toUpperCase()}\n`;
        report += `${'─'.repeat(50)}\n`;
        
        findings.forEach((finding, index) => {
          const emoji = this.getSeverityEmoji(finding.severity);
          report += `${index + 1}. ${emoji} ${finding.title}\n`;
          report += `   📍 ${finding.file}${finding.line ? `:${finding.line}` : ''}\n`;
          report += `   🏷️  ${finding.category.replace(/_/g, ' ')} | ⚠️  ${finding.severity}\n`;
          report += `   📝 ${finding.description}\n`;
          
          if (finding.suggestion) {
            report += `   💡 ${finding.suggestion}\n`;
          }
          
          report += '\n';
        });
        
        report += '\n';
      });
    }

    return report;
  }

  /**
   * Generate CSV report
   */
  private generateCsvReport(findings: Finding[], options: ReportOptions): string {
    const headers = [
      'ID',
      'Severity',
      'Category',
      'Title',
      'Description',
      'File',
      'Line',
      'Column',
      'Rule',
      'Suggestion'
    ];

    let csv = headers.join(',') + '\n';

    findings.forEach(finding => {
      const row = [
        this.escapeCsv(finding.id),
        this.escapeCsv(finding.severity),
        this.escapeCsv(finding.category),
        this.escapeCsv(finding.title),
        this.escapeCsv(finding.description),
        this.escapeCsv(finding.file),
        finding.line?.toString() || '',
        finding.column?.toString() || '',
        this.escapeCsv(finding.rule || ''),
        this.escapeCsv(finding.suggestion || '')
      ];
      csv += row.join(',') + '\n';
    });

    return csv;
  }

  /**
   * Generate recommendations based on analysis results
   */
  private generateRecommendations(summary: ReportSummary): string {
    let recommendations = '## 💡 Recommendations\n\n';

    if (summary.criticalFindings > 0) {
      recommendations += '### 🚨 Immediate Action Required\n';
      recommendations += `You have ${summary.criticalFindings} critical issues that need immediate attention. These could lead to security vulnerabilities or system failures.\n\n`;
    }

    if (summary.highFindings > 0) {
      recommendations += '### ⚠️ High Priority\n';
      recommendations += `Address ${summary.highFindings} high-priority issues to improve code reliability and maintainability.\n\n`;
    }

    if (summary.topIssues.length > 0) {
      recommendations += '### 🎯 Focus Areas\n';
      recommendations += 'Based on the analysis, focus on these areas:\n\n';
      
      summary.topIssues.slice(0, 3).forEach((issue, index) => {
        recommendations += `${index + 1}. **${issue.category.replace(/_/g, ' ')}** - Found ${issue.count} instances\n`;
      });
      recommendations += '\n';
    }

    // General recommendations based on findings
    recommendations += '### 📋 General Recommendations\n\n';
    recommendations += '- Set up automated code quality checks in your CI/CD pipeline\n';
    recommendations += '- Consider using a linter with stricter rules\n';
    recommendations += '- Implement code review processes\n';
    recommendations += '- Add comprehensive test coverage\n';
    recommendations += '- Document coding standards for your team\n\n';

    return recommendations;
  }

  // Helper methods

  private getSeverityEmoji(severity: Severity): string {
    const emojiMap = {
      [Severity.CRITICAL]: '🔴',
      [Severity.HIGH]: '🟠',
      [Severity.MEDIUM]: '🟡',
      [Severity.LOW]: '🔵',
      [Severity.INFO]: '⚪'
    };
    return emojiMap[severity] || '⚪';
  }

  private formatGroupName(group: string): string {
    return group.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private getTypicalSeverityForCategory(category: FindingCategory, findings: Finding[]): Severity {
    const categoryFindings = findings.filter(f => f.category === category);
    if (categoryFindings.length === 0) return Severity.INFO;
    
    // Return the most common severity for this category
    const severityCounts = categoryFindings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    }, {} as Record<Severity, number>);
    
    return Object.entries(severityCounts)
      .sort(([,a], [,b]) => b - a)[0][0] as Severity;
  }

  private escapeCsv(text: string): string {
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async saveReport(content: string, outputPath: string): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write file
      await fs.writeFile(outputPath, content, 'utf-8');
    } catch (error) {
      logger.error('Failed to save report', { error, path: outputPath });
      throw error;
    }
  }
}

/**
 * Factory function to create a new report generator instance
 */
export function createReportGenerator(): ReportGenerator {
  return new ReportGenerator();
}

/**
 * Convenience function to generate an analysis report
 */
export function generateAnalysisReport(
  data: AnalysisReport | CoordinationResult,
  options: ReportOptions
): Promise<string> {
  const generator = createReportGenerator();
  return generator.generateReport(data, options);
}