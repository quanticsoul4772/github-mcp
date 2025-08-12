# CI/CD Integration Guide

This guide explains how to integrate the Code Analysis Agent system into your CI/CD pipeline for automated code quality monitoring, security scanning, and test generation.

## Overview

The agent system provides multiple integration options:
- **GitHub Actions workflows** for comprehensive analysis
- **Pre-commit hooks** for immediate feedback
- **Docker containers** for consistent environments
- **CLI scripts** for flexible integration
- **Quality gates** for deployment control

## Quick Start

### 1. Enable GitHub Actions Workflows

The system includes several pre-configured workflows:

```bash
# Workflows are automatically available in .github/workflows/
- code-analysis.yml      # Main analysis workflow
- ci.yml                # Updated CI with agent integration
- security.yml          # Security scanning
```

### 2. Run Local Analysis

```bash
# Quick analysis
npm run agents:quick-scan

# Comprehensive analysis
npm run agents:analyze

# Security scan
npm run agents:security-scan

# Generate tests
npm run agents:generate-tests src/myfile.ts

# Health check
npm run agents:health
```

### 3. Set Up Git Hooks

```bash
# Install pre-commit hooks
./scripts/ci-integration.sh setup-hooks

# Or manually copy
cp .github/hooks/pre-commit-agents.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## GitHub Actions Integration

### Workflow Triggers

The analysis workflows trigger on:
- **Pull Requests**: Quick analysis with PR comments
- **Push to main/develop**: Comprehensive analysis
- **Schedule**: Daily comprehensive analysis
- **Manual dispatch**: On-demand analysis with custom parameters

### Workflow Features

#### Quick Analysis (Pull Requests)
- Analyzes only changed files
- Fast feedback (< 2 minutes)
- Automatic PR comments with results
- Fails on critical issues

#### Comprehensive Analysis (Push/Schedule)
- Full project analysis
- Multiple report formats (JSON, Markdown, HTML)
- GitHub Pages deployment for reports
- Automatic issue creation for critical findings

#### Security Analysis
- Security-focused scanning
- SARIF output for GitHub Security tab
- Integration with existing security workflows

#### Test Generation
- Automatic test generation for uncovered files
- Creates PRs with generated tests
- Validates generated tests

### Configuration

Configure workflows through environment variables or workflow inputs:

```yaml
env:
  ANALYSIS_DEPTH: deep          # shallow, deep, comprehensive
  TARGET_PATH: src/             # Path to analyze
  FAIL_ON_SEVERITY: critical    # critical, high, medium, low
  MAX_ISSUES: 50               # Maximum allowed issues
```

### Workflow Outputs

Workflows generate:
- **Artifacts**: Analysis reports and metrics
- **GitHub Outputs**: Issue counts and summaries
- **PR Comments**: Quick feedback on changes
- **Issues**: Automatic issue creation for critical findings
- **GitHub Pages**: Web-viewable reports

## Docker Integration

### Using Docker Compose

```bash
# Run comprehensive analysis
docker-compose -f docker-compose.agents.yml up code-analysis

# Run quick analysis
docker-compose -f docker-compose.agents.yml up quick-analysis

# Run security scan
docker-compose -f docker-compose.agents.yml up security-analysis

# Generate tests
docker-compose -f docker-compose.agents.yml up test-generation

# Start analysis dashboard
docker-compose -f docker-compose.agents.yml up analysis-dashboard
```

### Custom Docker Commands

```bash
# Build analysis image
docker build -f Dockerfile.agents -t github-mcp-agents .

# Run analysis
docker run --rm \
  -v ./src:/app/src:ro \
  -v ./output:/app/output \
  github-mcp-agents \
  /app/scripts/run-analysis.sh comprehensive src/ json /app/output

# Health check
docker run --rm github-mcp-agents /app/scripts/health-check.sh
```

### Analysis Dashboard

Access the web dashboard at `http://localhost:8080` when running the dashboard service:
- View analysis reports
- Browse historical results
- Download reports in various formats

## CLI Integration

### Using the Integration Script

```bash
# Quick quality check
./scripts/ci-integration.sh quick-check --target src/ --format console

# Full analysis with custom settings
./scripts/ci-integration.sh full-analysis \
  --depth comprehensive \
  --output reports/ \
  --fail-on high \
  --max-issues 20

# Security scan
./scripts/ci-integration.sh security-scan --fail-on medium

# Quality gate for deployment
./scripts/ci-integration.sh quality-gate --max-issues 10

# Health check
./scripts/ci-integration.sh health-check
```

### Script Options

| Option | Description | Default |
|--------|-------------|---------|
| `--target PATH` | Target path to analyze | `src/` |
| `--depth LEVEL` | Analysis depth | `deep` |
| `--format FORMAT` | Output format | `json` |
| `--output DIR` | Output directory | `ci-output/` |
| `--fail-on LEVEL` | Fail on severity level | `critical` |
| `--max-issues NUM` | Maximum allowed issues | unlimited |
| `--parallel` | Run agents in parallel | `true` |
| `--docker` | Use Docker for analysis | `false` |

## Quality Gates

### Basic Quality Gate

```bash
# Fail if critical issues found
./scripts/ci-integration.sh quality-gate --fail-on critical

# Fail if more than 10 issues total
./scripts/ci-integration.sh quality-gate --max-issues 10

# Fail if high or critical issues found
./scripts/ci-integration.sh quality-gate --fail-on high
```

### Advanced Quality Gate

```yaml
# In GitHub Actions
- name: Quality Gate
  run: |
    # Run analysis
    ./scripts/ci-integration.sh full-analysis --format json
    
    # Check results
    CRITICAL=$(jq -r '.summary.criticalFindings // 0' ci-output/analysis-summary.json)
    HIGH=$(jq -r '.summary.highFindings // 0' ci-output/analysis-summary.json)
    TOTAL=$(jq -r '.summary.totalFindings // 0' ci-output/analysis-summary.json)
    
    # Custom quality rules
    if [ "$CRITICAL" -gt 0 ]; then
      echo "❌ Critical issues found: $CRITICAL"
      exit 1
    elif [ "$HIGH" -gt 5 ]; then
      echo "❌ Too many high-priority issues: $HIGH"
      exit 1
    elif [ "$TOTAL" -gt 50 ]; then
      echo "❌ Too many total issues: $TOTAL"
      exit 1
    else
      echo "✅ Quality gate passed"
    fi
```

## Integration Examples

### Jenkins Pipeline

```groovy
pipeline {
    agent any
    
    stages {
        stage('Code Analysis') {
            steps {
                script {
                    // Run analysis
                    sh './scripts/ci-integration.sh full-analysis --format json'
                    
                    // Parse results
                    def results = readJSON file: 'ci-output/analysis-summary.json'
                    
                    // Set build status
                    if (results.criticalFindings > 0) {
                        currentBuild.result = 'FAILURE'
                        error("Critical issues found: ${results.criticalFindings}")
                    }
                }
            }
            post {
                always {
                    // Archive reports
                    archiveArtifacts artifacts: 'ci-output/**/*', fingerprint: true
                    
                    // Publish HTML report
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'ci-output',
                        reportFiles: 'full-analysis.html',
                        reportName: 'Code Analysis Report'
                    ])
                }
            }
        }
    }
}
```

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - analysis
  - quality-gate

code-analysis:
  stage: analysis
  image: node:20-alpine
  before_script:
    - npm ci
    - npm run build
  script:
    - ./scripts/ci-integration.sh full-analysis --format json
  artifacts:
    reports:
      junit: ci-output/analysis-summary.json
    paths:
      - ci-output/
    expire_in: 1 week
  only:
    - merge_requests
    - main

quality-gate:
  stage: quality-gate
  image: alpine:latest
  dependencies:
    - code-analysis
  before_script:
    - apk add --no-cache jq
  script:
    - |
      CRITICAL=$(jq -r '.summary.criticalFindings // 0' ci-output/analysis-summary.json)
      if [ "$CRITICAL" -gt 0 ]; then
        echo "Quality gate failed: $CRITICAL critical issues"
        exit 1
      fi
  only:
    - merge_requests
```

### Azure DevOps

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
      - main
      - develop

pool:
  vmImage: 'ubuntu-latest'

steps:
- task: NodeTool@0
  inputs:
    versionSpec: '20.x'
  displayName: 'Install Node.js'

- script: |
    npm ci
    npm run build
  displayName: 'Install dependencies and build'

- script: |
    ./scripts/ci-integration.sh full-analysis --format json
  displayName: 'Run code analysis'

- task: PublishTestResults@2
  inputs:
    testResultsFormat: 'JUnit'
    testResultsFiles: 'ci-output/analysis-summary.json'
    testRunTitle: 'Code Analysis Results'
  condition: always()

- task: PublishHtmlReport@1
  inputs:
    reportDir: 'ci-output'
    tabName: 'Code Analysis'
  condition: always()
```

## Pre-commit Integration

### Husky Setup

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged && .github/hooks/pre-commit-agents.sh"
    }
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

### Manual Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Run quick analysis on staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$' || echo "")

if [ -n "$STAGED_FILES" ]; then
    echo "🔍 Running code analysis on staged files..."
    
    # Build if needed
    if [ ! -d "build" ]; then
        npm run build
    fi
    
    # Run quick analysis
    if ! npm run agents:quick-scan; then
        echo "❌ Code analysis failed. Fix issues or use --no-verify to skip."
        exit 1
    fi
fi
```

## Monitoring and Alerting

### GitHub Issues Integration

The system automatically creates GitHub issues for critical findings:

```yaml
# Automatic issue creation
- name: Create issue for critical findings
  if: failure()
  uses: actions/github-script@v7
  with:
    script: |
      const summary = JSON.parse(fs.readFileSync('analysis-summary.json', 'utf8'));
      
      if (summary.criticalFindings > 0) {
        await github.rest.issues.create({
          owner: context.repo.owner,
          repo: context.repo.repo,
          title: `🚨 Critical Code Quality Issues - ${summary.criticalFindings} found`,
          body: `Critical issues detected in latest analysis...`,
          labels: ['code-quality', 'critical', 'automated']
        });
      }
```

### Slack Integration

```bash
# Send Slack notification
if [ "$CRITICAL_ISSUES" -gt 0 ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🚨 Critical code quality issues found: $CRITICAL_ISSUES\"}" \
        $SLACK_WEBHOOK_URL
fi
```

### Email Notifications

```yaml
# Email notification step
- name: Send email notification
  if: failure()
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: "Code Quality Alert - ${{ github.repository }}"
    body: |
      Critical code quality issues detected in ${{ github.repository }}.
      
      Check the analysis report: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
    to: team@example.com
```

## Performance Optimization

### Caching Strategies

```yaml
# Cache analysis results
- name: Cache analysis results
  uses: actions/cache@v4
  with:
    path: |
      ci-output/
      build/
    key: analysis-${{ hashFiles('src/**/*.ts') }}
    restore-keys: |
      analysis-
```

### Parallel Execution

```bash
# Run multiple analyses in parallel
./scripts/ci-integration.sh quick-check --target src/components/ &
./scripts/ci-integration.sh security-scan --target src/api/ &
./scripts/ci-integration.sh full-analysis --target src/utils/ &

wait  # Wait for all background jobs
```

### Incremental Analysis

```bash
# Analyze only changed files
CHANGED_FILES=$(git diff --name-only HEAD~1 | grep -E '\.(ts|tsx)$' | tr '\n' ' ')

if [ -n "$CHANGED_FILES" ]; then
    for file in $CHANGED_FILES; do
        ./scripts/ci-integration.sh quick-check --target "$file"
    done
fi
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Ensure project builds before analysis
   npm run build
   ```

2. **Permission Errors**
   ```bash
   # Make scripts executable
   chmod +x scripts/ci-integration.sh
   chmod +x .github/hooks/pre-commit-agents.sh
   ```

3. **Docker Issues**
   ```bash
   # Rebuild Docker image
   docker build -f Dockerfile.agents -t github-mcp-agents --no-cache .
   ```

4. **Memory Issues**
   ```bash
   # Reduce analysis scope
   ./scripts/ci-integration.sh quick-check --depth shallow --max-issues 20
   ```

### Debug Mode

```bash
# Enable debug logging
DEBUG=true ./scripts/ci-integration.sh full-analysis

# Verbose Docker output
docker run --rm -e DEBUG=true github-mcp-agents
```

### Health Checks

```bash
# Check agent health
./scripts/ci-integration.sh health-check

# Check system requirements
node --version  # Should be >= 18
npm --version   # Should be >= 8
```

## Best Practices

1. **Start Small**: Begin with quick analysis on PRs
2. **Gradual Rollout**: Increase analysis depth over time
3. **Quality Gates**: Set appropriate thresholds for your project
4. **Regular Monitoring**: Run comprehensive analysis daily
5. **Team Training**: Educate team on interpreting results
6. **Continuous Improvement**: Adjust thresholds based on results

## Configuration Reference

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANALYSIS_DEPTH` | Default analysis depth | `deep` |
| `TARGET_PATH` | Default target path | `src/` |
| `FAIL_ON_SEVERITY` | Default fail-on severity | `critical` |
| `MAX_ISSUES` | Default maximum issues | unlimited |
| `CI` | CI environment flag | `false` |
| `GITHUB_ACTIONS` | GitHub Actions flag | `false` |
| `DEBUG` | Enable debug logging | `false` |

### Agent Configuration

```typescript
// Custom agent configuration
const config = {
  enabled: true,
  depth: 'comprehensive',
  maxFindings: 100,
  minSeverity: 'medium',
  includeCategories: ['security_vulnerability', 'runtime_error'],
  excludeCategories: ['code_smell'],
  timeout: 300000,
  enableCache: true
};
```

This comprehensive CI/CD integration provides automated code quality monitoring, security scanning, and continuous improvement for your development workflow.