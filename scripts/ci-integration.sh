#!/bin/bash
# CI/CD Integration script for code analysis agents
# This script provides various CI/CD integration options

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="${PROJECT_ROOT}/ci-output"
ANALYSIS_DEPTH="${ANALYSIS_DEPTH:-deep}"
TARGET_PATH="${TARGET_PATH:-src/}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
CI/CD Integration Script for Code Analysis Agents

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    quick-check         Run quick analysis for fast feedback
    full-analysis       Run comprehensive analysis
    security-scan       Run security-focused analysis
    generate-tests      Generate missing test cases
    quality-gate        Run quality gate checks
    pr-analysis         Analyze pull request changes
    docker-analysis     Run analysis in Docker container
    setup-hooks         Set up Git hooks for analysis
    health-check        Check agent system health

Options:
    --target PATH       Target path to analyze (default: src/)
    --depth LEVEL       Analysis depth: shallow, deep, comprehensive (default: deep)
    --format FORMAT     Output format: json, markdown, html, console (default: json)
    --output DIR        Output directory (default: ci-output/)
    --fail-on LEVEL     Fail on severity level: critical, high, medium, low (default: critical)
    --max-issues NUM    Maximum allowed issues (default: unlimited)
    --parallel          Run agents in parallel (default: true)
    --docker            Use Docker for analysis
    --help              Show this help message

Examples:
    $0 quick-check --target src/ --format console
    $0 full-analysis --depth comprehensive --output reports/
    $0 security-scan --fail-on high
    $0 pr-analysis --target \$(git diff --name-only HEAD~1)
    $0 quality-gate --max-issues 10 --fail-on medium

Environment Variables:
    ANALYSIS_DEPTH      Default analysis depth
    TARGET_PATH         Default target path
    CI                  Set to 'true' in CI environment
    GITHUB_ACTIONS      Set to 'true' in GitHub Actions
    FAIL_ON_SEVERITY    Default fail-on severity level
    MAX_ISSUES          Default maximum issues

EOF
}

# Parse command line arguments
COMMAND=""
FORMAT="json"
FAIL_ON="critical"
MAX_ISSUES=""
PARALLEL="true"
USE_DOCKER="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        quick-check|full-analysis|security-scan|generate-tests|quality-gate|pr-analysis|docker-analysis|setup-hooks|health-check)
            COMMAND="$1"
            shift
            ;;
        --target)
            TARGET_PATH="$2"
            shift 2
            ;;
        --depth)
            ANALYSIS_DEPTH="$2"
            shift 2
            ;;
        --format)
            FORMAT="$2"
            shift 2
            ;;
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --fail-on)
            FAIL_ON="$2"
            shift 2
            ;;
        --max-issues)
            MAX_ISSUES="$2"
            shift 2
            ;;
        --parallel)
            PARALLEL="true"
            shift
            ;;
        --docker)
            USE_DOCKER="true"
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate command
if [[ -z "$COMMAND" ]]; then
    log_error "No command specified"
    show_help
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Change to project root
cd "$PROJECT_ROOT"

# Ensure project is built
ensure_build() {
    if [[ ! -d "build" ]] || [[ "src/" -nt "build/" ]]; then
        log_info "Building project..."
        npm run build
    fi
}

# Check if running in CI
is_ci() {
    [[ "$CI" == "true" ]] || [[ "$GITHUB_ACTIONS" == "true" ]] || [[ -n "$JENKINS_URL" ]] || [[ -n "$GITLAB_CI" ]]
}

# Set GitHub Actions outputs
set_github_output() {
    if [[ "$GITHUB_ACTIONS" == "true" ]]; then
        echo "$1=$2" >> "$GITHUB_OUTPUT"
    fi
}

# Run analysis with error handling
run_analysis() {
    local analysis_type="$1"
    local script_content="$2"
    
    log_info "Running $analysis_type analysis..."
    
    if [[ "$USE_DOCKER" == "true" ]]; then
        run_docker_analysis "$analysis_type"
        return $?
    fi
    
    ensure_build
    
    # Create temporary analysis script
    local temp_script="$OUTPUT_DIR/temp_analysis.mjs"
    echo "$script_content" > "$temp_script"
    
    # Run analysis
    if node "$temp_script"; then
        log_success "$analysis_type analysis completed successfully"
        rm -f "$temp_script"
        return 0
    else
        log_error "$analysis_type analysis failed"
        rm -f "$temp_script"
        return 1
    fi
}

# Run Docker analysis
run_docker_analysis() {
    local analysis_type="$1"
    
    log_info "Running $analysis_type analysis in Docker..."
    
    # Build Docker image if needed
    if ! docker image inspect github-mcp-agents:latest >/dev/null 2>&1; then
        log_info "Building Docker image..."
        docker build -f Dockerfile.agents -t github-mcp-agents:latest .
    fi
    
    # Run analysis in container
    docker run --rm \
        -v "$PWD/src:/app/src:ro" \
        -v "$OUTPUT_DIR:/app/output" \
        github-mcp-agents:latest \
        /app/scripts/run-analysis.sh "$analysis_type" "$TARGET_PATH" "$FORMAT" "/app/output"
}

# Process analysis results
process_results() {
    local results_file="$1"
    local analysis_type="$2"
    
    if [[ ! -f "$results_file" ]]; then
        log_warning "Results file not found: $results_file"
        return 1
    fi
    
    # Parse results based on format
    if [[ "$FORMAT" == "json" ]]; then
        local total_issues=$(jq -r '.summary.totalFindings // 0' "$results_file" 2>/dev/null || echo "0")
        local critical_issues=$(jq -r '.summary.criticalFindings // 0' "$results_file" 2>/dev/null || echo "0")
        local high_issues=$(jq -r '.summary.highFindings // 0' "$results_file" 2>/dev/null || echo "0")
        local medium_issues=$(jq -r '.summary.mediumFindings // 0' "$results_file" 2>/dev/null || echo "0")
        local low_issues=$(jq -r '.summary.lowFindings // 0' "$results_file" 2>/dev/null || echo "0")
        
        log_info "Analysis Results Summary:"
        log_info "  Total Issues: $total_issues"
        log_info "  Critical: $critical_issues"
        log_info "  High: $high_issues"
        log_info "  Medium: $medium_issues"
        log_info "  Low: $low_issues"
        
        # Set GitHub Actions outputs
        set_github_output "total_issues" "$total_issues"
        set_github_output "critical_issues" "$critical_issues"
        set_github_output "high_issues" "$high_issues"
        set_github_output "medium_issues" "$medium_issues"
        set_github_output "low_issues" "$low_issues"
        
        # Check fail conditions
        local fail_count=0
        case "$FAIL_ON" in
            "critical")
                fail_count="$critical_issues"
                ;;
            "high")
                fail_count=$((critical_issues + high_issues))
                ;;
            "medium")
                fail_count=$((critical_issues + high_issues + medium_issues))
                ;;
            "low")
                fail_count="$total_issues"
                ;;
        esac
        
        if [[ -n "$MAX_ISSUES" ]] && [[ "$total_issues" -gt "$MAX_ISSUES" ]]; then
            log_error "Too many issues found: $total_issues (max: $MAX_ISSUES)"
            return 1
        fi
        
        if [[ "$fail_count" -gt 0 ]]; then
            log_error "Found $fail_count issues at or above '$FAIL_ON' severity level"
            return 1
        fi
        
        log_success "Quality gate passed!"
        return 0
    fi
    
    return 0
}

# Command implementations
cmd_quick_check() {
    local script_content="
import { quickAnalyze } from './build/agents/index.js';
import fs from 'fs/promises';

try {
    const result = await quickAnalyze('$TARGET_PATH', {
        type: 'directory',
        depth: 'shallow',
        format: '$FORMAT'
    });
    
    if ('$FORMAT' === 'json') {
        await fs.writeFile('$OUTPUT_DIR/quick-analysis.json', JSON.stringify(result, null, 2));
    } else {
        await fs.writeFile('$OUTPUT_DIR/quick-analysis.txt', result.report);
    }
    
    console.log('Quick analysis completed');
} catch (error) {
    console.error('Quick analysis failed:', error);
    process.exit(1);
}
"
    
    run_analysis "quick" "$script_content"
    local exit_code=$?
    
    if [[ "$FORMAT" == "json" ]]; then
        process_results "$OUTPUT_DIR/quick-analysis.json" "quick"
        exit_code=$?
    fi
    
    return $exit_code
}

cmd_full_analysis() {
    local script_content="
import { createAgentSystem } from './build/agents/index.js';
import fs from 'fs/promises';

try {
    const { coordinator, reportGenerator } = createAgentSystem();
    
    const result = await coordinator.coordinate({
        target: {
            type: 'directory',
            path: '$TARGET_PATH',
            depth: '$ANALYSIS_DEPTH',
            exclude: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**']
        },
        parallel: $PARALLEL,
        config: {
            enabled: true,
            depth: '$ANALYSIS_DEPTH',
            minSeverity: 'low'
        }
    });
    
    // Generate report
    const report = await reportGenerator.generateReport(result, {
        format: '$FORMAT',
        outputPath: '$OUTPUT_DIR/full-analysis.$FORMAT',
        includeDetails: true,
        groupBy: 'severity',
        includeRecommendations: true
    });
    
    // Save summary
    const summary = {
        totalFindings: result.summary.totalFindings,
        criticalFindings: result.summary.findingsBySeverity?.critical || 0,
        highFindings: result.summary.findingsBySeverity?.high || 0,
        mediumFindings: result.summary.findingsBySeverity?.medium || 0,
        lowFindings: result.summary.findingsBySeverity?.low || 0,
        agentsUsed: result.summary.agentsUsed,
        analysisTime: result.summary.totalDuration
    };
    
    await fs.writeFile('$OUTPUT_DIR/analysis-summary.json', JSON.stringify(summary, null, 2));
    
    console.log('Full analysis completed');
} catch (error) {
    console.error('Full analysis failed:', error);
    process.exit(1);
}
"
    
    run_analysis "full" "$script_content"
    local exit_code=$?
    
    process_results "$OUTPUT_DIR/analysis-summary.json" "full"
    exit_code=$?
    
    return $exit_code
}

cmd_security_scan() {
    local script_content="
import { createAgentSystem } from './build/agents/index.js';
import fs from 'fs/promises';

try {
    const { coordinator, reportGenerator } = createAgentSystem();
    
    const result = await coordinator.coordinate({
        target: {
            type: 'directory',
            path: '$TARGET_PATH',
            depth: '$ANALYSIS_DEPTH'
        },
        parallel: true,
        config: {
            enabled: true,
            depth: '$ANALYSIS_DEPTH',
            minSeverity: 'medium',
            includeCategories: ['security_vulnerability', 'runtime_error']
        }
    });
    
    const securityFindings = result.consolidatedFindings.filter(
        f => f.category === 'security_vulnerability'
    );
    
    const summary = {
        totalFindings: result.summary.totalFindings,
        securityVulnerabilities: securityFindings.length,
        criticalFindings: result.summary.findingsBySeverity?.critical || 0,
        highFindings: result.summary.findingsBySeverity?.high || 0,
        mediumFindings: result.summary.findingsBySeverity?.medium || 0,
        findings: securityFindings.map(f => ({
            severity: f.severity,
            title: f.title,
            file: f.file,
            line: f.line,
            description: f.description
        }))
    };
    
    await fs.writeFile('$OUTPUT_DIR/security-analysis.json', JSON.stringify(summary, null, 2));
    
    // Generate security report
    await reportGenerator.generateReport(result, {
        format: 'markdown',
        outputPath: '$OUTPUT_DIR/security-report.md',
        includeDetails: true,
        filterCategory: ['security_vulnerability', 'runtime_error'],
        groupBy: 'severity'
    });
    
    console.log('Security scan completed');
    
    if (securityFindings.length > 0) {
        console.log(\`Found \${securityFindings.length} security vulnerabilities\`);
        process.exit(1);
    }
} catch (error) {
    console.error('Security scan failed:', error);
    process.exit(1);
}
"
    
    run_analysis "security" "$script_content"
    return $?
}

cmd_quality_gate() {
    log_info "Running quality gate checks..."
    
    # Run quick analysis first
    cmd_quick_check
    local quick_exit=$?
    
    if [[ $quick_exit -ne 0 ]]; then
        log_error "Quality gate failed: Quick analysis found issues"
        return 1
    fi
    
    log_success "Quality gate passed!"
    return 0
}

cmd_health_check() {
    local script_content="
import { createAgentSystem } from './build/agents/index.js';
import fs from 'fs/promises';

try {
    const { coordinator } = createAgentSystem();
    
    const health = await coordinator.getAgentsHealth();
    const summary = await coordinator.healthCheck();
    
    const healthReport = {
        summary,
        agents: health,
        timestamp: new Date().toISOString()
    };
    
    await fs.writeFile('$OUTPUT_DIR/health-report.json', JSON.stringify(healthReport, null, 2));
    
    console.log('Health check completed');
    console.log(\`Healthy agents: \${summary.healthyAgents}/\${summary.agentCount}\`);
    
    if (!summary.healthy) {
        console.log('Unhealthy agents:', summary.unhealthyAgents);
        process.exit(1);
    }
} catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
}
"
    
    run_analysis "health" "$script_content"
    return $?
}

cmd_setup_hooks() {
    log_info "Setting up Git hooks for code analysis..."
    
    # Copy pre-commit hook
    if [[ -f ".github/hooks/pre-commit-agents.sh" ]]; then
        cp ".github/hooks/pre-commit-agents.sh" ".git/hooks/pre-commit"
        chmod +x ".git/hooks/pre-commit"
        log_success "Pre-commit hook installed"
    else
        log_warning "Pre-commit hook script not found"
    fi
    
    # Create commit-msg hook for analysis
    cat > ".git/hooks/commit-msg" << 'EOF'
#!/bin/bash
# Commit message hook with analysis summary

if [[ -f "ci-output/quick-analysis.json" ]]; then
    total_issues=$(jq -r '.summary.totalFindings // 0' "ci-output/quick-analysis.json" 2>/dev/null || echo "0")
    if [[ "$total_issues" -gt 0 ]]; then
        echo "⚠️ Note: $total_issues code quality issues detected"
    fi
fi
EOF
    chmod +x ".git/hooks/commit-msg"
    
    log_success "Git hooks set up successfully"
    return 0
}

# Execute command
case "$COMMAND" in
    "quick-check")
        cmd_quick_check
        ;;
    "full-analysis")
        cmd_full_analysis
        ;;
    "security-scan")
        cmd_security_scan
        ;;
    "quality-gate")
        cmd_quality_gate
        ;;
    "health-check")
        cmd_health_check
        ;;
    "setup-hooks")
        cmd_setup_hooks
        ;;
    *)
        log_error "Command not implemented: $COMMAND"
        exit 1
        ;;
esac

exit $?