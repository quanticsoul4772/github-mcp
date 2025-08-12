#!/bin/bash
# Pre-commit hook for code analysis agents
# This script runs quick analysis on staged files

set -e

echo "🔍 Running code analysis agents on staged files..."

# Get list of staged TypeScript/JavaScript files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$' | head -10 || echo "")

if [ -z "$STAGED_FILES" ]; then
    echo "ℹ️ No TypeScript/JavaScript files staged for commit"
    exit 0
fi

echo "📁 Staged files to analyze:"
echo "$STAGED_FILES" | sed 's/^/  - /'

# Ensure project is built
if [ ! -d "build" ]; then
    echo "🔨 Building project..."
    npm run build
fi

# Create temporary analysis script
cat > .git/hooks/temp_analysis.mjs << 'EOF'
import { quickAnalyze } from './build/agents/index.js';
import fs from 'fs/promises';

const stagedFiles = process.argv[2].split('\n').filter(f => f.trim());
let hasErrors = false;
let totalIssues = 0;
let criticalIssues = 0;

console.log('🚀 Starting analysis...\n');

for (const file of stagedFiles) {
    try {
        console.log(`Analyzing ${file}...`);
        
        const result = await quickAnalyze(file, {
            type: 'file',
            depth: 'shallow',
            format: 'json'
        });
        
        const summary = result.analysis.summary;
        const critical = summary.findingsBySeverity?.critical || 0;
        const high = summary.findingsBySeverity?.high || 0;
        
        totalIssues += summary.totalFindings;
        criticalIssues += critical;
        
        if (summary.totalFindings > 0) {
            console.log(`  ⚠️  ${summary.totalFindings} issues found`);
            
            if (critical > 0) {
                console.log(`    🔴 ${critical} critical issues`);
                hasErrors = true;
            }
            if (high > 0) {
                console.log(`    🟠 ${high} high priority issues`);
            }
        } else {
            console.log(`  ✅ No issues found`);
        }
        
    } catch (error) {
        console.error(`  ❌ Error analyzing ${file}: ${error.message}`);
    }
}

console.log(`\n📊 Analysis Summary:`);
console.log(`  Total issues: ${totalIssues}`);
console.log(`  Critical issues: ${criticalIssues}`);

if (hasErrors) {
    console.log('\n❌ Critical issues found! Please fix before committing.');
    console.log('💡 Run "npm run agents:quick-scan" for detailed analysis.');
    process.exit(1);
} else if (totalIssues > 10) {
    console.log('\n⚠️  Many issues found. Consider running full analysis.');
    console.log('💡 Run "npm run agents:analyze" for comprehensive analysis.');
} else {
    console.log('\n✅ Pre-commit analysis passed!');
}
EOF

# Run analysis
if node .git/hooks/temp_analysis.mjs "$STAGED_FILES"; then
    echo "✅ Code analysis passed"
    rm -f .git/hooks/temp_analysis.mjs
    exit 0
else
    echo "❌ Code analysis failed"
    rm -f .git/hooks/temp_analysis.mjs
    echo ""
    echo "💡 To skip this check (not recommended), use: git commit --no-verify"
    echo "🔧 To fix issues, run: npm run agents:quick-scan"
    exit 1
fi