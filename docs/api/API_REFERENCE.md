# GitHub MCP Server - API Reference

This document provides a comprehensive reference for all tools available in the GitHub MCP Server.

## Table of Contents

- [Repository Tools](#repository-tools)
- [Issue Tools](#issue-tools)  
- [Pull Request Tools](#pull-request-tools)
- [GitHub Actions Tools](#github-actions-tools)
- [Security Tools](#security-tools)
- [User & Organization Tools](#user--organization-tools)
- [Search Tools](#search-tools)
- [Notification Tools](#notification-tools)
- [Discussion Tools](#discussion-tools)

## Repository Tools

### get_file_contents
Get file or directory contents from a GitHub repository.

**Parameters:**
- `owner` (required): Repository owner (username or organization)
- `repo` (required): Repository name
- `path` (optional): Path to file/directory (directories must end with `/`)
- `ref` (optional): Git ref (branch, tag, or commit SHA)

**Example:**
```json
{
  "owner": "octocat",
  "repo": "Hello-World",
  "path": "README.md",
  "ref": "main"
}
```

### create_file
Create a new file in a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `path` (required): File path
- `content` (required): File content (base64 encoded for binary files)
- `message` (required): Commit message
- `branch` (optional): Branch name (defaults to repository default branch)

### update_file
Update an existing file in a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name  
- `path` (required): File path
- `content` (required): New file content
- `message` (required): Commit message
- `sha` (required): SHA of the file being replaced
- `branch` (optional): Branch name

### delete_file
Delete a file from a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `path` (required): File path
- `message` (required): Commit message
- `sha` (required): SHA of the file to delete
- `branch` (optional): Branch name

### list_repos
List repositories for the authenticated user or organization.

**Parameters:**
- `owner` (optional): Username or organization name
- `type` (optional): Repository type (`all`, `owner`, `public`, `private`, `member`)
- `sort` (optional): Sort by (`created`, `updated`, `pushed`, `full_name`)
- `direction` (optional): Sort direction (`asc`, `desc`)
- `per_page` (optional): Results per page (1-100, default 30)
- `page` (optional): Page number

### fork_repo
Fork a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `organization` (optional): Organization to fork to

## Issue Tools

### get_issue  
Get details of a specific GitHub issue.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `issue_number` (required): Issue number

### list_issues
List issues for a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `state` (optional): Issue state (`open`, `closed`, `all`)
- `labels` (optional): Comma-separated list of labels
- `sort` (optional): Sort by (`created`, `updated`, `comments`)
- `direction` (optional): Sort direction (`asc`, `desc`)
- `per_page` (optional): Results per page (1-100, default 30)
- `page` (optional): Page number

### create_issue
Create a new issue in a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `title` (required): Issue title
- `body` (optional): Issue body
- `labels` (optional): Array of label names
- `assignees` (optional): Array of usernames to assign
- `milestone` (optional): Milestone number

### update_issue
Update an existing issue.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `issue_number` (required): Issue number
- `title` (optional): New issue title
- `body` (optional): New issue body
- `state` (optional): Issue state (`open`, `closed`)
- `labels` (optional): Array of label names
- `assignees` (optional): Array of usernames

### add_issue_comment
Add a comment to an issue.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `issue_number` (required): Issue number
- `body` (required): Comment body

## Pull Request Tools

### get_pull_request
Get details of a specific pull request.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `pull_number` (required): Pull request number

### list_pull_requests
List pull requests for a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `state` (optional): PR state (`open`, `closed`, `all`)
- `head` (optional): Head branch name
- `base` (optional): Base branch name
- `sort` (optional): Sort by (`created`, `updated`, `popularity`)
- `direction` (optional): Sort direction (`asc`, `desc`)

### create_pull_request
Create a new pull request.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `title` (required): Pull request title
- `head` (required): Head branch name
- `base` (required): Base branch name
- `body` (optional): Pull request body
- `maintainer_can_modify` (optional): Allow maintainer edits
- `draft` (optional): Create as draft PR

### merge_pull_request
Merge a pull request.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `pull_number` (required): Pull request number
- `commit_title` (optional): Commit title for merge
- `commit_message` (optional): Commit message for merge
- `merge_method` (optional): Merge method (`merge`, `squash`, `rebase`)

## GitHub Actions Tools

### list_workflows
List workflows for a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `per_page` (optional): Results per page
- `page` (optional): Page number

### get_workflow_run
Get details of a specific workflow run.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `run_id` (required): Workflow run ID

### list_workflow_runs
List workflow runs for a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `workflow_id` (optional): Workflow ID or filename
- `branch` (optional): Branch name
- `status` (optional): Run status
- `per_page` (optional): Results per page
- `page` (optional): Page number

### trigger_workflow
Trigger a workflow dispatch event.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `workflow_id` (required): Workflow ID or filename
- `ref` (required): Git reference
- `inputs` (optional): Input parameters for workflow

## Security Tools

### list_code_scanning_alerts
List code scanning alerts for a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `state` (optional): Alert state (`open`, `dismissed`, `fixed`)
- `severity` (optional): Alert severity
- `per_page` (optional): Results per page
- `page` (optional): Page number

### list_secret_scanning_alerts
List secret scanning alerts for a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `state` (optional): Alert state (`open`, `resolved`)
- `per_page` (optional): Results per page
- `page` (optional): Page number

### list_dependabot_alerts
List Dependabot vulnerability alerts for a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `state` (optional): Alert state (`auto_dismissed`, `dismissed`, `fixed`, `open`)
- `severity` (optional): Alert severity
- `per_page` (optional): Results per page
- `page` (optional): Page number

## User & Organization Tools

### get_user
Get information about a user.

**Parameters:**
- `username` (required): GitHub username

### get_authenticated_user
Get information about the authenticated user.

**Parameters:** None

### list_user_repos
List repositories for a user.

**Parameters:**
- `username` (required): GitHub username
- `type` (optional): Repository type
- `sort` (optional): Sort criteria
- `direction` (optional): Sort direction
- `per_page` (optional): Results per page
- `page` (optional): Page number

### follow_user
Follow a user.

**Parameters:**
- `username` (required): GitHub username to follow

### unfollow_user
Unfollow a user.

**Parameters:**
- `username` (required): GitHub username to unfollow

## Search Tools

### search_code
Search for code across GitHub.

**Parameters:**
- `q` (required): Search query
- `sort` (optional): Sort criteria (`indexed`)
- `order` (optional): Sort order (`desc`, `asc`)
- `per_page` (optional): Results per page
- `page` (optional): Page number

### search_repositories
Search for repositories.

**Parameters:**
- `q` (required): Search query
- `sort` (optional): Sort criteria (`stars`, `forks`, `help-wanted-issues`, `updated`)
- `order` (optional): Sort order (`desc`, `asc`)
- `per_page` (optional): Results per page
- `page` (optional): Page number

### search_issues
Search for issues and pull requests.

**Parameters:**
- `q` (required): Search query
- `sort` (optional): Sort criteria (`comments`, `reactions`, `author-date`, `committer-date`, `created`, `updated`)
- `order` (optional): Sort order (`desc`, `asc`)
- `per_page` (optional): Results per page
- `page` (optional): Page number

## Notification Tools

### list_notifications
List notifications for the authenticated user.

**Parameters:**
- `all` (optional): Show all notifications including read ones
- `participating` (optional): Show only notifications in which user is participating
- `since` (optional): ISO 8601 timestamp for notifications since
- `before` (optional): ISO 8601 timestamp for notifications before
- `per_page` (optional): Results per page
- `page` (optional): Page number

### mark_notification_read
Mark a notification as read.

**Parameters:**
- `thread_id` (required): Notification thread ID

## Discussion Tools

### list_discussions
List discussions for a repository.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `first` (optional): Number of discussions to fetch (default 10, max 100)
- `after` (optional): Cursor for pagination

### get_discussion
Get a specific discussion.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `number` (required): Discussion number

### create_discussion
Create a new discussion.

**Parameters:**
- `owner` (required): Repository owner
- `repo` (required): Repository name
- `title` (required): Discussion title
- `body` (required): Discussion body
- `category_id` (required): Discussion category ID

## Error Handling

All tools return standardized error responses with:
- `error`: Error message
- `status`: HTTP status code
- `documentation_url`: Link to relevant GitHub API documentation (when available)

Common error status codes:
- `400`: Bad Request - Invalid parameters
- `401`: Unauthorized - Invalid or missing authentication
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource doesn't exist
- `422`: Unprocessable Entity - Validation failed
- `500`: Internal Server Error - Server-side error

## Rate Limiting

GitHub API has rate limits:
- Authenticated requests: 5,000 per hour
- Search API: 30 requests per minute
- GraphQL API: 5,000 points per hour

The server automatically handles rate limiting and will return appropriate error messages when limits are exceeded.