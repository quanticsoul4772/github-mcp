# Tools Reference

Complete reference for all GitHub MCP Server tools with examples and parameters.

## Table of Contents

- [Repository Tools](#repository-tools)
- [Issue Tools](#issue-tools)
- [Pull Request Tools](#pull-request-tools)
- [GitHub Actions Tools](#github-actions-tools)
- [Search Tools](#search-tools)
- [User Tools](#user-tools)
- [Organization Tools](#organization-tools)
- [Security Tools](#security-tools)
- [Notification Tools](#notification-tools)
- [Discussion Tools](#discussion-tools)
- [Performance Tools](#performance-tools)
- [Batch Operation Tools](#batch-operation-tools)

## Repository Tools

### list_repositories
Lists repositories for the authenticated user.

```json
{
  "visibility": "public",
  "type": "owner",
  "sort": "updated",
  "direction": "desc",
  "page": 1,
  "perPage": 30
}
```

### get_repository
Gets details of a specific repository.

```json
{
  "owner": "octocat",
  "repo": "hello-world"
}
```

### get_file_contents
Retrieves file or directory contents from a repository.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "path": "README.md",
  "ref": "main"
}
```

### create_repository
Creates a new repository (requires write access).

```json
{
  "name": "my-new-repo",
  "description": "A new repository",
  "private": false,
  "autoInit": true
}
```

### create_or_update_file
Creates or updates a file in a repository.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "path": "docs/new-file.md",
  "message": "Add new documentation",
  "content": "# New Documentation\n\nContent here...",
  "branch": "main"
}
```

### delete_file
Deletes a file from a repository.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "path": "old-file.txt",
  "message": "Remove obsolete file",
  "branch": "main"
}
```

### list_branches
Lists branches in a repository.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "page": 1,
  "perPage": 30
}
```

### create_branch
Creates a new branch.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "branch": "feature-branch",
  "from_branch": "main"
}
```

### list_commits
Lists commits in a repository.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "sha": "main",
  "author": "octocat",
  "page": 1,
  "perPage": 30
}
```

### get_commit
Gets detailed information about a specific commit.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e"
}
```

### fork_repository
Forks a repository.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "organization": "my-org"
}
```

### push_files
Pushes multiple files in a single commit.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "branch": "main",
  "message": "Update multiple files",
  "files": [
    {
      "path": "file1.txt",
      "content": "Content 1"
    },
    {
      "path": "file2.txt",
      "content": "Content 2"
    }
  ]
}
```

## Issue Tools

### list_issues
Lists issues in a repository.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "state": "open",
  "labels": "bug,help wanted",
  "assignee": "octocat",
  "sort": "created",
  "direction": "desc",
  "page": 1,
  "perPage": 30
}
```

### get_issue
Gets a specific issue.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "issue_number": 42
}
```

### create_issue
Creates a new issue.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "title": "Found a bug",
  "body": "## Description\n\nDetailed bug description...",
  "assignees": ["octocat"],
  "labels": ["bug", "priority-high"],
  "milestone": 1
}
```

### update_issue
Updates an existing issue.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "issue_number": 42,
  "title": "Updated title",
  "body": "Updated description",
  "state": "closed",
  "labels": ["resolved"]
}
```

### add_issue_comment
Adds a comment to an issue.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "issue_number": 42,
  "body": "Thanks for reporting this issue!"
}
```

### list_issue_comments
Lists comments on an issue.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "issue_number": 42,
  "page": 1,
  "perPage": 30
}
```

### add_issue_labels
Adds labels to an issue.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "issue_number": 42,
  "labels": ["enhancement", "documentation"]
}
```

### remove_issue_label
Removes a label from an issue.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "issue_number": 42,
  "label": "wontfix"
}
```

## Pull Request Tools

### list_pull_requests
Lists pull requests in a repository.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "state": "open",
  "head": "feature-branch",
  "base": "main",
  "sort": "created",
  "direction": "desc",
  "page": 1,
  "perPage": 30
}
```

### get_pull_request
Gets a specific pull request.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "pull_number": 123
}
```

### create_pull_request
Creates a new pull request.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "title": "Add new feature",
  "head": "feature-branch",
  "base": "main",
  "body": "## Description\n\nThis PR adds...",
  "draft": false
}
```

### update_pull_request
Updates a pull request.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "pull_number": 123,
  "title": "Updated title",
  "body": "Updated description",
  "state": "closed"
}
```

### merge_pull_request
Merges a pull request.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "pull_number": 123,
  "merge_method": "squash",
  "commit_title": "Feature: Add new functionality (#123)",
  "commit_message": "Detailed merge commit message"
}
```

### get_pull_request_diff
Gets the diff for a pull request.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "pull_number": 123
}
```

### list_pull_request_files
Lists files changed in a pull request.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "pull_number": 123,
  "page": 1,
  "perPage": 30
}
```

### review_pull_request
Creates a review for a pull request.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "pull_number": 123,
  "event": "APPROVE",
  "body": "Looks good to me!",
  "comments": [
    {
      "path": "src/index.js",
      "line": 10,
      "body": "Consider using const here"
    }
  ]
}
```

## GitHub Actions Tools

### list_workflows
Lists workflows in a repository.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "page": 1,
  "perPage": 30
}
```

### trigger_workflow
Triggers a workflow run.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "workflow_id": "ci.yml",
  "ref": "main",
  "inputs": {
    "environment": "production",
    "debug": "false"
  }
}
```

### list_workflow_runs
Lists workflow runs.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "workflow_id": "ci.yml",
  "status": "completed",
  "branch": "main",
  "page": 1,
  "perPage": 10
}
```

### get_workflow_run
Gets a specific workflow run.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "run_id": 123456789
}
```

### cancel_workflow_run
Cancels a workflow run.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "run_id": 123456789
}
```

### rerun_workflow
Reruns a workflow.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "run_id": 123456789
}
```

### list_workflow_jobs
Lists jobs for a workflow run.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "run_id": 123456789,
  "page": 1,
  "perPage": 30
}
```

### get_job_logs
Gets logs for a specific job.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "job_id": 987654321
}
```

## Search Tools

### search_code
Searches for code across GitHub.

```json
{
  "query": "async function language:javascript repo:octocat/hello-world",
  "sort": "indexed",
  "order": "desc",
  "page": 1,
  "perPage": 30
}
```

### search_repositories
Searches for repositories.

```json
{
  "query": "machine learning language:python stars:>100",
  "sort": "stars",
  "order": "desc",
  "page": 1,
  "perPage": 30
}
```

### search_issues
Searches for issues and pull requests.

```json
{
  "query": "is:issue is:open label:bug org:github",
  "sort": "created",
  "order": "desc",
  "page": 1,
  "perPage": 30
}
```

### search_users
Searches for users.

```json
{
  "query": "location:\"San Francisco\" followers:>100",
  "sort": "followers",
  "order": "desc",
  "page": 1,
  "perPage": 30
}
```

## User Tools

### get_authenticated_user
Gets information about the authenticated user.

```json
{}
```

### get_user
Gets information about a specific user.

```json
{
  "username": "octocat"
}
```

### update_user
Updates the authenticated user's profile.

```json
{
  "name": "Mona Lisa",
  "email": "mona@github.com",
  "bio": "Software developer",
  "company": "GitHub",
  "location": "San Francisco"
}
```

### list_user_repositories
Lists repositories for a user.

```json
{
  "username": "octocat",
  "type": "owner",
  "sort": "updated",
  "page": 1,
  "perPage": 30
}
```

### follow_user
Follows a user.

```json
{
  "username": "octocat"
}
```

### unfollow_user
Unfollows a user.

```json
{
  "username": "octocat"
}
```

## Organization Tools

### list_organizations
Lists organizations for the authenticated user.

```json
{
  "page": 1,
  "perPage": 30
}
```

### get_organization
Gets information about an organization.

```json
{
  "org": "github"
}
```

### list_organization_members
Lists members of an organization.

```json
{
  "org": "github",
  "filter": "all",
  "role": "all",
  "page": 1,
  "perPage": 30
}
```

### list_organization_repositories
Lists repositories for an organization.

```json
{
  "org": "github",
  "type": "public",
  "sort": "updated",
  "page": 1,
  "perPage": 30
}
```

## Security Tools

### list_code_scanning_alerts
Lists code scanning alerts for a repository.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "state": "open",
  "severity": "high",
  "page": 1,
  "perPage": 30
}
```

### get_code_scanning_alert
Gets a specific code scanning alert.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "alert_number": 42
}
```

### list_secret_scanning_alerts
Lists secret scanning alerts.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "state": "open",
  "secret_type": "github_personal_access_token",
  "page": 1,
  "perPage": 30
}
```

### list_dependabot_alerts
Lists Dependabot vulnerability alerts.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "state": "open",
  "severity": "critical",
  "ecosystem": "npm",
  "page": 1,
  "perPage": 30
}
```

## Notification Tools

### list_notifications
Lists notifications for the authenticated user.

```json
{
  "all": false,
  "participating": true,
  "since": "2024-01-01T00:00:00Z",
  "page": 1,
  "perPage": 30
}
```

### mark_notification_read
Marks a notification as read.

```json
{
  "thread_id": "123456789"
}
```

### watch_repository
Watches a repository for notifications.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "subscribed": true,
  "ignored": false
}
```

### unwatch_repository
Unwatches a repository.

```json
{
  "owner": "octocat",
  "repo": "hello-world"
}
```

## Discussion Tools

### list_discussions
Lists discussions in a repository (GraphQL).

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "first": 10,
  "after": null,
  "categoryId": null
}
```

### get_discussion
Gets a specific discussion (GraphQL).

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "discussionNumber": 42
}
```

### create_discussion
Creates a new discussion (GraphQL).

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "title": "New discussion topic",
  "body": "Let's discuss this...",
  "categoryId": "DIC_kwDOBkKMX84CAbcd"
}
```

### add_discussion_comment
Adds a comment to a discussion (GraphQL).

```json
{
  "discussionId": "D_kwDOBkKMX84APNvM",
  "body": "Great point!"
}
```

## Performance Tools

### get_performance_metrics
Returns current performance metrics.

```json
{}
```

Returns:
```json
{
  "requestCount": 1234,
  "averageLatency": 150,
  "errorRate": 0.02,
  "cacheHitRate": 0.85,
  "rateLimitRemaining": 4500
}
```

### get_performance_report
Generates a comprehensive performance report.

```json
{}
```

### get_cache_stats
Returns cache statistics.

```json
{}
```

Returns:
```json
{
  "hits": 850,
  "misses": 150,
  "hitRate": 0.85,
  "size": 500,
  "maxSize": 1000
}
```

### clear_api_cache
Clears all API response caches.

```json
{}
```

### get_health_status
Returns system health status.

```json
{}
```

Returns:
```json
{
  "status": "healthy",
  "githubApi": "connected",
  "rateLimit": {
    "remaining": 4500,
    "reset": "2024-01-01T12:00:00Z"
  },
  "circuitBreaker": "closed",
  "cache": "operational"
}
```

## Batch Operation Tools

### batch_get_files
Retrieves multiple files in a single operation.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "paths": [
    "README.md",
    "package.json",
    "src/index.js"
  ],
  "ref": "main"
}
```

### batch_create_issues
Creates multiple issues in a single operation.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "issues": [
    {
      "title": "Issue 1",
      "body": "Description 1",
      "labels": ["bug"]
    },
    {
      "title": "Issue 2",
      "body": "Description 2",
      "labels": ["enhancement"]
    }
  ]
}
```

### batch_update_labels
Updates labels on multiple issues.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "updates": [
    {
      "issue_number": 1,
      "labels": ["bug", "priority-high"]
    },
    {
      "issue_number": 2,
      "labels": ["enhancement", "documentation"]
    }
  ]
}
```

### batch_close_issues
Closes multiple issues.

```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "issue_numbers": [1, 2, 3, 4, 5],
  "comment": "Closing as resolved"
}
```

## Advanced Usage

### Search Query Syntax

GitHub search supports advanced query syntax:

**Code Search:**
- `language:javascript`: Filter by language
- `repo:owner/name`: Search in specific repo
- `path:src/`: Search in path
- `filename:test`: Search by filename
- `extension:js`: Filter by file extension

**Repository Search:**
- `stars:>100`: Minimum stars
- `forks:<10`: Maximum forks
- `created:>2023-01-01`: Created after date
- `topic:machine-learning`: Has topic
- `license:mit`: Has specific license

**Issue/PR Search:**
- `is:issue` or `is:pr`: Type filter
- `is:open` or `is:closed`: State filter
- `label:bug`: Has label
- `assignee:username`: Assigned to user
- `author:username`: Created by user

### Pagination

All list operations support pagination:

```json
{
  "page": 2,
  "perPage": 50
}
```

- `page`: Page number (starts at 1)
- `perPage`: Results per page (max 100)

### Error Handling

All tools return consistent error responses:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Repository not found",
    "details": {
      "owner": "octocat",
      "repo": "nonexistent"
    }
  }
}
```

Common error codes:
- `VALIDATION_ERROR`: Invalid parameters
- `NOT_FOUND`: Resource not found
- `UNAUTHORIZED`: Authentication failed
- `FORBIDDEN`: Insufficient permissions
- `RATE_LIMITED`: API rate limit exceeded
- `INTERNAL_ERROR`: Server error

### Rate Limiting

Monitor rate limits with:

```json
{
  "tool": "get_rate_limit_status"
}
```

Returns current limits and remaining quota:
```json
{
  "rate_limits": {
    "core": {
      "limit": 5000,
      "remaining": 4500,
      "reset": "2024-01-01T12:00:00Z"
    }
  }
}
```

### Best Practices

1. **Use pagination** for large result sets
2. **Cache responses** when appropriate
3. **Batch operations** when possible
4. **Handle errors** gracefully
5. **Monitor rate limits** proactively
6. **Use appropriate scopes** in your PAT
7. **Filter results** at the API level
8. **Use GraphQL** for complex queries