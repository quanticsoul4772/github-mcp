#!/bin/bash
# Gemini CLI Integration Setup Script for MCP

set -e

echo "🚀 Gemini CLI Integration Setup for MCP"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d ".github/workflows" ]; then
    echo "❌ Error: Please run this script from the github-mcp root directory"
    exit 1
fi

# Function to check if a secret/variable exists
check_github_setting() {
    local type=$1
    local name=$2
    
    if [ "$type" = "secret" ]; then
        gh secret list --repo "${GITHUB_REPOSITORY:-$(git remote get-url origin | sed 's/.*github.com[:\/]\(.*\)\.git/\1/')}" | grep -q "$name" && echo "✓" || echo "✗"
    else
        gh variable list --repo "${GITHUB_REPOSITORY:-$(git remote get-url origin | sed 's/.*github.com[:\/]\(.*\)\.git/\1/')}" | grep -q "$name" && echo "✓" || echo "✗"
    fi
}

echo ""
echo "📋 Prerequisites Check:"
echo "----------------------"

# Check for required tools
echo -n "GitHub CLI (gh): "
if command -v gh &> /dev/null; then
    echo "✓ Installed"
else
    echo "✗ Not installed -