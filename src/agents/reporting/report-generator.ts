/**
 * Comprehensive Report Generator
 * 
 * This module provides secure report generation with proper XSS protection
 * for both general reports and code analysis results.
 * All user input is properly escaped to prevent security vulnerabilities.
 */

import { 
  escapeHtml, 
  escapeHtmlAttribute, 
  safeHtmlTemplate, 
  safeStringify,
  stripHtmlTags 
} from '../../utils/html-security.js';
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

/**
 * Interface for general report data
 */
export interface ReportData {
  title: string;
  summary: string;
  sections: ReportSection[];
  metadata: ReportMetadata;
}

export interface ReportSection {
  title: string;
  content: string;
  subsections?: ReportSubsection[];
  data?: Record<string, unknown>;
}

export interface ReportSubsection {
  title: string;
  content: string;
  data?: Record<string, unknown>;
}

export interface ReportMetadata {
  generatedAt: Date;
  generatedBy: string;
  version: string;
  repository?: string;
  branch?: string;
}

/**
 * Interface for analysis report options
 */
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
 * Comprehensive Report Generator
 * 
 * This class generates both general HTML reports and code analysis reports
 * with proper security measures to prevent XSS attacks.
 * All user input is automatically escaped and validated.
 */
export class ReportGenerator {
  private readonly cssStyles: string;

  constructor() {
    this.cssStyles = this.getDefaultStyles();
  }

  /**
   * Generates a complete HTML report from the provided data
   * 
   * @param data - The report data to render
   * @returns A secure HTML string
   */
  public generateReport(data: ReportData): string {
    this.validateReportData(data);

    const escapedTitle = escapeHtml(data.title);
    const escapedSummary = escapeHtml(data.summary);
    
    const sectionsHtml = data.sections
      .map(section => this.renderSection(section))
      .join('\
');

    const metadataHtml = this.renderMetadata(data.metadata);

    return this.renderFullDocument({
      title: escapedTitle,
      summary: escapedSummary,
      sections: sectionsHtml,
      metadata: metadataHtml,
      styles: this.cssStyles
    });
  }

  /**
   * Safely generates a report with default values for missing fields
   * This method provides defensive programming to prevent workflow failures
   * 
   * @param data - Partial report data that might be missing required fields
   * @returns A secure HTML string
   */
  public generateReportSafe(data: Partial<ReportData>): string {
    const safeData: ReportData = {
      title: data.title || 'Security Analysis Report',
      summary: data.summary || 'Analysis completed',
      sections: data.sections || [],
      metadata: {
          generatedAt: (() => {
            const v = data.metadata?.generatedAt;
            const d = v instanceof Date ? v : (v ? new Date(v as any) : undefined);
            return (d && !isNaN(d.getTime())) ? d : new Date();
          })(),
          generatedBy: data.metadata?.generatedBy ?? 'Security Analysis Agent (Safe Mode)',
        version: data.metadata?.version ?? '1.0.0',
        repository: data.metadata?.repository ?? 'Unknown',
        branch: data.metadata?.branch ?? 'Unknown'
      }
    };

    return this.generateReport(safeData);
  }

  /**
   * Generate a report from analysis results
   */
  async generateAnalysisReport(
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
          report = this.generateAnalysisHtmlReport(data, summary, groupedFindings, options);
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
   * Renders a report section with proper escaping
   */
  private renderSection(section: ReportSection): string {
    const escapedTitle = escapeHtml(section.title);
    const escapedContent = escapeHtml(section.content);
    
    let subsectionsHtml = '';
    if (section.subsections && section.subsections.length > 0) {
      subsectionsHtml = section.subsections
        .map(subsection => this.renderSubsection(subsection))
        .join('\
');
    }

    let dataHtml = '';
    if (section.data) {
      dataHtml = this.renderDataTable(section.data);
    }

    return `
      <section class=\"report-section\">
        <h2>${escapedTitle}</h2>
        <div class=\"section-content\">${escapedContent}</div>
        ${subsectionsHtml}
        ${dataHtml}
      </section>
    `;
  }

  /**
   * Renders a report subsection with proper escaping
   */
  private renderSubsection(subsection: ReportSubsection): string {
    const escapedTitle = escapeHtml(subsection.title);
    const escapedContent = escapeHtml(subsection.content);
    
    let dataHtml = '';
    if (subsection.data) {
      dataHtml = this.renderDataTable(subsection.data);
    }

    return `
      <div class=\"report-subsection\">
        <h3>${escapedTitle}</h3>
        <div class=\"subsection-content\">${escapedContent}</div>
        ${dataHtml}
      </div>
    `;
  }

  /**
   * Renders a data table with proper escaping
   */
  private renderDataTable(data: Record<string, unknown>): string {
    const rows = Object.entries(data)
      .map(([key, value]) => {
        const escapedKey = escapeHtml(key);
        const escapedValue = safeStringify(value);
        
        return `
          <tr>
            <td class=\"data-key\">${escapedKey}</td>
            <td class=\"data-value\">${escapedValue}</td>
          </tr>
        `;
      })
      .join('\
');

    return `
      <table class=\"data-table\">
        <thead>
          <tr>
            <th>Property</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  /**
   * Renders report metadata with proper escaping
   */
  private renderMetadata(metadata: ReportMetadata): string {
    const escapedGeneratedBy = escapeHtml(metadata.generatedBy);
    const escapedVersion = escapeHtml(metadata.version);
    const escapedRepository = metadata.repository ? escapeHtml(metadata.repository) : '';
    const escapedBranch = metadata.branch ? escapeHtml(metadata.branch) : '';
    const formattedDate = escapeHtml(metadata.generatedAt.toISOString());

    let repositoryInfo = '';
    if (escapedRepository) {
      repositoryInfo = `
        <div class=\"metadata-item\">
          <span class=\"metadata-label\">Repository:</span>
          <span class=\"metadata-value\">${escapedRepository}</span>
        </div>`;
      
      if (escapedBranch) {
        repositoryInfo += `
          <div class=\"metadata-item\">
            <span class=\"metadata-label\">Branch:</span>
            <span class=\"metadata-value\">${escapedBranch}</span>
          </div>`;
      }
    }

    return `
      <div class=\"report-metadata\">
        <h3>Report Information</h3>
        <div class=\"metadata-grid\">
          <div class=\"metadata-item\">
            <span class=\"metadata-label\">Generated:</span>
            <span class=\"metadata-value\">${formattedDate}</span>
          </div>
          <div class=\"metadata-item\">
            <span class=\"metadata-label\">Generated By:</span>
            <span class=\"metadata-value\">${escapedGeneratedBy}</span>
          </div>
          <div class=\"metadata-item\">
            <span class=\"metadata-label\">Version:</span>
            <span class=\"metadata-value\">${escapedVersion}</span>
          </div>
          ${repositoryInfo}
        </div>
      </div>
    `;
  }

  /**
   * Renders the complete HTML document
   */
  private renderFullDocument(parts: {
    title: string;
    summary: string;
    sections: string;
    metadata: string;
    styles: string;
  }): string {
    // Note: parts.title, parts.summary are already escaped
    // parts.sections, parts.metadata, parts.styles are safe HTML
    return `<!DOCTYPE html>
<html lang=\"en\">
<head>
    <meta charset=\"UTF-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
    <title>${parts.title}</title>
    <style>
        ${parts.styles}
    </style>
</head>
<body>
    <div class=\"report-container\">
        <header class=\"report-header\">
            <h1>${parts.title}</h1>
            <div class=\"report-summary\">${parts.summary}</div>
        </header>
        
        <main class=\"report-content\">
            ${parts.sections}
        </main>
        
        <footer class=\"report-footer\">
            ${parts.metadata}
        </footer>
    </div>
</body>
</html>`;
  }

  // Analysis Report Methods

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
    let report = '# Code Analysis Report\
\
';
    
    // Metadata
    report += `**Generated:** ${new Date().toISOString()}\
`;
    report += `**Agents Used:** ${summary.agentsUsed.join(', ')}\
`;
    report += `**Analysis Time:** ${Math.round(summary.analysisTime)}ms\
\
`;

    // Summary
    report += '## Summary\
\
';
    report += `- **Total Findings:** ${summary.totalFindings}\
`;
    report += `- **Files Analyzed:** ${summary.filesAnalyzed}\
`;
    report += `- **Critical Issues:** ${summary.criticalFindings}\
`;
    report += `- **High Priority:** ${summary.highFindings}\
`;
    report += `- **Medium Priority:** ${summary.mediumFindings}\
`;
    report += `- **Low Priority:** ${summary.lowFindings}\
`;
    report += `- **Info:** ${summary.infoFindings}\
\
`;

    // Severity distribution chart
    report += '### Severity Distribution\
\
';
    report += '```\
';
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
        report += `${sev.symbol} ${sev.name.padEnd(8)} │${bar}│ ${sev.count}\
`;
      });
    }
    report += '```\
\
';

    // Top issues
    if (summary.topIssues.length > 0) {
      report += '### Top Issues\
\
';
      summary.topIssues.forEach((issue, index) => {
        const emoji = this.getSeverityEmoji(issue.severity);
        report += `${index + 1}. ${emoji} **${issue.category.replace(/_/g, ' ')}** (${issue.count} occurrences)\
`;
      });
      report += '\
';
    }

    // Detailed findings
    if (options.includeDetails) {
      report += '## Detailed Findings\
\
';
      
      Object.entries(groupedFindings).forEach(([group, findings]) => {
        if (findings.length === 0) return;
        
        report += `### ${this.formatGroupName(group)}\
\
`;
        
        findings.forEach(finding => {
          const emoji = this.getSeverityEmoji(finding.severity);
          report += `#### ${emoji} ${finding.title}\
`;
          report += `- **File:** \`${finding.file}\`\
`;
          if (finding.line) report += `- **Line:** ${finding.line}\
`;
          report += `- **Severity:** ${finding.severity}\
`;
          report += `- **Category:** ${finding.category.replace(/_/g, ' ')}\
`;
          if (finding.rule) report += `- **Rule:** ${finding.rule}\
`;
          report += `\
**Description:** ${finding.description}\
\
`;
          
          if (finding.snippet) {
            report += '**Code:**\
```typescript\
';
            report += finding.snippet;
            report += '\
```\
\
';
          }
          
          if (finding.suggestion) {
            report += `**Suggestion:** ${finding.suggestion}\
\
`;
          }
          
          report += '---\
\
';
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
   * Generate HTML report for analysis results
   */
  private generateAnalysisHtmlReport(
    data: AnalysisReport | CoordinationResult,
    summary: ReportSummary,
    groupedFindings: Record<string, Finding[]>,
    options: ReportOptions
  ): string {
    let html = `<!DOCTYPE html>
<html lang=\"en\">
<head>
    <meta charset=\"UTF-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
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
    <div class=\"container\">
        <h1>🔍 Code Analysis Report</h1>
        
        <div class=\"meta\">
            <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
            <p><strong>Agents Used:</strong> ${summary.agentsUsed.join(', ')}</p>
            <p><strong>Analysis Time:</strong> ${Math.round(summary.analysisTime)}ms</p>
        </div>

        <h2>📊 Summary</h2>
        <div class=\"summary\">
            <div class=\"stat-card\">
                <div class=\"stat-number\">${summary.totalFindings}</div>
                <div class=\"stat-label\">Total Findings</div>
            </div>
            <div class=\"stat-card\">
                <div class=\"stat-number\">${summary.filesAnalyzed}</div>
                <div class=\"stat-label\">Files Analyzed</div>
            </div>
            <div class=\"stat-card severity-critical\">
                <div class=\"stat-number\">${summary.criticalFindings}</div>
                <div class=\"stat-label\">Critical</div>
            </div>
            <div class=\"stat-card severity-high\">
                <div class=\"stat-number\">${summary.highFindings}</div>
                <div class=\"stat-label\">High</div>
            </div>
            <div class=\"stat-card severity-medium\">
                <div class=\"stat-number\">${summary.mediumFindings}</div>
                <div class=\"stat-label\">Medium</div>
            </div>
            <div class=\"stat-card severity-low\">
                <div class=\"stat-number\">${summary.lowFindings}</div>
                <div class=\"stat-label\">Low</div>
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
        <div class=\"chart\">`;

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
            <div class=\"bar\">
                <div class=\"bar-label\">${sev.name}</div>
                <div class=\"bar-visual\">
                    <div class=\"bar-fill\" style=\"width: ${percentage}%; background-color: ${sev.color};\"></div>
                </div>
                <div style=\"width: 40px; text-align: right;\">${sev.count}</div>
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
            <div class=\"finding ${severityClass}\">
                <div class=\"finding-title\">${this.getSeverityEmoji(finding.severity)} ${escapeHtml(finding.title)}</div>
                <div class=\"finding-meta\">
                    📁 ${escapeHtml(finding.file)}${finding.line ? ` : ${finding.line}` : ''} | 
                    🏷️ ${finding.category.replace(/_/g, ' ')} | 
                    ⚠️ ${finding.severity}
                </div>
                <div class=\"finding-description\">${escapeHtml(finding.description)}</div>`;
          
          if (finding.snippet) {
            html += `<div class=\"code-snippet\">${escapeHtml(finding.snippet)}</div>`;
          }
          
          if (finding.suggestion) {
            html += `<div class=\"suggestion\"><strong>💡 Suggestion:</strong> ${escapeHtml(finding.suggestion)}</div>`;
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
    report += '╔══════════════════════════════════════════════════════════════════════════════╗\
';
    report += '║                            CODE ANALYSIS REPORT                             ║\
';
    report += '╚══════════════════════════════════════════════════════════════════════════════╝\
\
';

    // Summary
    report += `📊 SUMMARY\
`;
    report += `${'─'.repeat(50)}\
`;
    report += `Total Findings:     ${summary.totalFindings}\
`;
    report += `Files Analyzed:     ${summary.filesAnalyzed}\
`;
    report += `Analysis Time:      ${Math.round(summary.analysisTime)}ms\
`;
    report += `Agents Used:        ${summary.agentsUsed.join(', ')}\
\
`;

    // Severity breakdown
    report += `🚨 SEVERITY BREAKDOWN\
`;
    report += `${'─'.repeat(50)}\
`;
    report += `🔴 Critical:        ${summary.criticalFindings}\
`;
    report += `🟠 High:            ${summary.highFindings}\
`;
    report += `🟡 Medium:          ${summary.mediumFindings}\
`;
    report += `🔵 Low:             ${summary.lowFindings}\
`;
    report += `⚪ Info:            ${summary.infoFindings}\
\
`;

    // Top issues
    if (summary.topIssues.length > 0) {
      report += `🎯 TOP ISSUES\
`;
      report += `${'─'.repeat(50)}\
`;
      summary.topIssues.forEach((issue, index) => {
        const emoji = this.getSeverityEmoji(issue.severity);
        report += `${index + 1}. ${emoji} ${issue.category.replace(/_/g, ' ')} (${issue.count})\
`;
      });
      report += '\
';
    }

    // Detailed findings
    if (options.includeDetails) {
      report += `🔍 DETAILED FINDINGS\
`;
      report += `${'═'.repeat(80)}\
\
`;
      
      Object.entries(groupedFindings).forEach(([group, findings]) => {
        if (findings.length === 0) return;
        
        report += `📁 ${this.formatGroupName(group).toUpperCase()}\
`;
        report += `${'─'.repeat(50)}\
`;
        
        findings.forEach((finding, index) => {
          const emoji = this.getSeverityEmoji(finding.severity);
          report += `${index + 1}. ${emoji} ${finding.title}\
`;
          report += `   📍 ${finding.file}${finding.line ? `:${finding.line}` : ''}\
`;
          report += `   🏷️  ${finding.category.replace(/_/g, ' ')} | ⚠️  ${finding.severity}\
`;
          report += `   📝 ${finding.description}\
`;
          
          if (finding.suggestion) {
            report += `   💡 ${finding.suggestion}\
`;
          }
          
          report += '\
';
        });
        
        report += '\
';
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

    let csv = headers.join(',') + '\
';

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
      csv += row.join(',') + '\
';
    });

    return csv;
  }

  /**
   * Generate recommendations based on analysis results
   */
  private generateRecommendations(summary: ReportSummary): string {
    let recommendations = '## 💡 Recommendations\
\
';

    if (summary.criticalFindings > 0) {
      recommendations += '### 🚨 Immediate Action Required\
';
      recommendations += `You have ${summary.criticalFindings} critical issues that need immediate attention. These could lead to security vulnerabilities or system failures.\
\
`;
    }

    if (summary.highFindings > 0) {
      recommendations += '### ⚠️ High Priority\
';
      recommendations += `Address ${summary.highFindings} high-priority issues to improve code reliability and maintainability.\
\
`;
    }

    if (summary.topIssues.length > 0) {
      recommendations += '### 🎯 Focus Areas\
';
      recommendations += 'Based on the analysis, focus on these areas:\
\
';
      
      summary.topIssues.slice(0, 3).forEach((issue, index) => {
        recommendations += `${index + 1}. **${issue.category.replace(/_/g, ' ')}** - Found ${issue.count} instances\
`;
      });
      recommendations += '\
';
    }

    // General recommendations based on findings
    recommendations += '### 📋 General Recommendations\
\
';
    recommendations += '- Set up automated code quality checks in your CI/CD pipeline\
';
    recommendations += '- Consider using a linter with stricter rules\
';
    recommendations += '- Implement code review processes\
';
    recommendations += '- Add comprehensive test coverage\
';
    recommendations += '- Document coding standards for your team\
\
';

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
    return group.replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());
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
    if (text.includes(',') || text.includes('\"') || text.includes('\
')) {
      return `\"${text.replace(/\"/g, '\"\"')}\"`;
    }
    return text;
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

  /**
   * Validates report data to ensure it's safe to process
   */
  private validateReportData(data: ReportData): void {
    if (!data || typeof data !== 'object') {
      throw new Error('Report data must be a valid object');
    }

    if (!data.title || typeof data.title !== 'string') {
      throw new Error(`Report title must be a non-empty string. Received: ${typeof data.title} (${JSON.stringify(data.title)})`);
    }

    if (!data.summary || typeof data.summary !== 'string') {
      throw new Error(`Report summary must be a non-empty string. Received: ${typeof data.summary} (${JSON.stringify(data.summary)})`);
    }

    if (!Array.isArray(data.sections)) {
      throw new Error(`Report sections must be an array. Received: ${typeof data.sections} (${JSON.stringify(data.sections)})`);
    }

    if (!data.metadata || typeof data.metadata !== 'object') {
      throw new Error(`Report metadata must be a valid object. Received: ${typeof data.metadata} (${JSON.stringify(data.metadata)})`);
    }

    // Validate each section
    data.sections.forEach((section, index) => {
      if (!section.title || typeof section.title !== 'string') {
        throw new Error(`Section ${index} must have a valid title. Received: ${typeof section.title} (${JSON.stringify(section.title)})`);
      }
      if (!section.content || typeof section.content !== 'string') {
        throw new Error(`Section ${index} must have valid content. Received: ${typeof section.content} (${JSON.stringify(section.content)})`);
      }
    });
  }

  /**
   * Gets the default CSS styles for reports
   */
  private getDefaultStyles(): string {
    // CSS is safe to include directly as it doesn't contain user input
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
        background-color: #f5f5f5;
      }

      .report-container {
        max-width: 1200px;
        margin: 0 auto;
        background: white;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        min-height: 100vh;
      }

      .report-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 2rem;
        text-align: center;
      }

      .report-header h1 {
        font-size: 2.5rem;
        margin-bottom: 1rem;
        font-weight: 300;
      }

      .report-summary {
        font-size: 1.2rem;
        opacity: 0.9;
        max-width: 800px;
        margin: 0 auto;
      }

      .report-content {
        padding: 2rem;
      }

      .report-section {
        margin-bottom: 3rem;
        border-bottom: 1px solid #eee;
        padding-bottom: 2rem;
      }

      .report-section:last-child {
        border-bottom: none;
        margin-bottom: 0;
      }

      .report-section h2 {
        color: #2c3e50;
        font-size: 1.8rem;
        margin-bottom: 1rem;
        border-left: 4px solid #667eea;
        padding-left: 1rem;
      }

      .section-content {
        margin-bottom: 1.5rem;
        font-size: 1.1rem;
        line-height: 1.7;
      }

      .report-subsection {
        margin: 1.5rem 0;
        padding-left: 1rem;
        border-left: 2px solid #ddd;
      }

      .report-subsection h3 {
        color: #34495e;
        font-size: 1.4rem;
        margin-bottom: 0.5rem;
      }

      .subsection-content {
        margin-bottom: 1rem;
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        margin: 1rem 0;
        background: white;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .data-table th,
      .data-table td {
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid #eee;
      }

      .data-table th {
        background: #f8f9fa;
        font-weight: 600;
        color: #2c3e50;
      }

      .data-table tr:hover {
        background: #f8f9fa;
      }

      .data-key {
        font-weight: 500;
        color: #555;
        width: 30%;
      }

      .data-value {
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.9rem;
        word-break: break-all;
      }

      .report-footer {
        background: #f8f9fa;
        padding: 2rem;
        border-top: 1px solid #eee;
      }

      .report-metadata h3 {
        color: #2c3e50;
        margin-bottom: 1rem;
      }

      .metadata-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
      }

      .metadata-item {
        display: flex;
        flex-direction: column;
      }

      .metadata-label {
        font-weight: 600;
        color: #555;
        font-size: 0.9rem;
        margin-bottom: 0.25rem;
      }

      .metadata-value {
        color: #333;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.9rem;
      }

      @media (max-width: 768px) {
        .report-header {
          padding: 1.5rem 1rem;
        }

        .report-header h1 {
          font-size: 2rem;
        }

        .report-content {
          padding: 1rem;
        }

        .metadata-grid {
          grid-template-columns: 1fr;
        }
      }
    `;
  }

  /**
   * Generates a plain text version of the report
   */
  public generatePlainTextReport(data: ReportData): string {
    this.validateReportData(data);

    const lines: string[] = [];
    
    // Title and summary
    lines.push(data.title.toUpperCase());
    lines.push('='.repeat(data.title.length));
    lines.push('');
    lines.push(data.summary);
    lines.push('');

    // Sections
    data.sections.forEach(section => {
      lines.push(section.title);
      lines.push('-'.repeat(section.title.length));
      lines.push(stripHtmlTags(section.content)); // Strip HTML for plain text
      lines.push('');

      if (section.subsections) {
        section.subsections.forEach(subsection => {
          lines.push(`  ${subsection.title}`);
          lines.push(`  ${stripHtmlTags(subsection.content)}`);
          lines.push('');
        });
      }

      if (section.data) {
        Object.entries(section.data).forEach(([key, value]) => {
          const stringValue = typeof value === 'string' ? stripHtmlTags(value) : String(value);
          lines.push(`  ${key}: ${stringValue}`);
        });
        lines.push('');
      }
    });

    // Metadata
    lines.push('REPORT INFORMATION');
    lines.push('-'.repeat(18));
    lines.push(`Generated: ${data.metadata.generatedAt.toISOString()}`);
    lines.push(`Generated By: ${data.metadata.generatedBy}`);
    lines.push(`Version: ${data.metadata.version}`);
    
    if (data.metadata.repository) {
      lines.push(`Repository: ${data.metadata.repository}`);
    }
    
    if (data.metadata.branch) {
      lines.push(`Branch: ${data.metadata.branch}`);
    }

    return lines.join('\
');
  }
}

/**
 * Factory function to create a new report generator instance
 */
export function createReportGenerator(): ReportGenerator {
  return new ReportGenerator();
}

/**
 * Convenience function to generate an HTML report
 */
export function generateHtmlReport(data: ReportData): string {
  const generator = createReportGenerator();
  return generator.generateReport(data);
}

/**
 * Convenience function to generate a plain text report
 */
export function generatePlainTextReport(data: ReportData): string {
  const generator = createReportGenerator();
  return generator.generatePlainTextReport(data);
}

/**
 * Convenience function to generate a safe HTML report with defaults
 */
export function generateSafeReport(data: Partial<ReportData>): string {
  const generator = createReportGenerator();
  return generator.generateReportSafe(data);
}

/**
 * Convenience function to generate an analysis report
 */
export function generateAnalysisReport(
  data: AnalysisReport | CoordinationResult,
  options: ReportOptions
): Promise<string> {
  const generator = createReportGenerator();
  return generator.generateAnalysisReport(data, options);
}