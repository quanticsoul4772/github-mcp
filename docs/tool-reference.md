# GitHub MCP Server - Tool Reference

## Overview
This document provides a complete reference for all tools available in the GitHub MCP Server.

## Tool Categories

### Repository Management

#### `list_repositories`

List repositories for the authenticated user

**Optional Parameters:**
- `username`
- `org`
- `type`
- `sort`
- `per_page`

**Example:**
```json
{
  "type": "all",
  "sort": "updated",
  "per_page": 30
}
```

#### `get_repository`

Get details of a specific repository

**Required Parameters:**
- `owner`
- `repo`

**Example:**
```json
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp"
}
```

#### `create_repository`

Create a new GitHub repository

**Required Parameters:**
- `name`

**Optional Parameters:**
- `description`
- `private`
- `auto_init`
- `gitignore_template`
- `license_template`

**Example:**
```json
{
  "name": "my-new-repo",
  "description": "A new repository",
  "private": false,
  "auto_init": true
}
```

### Issues

#### `get_issue`

Get details of a specific GitHub issue

**Required Parameters:**
- `owner`
- `repo`
- `issue_number`

**Example:**
```json
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "issue_number": 42
}
```

#### `list_issues`

List issues in a GitHub repository

**Required Parameters:**
- `owner`
- `repo`

**Optional Parameters:**
- `state`
- `assignee`
- `creator`
- `labels`
- `sort`
- `direction`
- `per_page`

**Example:**
```json
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "state": "open",
  "sort": "created"
}
```

#### `create_issue`

Create a new GitHub issue

**Required Parameters:**
- `owner`
- `repo`
- `title`

**Optional Parameters:**
- `body`
- `assignees`
- `labels`
- `milestone`

**Example:**
```json
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "title": "Bug: Something is broken",
  "body": "Detailed description of the issue",
  "labels": [
    "bug"
  ]
}
```

#### `update_issue`

Update an existing GitHub issue

**Required Parameters:**
- `owner`
- `repo`
- `issue_number`

**Optional Parameters:**
- `title`
- `body`
- `state`
- `assignees`
- `labels`
- `milestone`

**Example:**
```json
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "issue_number": 42,
  "state": "closed"
}
```

### Pull Requests

#### `get_pull_request`

Get details of a specific pull request

**Required Parameters:**
- `owner`
- `repo`
- `pull_number`

**Example:**
```json
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "pull_number": 10
}
```

#### `list_pull_requests`

List pull requests in a repository

**Required Parameters:**
- `owner`
- `repo`

**Optional Parameters:**
- `state`
- `head`
- `base`
- `sort`
- `direction`
- `per_page`

**Example:**
```json
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "state": "open"
}
```

#### `create_pull_request`

Create a new pull request

**Required Parameters:**
- `owner`
- `repo`
- `title`
- `head`
- `base`

**Optional Parameters:**
- `body`
- `maintainer_can_modify`
- `draft`

**Example:**
```json
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "title": "Feature: Add new functionality",
  "head": "feature-branch",
  "base": "main",
  "body": "Description of changes"
}
```

#### `merge_pull_request`

Merge a pull request

**Required Parameters:**
- `owner`
- `repo`
- `pull_number`

**Optional Parameters:**
- `commit_title`
- `commit_message`
- `merge_method`

**Example:**
```json
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "pull_number": 10,
  "merge_method": "squash"
}
```

### File Operations

#### `get_file_contents`

Get contents of a file from a repository

**Required Parameters:**
- `owner`
- `repo`
- `path`

**Optional Parameters:**
- `ref`

**Example:**
```json
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "path": "README.md",
  "ref": "main"
}
```

#### `create_or_update_file`

Create or update a file in a repository

**Required Parameters:**
- `owner`
- `repo`
- `path`
- `message`
- `content`

**Optional Parameters:**
- `branch`
- `sha`
- `committer`
- `author`

**Example:**
```json
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "path": "docs/new-file.md",
  "message": "Add new documentation",
  "content": "SGVsbG8gV29ybGQh",
  "branch": "main"
}
```

### Search

#### `search_repositories`

Search for GitHub repositories

**Required Parameters:**
- `q`

**Optional Parameters:**
- `sort`
- `order`
- `per_page`

**Example:**
```json
{
  "q": "language:typescript mcp",
  "sort": "stars",
  "order": "desc"
}
```

#### `search_issues`

Search for GitHub issues and pull requests

**Required Parameters:**
- `q`

**Optional Parameters:**
- `sort`
- `order`
- `per_page`

**Example:**
```json
{
  "q": "is:issue is:open label:bug",
  "sort": "created",
  "order": "desc"
}
```

#### `search_code`

Search for code across GitHub repositories

**Required Parameters:**
- `q`

**Optional Parameters:**
- `sort`
- `order`
- `per_page`

**Example:**
```json
{
  "q": "console.log repo:quanticsoul4772/github-mcp",
  "sort": "indexed"
}
```

### Users

#### `get_me`

Get my GitHub user profile

#### `get_user`

Get a GitHub user by username

**Required Parameters:**
- `username`

**Example:**
```json
{
  "username": "quanticsoul4772"
}
```

### GitHub Actions

#### `list_workflows`

List GitHub Actions workflows in a repository

**Required Parameters:**
- `owner`
- `repo`

**Optional Parameters:**
- `per_page`

**Example:**
```json
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp"
}
```

#### `list_workflow_runs`

List runs for a specific workflow

**Required Parameters:**
- `owner`
- `repo`
- `workflow_id`

**Optional Parameters:**
- `status`
- `branch`
- `per_page`

**Example:**
```json
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "workflow_id": "ci.yml",
  "status": "completed"
}
```

### Branches

#### `list_branches`

List branches in a repository

**Required Parameters:**
- `owner`
- `repo`

**Optional Parameters:**
- `protected`
- `per_page`

**Example:**
```json
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "protected": true
}
```

#### `create_branch`

Create a new branch in a repository

**Required Parameters:**
- `owner`
- `repo`
- `ref`
- `sha`

**Example:**
```json
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "ref": "refs/heads/new-feature",
  "sha": "aa218f56b14c9653891f9e74264a383fa43fefbd"
}
```

### Commits

#### `list_commits`

List commits in a repository

**Required Parameters:**
- `owner`
- `repo`

**Optional Parameters:**
- `sha`
- `path`
- `author`
- `since`
- `until`
- `per_page`

**Example:**
```json
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "since": "2025-08-01T00:00:00Z",
  "author": "quanticsoul4772"
}
```

#### `get_commit`

Get detailed information about a specific commit

**Required Parameters:**
- `owner`
- `repo`
- `sha`

**Example:**
```json
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "sha": "aa218f56b14c9653891f9e74264a383fa43fefbd"
}
```

### Utilities

#### `get_rate_limit_status`

Get current GitHub API rate limit status

## Error Handling

All tools now provide clear error messages when:
- Required parameters are missing
- Parameters have incorrect types
- API requests fail

Example error message:
```
Error: Missing required parameters for get_issue:
  Required: ["owner", "repo", "issue_number"]
  Received: {"owner": "quanticsoul4772"}
  Missing: ["repo", "issue_number"]
```