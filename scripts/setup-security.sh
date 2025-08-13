#!/bin/bash

# GitHub Repository Security Setup Script
# This script helps configure security settings for the github-mcp repository

set -e

echo "================================================"
echo "GitHub MCP Repository Security Setup"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed${NC}"
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

echo -e "${GREEN}✓ GitHub CLI detected${NC}"

# Check if logged in
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠ Not logged in to GitHub CLI${NC}"
    echo "Running: gh auth login"
    gh auth login
fi

# Get repository info
REPO_OWNER="quanticsoul4772"
REPO_NAME="github-mcp"
REPO="${REPO_OWNER}/${REPO_NAME}"

echo ""
echo "Repository: $REPO"
echo ""

# Function to enable a setting
enable_setting() {
    local setting_name=$1
    local api_path=$2
    local data=$3
    
    echo -n "Enabling $setting_name... "
    
    if gh api -X PUT "$api_path" --input - <<< "$data" &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠ May already be enabled or requires admin permissions${NC}"
    fi
}

# Function to check if secret exists
check_secret() {
    local secret_name=$1
    
    if gh secret list --repo "$REPO" | grep -q "$secret_name"; then
        echo -e "${GREEN}✓ Secret $secret_name exists${NC}"
        return 0
    else
        echo -e "${RED}✗ Secret $secret_name not found${NC}"
        return 1
    fi
}

echo "================================================"
echo "1. Checking Repository Secrets"
echo "================================================"
echo ""

# Check for required secrets
if ! check_secret "CLAUDE_CODE_OAUTH_TOKEN"; then
    echo ""
    echo -e "${YELLOW}To add CLAUDE_CODE_OAUTH_TOKEN:${NC}"
    echo "1. Go to: https://claude.ai/settings/code"
    echo "2. Generate or copy your OAuth token"
    echo "3. Run: gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo $REPO"
    echo ""
fi

echo ""
echo "================================================"
echo "2. Enabling Security Features"
echo "================================================"
echo ""

# Enable vulnerability alerts
enable_setting "Vulnerability Alerts" \
    "repos/$REPO/vulnerability-alerts" \
    ''

# Enable automated security fixes
enable_setting "Automated Security Fixes" \
    "repos/$REPO/automated-security-fixes" \
    ''

# Enable Dependabot alerts
enable_setting "Dependabot Alerts" \
    "repos/$REPO/vulnerability-alerts" \
    ''

echo ""
echo "================================================"
echo "3. Creating Branch Protection Rules"
echo "================================================"
echo ""

# Create branch protection for main
echo -n "Setting up branch protection for 'main'... "

PROTECTION_RULES='{
  "required_status_checks": {
    "strict": true,
    "checks": [
      {
        "context": "CodeQL",
        "app_id": null
      },
      {
        "context": "NPM Security Audit",
        "app_id": null
      }
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismissal_restrictions": {},
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}'

if gh api -X PUT "repos/$REPO/branches/main/protection" --input - <<< "$PROTECTION_RULES" &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠ May already be configured or requires admin permissions${NC}"
fi

echo ""
echo "================================================"
echo "4. Setting up Labels"
echo "================================================"
echo ""

# Create labels for issues
declare -a labels=(
    "security:ff0000"
    "critical:ff0000"
    "high-priority:ff6b6b"
    "bug:d73a4a"
    "enhancement:a2eeef"
    "documentation:0075ca"
    "technical-debt:fbca04"
    "testing:006b75"
    "infrastructure:1d76db"
    "performance:d4c5f9"
    "dependencies:0366d6"
    "ci/cd:0e8a16"
    "compliance:5319e7"
)

for label in "${labels[@]}"; do
    IFS=':' read -r name color <<< "$label"
    echo -n "Creating label '$name'... "
    
    if gh label create "$name" --color "$color" --repo "$REPO" &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}Already exists${NC}"
    fi
done

echo ""
echo "================================================"
echo "5. Manual Steps Required"
echo "================================================"
echo ""

echo "Please complete these manual steps in your browser:"
echo ""
echo "1. Enable GitHub Pages (if needed):"
echo "   https://github.com/$REPO/settings/pages"
echo ""
echo "2. Configure Code Security:"
echo "   https://github.com/$REPO/settings/security_analysis"
echo "   - Enable: Dependency graph"
echo "   - Enable: Dependabot security updates"
echo "   - Enable: Secret scanning"
echo "   - Enable: Push protection"
echo ""
echo "3. Set up Environments (if needed):"
echo "   https://github.com/$REPO/settings/environments"
echo ""
echo "4. Add additional secrets:"
echo "   https://github.com/$REPO/settings/secrets/actions"
echo "   - SEMGREP_APP_TOKEN (optional, from semgrep.dev)"
echo ""

echo "================================================"
echo "6. Testing Workflows"
echo "================================================"
echo ""

echo "To test the workflows:"
echo "1. Create a test issue mentioning @claude"
echo "2. Create a test PR to trigger security scans"
echo "3. Check Actions tab for workflow runs"
echo ""

echo -e "${GREEN}✓ Setup script completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Review and commit the workflow files"
echo "2. Push to GitHub"
echo "3. Complete the manual configuration steps"
echo "4. Test the workflows"
