# Agent-Based Code Analysis System

A comprehensive, modular system for analyzing code quality, type safety, testing, and security using specialized agents that work together to provide detailed insights and recommendations.

## 🎯 Overview

The Agent System is designed to provide thorough code analysis through multiple specialized agents:

- **Code Analysis Agent**: Static analysis, syntax validation, complexity analysis
- **Type Safety Agent**: TypeScript type checking and safety validation  
- **Testing Agent**: Test coverage, quality, and completeness analysis
- **Security Agent**: Vulnerability detection and security best practices

## 🏗️ Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Coordinator                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Agent Registry                         │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │   │
│  │  │  Code   │ │  Type   │ │Testing  │ │Security │  │   │
│  │  │Analysis │ │ Safety  │ │ Agent   │ │ Agent   │  │   │
│  │  │ Agent   │ │ Agent   │ │         │ │         │  │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Agent Interface

All agents implement the `BaseAgent` interface:

```typescript
interface BaseAgent {
  name: string;
  version: string;
  description: string;
  analyze(context: AnalysisContext): Promise<AnalysisResult>;
  canHandle(fileType: string): boolean;
  getDependencies(): string[];
  getPriority(): number;
  validateConfiguration(config: AgentConfiguration): boolean;
  getDefaultConfiguration(): AgentConfiguration;
}
```

## 🚀 Quick Start

### Installation

```bash
npm install
npm run build
```

### Basic Usage

```bash
# Analyze current directory
npx analysis-cli

# Analyze specific project
npx analysis-cli /path/to/project

# Run specific agents
npx analysis-cli --agents code-analysis,security

# Generate JSON report
npx analysis-cli --format json --output report.json

# Verbose output with HTML report
npx analysis-cli --verbose --format html --output report.html
```

### Programmatic Usage

```typescript
import { DefaultAgentCoordinator, DefaultAgentRegistry } from './agents';
import { CodeAnalysisAgent, TypeSafetyAgent, TestingAgent, SecurityAgent } from './agents';

// Setup
const registry = new DefaultAgentRegistry();
const coordinator = new DefaultAgentCoordinator(registry);

// Register agents
registry.register(new CodeAnalysisAgent());
registry.register(new TypeSafetyAgent());
registry.register(new TestingAgent());
registry.register(new SecurityAgent());

// Run analysis
const context = {
  projectPath: '/path/to/project',
  files: ['src/**/*.ts', 'src/**/*.js']
};

const report = await coordinator.runFullAnalysis(context);
console.log(\`Found \${report.summary.totalFindings} issues\`);
```

## 🔍 Agents Overview

### Code Analysis Agent

**Purpose**: Static code analysis for syntax, complexity, and quality

**Capabilities**:
- Syntax validation and error detection
- Cyclomatic complexity analysis
- Code quality checks (long lines, magic numbers, etc.)
- Duplicate code detection
- Console statement detection
- TODO/FIXME comment tracking

**Example Findings**:
```
• Missing semicolon at line 15
• High cyclomatic complexity in function 'processData' (12)
• Magic number found: 86400
• Console statement found - consider removing for production
```

### Type Safety Agent

**Purpose**: TypeScript type safety and coverage analysis

**Capabilities**:
- TypeScript configuration validation
- Type annotation analysis
- 'any' type usage detection
- Interface and type definition validation
- Generic type analysis
- Null safety checks

**Example Findings**:
```
• TypeScript strict mode is not enabled
• Usage of "any" type reduces type safety
• Function parameter missing type annotation
• Potential null/undefined access on 'user'
```

### Testing Agent

**Purpose**: Test coverage, quality, and completeness analysis

**Capabilities**:
- Test coverage analysis
- Test quality assessment
- Missing test detection
- Test structure validation
- Assertion analysis
- Test isolation checks

**Example Findings**:
```
• Source file has no corresponding test file
• Test 'should process data' has no assertions
• Skipped test found - may indicate incomplete implementation
• Large number of tests in single file (25)
```

### Security Agent

**Purpose**: Security vulnerability detection and best practices

**Capabilities**:
- Code injection vulnerability detection
- XSS vulnerability scanning
- SQL injection pattern detection
- Hardcoded secret detection
- Dependency vulnerability analysis
- Authentication/authorization checks

**Example Findings**:
```
• Code injection vulnerability detected (eval usage)
• Hardcoded secret detected in configuration
• Potentially vulnerable dependency: lodash@4.17.15
• CORS configured with wildcard (*)
```

## ⚙️ Configuration

### Configuration File

Create a `analysis-config.json` file:

```json
{
  "code-analysis": {
    "enabled": true,
    "priority": 10,
    "timeout": 30000,
    "options": {
      "maxComplexity": 10,
      "maxNestingLevel": 4,
      "checkConsoleStatements": true
    }
  },
  "type-safety": {
    "enabled": true,
    "options": {
      "strictMode": true,
      "checkAnyTypes": true
    }
  }
}
```

### CLI Options

```bash
Options:
  -p, --path <path>        Project path to analyze
  -a, --agents <agents>    Comma-separated list of agents to run
  -o, --output <file>      Output file path
  -f, --format <format>    Output format: text, json, html
  -v, --verbose           Verbose output
  -e, --exclude <patterns> Exclude patterns
  -i, --include <patterns> Include patterns
  -c, --config <file>      Configuration file path
```

## 📊 Report Formats

### Text Report

```
📊 ANALYSIS SUMMARY
══════════════════════════════════════════════════════
Total Findings: 23
  🔴 Critical: 2
  🟠 High: 5
  🟡 Medium: 12
  🟢 Low: 4
  ℹ️  Info: 0
Files Analyzed: 45
Execution Time: 2847ms

🔍 FINDINGS
══════════════════════════════════════════════════════

🔴 CRITICAL (2)
──────────────────────────────
• Code injection vulnerability detected
  📁 src/utils/processor.ts:23
  🔧 Avoid eval() and Function() constructor

• Hardcoded secret detected
  📁 config/database.ts:15
  🔧 Move secrets to environment variables
```

### JSON Report

```json
{
  "summary": {
    "totalFindings": 23,
    "criticalFindings": 2,
    "highFindings": 5,
    "agentsRun": 4,
    "filesAnalyzed": 45,
    "totalExecutionTime": 2847
  },
  "findings": [
    {
      "id": "security-1634567890-abc123",
      "severity": "critical",
      "category": "security-pattern",
      "message": "Code injection vulnerability detected",
      "file": "src/utils/processor.ts",
      "line": 23,
      "fix": "Avoid eval() and Function() constructor"
    }
  ],
  "recommendations": [
    "Address critical security vulnerabilities immediately",
    "Enable strict TypeScript compiler options"
  ]
}
```

### HTML Report

Interactive HTML report with:
- Summary dashboard
- Filterable findings by severity
- File-based navigation
- Syntax-highlighted code snippets
- Actionable recommendations

## 🔧 Extending the System

### Creating Custom Agents

```typescript
import { AbstractBaseAgent } from './base/base-agent';

export class CustomAgent extends AbstractBaseAgent {
  public readonly name = 'custom-agent';
  public readonly version = '1.0.0';
  public readonly description = 'Custom analysis agent';

  public canHandle(fileType: string): boolean {
    return ['ts', 'js'].includes(fileType);
  }

  public getPriority(): number {
    return 50; // Lower priority
  }

  public async analyze(context: AnalysisContext): Promise<AnalysisResult> {
    const findings = [];
    
    // Your analysis logic here
    
    return this.createResult('success', findings);
  }
}

// Register the agent
registry.register(new CustomAgent());
```

### Adding New Finding Categories

```typescript
// In your custom agent
const finding = this.createFinding(
  'medium',
  'custom-category',
  'Custom issue detected',
  {
    file: 'example.ts',
    line: 42,
    fix: 'Apply custom fix',
    evidence: 'problematic code snippet'
  }
);
```

## 🎯 Best Practices

### Agent Development

1. **Single Responsibility**: Each agent should focus on one analysis domain
2. **Dependency Management**: Declare dependencies on other agents when needed
3. **Error Handling**: Gracefully handle errors and continue analysis
4. **Performance**: Use efficient algorithms and respect timeout limits
5. **Actionable Findings**: Provide clear messages and fix suggestions

### Configuration

1. **Environment-Specific**: Use different configs for dev/staging/production
2. **Team Standards**: Align configuration with team coding standards
3. **Incremental Adoption**: Start with warnings, gradually increase strictness
4. **Documentation**: Document custom configuration options

### Integration

1. **CI/CD Integration**: Run analysis in continuous integration pipelines
2. **Pre-commit Hooks**: Catch issues before they reach the repository
3. **IDE Integration**: Provide real-time feedback during development
4. **Monitoring**: Track analysis metrics over time

## 🚨 Troubleshooting

### Common Issues

**Agent Not Found**
```bash
Error: Agent 'custom-agent' not found
```
Solution: Ensure the agent is registered before running analysis.

**Timeout Errors**
```bash
Agent 'security' timed out after 30000ms
```
Solution: Increase timeout in configuration or optimize agent performance.

**File Access Errors**
```bash
Could not read file: permission denied
```
Solution: Check file permissions and ensure the analysis process has read access.

### Performance Optimization

1. **File Filtering**: Use include/exclude patterns to limit scope
2. **Parallel Execution**: Agents run in dependency order but can be parallelized
3. **Caching**: Implement result caching for unchanged files
4. **Incremental Analysis**: Only analyze changed files in CI/CD

## 📈 Metrics and Monitoring

### Key Metrics

- **Finding Trends**: Track finding counts over time
- **Agent Performance**: Monitor execution times and success rates
- **Code Quality Score**: Aggregate metric based on findings
- **Coverage Metrics**: Test coverage, type coverage, etc.

### Integration Examples

```typescript
// Custom metrics collection
coordinator.addEventListener((event) => {
  if (event.type === 'analysis-complete') {
    const report = event.data.report;
    metrics.recordAnalysis({
      timestamp: new Date(),
      findings: report.summary.totalFindings,
      criticalIssues: report.summary.criticalFindings,
      executionTime: report.summary.totalExecutionTime
    });
  }
});
```

## 🤝 Contributing

### Adding New Agents

1. Create agent class extending `AbstractBaseAgent`
2. Implement required methods
3. Add comprehensive tests
4. Update documentation
5. Submit pull request

### Improving Existing Agents

1. Identify improvement opportunities
2. Add new detection patterns
3. Enhance finding messages and fixes
4. Update tests and documentation

## 📚 API Reference

### Core Classes

- `DefaultAgentRegistry`: Manages agent registration and discovery
- `DefaultAgentCoordinator`: Orchestrates analysis execution
- `AbstractBaseAgent`: Base class for all agents
- `AnalysisContext`: Input context for analysis
- `AnalysisResult`: Output from individual agents
- `AnalysisReport`: Aggregated results from all agents

### Interfaces

- `BaseAgent`: Core agent interface
- `Finding`: Individual issue or observation
- `AgentConfiguration`: Agent-specific configuration
- `AgentEvent`: Event emitted during analysis

## 🔗 Related Tools

- **ESLint**: JavaScript/TypeScript linting
- **TypeScript Compiler**: Type checking
- **Jest**: Testing framework
- **SonarQube**: Code quality platform
- **Snyk**: Security vulnerability scanning

## 📄 License

MIT License - see LICENSE file for details.

---

For more information, examples, and updates, visit the [project repository](https://github.com/your-org/agent-system).