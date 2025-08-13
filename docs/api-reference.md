# API Reference

## Tool Categories

The GitHub MCP Server provides tools organized into the following categories:

## Repository Operations

### get_file_contents
Retrieves the contents of a file from a repository.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `path` (string, required): File path
- `ref` (string, optional): Branch, tag, or commit SHA

**Returns:**
- `content`: File content (base64 encoded for binary files)
- `encoding`: Content encoding type
- `size`: File size in bytes
- `sha`: File SHA

**Example:**
```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "path": "README.md",
  "ref": "main"
}
```

### create_or_update_file
Creates or updates a file in a repository.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `path` (string, required): File path
- `content` (string, required): File content
- `message` (string, required): Commit message
- `branch` (string, optional): Target branch
- `sha` (string, optional): Required for updates

**Returns:**
- `commit`: Commit information
- `content`: Updated file details

### list_repositories
Lists repositories for the authenticated user or specified user.

**Parameters:**
- `user` (string, optional): Username (defaults to authenticated user)
- `type` (string, optional): Filter by type (all, owner, public, private, member)
- `sort` (string, optional): Sort by (created, updated, pushed, full_name)
- `direction` (string, optional): Sort direction (asc, desc)
- `per_page` (number, optional): Results per page (max 100)
- `page` (number, optional): Page number

**Returns:**
Array of repository objects with:
- `name`: Repository name
- `full_name`: Full repository name
- `description`: Repository description
- `private`: Privacy status
- `html_url`: Web URL
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

### create_repository
Creates a new repository.

**Parameters:**
- `name` (string, required): Repository name
- `description` (string, optional): Repository description
- `private` (boolean, optional): Make repository private
- `auto_init` (boolean, optional): Initialize with README
- `gitignore_template` (string, optional): .gitignore template
- `license_template` (string, optional): License template

### list_branches
Lists branches in a repository.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `protected` (boolean, optional): Filter protected branches
- `per_page` (number, optional): Results per page
- `page` (number, optional): Page number

**Returns:**
Array of branch objects with protection status.

### create_branch
Creates a new branch in a repository.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `branch` (string, required): New branch name
- `from_branch` (string, optional): Source branch (defaults to default branch)

## Issue Management

### list_issues
Lists issues in a repository.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `state` (string, optional): Filter by state (open, closed, all)
- `labels` (string, optional): Comma-separated label names
- `assignee` (string, optional): Username of assignee
- `creator` (string, optional): Username of creator
- `milestone` (string, optional): Milestone number
- `since` (string, optional): ISO 8601 timestamp
- `sort` (string, optional): Sort by (created, updated, comments)
- `direction` (string, optional): Sort direction (asc, desc)
- `per_page` (number, optional): Results per page
- `page` (number, optional): Page number

**Returns:**
Array of issue objects.

### create_issue
Creates a new issue.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `title` (string, required): Issue title
- `body` (string, optional): Issue description
- `assignees` (array, optional): Array of usernames
- `milestone` (number, optional): Milestone number
- `labels` (array, optional): Array of label names

### update_issue
Updates an existing issue.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `issue_number` (number, required): Issue number
- `title` (string, optional): New title
- `body` (string, optional): New body
- `state` (string, optional): New state (open, closed)
- `assignees` (array, optional): New assignees
- `labels` (array, optional): New labels

### add_issue_comment
Adds a comment to an issue.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `issue_number` (number, required): Issue number
- `body` (string, required): Comment text

## Pull Request Operations

### list_pull_requests
Lists pull requests in a repository.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `state` (string, optional): Filter by state (open, closed, all)
- `head` (string, optional): Filter by head branch
- `base` (string, optional): Filter by base branch
- `sort` (string, optional): Sort by (created, updated, popularity)
- `direction` (string, optional): Sort direction (asc, desc)

### create_pull_request
Creates a new pull request.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `title` (string, required): PR title
- `head` (string, required): Source branch
- `base` (string, required): Target branch
- `body` (string, optional): PR description
- `draft` (boolean, optional): Create as draft

### merge_pull_request
Merges a pull request.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `pull_number` (number, required): PR number
- `merge_method` (string, optional): Merge method (merge, squash, rebase)
- `commit_title` (string, optional): Merge commit title
- `commit_message` (string, optional): Merge commit message

### review_pull_request
Creates a review for a pull request.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `pull_number` (number, required): PR number
- `event` (string, required): Review action (APPROVE, REQUEST_CHANGES, COMMENT)
- `body` (string, optional): Review comment
- `comments` (array, optional): Inline comments

## GitHub Actions

### list_workflows
Lists workflows in a repository.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `per_page` (number, optional): Results per page
- `page` (number, optional): Page number

### trigger_workflow
Triggers a workflow run.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `workflow_id` (string, required): Workflow ID or filename
- `ref` (string, required): Branch or tag ref
- `inputs` (object, optional): Workflow input parameters

### list_workflow_runs
Lists workflow runs.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `workflow_id` (string, optional): Filter by workflow
- `status` (string, optional): Filter by status
- `branch` (string, optional): Filter by branch
- `per_page` (number, optional): Results per page
- `page` (number, optional): Page number

### cancel_workflow_run
Cancels a workflow run.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `run_id` (number, required): Workflow run ID

## Search Operations

### search_code
Searches for code across GitHub.

**Parameters:**
- `query` (string, required): Search query
- `sort` (string, optional): Sort by (indexed)
- `order` (string, optional): Sort order (asc, desc)
- `per_page` (number, optional): Results per page
- `page` (number, optional): Page number

**Query Syntax:**
- `language:javascript`: Filter by language
- `repo:owner/name`: Search in specific repo
- `path:src/`: Search in path
- `filename:test`: Search by filename

### search_repositories
Searches for repositories.

**Parameters:**
- `query` (string, required): Search query
- `sort` (string, optional): Sort by (stars, forks, updated)
- `order` (string, optional): Sort order (asc, desc)
- `per_page` (number, optional): Results per page
- `page` (number, optional): Page number

### search_issues
Searches for issues and pull requests.

**Parameters:**
- `query` (string, required): Search query
- `sort` (string, optional): Sort by (comments, created, updated)
- `order` (string, optional): Sort order (asc, desc)
- `per_page` (number, optional): Results per page
- `page` (number, optional): Page number

## User Operations

### get_authenticated_user
Gets information about the authenticated user.

**Returns:**
- `login`: Username
- `name`: Full name
- `email`: Email address
- `bio`: User bio
- `company`: Company
- `location`: Location
- `public_repos`: Public repository count
- `followers`: Follower count
- `following`: Following count

### get_user
Gets information about a specific user.

**Parameters:**
- `username` (string, required): Username

### list_user_repositories
Lists repositories for a user.

**Parameters:**
- `username` (string, required): Username
- `type` (string, optional): Filter by type
- `sort` (string, optional): Sort by
- `per_page` (number, optional): Results per page
- `page` (number, optional): Page number

## Organization Operations

### list_organizations
Lists organizations for the authenticated user.

**Parameters:**
- `per_page` (number, optional): Results per page
- `page` (number, optional): Page number

### get_organization
Gets information about an organization.

**Parameters:**
- `org` (string, required): Organization name

### list_organization_members
Lists members of an organization.

**Parameters:**
- `org` (string, required): Organization name
- `filter` (string, optional): Filter by (2fa_disabled, all)
- `role` (string, optional): Filter by role (all, admin, member)
- `per_page` (number, optional): Results per page
- `page` (number, optional): Page number

## Security Operations

### list_code_scanning_alerts
Lists code scanning alerts for a repository.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `state` (string, optional): Filter by state (open, closed, dismissed, fixed)
- `severity` (string, optional): Filter by severity
- `per_page` (number, optional): Results per page
- `page` (number, optional): Page number

### list_secret_scanning_alerts
Lists secret scanning alerts.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `state` (string, optional): Filter by state
- `secret_type` (string, optional): Filter by secret type
- `per_page` (number, optional): Results per page
- `page` (number, optional): Page number

### list_dependabot_alerts
Lists Dependabot vulnerability alerts.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `state` (string, optional): Filter by state
- `severity` (string, optional): Filter by severity
- `ecosystem` (string, optional): Filter by ecosystem
- `per_page` (number, optional): Results per page
- `page` (number, optional): Page number

## Batch Operations

### batch_get_files
Retrieves multiple files in a single operation.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `paths` (array, required): Array of file paths
- `ref` (string, optional): Branch, tag, or commit SHA

### batch_create_issues
Creates multiple issues in a single operation.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `issues` (array, required): Array of issue objects

### batch_update_labels
Updates labels on multiple issues.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `updates` (array, required): Array of label updates

## Performance Tools

### get_cache_stats
Returns cache performance statistics.

**Returns:**
- `hits`: Cache hit count
- `misses`: Cache miss count
- `hitRate`: Cache hit rate percentage
- `size`: Current cache size
- `maxSize`: Maximum cache size

### get_performance_metrics
Returns performance metrics.

**Returns:**
- `averageLatency`: Average request latency
- `requestCount`: Total request count
- `errorRate`: Error rate percentage
- `rateLimitRemaining`: GitHub API rate limit remaining

### get_health_status
Returns system health status.

**Returns:**
- `status`: Overall health status (healthy, degraded, unhealthy)
- `githubApi`: GitHub API connectivity status
- `rateLimit`: Rate limit status
- `circuitBreaker`: Circuit breaker status
- `cache`: Cache status

## Error Responses

All tools return consistent error responses:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  }
}
```

### Common Error Codes
- `VALIDATION_ERROR`: Invalid input parameters
- `NOT_FOUND`: Resource not found
- `UNAUTHORIZED`: Authentication failed
- `FORBIDDEN`: Insufficient permissions
- `RATE_LIMITED`: GitHub API rate limit exceeded
- `CIRCUIT_OPEN`: Circuit breaker is open
- `TIMEOUT`: Request timeout
- `INTERNAL_ERROR`: Internal server error