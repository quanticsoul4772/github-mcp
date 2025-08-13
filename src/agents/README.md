# Code Analysis Agents System

A comprehensive multi-agent system for analyzing code and detecting errors, security issues, performance problems, and maintainability concerns.

## Overview

The agents system provides a flexible framework for running multiple code analysis agents in parallel, coordinating their results, and generating comprehensive reports. It's designed to be extensible, allowing you to add new agents and customize analysis workflows.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Coordinator   │────│   Base Agent     │────│ Static Analysis │
│                 │    │   (Abstract)     │    │     Agent       │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ • Manages agents│    │ • Common interface│    │ • TypeScript/JS │
│ • Runs in parallel│  │ • Finding creation│    │ • Security rules│
│ • Deduplicates  │    │ • Error handling │    │ • Performance   │
│ • Coordinates   │    │ • Capabilities   │    │ • Best practices│
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌──────────────────┐
                    │ Report Generator │
                    ├──────────────────┤
                    │ • Multiple formats│
                    │ • Filtering      │
                    │ • Grouping       │
                    │ • Recommendations│
                    └──────────────────┘
```

## Core Components

### 1. Base Agent (`BaseAgent`)

Abstract base class that all analysis agents must extend:

```typescript
abstract class BaseAgent {
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly capabilities: AgentCapabilities;
  
  abstract analyze(context: AnalysisContext): Promise<AnalysisReport>;
}
```

### 2. Agent Coordinator (`AgentCoordinator`)

Manages multiple agents and coordinates their execution:

- **Parallel Execution**: Runs agents concurrently with configurable limits
- **Error Handling**: Continues analysis even if some agents fail
- **Retry Logic**: Automatically retries failed agents
- **Deduplication**: Removes duplicate findings across agents
- **Timeout Management**: Prevents agents from running indefinitely

### 3. Static Analysis Agent (`StaticAnalysisAgent`)

Built-in agent that analyzes TypeScript/JavaScript code for:

- **Security Issues**: `eval()` usage, potential XSS vulnerabilities
- **Performance Problems**: Console statements, inefficient patterns
- **Maintainability**: Use of `any` type, code complexity
- **Reliability**: Empty catch blocks, error handling
- **Best Practices**: `const` vs `let`, naming conventions

### 4. Report Generator (`ReportGenerator`)

Generates comprehensive reports in multiple formats:

- **JSON**: Machine-readable format for integration
- **Markdown**: Human-readable documentation
- **HTML**: Rich web-based reports with charts
- **Console**: Terminal-friendly output
- **CSV**: Spreadsheet-compatible data export

## Quick Start

### Basic Usage

```typescript
import {
  AgentCoordinator,
  StaticAnalysisAgent,
  ReportGenerator,
  AnalysisContext
} from './agents/index.js';

// Create coordinator and register agents
const coordinator = new AgentCoordinator();
const staticAgent = new StaticAnalysisAgent();
coordinator.registerAgent(staticAgent);

// Define analysis context
const context: AnalysisContext = {
  repositoryPath: './src',
  excludePatterns: ['*.test.ts', 'node_modules'],
  includePatterns: ['**/*.ts', '**/*.js']
};

// Run analysis
const result = await coordinator.runAnalysis(context);

// Generate report
const reportGenerator = new ReportGenerator();
const report = await reportGenerator.generateReport(result, {
  format: 'console',
  includeDetails: true,
  includeRecommendations: true
});

console.log(report);
```

### Advanced Configuration

```typescript
// Configure coordinator
const coordinator = new AgentCoordinator({
  maxConcurrency: 3,        // Run up to 3 agents in parallel
  timeout: 300000,          // 5 minute timeout per agent
  retries: 2,               // Retry failed agents twice
  failFast: false,          // Continue even if agents fail
  deduplication: true       // Remove duplicate findings
});

// Configure analysis context
const context: AnalysisContext = {
  repositoryPath: './src',
  files: ['src/index.ts', 'src/main.ts'], // Specific files
  excludePatterns: [
    'node_modules',
    '*.test.ts',
    '*.spec.ts',
    'dist',
    'build'
  ],
  includePatterns: [
    'src/**/*.ts',
    'src/**/*.js',
    'lib/**/*.ts'
  ],
  maxFileSize: 1024 * 1024, // 1MB max file size
  timeout: 30000,           // 30 second timeout per file
  metadata: {
    project: 'my-project',
    version: '1.0.0'
  }
};
```

## Report Formats

### Console Report

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                            CODE ANALYSIS REPORT                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

📊 SUMMARY
──────────────────────────────────────────────────────
Total Findings:     23
Files Analyzed:     45
Analysis Time:      1,234ms
Agents Used:        static-analysis

🚨 SEVERITY BREAKDOWN
──────────────────────────────────────────────────────
🔴 Critical:        2
🟠 High:            5
🟡 Medium:          8
🔵 Low:             6
⚪ Info:            2
```

### Markdown Report

```markdown
# Code Analysis Report

**Generated:** 2024-01-15T10:30:00.000Z
**Agents Used:** static-analysis
**Analysis Time:** 1,234ms

## Summary

- **Total Findings:** 23
- **Files Analyzed:** 45
- **Critical Issues:** 2
- **High Priority:** 5

### Severity Distribution

```
🔴 Critical  │████████████████████│ 2
🟠 High      │██████████████████░░│ 5
🟡 Medium    │████████████░░░░░░░░│ 8
🔵 Low       │██████░░░░░░░░░░░░░░│ 6
⚪ Info      │██░░░░░░░░░░░░░░░░░░│ 2
```

## Detailed Findings

### 🔴 Critical Issues

#### Use of eval() detected

- **File:** `src/utils/parser.ts`
- **Line:** 42
- **Severity:** critical
- **Category:** security
- **Rule:** no-eval

**Description:** eval() can execute arbitrary code and poses a security risk.

**Suggestion:** Use JSON.parse() for JSON data or Function constructor for safer code execution
```

### HTML Report

Rich web-based report with:
- Interactive charts and graphs
- Filterable findings table
- Severity-based color coding
- Responsive design for mobile/desktop
- Export capabilities

### JSON Report

```json
{
  "metadata": {
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "format": "json",
    "version": "1.0.0"
  },
  "summary": {
    "totalFindings": 23,
    "criticalFindings": 2,
    "highFindings": 5,
    "mediumFindings": 8,
    "lowFindings": 6,
    "infoFindings": 2,
    "filesAnalyzed": 45,
    "agentsUsed": ["static-analysis"],
    "analysisTime": 1234
  },
  "findings": [
    {
      "id": "static-analysis-1642248600000-abc123def",
      "severity": "critical",
      "category": "security",
      "title": "Use of eval() detected",
      "description": "eval() can execute arbitrary code and poses a security risk.",
      "file": "src/utils/parser.ts",
      "line": 42,
      "rule": "no-eval",
      "suggestion": "Use JSON.parse() for JSON data or Function constructor for safer code execution"
    }
  ]
}
```

## Filtering and Grouping

### Filter by Severity

```typescript
const report = await reportGenerator.generateReport(result, {
  format: 'markdown',
  filterSeverity: [Severity.CRITICAL, Severity.HIGH],
  includeDetails: true
});
```

### Filter by Category

```typescript
const report = await reportGenerator.generateReport(result, {
  format: 'html',
  filterCategory: [FindingCategory.SECURITY, FindingCategory.PERFORMANCE],
  groupBy: 'category'
});
```

### Group and Sort

```typescript
const report = await reportGenerator.generateReport(result, {
  format: 'console',
  groupBy: 'file',        // Group by file, severity, or category
  sortBy: 'severity',     // Sort by severity, category, file, or line
  includeDetails: true
});
```

## Creating Custom Agents

### 1. Extend BaseAgent

```typescript
import { BaseAgent, AnalysisContext, AnalysisReport, Finding, Severity, FindingCategory } from './types.js';

export class CustomSecurityAgent extends BaseAgent {
  readonly name = 'custom-security';
  readonly version = '1.0.0';
  readonly capabilities = {
    supportedFileTypes: ['.ts', '.js', '.json'],
    supportedLanguages: ['typescript', 'javascript'],
    categories: [FindingCategory.SECURITY],
    requiresNetwork: false,
    requiresFileSystem: true,
    canRunInParallel: true
  };

  async analyze(context: AnalysisContext): Promise<AnalysisReport> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    // Your analysis logic here
    const files = await this.getFilesToAnalyze(context);
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const fileFindings = this.analyzeFile(content, file);
      findings.push(...fileFindings);
    }

    const duration = Date.now() - startTime;
    
    return {
      agentName: this.name,
      version: this.version,
      summary: {
        filesAnalyzed: files.length,
        totalFindings: findings.length,
        findingsBySeverity: this.groupBySeverity(findings),
        findingsByCategory: this.groupByCategory(findings),
        duration,
        timestamp: new Date()
      },
      findings,
      duration,
      timestamp: new Date()
    };
  }

  private analyzeFile(content: string, filePath: string): Finding[] {
    const findings: Finding[] = [];
    
    // Example: Check for hardcoded secrets
    const secretPattern = /(password|secret|key|token)\s*[:=]\s*["'][^"']+["']/gi;
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      if (secretPattern.test(line)) {
        findings.push(this.createFinding(
          Severity.CRITICAL,
          FindingCategory.SECURITY,
          'Potential hardcoded secret',
          'Hardcoded secrets should not be stored in source code',
          filePath,
          {
            line: index + 1,
            rule: 'no-hardcoded-secrets',
            snippet: line.trim(),
            suggestion: 'Use environment variables or secure secret management'
          }
        ));
      }
    });
    
    return findings;
  }
}
```

### 2. Register with Coordinator

```typescript
const coordinator = new AgentCoordinator();
const customAgent = new CustomSecurityAgent();
coordinator.registerAgent(customAgent);
```

## Integration with GitHub MCP Server

The agents system integrates seamlessly with the GitHub MCP server through dedicated tools:

### Available Tools

1. **`run_code_analysis`** - Run comprehensive code analysis
2. **`generate_analysis_report`** - Generate formatted reports
3. **`list_analysis_agents`** - List available agents and capabilities
4. **`get_analysis_summary`** - Get quick analysis summary
5. **`run_security_analysis`** - Security-focused analysis

### Usage via MCP

```typescript
// Register agent tools with MCP server
import { createAgentTools } from './agents/tools/agent-tools.js';

const agentTools = createAgentTools();
agentTools.forEach(tool => {
  server.addTool(tool);
});
```

## Configuration Options

### Coordinator Configuration

```typescript
interface CoordinatorConfig {
  maxConcurrency: number;    // Max agents running in parallel
  timeout: number;           // Timeout per agent (ms)
  retries: number;           // Retry attempts for failed agents
  failFast: boolean;         // Stop on first agent failure
  deduplication: boolean;    // Remove duplicate findings
}
```

### Analysis Context

```typescript
interface AnalysisContext {
  repositoryPath: string;           // Required: path to analyze
  files?: string[];                 // Optional: specific files
  excludePatterns?: string[];       // Optional: exclude patterns
  includePatterns?: string[];       // Optional: include patterns
  maxFileSize?: number;             // Optional: max file size
  timeout?: number;                 // Optional: timeout per file
  metadata?: Record<string, any>;   // Optional: custom metadata
}
```

### Report Options

```typescript
interface ReportOptions {
  format: 'json' | 'markdown' | 'html' | 'console' | 'csv';
  outputPath?: string;                    // Save to file
  includeDetails?: boolean;               // Include full findings
  groupBy?: 'severity' | 'category' | 'file';
  sortBy?: 'severity' | 'category' | 'file' | 'line';
  filterSeverity?: Severity[];            // Filter by severity
  filterCategory?: FindingCategory[];     // Filter by category
  includeMetrics?: boolean;               // Include performance metrics
  includeRecommendations?: boolean;       // Include recommendations
}
```

## Best Practices

### 1. Agent Development

- **Single Responsibility**: Each agent should focus on one type of analysis
- **Error Handling**: Gracefully handle file read errors and parsing failures
- **Performance**: Use streaming for large files, implement timeouts
- **Capabilities**: Accurately declare what your agent can analyze

### 2. Coordinator Usage

- **Concurrency**: Balance parallelism with system resources
- **Timeouts**: Set appropriate timeouts based on expected analysis time
- **Retries**: Use retries for transient failures, not logic errors
- **Deduplication**: Enable for multiple agents analyzing similar issues

### 3. Report Generation

- **Format Selection**: Choose format based on intended audience
- **Filtering**: Use filters to focus on relevant issues
- **Grouping**: Group findings logically for easier review
- **Output**: Save reports to files for sharing and archiving

## Troubleshooting

### Common Issues

1. **Agent Timeouts**
   - Increase timeout values
   - Reduce file size limits
   - Optimize agent performance

2. **Memory Issues**
   - Reduce concurrency
   - Implement streaming for large files
   - Add memory monitoring

3. **No Findings**
   - Check include/exclude patterns
   - Verify file types are supported
   - Review agent capabilities

4. **Duplicate Findings**
   - Enable deduplication
   - Review agent overlap
   - Adjust finding IDs

### Debug Mode

Enable detailed logging:

```typescript
import { logger } from './logger.js';

// Set log level to debug
logger.level = 'debug';

// Run analysis with detailed logging
const result = await coordinator.runAnalysis(context);
```

## Examples

See the `examples/` directory for complete working examples:

- `basic-usage.ts` - Simple analysis workflow
- `custom-agent.ts` - Creating custom agents
- `advanced-reporting.ts` - Advanced report generation
- `integration.ts` - MCP server integration

## Contributing

To add new agents or improve existing ones:

1. Create agent class extending `BaseAgent`
2. Implement required methods and properties
3. Add comprehensive tests
4. Update documentation
5. Register with coordinator

## License

This agents system is part of the GitHub MCP Server project and follows the same license terms.