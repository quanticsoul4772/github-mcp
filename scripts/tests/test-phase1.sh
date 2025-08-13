#!/bin/bash

# Quick test script for Phase 1 improvements
# Run this to verify the enhanced error handling works

echo "=========================================="
echo "GitHub MCP Phase 1 Testing"
echo "=========================================="

# Check if TypeScript files compile
echo ""
echo "📦 Building TypeScript files..."
npm run build 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed. Running with --force to see errors:"
    npx tsc --noEmit
    exit 1
fi

# Run the validation test
echo ""
echo "🧪 Running validation tests..."
if [ -f "test-validation.js" ]; then
    node test-validation.js
else
    echo "⚠️  test-validation.js not found"
fi

# Run the demo
echo ""
echo "🎭 Running demo..."
if [ -f "demo-phase1.js" ]; then
    node demo-phase1.js
else
    echo "⚠️  demo-phase1.js not found"
fi

echo ""
echo "=========================================="
echo "✨ Phase 1 Testing Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Update src/index.ts to import enhanced tools"
echo "2. Register help tools in initialization"
echo "3. Test with actual GitHub API calls"
echo ""
echo "See PHASE1-COMPLETE.md for full details"
