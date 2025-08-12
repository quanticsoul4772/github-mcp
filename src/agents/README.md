# Code Analysis Agent System

A comprehensive, multi-agent system for testing and analyzing code for errors, security vulnerabilities, performance issues, and code quality problems.

## Overview

The Code Analysis Agent System provides a modular, extensible framework for automated code analysis. It consists of specialized agents that work together to provide comprehensive code quality assessment, test generation, and detailed reporting.

## Features

- 🔍 **Multi-Agent Analysis**: Specialized agents for different types of analysis
- 🚀 **Parallel Processing**: Run multiple agents simultaneously for faster results
- 📊 **Comprehensive Reporting**: Generate reports in multiple formats (JSON, Markdown, HTML, CSV)
- 🧪 **Test Generation**: Automatically generate unit tests for your code
- 🔒 **Security Scanning**: Detect potential security vulnerabilities
- ⚡ **Performance Analysis**: Identify performance bottlenecks and issues
- 🎯 **Configurable**: Customize analysis depth, severity levels, and categories
- 🏥 **Health Monitoring**: Monitor agent health and performance metrics

## Architecture

### Core Components

1. **Base Agent System** (`base/`)
   - `BaseAgent`: Abstract base class for all agents
   - `AgentCoordinator`: Orchestrates multiple agents
   - `AgentRegistry`: Manages agent registration and discovery

2. **Analysis Agents** (`analysis/`)
   - `StaticAnalysisAgent`: Static code analysis for syntax, patterns, and quality
   - `ErrorDetectionAgent`: Runtime error detection and edge case analysis

3. **Testing Agents** (`testing/`)
   - `TestGenerationAgent`: Generates comprehensive test suites

4. **Reporting System** (`reporting/`)
   - `ReportGenerator`: Creates detailed reports in multiple formats

5. **MCP Integration** (`tools/`)
   - `AgentTools`: MCP tools for GitHub server integration

## Quick Start

### Basic Usage

```typescript
import { createAgentSystem, quickAnalyze } from './agents/index.js';

// Quick analysis of a single file
const result = await quickAnalyze('./src/myfile.ts', {
  type: 'file',
  format: 'markdown'
});

console.log(result.report);
```

### Comprehensive Project Analysis

```typescript
import { AgentCoordinator, StaticAnalysisAgent, ErrorDetectionAgent } from './agents/index.js';

// Create coordinator and register agents
const coordinator = new AgentCoordinator();
coordinator.registerAgent(new StaticAnalysisAgent());
coordinator.registerAgent(new ErrorDetectionAgent());

// Define analysis target
const target = {
  type: 'project',
  path: './src',
  depth: 'comprehensive',
  exclude: ['node_modules/**', 'dist/**']
};

// Run coordinated analysis
const result = await coordinator.coordinate({
  target,
  parallel: true,
  config: {
    minSeverity: 'medium',
    maxFindings: 100
  }
});

console.log(`Found ${result.summary.totalFindings} issues`);
```

### Generate Tests

```typescript
import { TestGenerationAgent } from './agents/index.js';

const testAgent = new TestGenerationAgent();

const testResult = await testAgent.generateTests({
  target: './src/utils.ts',
  testType: 'unit',
  framework: 'vitest',
  coverage: { lines: 80, functions: 80, branches: 70 }
});

// Save generated tests
import fs from 'fs/promises';
await fs.writeFile('./src/utils.test.ts', testResult.content);
```

### Generate Reports

```typescript
import { ReportGenerator } from './agents/index.js';

const reportGenerator = new ReportGenerator();

// Generate HTML report
const htmlReport = await reportGenerator.generateReport(analysisResult, {
  format: 'html',
  outputPath: './reports/analysis.html',
  includeDetails: true,
  groupBy: 'severity',
  includeRecommendations: true
});
```

## Available Agents

### StaticAnalysisAgent

Analyzes code for:
- Syntax errors and issues
- Code smells and anti-patterns
- Naming convention violations
- Complexity analysis
- Import/export issues
- TypeScript-specific problems

**Configuration:**
```typescript
agent.configure({
  depth: 'comprehensive',
  maxFindings: 50,
  minSeverity: 'low',
  includeCategories: ['syntax_error', 'code_smell', 'best_practice']
});
```

### ErrorDetectionAgent

Detects potential runtime errors:
- Null pointer exceptions
- Array bounds errors
- Async/await issues
- Resource leaks
- Error handling problems
- Basic security vulnerabilities

**Configuration:**
```typescript
agent.configure({
  depth: 'deep',
  maxFindings: 30,
  minSeverity: 'medium',
  includeCategories: ['runtime_error', 'security_vulnerability']
});
```

### TestGenerationAgent

Generates comprehensive test suites:
- Unit tests for functions and classes
- Edge case testing
- Error condition testing
- Mock parameter generation
- Multiple framework support (Vitest, Jest, Mocha)

**Configuration:**
```typescript
const request = {
  target: './src/calculator.ts',
  testType: 'unit',
  framework: 'vitest',
  coverage: {
    lines: 90,
    functions: 85,
    branches: 80
  }
};
```

## Report Formats

### Markdown Report
```typescript
const report = await reportGenerator.generateReport(result, {
  format: 'markdown',
  includeDetails: true,
  groupBy: 'severity',
  includeRecommendations: true
});
```

### HTML Report
```typescript
const report = await reportGenerator.generateReport(result, {
  format: 'html',
  outputPath: './analysis-report.html',
  includeDetails: true
});
```

### JSON Report
```typescript
const report = await reportGenerator.generateReport(result, {
  format: 'json',
  includeDetails: false // For summary only
});
```

### Console Report
```typescript
const report = await reportGenerator.generateReport(result, {
  format: 'console',
  groupBy: 'category'
});
console.log(report);
```

## MCP Integration

The agent system integrates with the GitHub MCP server through specialized tools:

### Available MCP Tools

1. **`list_analysis_agents`** - List all available agents and their capabilities
2. **`analyze_code`** - Run comprehensive multi-agent analysis
3. **`analyze_with_single_agent`** - Run analysis with a specific agent
4. **`generate_tests`** - Generate test cases for code
5. **`generate_analysis_report`** - Create comprehensive reports
6. **`quick_code_scan`** - Run quick scans for immediate feedback
7. **`configure_agent`** - Configure agent settings
8. **`get_agent_health`** - Monitor agent health and performance

### Example MCP Usage

```json
{
  "tool": "analyze_code",
  "arguments": {
    "target": "./src",
    "type": "directory",
    "depth": "deep",
    "parallel": true,
    "minSeverity": "medium"
  }
}
```

## Configuration Options

### Agent Configuration

```typescript
interface AgentConfig {
  enabled: boolean;
  depth: 'shallow' | 'deep' | 'comprehensive';
  maxFindings?: number;
  minSeverity?: Severity;
  includeCategories?: FindingCategory[];
  excludeCategories?: FindingCategory[];
  timeout?: number;
  enableCache?: boolean;
}
```

### Analysis Target

```typescript
interface AnalysisTarget {
  type: 'file' | 'directory' | 'project';
  path: string;
  include?: string[]; // Glob patterns
  exclude?: string[]; // Glob patterns
  depth?: 'shallow' | 'deep' | 'comprehensive';
}
```

### Coordination Request

```typescript
interface CoordinationRequest {
  target: AnalysisTarget;
  agents?: string[]; // Specific agents to use
  config?: Partial<AgentConfig>; // Global config overrides
  parallel?: boolean; // Run in parallel
  timeout?: number; // Max time to wait
}
```

## Severity Levels

- **CRITICAL** 🔴 - Issues that could cause system failures or security breaches
- **HIGH** 🟠 - Important issues that should be addressed soon
- **MEDIUM** 🟡 - Moderate issues that affect code quality
- **LOW** 🔵 - Minor issues and improvements
- **INFO** ⚪ - Informational findings and suggestions

## Finding Categories

- `SYNTAX_ERROR` - Syntax and parsing errors
- `TYPE_ERROR` - Type-related issues
- `RUNTIME_ERROR` - Potential runtime errors
- `SECURITY_VULNERABILITY` - Security issues
- `PERFORMANCE_ISSUE` - Performance problems
- `CODE_SMELL` - Code quality issues
- `BEST_PRACTICE` - Best practice violations
- `MAINTAINABILITY` - Maintainability concerns
- `TESTING` - Testing-related issues
- `DOCUMENTATION` - Documentation problems

## Advanced Usage

### Custom Agent Development

```typescript
import { BaseAgent, AgentCapabilities, Finding } from './agents/index.js';

class CustomSecurityAgent extends BaseAgent {
  constructor() {
    super(
      'custom-security',
      '1.0.0',
      'Custom security analysis agent',
      {
        supportedFileTypes: ['ts', 'js'],
        analysisTypes: ['security_vulnerability'],
        canSuggestFixes: true,
        canGenerateTests: false,
        supportsIncremental: true,
        performance: { speed: 'fast', memoryUsage: 'low', cpuUsage: 'low' }
      }
    );
  }

  protected async performAnalysis(target: AnalysisTarget): Promise<Finding[]> {
    // Implement custom security analysis logic
    const findings: Finding[] = [];
    // ... analysis implementation
    return findings;
  }
}

// Register with coordinator
coordinator.registerAgent(new CustomSecurityAgent());
```

### Filtering and Sorting

```typescript
// Filter by severity and category
const result = await coordinator.coordinate({
  target,
  config: {
    minSeverity: 'high',
    includeCategories: ['security_vulnerability', 'runtime_error'],
    excludeCategories: ['code_smell']
  }
});

// Generate filtered report
const report = await reportGenerator.generateReport(result, {
  format: 'markdown',
  filterSeverity: ['critical', 'high'],
  sortBy: 'severity',
  groupBy: 'category'
});
```

### Health Monitoring

```typescript
// Check agent health
const health = await coordinator.getAgentsHealth();
const summary = await coordinator.healthCheck();

console.log(`Healthy agents: ${summary.healthyAgents}/${summary.agentCount}`);

// Monitor specific agent
const agent = coordinator.getAgent('static-analysis');
const agentHealth = await agent.getHealth();
console.log(`Agent status: ${agentHealth.status}`);
```

## Performance Considerations

- **Parallel Execution**: Use `parallel: true` for faster analysis of large codebases
- **Depth Control**: Use `shallow` depth for quick scans, `comprehensive` for thorough analysis
- **Finding Limits**: Set `maxFindings` to control memory usage and processing time
- **Caching**: Enable `enableCache` for repeated analysis of the same files
- **Filtering**: Use severity and category filters to focus on relevant issues

## Best Practices

1. **Start with Quick Scans**: Use shallow analysis for immediate feedback
2. **Progressive Analysis**: Run deeper analysis on problem areas identified in quick scans
3. **Regular Health Checks**: Monitor agent health in production environments
4. **Custom Configuration**: Tailor agent configuration to your project's needs
5. **Automated Integration**: Integrate with CI/CD pipelines for continuous quality monitoring
6. **Report Archiving**: Save reports for trend analysis and compliance

## Troubleshooting

### Common Issues

1. **Agent Not Found**: Ensure agents are properly registered with the coordinator
2. **Analysis Timeout**: Increase timeout values for large codebases
3. **Memory Issues**: Reduce `maxFindings` or use `shallow` depth for large projects
4. **Permission Errors**: Ensure read access to all target files and directories

### Debug Mode

```typescript
// Enable debug logging
import { logger } from '../logger.js';
logger.level = 'debug';

// Check agent configuration
const config = agent.getConfig();
console.log('Agent config:', config);

// Monitor analysis progress
agent.configure({ enableCache: false }); // Disable cache for debugging
```

## Contributing

To add new agents or extend functionality:

1. Extend `BaseAgent` for new analysis agents
2. Implement the `performAnalysis` method
3. Define appropriate capabilities and configuration
4. Register with the coordinator
5. Add corresponding MCP tools if needed
6. Update documentation and examples

## License

This agent system is part of the GitHub MCP Server project and follows the same licensing terms.