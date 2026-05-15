# GraphQL Tools Documentation

The GitHub MCP Server includes powerful GraphQL-based tools that provide advanced functionality beyond what's available through REST APIs. These tools leverage GitHub's GraphQL API to deliver efficient, flexible, and feature-rich integrations.

## Overview

GraphQL tools in this server provide several key advantages:

- **Efficient Data Fetching**: Query only the data you need, reducing API calls and bandwidth
- **Advanced Features**: Access to GitHub features only available via GraphQL (like Discussions and Projects V2)
- **Flexible Queries**: Customize data retrieval to match specific use cases
- **Real-time Capabilities**: Better support for subscriptions and live data
- **Nested Relationships**: Fetch related data in a single request

## When to Use GraphQL vs REST

### Use GraphQL Tools When:
- Working with GitHub Discussions
- Managing GitHub Projects V2
- Requiring complex repository insights and statistics
- Need to minimize API calls with nested data fetching
- Advanced search functionality is required
- Working with data relationships across multiple entities

### Use REST Tools When:
- Simple CRUD operations on issues, PRs, files
- Working with GitHub Actions workflows
- Basic repository management tasks
- When REST endpoints provide sufficient functionality

## Available GraphQL Toolsets

### 1. Discussions (`discussions.ts`)

GitHub Discussions enable community conversations around repositories. All Discussion operations require GraphQL.

#### Available Tools:
- `list_discussions` - List discussions in a repository
- `get_discussion` - Get a specific discussion with full details
- `get_discussion_comments` - Get comments on a discussion with pagination
- `list_discussion_categories` - List available discussion categories
- `search_discussions` - Search for discussions across repositories
- `create_discussion` - Create a new discussion (write mode)
- `add_discussion_comment` - Add a comment to a discussion (write mode)
- `update_discussion` - Update discussion title/body/category (write mode)
- `delete_discussion` - Delete a discussion (write mode)

#### Key Features:
- Full pagination support with cursor-based navigation
- Rich discussion data including upvotes, categories, and nested replies
- Support for discussion categories and filtering
- Global discussion search across repositories
- Comprehensive comment threading

### 2. Project Management (`project-management.ts`)

GitHub Projects V2 is only accessible via GraphQL and provides advanced project management capabilities.

#### Available Tools:
- `get_project_boards` - Get Projects V2 boards for repositories or organizations
- `get_project_items` - Get items in a specific project
- `get_project_fields` - Get custom fields configured for a project
- `search_project_items` - Search for items within projects
- `create_project_item` - Add items to a project (write mode)
- `update_project_item` - Update project item fields (write mode)
- `delete_project_item` - Remove items from a project (write mode)

#### Key Features:
- Support for both repository and organization projects
- Custom field management (text, number, date, single select, etc.)
- Advanced filtering and searching within projects
- Item relationships with issues and pull requests
- Project views and configurations

### 3. Repository Insights (`repository-insights.ts`)

Advanced repository statistics and analytics using GraphQL for comprehensive data aggregation.

#### Available Tools:
- `get_repository_insights` - Comprehensive repository statistics
- `get_contributor_insights` - Detailed contributor statistics and activity
- `get_language_insights` - Language breakdown and statistics
- `get_commit_activity` - Commit activity patterns over time
- `get_issue_insights` - Issue and PR analytics
- `get_security_insights` - Security-related repository information

#### Key Features:
- Aggregated statistics across multiple data points
- Time-series data for trends and patterns
- Contributor activity analysis
- Language distribution and evolution
- Issue/PR lifecycle analytics

### 4. Advanced Search (`advanced-search.ts`)

Enhanced search capabilities that leverage GraphQL's powerful querying features.

#### Available Tools:
- `advanced_code_search` - Search code with advanced filters and context
- `search_repositories_advanced` - Repository search with detailed criteria
- `search_users_advanced` - User search with profile information
- `search_issues_advanced` - Issue search with relationship data
- `search_pull_requests_advanced` - PR search with review information
- `search_commits_advanced` - Commit search with author and change data

#### Key Features:
- Context-aware search results with relationships
- Advanced filtering and sorting options
- Nested data retrieval in search results
- Performance-optimized queries
- Support for complex search criteria

## Configuration

### Enabling GraphQL Toolsets

GraphQL toolsets are enabled by default. To enable specific toolsets:

```bash
# Enable only GraphQL toolsets
GITHUB_TOOLSETS="discussions,graphql_insights,project_management,advanced_search"

# Enable all toolsets (default)
GITHUB_TOOLSETS="all"
```

### Required Permissions

Different GraphQL tools require different scopes in your GitHub Personal Access Token:

#### Discussions:
- `repo` - Access to repository discussions
- `write:discussion` - Create and modify discussions (write mode)

#### Projects:
- `repo` - Access to repository projects
- `project` - Full control of projects (write mode)
- `admin:org` - Organization projects (if applicable)

#### Repository Insights:
- `repo` - Access to repository data
- `read:org` - Organization repository insights

#### Advanced Search:
- `repo` - Access to repository content for search
- `read:user` - User search capabilities

### Environment Variables

```bash
# GraphQL-specific configuration
GITHUB_ENABLE_GRAPHQL_CACHE=true          # Enable GraphQL query caching
GITHUB_GRAPHQL_TIMEOUT=30000             # GraphQL query timeout (ms)
GITHUB_GRAPHQL_MAX_COMPLEXITY=1000       # Maximum query complexity
GITHUB_ENABLE_GRAPHQL_INTROSPECTION=false # Disable introspection in production
```

## Performance Considerations

### Query Optimization

GraphQL tools in this server are optimized for performance:

1. **Query Complexity Limits**: Prevents overly complex queries that could impact GitHub's servers
2. **Cursor-based Pagination**: Efficient pagination for large result sets
3. **Field Selection**: Only requested fields are fetched to minimize response size
4. **Query Caching**: Intelligent caching of GraphQL responses
5. **Batching**: Multiple operations can be batched into single requests where possible

### Rate Limiting

GraphQL and REST APIs have different rate limiting:

- **REST API**: 5,000 requests per hour
- **GraphQL API**: 5,000 points per hour (varies by query complexity)

GraphQL tools automatically:
- Monitor query complexity and point consumption
- Implement adaptive rate limiting based on query costs
- Provide rate limit headers in responses
- Queue requests when approaching limits

### Best Practices

1. **Request Only Needed Data**: GraphQL allows precise data fetching - use it
2. **Use Pagination**: Always paginate large result sets
3. **Monitor Query Costs**: Be aware of GraphQL query complexity points
4. **Cache Responses**: Enable caching for frequently accessed data
5. **Batch Operations**: Group related operations when possible

## Error Handling

GraphQL tools provide comprehensive error handling:

### GraphQL-Specific Errors:
- **Syntax Errors**: Invalid GraphQL query syntax
- **Validation Errors**: Schema validation failures
- **Execution Errors**: Runtime errors during query execution
- **Rate Limit Errors**: GraphQL point exhaustion
- **Permission Errors**: Insufficient scopes or repository access

### Error Response Format:
```json
{
  "error": "GraphQL execution error",
  "type": "GraphQLError",
  "details": {
    "query": "...",
    "variables": "...",
    "path": ["repository", "discussions"],
    "extensions": {
      "code": "INSUFFICIENT_SCOPES",
      "cost": 15,
      "remaining": 4985
    }
  }
}
```

## Migration from REST to GraphQL

When migrating from REST to GraphQL tools:

1. **Identify Use Cases**: Determine which operations benefit from GraphQL
2. **Update Permissions**: Ensure PAT has required scopes
3. **Modify Queries**: Adapt data fetching patterns to GraphQL
4. **Test Performance**: Validate improved efficiency
5. **Monitor Costs**: Track GraphQL point consumption

### Common Migration Patterns:

| REST Pattern | GraphQL Equivalent | Benefits |
|--------------|-------------------|----------|
| Multiple API calls for related data | Single GraphQL query | Reduced latency, fewer API calls |
| Fetching entire objects | Field selection | Reduced bandwidth |
| Manual pagination | Cursor-based pagination | More efficient, stable pagination |
| Separate discussion endpoints | Integrated discussion queries | Better data relationships |

## Troubleshooting

### Common Issues:

1. **Query Timeout**
   - Reduce query complexity
   - Add pagination to large result sets
   - Check network connectivity

2. **Rate Limit Exceeded**
   - Monitor query costs with complexity analysis
   - Implement request queuing
   - Use caching for repeated queries

3. **Permission Denied**
   - Verify PAT scopes include required permissions
   - Check repository/organization access rights
   - Ensure discussions/projects are enabled

4. **Invalid Query**
   - Validate GraphQL syntax
   - Check schema documentation
   - Use GraphQL introspection for debugging

5. **Data Inconsistency**
   - Check for eventual consistency in GraphQL responses
   - Refresh cached data if needed
   - Verify query field selections

## Examples

See the `/examples` directory for comprehensive usage examples of each GraphQL tool, including:

- Complete workflow examples
- Performance optimization techniques
- Error handling patterns
- Integration with REST tools
- Advanced query patterns

## Further Reading

- [GitHub GraphQL API Documentation](https://docs.github.com/en/graphql)
- [GraphQL Query Complexity](https://docs.github.com/en/graphql/overview/resource-limitations)
- [GitHub Discussions API](https://docs.github.com/en/graphql/reference/objects#discussion)
- [GitHub Projects V2 API](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)