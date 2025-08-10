# GraphQL Tools Usage Examples

This document provides comprehensive examples of using the GraphQL-powered tools in the GitHub MCP Server.

## Prerequisites

Before using GraphQL tools, ensure your GitHub Personal Access Token has the required scopes:

```bash
# Required scopes for different GraphQL toolsets
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxx  # with repo, discussions, project scopes
```

## GitHub Discussions Examples

### Basic Discussion Operations

#### List All Discussions in a Repository

```javascript
// Using the list_discussions tool
{
  "tool": "list_discussions",
  "arguments": {
    "owner": "microsoft",
    "repo": "vscode",
    "perPage": 10
  }
}
```

**Expected Response:**
```json
{
  "total_count": 1250,
  "has_next_page": true,
  "end_cursor": "Y3Vyc29yOjIw",
  "discussions": [
    {
      "id": "D_kwDOABOvAA4AQhZS",
      "number": 123,
      "title": "Feature Request: Better IntelliSense",
      "body": "It would be great if...",
      "createdAt": "2023-10-01T12:00:00Z",
      "author": {
        "login": "developer123"
      },
      "category": {
        "id": "DIC_kwDOABOvAA4B-w8j",
        "name": "Ideas",
        "slug": "ideas"
      },
      "comments": {
        "totalCount": 15
      },
      "upvoteCount": 8,
      "url": "https://github.com/microsoft/vscode/discussions/123"
    }
  ]
}
```

#### Get Discussion with Comments

```javascript
// Using the get_discussion tool
{
  "tool": "get_discussion",
  "arguments": {
    "owner": "microsoft",
    "repo": "vscode", 
    "discussionNumber": 123
  }
}
```

#### Search Discussions Across Repositories

```javascript
// Using the search_discussions tool
{
  "tool": "search_discussions",
  "arguments": {
    "query": "GraphQL API performance",
    "first": 20
  }
}
```

#### Create a New Discussion

```javascript
// Using the create_discussion tool (requires write access)
{
  "tool": "create_discussion",
  "arguments": {
    "owner": "myorg",
    "repo": "myproject",
    "title": "Proposal: GraphQL Schema Changes",
    "body": "I propose we make the following changes to our GraphQL schema...",
    "categoryId": "DIC_kwDOABOvAA4B-w8j"  // Get this from list_discussion_categories
  }
}
```

### Advanced Discussion Workflows

#### Get Discussion Categories and Create Targeted Discussion

```javascript
// Step 1: Get available categories
{
  "tool": "list_discussion_categories",
  "arguments": {
    "owner": "myorg",
    "repo": "myproject"
  }
}

// Step 2: Create discussion in appropriate category
{
  "tool": "create_discussion", 
  "arguments": {
    "owner": "myorg",
    "repo": "myproject",
    "title": "Bug Report: GraphQL Timeout Issues",
    "body": "## Description\nWe're experiencing timeout issues...",
    "categoryId": "DIC_kwDOABOvAA4B-bug"  // From step 1 results
  }
}
```

## GitHub Projects V2 Examples

### Project Board Management

#### List Organization Projects

```javascript
// Using the get_project_boards tool
{
  "tool": "get_project_boards",
  "arguments": {
    "owner": "myorg",
    "first": 10
  }
}
```

**Expected Response:**
```json
{
  "total_count": 5,
  "projects": [
    {
      "id": "PN_kwHOABCD1234",
      "number": 1,
      "title": "Product Roadmap 2024",
      "shortDescription": "Planning and tracking product features",
      "url": "https://github.com/orgs/myorg/projects/1",
      "createdAt": "2024-01-01T00:00:00Z",
      "closed": false,
      "public": true,
      "owner": {
        "login": "myorg"
      }
    }
  ]
}
```

#### Get Project Items with Custom Fields

```javascript
// Using the get_project_items tool
{
  "tool": "get_project_items",
  "arguments": {
    "projectId": "PN_kwHOABCD1234",
    "first": 25
  }
}
```

### Repository Insights Examples

#### Comprehensive Repository Analytics

```javascript
// Using the get_repository_insights tool
{
  "tool": "get_repository_insights",
  "arguments": {
    "owner": "facebook",
    "repo": "react",
    "since": "2024-01-01T00:00:00Z"
  }
}
```

**Expected Response:**
```json
{
  "name": "react",
  "description": "A declarative, efficient, and flexible JavaScript library...",
  "stargazerCount": 210000,
  "forkCount": 43000,
  "watchers": {
    "totalCount": 6800
  },
  "issues": {
    "totalCount": 1200
  },
  "pullRequests": {
    "totalCount": 350
  },
  "languages": {
    "edges": [
      {
        "size": 892456,
        "node": {
          "name": "JavaScript",
          "color": "#f1e05a"
        }
      },
      {
        "size": 124567,
        "node": {
          "name": "TypeScript", 
          "color": "#2b7489"
        }
      }
    ]
  },
  "defaultBranchRef": {
    "target": {
      "history": {
        "totalCount": 15234
      }
    }
  }
}
```

#### Get Contributor Statistics

```javascript
// Using the get_contributor_insights tool  
{
  "tool": "get_contributor_insights",
  "arguments": {
    "owner": "facebook",
    "repo": "react",
    "since": "2024-01-01T00:00:00Z",
    "first": 10
  }
}
```

## Advanced Search Examples

### Code Search with Context

```javascript
// Using the advanced_code_search tool
{
  "tool": "search_across_repos",
  "arguments": {
    "query": "GraphQL mutation language:TypeScript",
    "type": "CODE",
    "first": 15
  }
}
```

**Expected Response:**
```json
{
  "search": {
    "codeCount": 1250,
    "nodes": [
      {
        "repository": {
          "name": "github-mcp",
          "owner": {
            "login": "myorg"
          }
        },
        "textMatches": [
          {
            "fragment": "const mutation = `\n  mutation($input: CreateDiscussionInput!) {\n    createDiscussion(input: $input) {",
            "highlights": [
              {
                "text": "mutation",
                "beginIndice": 6,
                "endIndice": 14
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### Repository Search with Detailed Metadata

```javascript
// Using the search_repositories_advanced tool
{
  "tool": "search_across_repos",
  "arguments": {
    "query": "GraphQL stars:>1000 language:TypeScript",
    "type": "REPOSITORY", 
    "first": 10
  }
}
```

## Performance Optimization Examples

### Pagination Best Practices

```javascript
// Initial request
{
  "tool": "list_discussions",
  "arguments": {
    "owner": "microsoft",
    "repo": "vscode",
    "perPage": 50
  }
}

// Follow-up request with cursor
{
  "tool": "list_discussions",
  "arguments": {
    "owner": "microsoft", 
    "repo": "vscode",
    "perPage": 50,
    "after": "Y3Vyc29yOjUw"  // from previous response's end_cursor
  }
}
```

### Efficient Data Fetching

```javascript
// Get discussion with limited comments for performance
{
  "tool": "get_discussion",
  "arguments": {
    "owner": "microsoft",
    "repo": "vscode",
    "discussionNumber": 123
  }
}

// Then get more comments if needed
{
  "tool": "get_discussion_comments",
  "arguments": {
    "owner": "microsoft",
    "repo": "vscode", 
    "discussionNumber": 123,
    "perPage": 25,
    "after": "cursor_from_initial_query"
  }
}
```

## Error Handling Examples

### Handling GraphQL Errors

```javascript
// Example error response
{
  "error": "GraphQL execution error",
  "type": "GraphQLError",
  "details": {
    "errors": [
      {
        "message": "Resource not accessible by integration",
        "type": "FORBIDDEN", 
        "path": ["repository", "discussions"]
      }
    ]
  }
}
```

**Common Solutions:**
1. Check repository has discussions enabled
2. Verify PAT has `repo` and `write:discussion` scopes
3. Ensure user has access to the repository

### Rate Limit Handling

```javascript
// Rate limit error response
{
  "error": "Rate limit exceeded",
  "type": "RateLimitError",
  "details": {
    "cost": 150,
    "remaining": 0,
    "resetAt": "2024-01-01T12:30:00Z"
  }
}
```

**Best Practices:**
- Monitor query complexity with the `cost` field
- Implement exponential backoff for retries
- Use pagination to reduce query complexity
- Cache responses when appropriate

## Integration Patterns

### Combining REST and GraphQL Tools

```javascript
// Step 1: Use REST to get basic repository info
{
  "tool": "get_repository",  // REST tool
  "arguments": {
    "owner": "microsoft",
    "repo": "vscode"
  }
}

// Step 2: Use GraphQL for advanced insights
{
  "tool": "get_repository_insights",  // GraphQL tool  
  "arguments": {
    "owner": "microsoft",
    "repo": "vscode"
  }
}

// Step 3: Use GraphQL for discussions
{
  "tool": "list_discussions",  // GraphQL tool
  "arguments": {
    "owner": "microsoft", 
    "repo": "vscode",
    "perPage": 10
  }
}
```

### Workflow Automation

```javascript
// Automated project management workflow
// 1. Get project boards
{
  "tool": "get_project_boards",
  "arguments": {
    "owner": "myorg"
  }
}

// 2. Get project items to analyze
{
  "tool": "get_project_items", 
  "arguments": {
    "projectId": "PN_kwHOABCD1234"
  }
}

// 3. Create new project item based on analysis
{
  "tool": "create_project_item",
  "arguments": {
    "projectId": "PN_kwHOABCD1234", 
    "contentId": "I_kwDOABOvAA4ABCDE",  // Issue or PR ID
    "contentType": "Issue"
  }
}
```

## Security Considerations

### Token Scope Requirements

```bash
# Minimum required scopes for GraphQL tools
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxx

# Required scopes by toolset:
# discussions: repo, write:discussion
# project_management: repo, project, admin:org (for org projects)  
# repository_insights: repo, read:org
# advanced_search: repo, read:user
```

### Rate Limit Monitoring

```javascript
// Monitor GraphQL rate limits
{
  "tool": "get_rate_limit",  // Built-in monitoring tool
  "arguments": {}
}
```

**Response includes GraphQL-specific limits:**
```json
{
  "resources": {
    "graphql": {
      "limit": 5000,
      "remaining": 4850,
      "reset": 1641024000
    }
  }
}
```

## Troubleshooting

### Common Issues and Solutions

1. **"Discussions not enabled"**
   - Enable discussions in repository settings
   - Verify repository has discussions feature

2. **"Project not found"**  
   - Check project ID format (starts with PN_)
   - Verify project access permissions

3. **"Query complexity too high"**
   - Reduce pagination limits
   - Remove unnecessary nested fields
   - Split complex queries into smaller parts

4. **"Authentication failed"**
   - Verify PAT has required scopes
   - Check token expiration
   - Test with minimal scope requirements first

This comprehensive example guide should help you effectively use all GraphQL tools in the GitHub MCP Server.