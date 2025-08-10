#!/bin/bash

# Security Setup Script for GitHub MCP Server
# This script sets up security tools and pre-commit hooks

set -e

echo "🔒 Setting up security infrastructure..."

# Check if pre-commit is installed
if ! command -v pre-commit &> /dev/null; then
    echo "Installing pre-commit..."
    if command -v pip &> /dev/null; then
        pip install pre-commit
    elif command -v pip3 &> /dev/null; then
        pip3 install pre-commit
    else
        echo "❌ Error: pip not found. Please install pip and pre-commit manually:"
        echo "   pip install pre-commit"
        exit 1
    fi
fi

# Install pre-commit hooks
echo "Installing pre-commit hooks..."
pre-commit install

# Generate secrets baseline if not exists
if [ ! -f ".secrets.baseline" ]; then
    echo "Generating secrets baseline..."
    if command -v detect-secrets &> /dev/null; then
        detect-secrets scan --baseline .secrets.baseline
    else
        echo "⚠️  Warning: detect-secrets not found. Installing..."
        pip install detect-secrets
        detect-secrets scan --baseline .secrets.baseline
    fi
fi

# Install npm dependencies if package.json exists
if [ -f "package.json" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

# Build the project for security validation
if [ -f "tsconfig.json" ]; then
    echo "Building TypeScript project..."
    npm run build 2>/dev/null || npx tsc
fi

# Run initial security checks
echo "Running initial security scan..."
pre-commit run --all-files || {
    echo "⚠️  Some pre-commit checks failed. This is normal for the first run."
    echo "   Please review the output above and fix any issues."
}

echo ""
echo "✅ Security setup complete!"
echo ""
echo "Next steps:"
echo "1. Review and fix any issues identified by the security scan"
echo "2. Ensure your GitHub token is set in environment variables"
echo "3. Review the SECURITY.md file for security best practices"
echo "4. Run 'pre-commit run --all-files' to validate all files"
echo ""
echo "Security features now active:"
echo "- ✅ Pre-commit hooks for secret detection"
echo "- ✅ GitHub Actions workflows for security scanning"
echo "- ✅ Environment variable validation"
echo "- ✅ Vulnerability disclosure policy"
echo ""