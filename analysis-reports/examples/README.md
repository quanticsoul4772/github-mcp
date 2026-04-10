# GraphQL Tools Examples

This directory contains comprehensive examples demonstrating how to use the GraphQL-powered tools in the GitHub MCP Server.

## Examples Overview

### 1. [`graphql-examples.md`](./graphql-examples.md)
Complete reference guide with examples for all GraphQL tools:
- GitHub Discussions operations
- Projects V2 management
- Repository insights and analytics
- Advanced search capabilities
- Performance optimization techniques
- Error handling patterns

### 2. [`discussions-workflow.js`](./discussions-workflow.js)
Interactive workflow example showing:
- Creating and managing discussions
- Adding comments and replies
- Searching across discussions
- Best practices for discussion management

### 3. [`projects-automation.js`](./projects-automation.js)
Project automation example demonstrating:
- Automated project board management
- Issue triage and assignment
- Custom field updates
- Project reporting and analytics

## Getting Started

### Prerequisites

1. **GitHub Personal Access Token** with required scopes:
   ```bash
   # For discussions
   repo, write:discussion
   
   # For projects  
   repo, project, admin:org
   
   # For repository insights
   repo, read:org
   
   # For advanced search
   repo, read:user
   ```

2. **Repository/Organization Access**:
   - Enable discussions in target repositories
   - Ensure Projects V2 are accessible
   - Verify appropriate permissions

### Running Examples

#### Method 1: Node.js Integration

```javascript
import { runDiscussionWorkflow } from './discussions-workflow.js';
import { runProjectsAutomation } from './projects-automation.js';

// Your MCP client instance
const mcpClient = new MCPClient(/* configuration */);

// Run discussion workflow
const discussionResult = await runDiscussionWorkflow(mcpClient);

// Run project automation
const projectResult = await runProjectsAutomation(mcpClient, 'myorg');
```

#### Method 2: Direct MCP Tool Calls

```javascript
// Example: Create a discussion
const discussion = await mcpClient.callTool('create_discussion', {
  owner: 'myorg',
  repo: 'myproject', 
  title: 'API Design Discussion',
  body: 'Let\'s discuss the new API design...',
  categoryId: 'DIC_kwDOABOvAA4B-w8j'
});
```

#### Method 3: Claude Desktop Integration

With Claude Desktop, you can use natural language:

```
"Create a discussion in myorg/myproject about GraphQL performance improvements"

"Show me all projects for myorg and their current status"

"Get repository insights for facebook/react since January 2024"
```

## Example Scenarios

### Scenario 1: Community Management
```javascript
// 1. List recent discussions
await mcpClient.callTool('list_discussions', {
  owner: 'myorg',
  repo: 'community',
  perPage: 10
});

// 2. Respond to unanswered discussions
await mcpClient.callTool('add_discussion_comment', {
  discussionId: 'D_kwDOABOvAA4AQhZS',
  body: 'Thanks for raising this! Let me investigate...'
});
```

### Scenario 2: Project Planning
```javascript
// 1. Create new project board
await mcpClient.callTool('create_project_board', {
  owner: 'myorg',
  title: 'Q1 2024 Roadmap',
  body: 'Planning board for Q1 objectives'
});

// 2. Add issues to project
await mcpClient.callTool('create_project_item', {
  projectId: 'PN_kwHOABCD1234',
  contentId: 'I_kwDOABOvAA4ABCDE',
  contentType: 'Issue'
});
```

### Scenario 3: Repository Analysis
```javascript
// 1. Get comprehensive repo insights  
await mcpClient.callTool('get_repository_insights', {
  owner: 'microsoft',
  repo: 'vscode',
  since: '2024-01-01T00:00:00Z'
});

// 2. Analyze contributor patterns
await mcpClient.callTool('get_contributor_insights', {
  owner: 'microsoft',
  repo: 'vscode',
  first: 20
});
```

## Performance Best Practices

### 1. Pagination
Always use appropriate page sizes:
```javascript
// Good: Reasonable page size
{ perPage: 25 }

// Avoid: Too large, may hit complexity limits  
{ perPage: 100 }
```

### 2. Field Selection
GraphQL allows precise data fetching - the tools automatically optimize queries, but you can influence performance by requesting only what you need.

### 3. Error Handling
```javascript
try {
  const result = await mcpClient.callTool('create_discussion', params);
} catch (error) {
  if (error.type === 'GraphQLError') {
    // Handle GraphQL-specific errors
    console.error('GraphQL error:', error.details);
  } else if (error.type === 'RateLimitError') {
    // Handle rate limiting
    console.error('Rate limit hit, retry after:', error.resetAt);
  }
}
```

### 4. Caching
Enable caching for frequently accessed data:
```bash
GITHUB_ENABLE_GRAPHQL_CACHE=true
```

## Common Use Cases

### Discussion Management
- **Community Support**: Monitor and respond to community discussions
- **Feature Requests**: Collect and organize feature requests via discussions  
- **Q&A Sessions**: Host community Q&A sessions
- **Announcements**: Share project updates and announcements

### Project Automation  
- **Issue Triage**: Automatically add labeled issues to projects
- **Sprint Planning**: Organize issues by sprints and milestones
- **Progress Tracking**: Monitor project progress and generate reports
- **Workflow Automation**: Update project status based on PR events

### Repository Analytics
- **Health Monitoring**: Track repository activity and health metrics
- **Contributor Analysis**: Understand contribution patterns and activity
- **Language Evolution**: Monitor language usage changes over time
- **Performance Metrics**: Analyze issue resolution and PR merge times

### Advanced Search
- **Code Discovery**: Find code patterns across repositories
- **Impact Analysis**: Identify affected repositories for changes
- **Security Auditing**: Search for potential security issues
- **Documentation**: Find examples and usage patterns

## Troubleshooting

### Common Issues

1. **"Discussions not enabled"**
   - Enable discussions in repository settings
   - Verify repository owner permissions

2. **"Project access denied"**
   - Check project visibility settings
   - Ensure PAT has `project` scope
   - Verify organization membership

3. **"GraphQL complexity too high"** 
   - Reduce pagination limits
   - Remove unnecessary nested queries
   - Use cursor-based pagination

4. **"Rate limit exceeded"**
   - Monitor query costs
   - Implement exponential backoff
   - Use caching to reduce API calls

### Getting Help

1. Check the main documentation: [`docs/graphql-tools.md`](../docs/graphql-tools.md)
2. Review GitHub's GraphQL documentation
3. Test with minimal queries first
4. Monitor rate limits and query complexity

## Contributing

Found an issue with these examples or want to add more? Contributions are welcome!

1. Test your examples thoroughly
2. Include error handling
3. Add clear documentation
4. Follow the existing patterns

These examples should provide a solid foundation for using the GraphQL tools effectively in your own projects.