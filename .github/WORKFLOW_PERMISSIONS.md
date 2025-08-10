# GitHub Actions Workflow Permissions Guide

## Overview
This document explains the permissions required for different GitHub Actions workflows in this repository.

## Workflow Files

### 1. `claude.yml` - Interactive Claude Code Assistant
**Purpose**: Responds to @claude mentions in issues and PRs

**Required Permissions**:
- `contents: write` - To commit and push code changes
- `pull-requests: write` - To comment on and modify PRs
- `issues: write` - To comment on and modify issues
- `id-token: write` - For OIDC authentication
- `actions: read` - To read workflow run results
- `checks: write` - To create check runs for PR status
- `statuses: write` - To update commit statuses
- `security-events: write` - To upload security scanning results
- `packages: read` - To read package registry information
- `deployments: write` - To update deployment status

### 2. `claude-review.yml` - Automated PR Review
**Purpose**: Automatically reviews PRs when opened or updated

**Required Permissions**:
- `contents: read` - To read repository code
- `pull-requests: write` - To comment on PRs
- `issues: write` - To create related issues if needed
- `id-token: write` - For OIDC authentication
- `actions: read` - To read workflow status
- `checks: write` - To create PR checks
- `statuses: write` - To update commit status
- `security-events: write` - To report security issues

### 3. `security.yml` - Comprehensive Security Scanning
**Purpose**: Runs multiple security scanning tools

**Required Permissions**:
- `contents: read` - To read repository code
- `security-events: write` - To upload security scan results
- `id-token: write` - For OIDC authentication
- `actions: read` - To read workflow artifacts
- `checks: write` - To create security checks
- `statuses: write` - To update security status
- `pull-requests: write` - To comment on PRs with security findings

## Security Scanning Tools

### TruffleHog
- **Purpose**: Detect secrets and credentials
- **Required**: `contents: read`, `security-events: write`

### CodeQL
- **Purpose**: Static application security testing (SAST)
- **Required**: `contents: read`, `security-events: write`, `actions: read`

### Dependency Review
- **Purpose**: Check for vulnerable dependencies in PRs
- **Required**: `contents: read`, `pull-requests: write`

### OpenSSF Scorecard
- **Purpose**: Assess security best practices
- **Required**: `contents: read`, `security-events: write`, `id-token: write`

### NPM Audit
- **Purpose**: Check npm packages for vulnerabilities
- **Required**: `contents: read`

### License Checker
- **Purpose**: Ensure license compliance
- **Required**: `contents: read`

### Semgrep
- **Purpose**: Pattern-based SAST
- **Required**: `contents: read`, `security-events: write`

### Trivy
- **Purpose**: Container and filesystem vulnerability scanning
- **Required**: `contents: read`, `security-events: write`

## Setting Up Secrets

Add these secrets to your repository:

1. **`CLAUDE_CODE_OAUTH_TOKEN`** (Required)
   - Get from: https://claude.ai/settings/code
   - Used by: `claude.yml`, `claude-review.yml`

2. **`SEMGREP_APP_TOKEN`** (Optional)
   - Get from: https://semgrep.dev/
   - Used by: `security.yml`
   - Note: Semgrep can run without this but with limited rules

## Repository Settings

### Required Settings:
1. **Enable GitHub Actions**
   - Settings → Actions → General → Actions permissions
   - Select: "Allow all actions and reusable workflows"

2. **Enable Dependency Graph**
   - Settings → Security & analysis → Dependency graph
   - Enable: Dependency graph

3. **Enable Dependabot**
   - Settings → Security & analysis → Dependabot
   - Enable: Dependabot alerts
   - Enable: Dependabot security updates

4. **Enable Code Scanning**
   - Settings → Security & analysis → Code scanning
   - This will be automatically enabled when CodeQL runs

5. **Enable Secret Scanning**
   - Settings → Security & analysis → Secret scanning
   - Enable: Secret scanning
   - Enable: Push protection (recommended)

### Workflow Permissions:
1. Go to: Settings → Actions → General
2. Under "Workflow permissions", choose:
   - **Option 1** (Recommended): "Read and write permissions"
   - **Option 2**: "Read repository contents and packages permissions"
     - Then add specific permissions in each workflow file

## Troubleshooting

### Permission Denied Errors
If you see "Resource not accessible by integration":
1. Check repository Settings → Actions → General → Workflow permissions
2. Ensure the workflow has the correct `permissions:` block
3. For organization repos, check organization-level permissions

### Security Scanning Not Working
1. Ensure security features are enabled in repository settings
2. Check that required secrets are configured
3. Verify branch protection rules don't block security workflows

### Claude Code Not Responding
1. Verify `CLAUDE_CODE_OAUTH_TOKEN` is set correctly
2. Check the @claude mention is formatted correctly
3. Ensure the workflow has necessary permissions

## Best Practices

1. **Principle of Least Privilege**: Only grant permissions that are absolutely necessary
2. **Use GITHUB_TOKEN**: Default token when possible instead of PATs
3. **Rotate Secrets**: Regularly rotate OAuth tokens and API keys
4. **Monitor Usage**: Check Actions usage and security alerts regularly
5. **Test in PR**: Test workflow changes in a PR before merging to main

## Additional Resources

- [GitHub Actions Permissions Documentation](https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs)
- [GitHub Security Features](https://docs.github.com/en/code-security)
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [OpenSSF Best Practices](https://bestpractices.coreinfrastructure.org/)
