# Examples and Tutorials

This document provides practical examples and tutorials for using the GitHub MCP Server.

## Table of Contents

- [Basic Usage Examples](#basic-usage-examples)
- [Repository Management](#repository-management)
- [Issue Management](#issue-management)
- [Pull Request Workflows](#pull-request-workflows)
- [GitHub Actions Integration](#github-actions-integration)
- [Security and Monitoring](#security-and-monitoring)
- [Advanced Workflows](#advanced-workflows)
- [Best Practices](#best-practices)

## Basic Usage Examples

### Getting Started

Once the GitHub MCP Server is configured in Claude Desktop, you can interact with it using natural language:

```
"Show me my recent repositories"
"List open issues in my project"
"Get the README file from octocat/Hello-World"
```

### Authentication Check

First, verify your authentication is working:

```
"What's my GitHub username and profile information?"
```

This uses the `get_me` tool to retrieve your authenticated user information.

## Repository Management

### Browsing Repository Content

**Get a file's contents:**
```
"Show me the package.json file from the main branch of owner/repo"
```

**Browse a directory:**
```
"List the files in the src/ directory of owner/repo"
```

**Check different branches:**
```
"Show me the README from the develop branch of owner/repo"
```

### File Operations

**Create a new file:**
```
"Create a new file called 'hello.py' in owner/repo with the content:
print('Hello, World!')"
```

**Update an existing file:**
```
"Update the README.md file in owner/repo to add a new section about installation"
```

**Delete a file:**
```
"Delete the old-script.js file from owner/repo"
```

### Repository Discovery

**List your repositories:**
```
"Show me my 10 most recently updated repositories"
```

**Search for repositories:**
```
"Find public repositories related to machine learning with TypeScript"
```

**Fork a repository:**
```
"Fork the repository microsoft/TypeScript"
```

## Issue Management

### Basic Issue Operations

**List issues:**
```
"Show me all open issues in owner/repo"
"List closed issues from the last week in owner/repo"
"Find issues labeled 'bug' and 'high-priority' in owner/repo"
```

**Get issue details:**
```
"Show me the details of issue #123 in owner/repo"
```

**Create an issue:**
```
"Create a new issue in owner/repo titled 'Fix login bug' with the description:
Users are experiencing login failures when using special characters in passwords.

Steps to reproduce:
1. Go to login page
2. Enter username and password with special characters
3. Click login
4. Error occurs"
```

**Update an issue:**
```
"Close issue #123 in owner/repo"
"Add the label 'in-progress' to issue #45 in owner/repo"
"Assign issue #67 to username123 in owner/repo"
```

### Issue Comments

**Add a comment:**
```
"Add a comment to issue #123 in owner/repo saying:
I've started working on this issue. Should have a fix ready by end of week."
```

### Advanced Issue Workflows

**Triage workflow:**
```
1. "List all issues labeled 'needs-triage' in owner/repo"
2. For each issue: "Show me the details of issue #X"
3. "Add label 'bug' to issue #X" or "Add label 'enhancement' to issue #X"
4. "Remove label 'needs-triage' from issue #X"
```

## Pull Request Workflows

### Basic PR Operations

**List pull requests:**
```
"Show me all open pull requests in owner/repo"
"List my pull requests in owner/repo"
"Find pull requests targeting the main branch"
```

**Get PR details:**
```
"Show me the details of pull request #456 in owner/repo"
"Get the diff for pull request #456 in owner/repo"
```

### Creating Pull Requests

**Create a PR:**
```
"Create a pull request in owner/repo from feature-branch to main with title 'Add user authentication' and description:
This PR implements user authentication using JWT tokens.

Changes include:
- New authentication middleware  
- Login/logout endpoints
- User session management
- Tests for auth functionality"
```

### PR Review Workflow

**Review process:**
```
1. "List all pull requests waiting for my review"
2. "Show me PR #789 in owner/repo" 
3. "Get the files changed in PR #789"
4. "Show me the diff for PR #789"
5. Add review comments via GitHub web interface
6. "Merge pull request #789 in owner/repo using squash method"
```

### Advanced PR Management

**Batch PR operations:**
```
1. "List all pull requests from dependabot in owner/repo"
2. For dependency updates: "Merge pull request #X using merge method"
3. "List all draft pull requests in owner/repo"
```

## GitHub Actions Integration

### Workflow Management

**List workflows:**
```
"Show me all GitHub Actions workflows in owner/repo"
```

**Get workflow runs:**
```
"Show me the latest workflow runs for owner/repo"
"List failed workflow runs from the last 24 hours"
```

**Trigger a workflow:**
```
"Trigger the 'deploy' workflow in owner/repo on the main branch"
```

### Monitoring Builds

**Check build status:**
```
"What's the status of the latest CI run for owner/repo?"
"Show me the logs for workflow run #12345"
```

**Deployment workflows:**
```
1. "List all workflow runs for the 'deploy' workflow"
2. "Get the status of the latest deploy to production"
3. "Trigger a new deployment to staging environment"
```

## Security and Monitoring

### Security Alerts

**Code scanning alerts:**
```
"Show me all code scanning alerts in owner/repo"
"List high-severity security issues"
```

**Secret scanning:**
```
"Check for any secret scanning alerts in owner/repo"
"Show me resolved secret scanning alerts"
```

**Dependabot alerts:**
```
"List all Dependabot vulnerability alerts"
"Show me critical security updates available"
```

### Security Workflow

**Weekly security review:**
```
1. "List all open security alerts across my repositories"
2. "Show me critical Dependabot alerts"
3. "List any new secret scanning alerts"
4. "Check if there are any code scanning alerts that need attention"
```

## Advanced Workflows

### Repository Audit

**Comprehensive repository review:**
```
1. "List all my repositories with their visibility settings"
2. "Show me repositories that haven't been updated in 6 months"
3. "List repositories with open security alerts"
4. "Find repositories without README files"
```

### Project Management Integration

**Sprint planning with issues:**
```
1. "List all issues labeled 'sprint-planning' in owner/repo"
2. "Create milestone 'Sprint 12' in owner/repo"
3. "Assign issues to the new milestone"
4. "List issues without assignees"
```

### Cross-Repository Operations

**Multi-repo maintenance:**
```
1. "List all my repositories that use Node.js" (check package.json)
2. For each repo: "Check if there are any Dependabot alerts"
3. "List repositories with outdated dependencies"
```

### Automated Code Review

**PR review checklist:**
```
1. "Show me PR #123 details"
2. "Get the files changed in this PR"
3. "Check if there are any failing CI checks"
4. "Look for any security alerts in the changed files"
5. "Verify that tests are included with the changes"
```

## Best Practices

### Efficient Workflows

1. **Use specific queries:**
   ```
   Instead of: "Show me issues"
   Use: "Show me open bug issues labeled 'high-priority' in owner/repo"
   ```

2. **Batch operations:**
   ```
   "List all pull requests from dependabot, then merge the ones that passed CI"
   ```

3. **Combine related operations:**
   ```
   "Create issue, assign to me, add labels 'bug' and 'urgent', and add to Sprint 5 milestone"
   ```

### Security Best Practices

1. **Regular security audits:**
   ```
   Weekly: "Show me all new security alerts across my repositories"
   ```

2. **Dependency management:**
   ```
   "List all Dependabot PRs and merge the ones with passing tests"
   ```

3. **Secret monitoring:**
   ```
   "Check for any new secret scanning alerts and show me the details"
   ```

### Organization Management

1. **Team coordination:**
   ```
   "List all open PRs assigned to my team members"
   "Show me issues that haven't been updated in 2 weeks"
   ```

2. **Repository governance:**
   ```
   "List repositories without branch protection rules"
   "Find repositories with admin access for too many users"
   ```

### Performance Optimization

1. **Use pagination for large results:**
   ```
   "Show me the first 10 issues, then show me the next 10"
   ```

2. **Specific date ranges:**
   ```
   "Show me PRs created in the last week"
   "List issues updated since yesterday"
   ```

3. **Filter early:**
   ```
   "List only high-priority bugs in active repositories"
   ```

## Common Use Cases

### Daily Developer Workflow

```
Morning routine:
1. "Show me my assigned issues"
2. "List PRs waiting for my review"
3. "Check if any of my PRs have been merged"
4. "Show me any failed CI runs in my repositories"

Code review session:
1. "List all open PRs in owner/repo"
2. "Show me PR #X with its diff"
3. "Check the CI status for this PR"
4. "Merge the PR if everything looks good"

End of day:
1. "Create issue for tomorrow's work"
2. "Update the status on current issues"
3. "Check for any urgent security alerts"
```

### Maintainer Workflow

```
Weekly maintenance:
1. "List all repositories I maintain"
2. "Show me issues that need triage"
3. "List Dependabot PRs that can be merged"
4. "Check for any security alerts needing attention"

Release preparation:
1. "List all PRs merged since last release"
2. "Create a new release in owner/repo"
3. "Update changelog and documentation"
4. "Trigger deployment workflow"
```

### Team Lead Workflow

```
Sprint planning:
1. "List all issues in the backlog"
2. "Show me team member workloads"
3. "Create milestone for next sprint"
4. "Assign issues to team members"

Progress tracking:
1. "Show me current sprint progress"
2. "List blocked issues"
3. "Check PR review status"
4. "Monitor CI/CD pipeline health"
```

These examples demonstrate the flexibility and power of the GitHub MCP Server. The natural language interface allows you to express complex operations in intuitive ways, making GitHub API interactions more accessible and efficient.