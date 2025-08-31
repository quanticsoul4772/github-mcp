# GitHub MCP Server

A comprehensive Model Context Protocol (MCP) server for GitHub integration, enabling AI assistants to interact with GitHub repositories, issues, pull requests, actions, and more.

> **Note**: This project uses a patched version of the MCP SDK to fix parameter passing for JSON Schema-based tools. See [docs/PARAMETER_BUG_RESOLUTION.md](docs/PARAMETER_BUG_RESOLUTION.md) for details.

## Features

This MCP server provides comprehensive GitHub integration with 100+ tools organized into specialized modules:

### Repository Management
- Browse and search repositories
- Get file contents and directory listings
- Create, update, and delete files
- Manage branches, tags, and releases
- Fork repositories
- Search code across GitHub
- Batch operations for efficiency

### Issues & Pull Requests
- List, create, and update issues
- Manage issue comments and labels
- Create and review pull requests
- Merge pull requests with various strategies
- Get PR diffs and files
- Search issues and PRs
- Automated PR review workflows

### GitHub Actions
- List and trigger workflows
- Monitor workflow runs with real-time status
- Get job logs and artifacts
- Manage secrets and variables
- Cancel and rerun workflows
- Download and manage artifacts

### Security & Compliance
- Code scanning alerts and SARIF uploads
- Secret scanning alerts and management
- Dependabot vulnerability alerts
- Security advisories and policy enforcement
- Branch protection rules
- Security settings management

### Organizations & Users
- Search users and organizations
- Manage organization members and teams
- List user repositories and activity
- Follow/unfollow users
- Update profiles
- Team collaboration features

### Notifications & Discussions
- List and manage notifications
- Watch/unwatch repositories
- Create and participate in discussions
- Manage discussion comments
- Thread subscriptions

### Performance Features
- **Smart Caching**: LRU cache with TTL for API responses
- **Request Deduplication**: Prevents duplicate concurrent API calls
- **Batch Operations**: Process multiple items efficiently
- **Streaming Pagination**: Memory-efficient handling of large datasets
- **Circuit Breaker**: Prevents cascading failures
- **Rate Limit Management**: Proactive rate limit tracking

### GraphQL-Powered Features
- **GitHub Discussions**: Full discussion management with GraphQL
- **Projects V2**: Advanced project management and tracking
- **Repository Insights**: Comprehensive repository analytics and statistics
- **Advanced Search**: Enhanced search with nested data and relationships
- **Custom Field Queries**: Efficient data fetching with field selection
## Deployment

The GitHub MCP Server supports multiple deployment options:

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/quanticsoul4772/github-mcp.git
cd github-mcp

# Set up environment
echo "GITHUB_PERSONAL_ACCESS_TOKEN=your_token_here" > .env

# Run with Docker Compose
docker-compose up -d
```

### Kubernetes Deployment

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/

# Configure secrets
kubectl create secret generic github-mcp-secrets \
  --from-literal=GITHUB_PERSONAL_ACCESS_TOKEN=your_token_here \
  -n github-mcp
```

### Available Deployment Options

- Docker: Production-ready containerized deployment
- Kubernetes: Scalable orchestrated deployment with auto-scaling
- Cloud Platforms: AWS EKS, Google GKE, Azure AKS
- CI/CD: GitHub Actions for automated deployments
- Monitoring: Prometheus metrics and health checks

For detailed deployment instructions, see [docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md).

## Installation

### Prerequisites
- Node.js 18.0.0 or later
- npm 8.0.0 or later
- GitHub Personal Access Token with appropriate scopes
- **Important**: The patched MCP SDK fork (included via local dependency)

1. Clone the repository:
```bash
git clone https://github.com/quanticsoul4772/github-mcp.git
cd github-mcp
```

2. Ensure the MCP SDK fork is available:
```bash
# The SDK fork should be at ../mcp-sdk-fork relative to this project
# If not present, it will need to be cloned from the fork repository
```

3. Install dependencies:
```bash
npm install
```

4. Build the project:
```bash
npm run build
```

4. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your GitHub Personal Access Token:
```
GITHUB_PERSONAL_ACCESS_TOKEN=your_token_here
```

## Configuration

### Claude Desktop Configuration

Add this server to your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": [
        "--max-old-space-size=4096",
        "--expose-gc",
        "--max-semi-space-size=64",
        "/Users/russellsmith/Projects/mcp-servers/github-mcp/build/index.js"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_token_here",
        "NODE_OPTIONS": "--max-old-space-size=4096 --expose-gc --max-semi-space-size=64"
      },
      "type": "stdio"
    }
  }
}
```

### Environment Variables

- `GITHUB_PERSONAL_ACCESS_TOKEN` or `GITHUB_TOKEN` - **Required**: Your GitHub PAT
- `GITHUB_HOST` or `GITHUB_API_URL` - Optional: Custom GitHub API endpoint (for GitHub Enterprise)
- `GITHUB_READ_ONLY` - Optional: Set to `1` or `true` to enable read-only mode
- `GITHUB_TOOLSETS` - Optional: Comma-separated list of toolsets to enable (default: all)
- `GITHUB_DYNAMIC_TOOLSETS` - Optional: Set to `1` or `true` for dynamic toolset discovery

### Available Toolsets

You can enable specific toolsets using the `GITHUB_TOOLSETS` environment variable:

- `context` - User context tools (get_me)
- `repos` - Repository management tools
- `issues` - Issue management tools
- `pull_requests` - Pull request tools
- `actions` - GitHub Actions tools
- `code_security` - Code scanning and security tools
- `users` - User management tools
- `orgs` - Organization tools
- `notifications` - Notification management
- `discussions` - Discussion tools (GraphQL-powered)
- `dependabot` - Dependabot alerts and settings
- `secret_protection` - Secret scanning tools
- `graphql_insights` - Advanced repository insights via GraphQL
- `project_management` - GitHub Projects V2 management via GraphQL
- `advanced_search` - Enhanced search capabilities via GraphQL

Example: `GITHUB_TOOLSETS="repos,issues,pull_requests"`

To enable all toolsets: `GITHUB_TOOLSETS="all"`

### Read-Only Mode

To run the server in read-only mode (prevents any write operations):

```bash
GITHUB_READ_ONLY=1 npm start
```

## GraphQL Tools

This server includes powerful GraphQL-based tools that provide advanced functionality beyond REST APIs:

### When to Use GraphQL vs REST

**Use GraphQL Tools For:**
- GitHub Discussions (only available via GraphQL)
- GitHub Projects V2 (GraphQL-only feature)
- Complex repository insights and analytics
- Advanced search with nested relationships
- Efficient data fetching with custom field selection

**Use REST Tools For:**
- Simple CRUD operations on issues, PRs, and files
- GitHub Actions workflow management
- Basic repository operations
- When REST endpoints provide sufficient functionality

### GraphQL Performance Benefits

- **Reduced API Calls**: Fetch related data in single requests
- **Bandwidth Efficiency**: Query only the fields you need
- **Advanced Features**: Access to GraphQL-exclusive GitHub features
- **Real-time Capabilities**: Better support for live data and subscriptions

### GraphQL-Specific Configuration

```bash
# GraphQL toolsets
GITHUB_TOOLSETS="discussions,graphql_insights,project_management,advanced_search"

# GraphQL performance settings
GITHUB_ENABLE_GRAPHQL_CACHE=true
GITHUB_GRAPHQL_TIMEOUT=30000
GITHUB_GRAPHQL_MAX_COMPLEXITY=1000
```

For detailed GraphQL tools documentation, see [docs/graphql-tools.md](docs/graphql-tools.md).

## Creating a GitHub Personal Access Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select the following scopes based on your needs:
   - `repo` - Full control of repositories
   - `workflow` - Update GitHub Action workflows
   - `write:packages` - Upload packages to GitHub Package Registry
   - `delete:packages` - Delete packages from GitHub Package Registry
   - `admin:org` - Full control of organizations
   - `admin:public_key` - Full control of public keys
   - `admin:repo_hook` - Full control of repository hooks
   - `gist` - Create gists
   - `notifications` - Access notifications
   - `user` - Update user profile
   - `write:discussion` - Write discussions
   - `project` - Full control of projects
   - `delete_repo` - Delete repositories


## Tool Reference

For detailed information about all available tools and their parameters, see:
- [Tool Reference](docs/tool-reference.md) - Complete list of tools with examples
- [Migration Guide](docs/migration-guide.md) - Upgrading from previous versions
- [User Preferences](docs/user-preferences.yaml) - Configuration for Claude Desktop

### Quick Examples

```javascript
// Get an issue
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "issue_number": 42
}

// Search repositories
{
  "q": "language:typescript mcp",
  "sort": "stars",
  "order": "desc"
}

// Create a pull request
{
  "owner": "quanticsoul4772",
  "repo": "github-mcp",
  "title": "Feature: Add new functionality",
  "head": "feature-branch",
  "base": "main",
  "body": "Description of changes"
}
```

## Usage

Once configured, the GitHub MCP server will be available in Claude Desktop. You can use natural language to interact with GitHub:

### Example Commands

- "List my recent pull requests"
- "Show me the README file from owner/repo"
- "Create an issue in my project repository"
- "Search for TypeScript files containing 'async'"
- "Get the status of my latest workflow run"
- "Show me open Dependabot alerts"
- "List discussions in the repository"

### GraphQL-Powered Examples

- "Get comprehensive repository insights and contributor statistics"
- "Search for discussions across all my repositories"
- "Show me Projects V2 boards and their items"
- "Find code with advanced search including author and file context"
- "Get detailed analytics on issue resolution patterns"

## Development

### Running in Development Mode

```bash
npm run dev
```

### Building

```bash
npm run build
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:performance # Performance tests

# Watch mode for development
npm run test:watch
```

### Code Quality

```bash
# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check

# Full quality check
npm run quality:check
```

### Security Scanning

```bash
# Security audit
npm run security:scan

# Secret detection
npm run security:secrets
```

## Documentation

### Getting Started
- [Quick Start Guide](docs/QUICK_START.md) - Get running in 5 minutes
- [Installation Guide](#installation) - Detailed setup instructions
- [Configuration Guide](docs/CONFIGURATION.md) - All configuration options

### Development
- [Testing Guide](docs/TESTING.md) - Testing strategy and instructions
- [CLAUDE.md](CLAUDE.md) - Guide for Claude Code development
- [Contributing](CONTRIBUTING.md) - How to contribute

### Reference
- [Tool Reference](docs/tool-reference.md) - Complete tool documentation
- [Migration Guide](docs/migration-guide.md) - Upgrading from previous versions
- [Performance Guide](docs/performance.md) - Performance optimization
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions

### Advanced Topics
- [GraphQL Tools](docs/graphql-tools.md) - GraphQL-specific features
- [Deployment Guide](docs/deployment/DEPLOYMENT.md) - Production deployment
- [Security Guide](docs/guides/AUTHENTICATION_SECURITY.md) - Security best practices
- [Agent System](docs/guides/AGENT_SYSTEM_GUIDE.md) - Code analysis agents

### API Documentation
- [API Reference](docs/api/API_REFERENCE.md) - Complete API documentation
- [Examples](docs/EXAMPLES.md) - Usage examples and patterns

## Resources

The server provides these MCP resources:

- `github://repositories` - Browse your GitHub repositories
- `github://user` - Get current authenticated user information

## Prompts

The server includes helpful prompts for common workflows:

- `create_issue` - Template for creating GitHub issues
- `review_pr` - Template for reviewing pull requests

## Security Considerations

- **Never commit your `.env` file** - It contains sensitive tokens
- **Use minimal required scopes** - Only grant the permissions you need
- **Rotate tokens regularly** - Update your PAT periodically
- **Use read-only mode** - When only browsing is needed
- **Store tokens securely** - Use environment variables or secure key management

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify your GitHub token is valid
   - Check token has required scopes
   - Ensure token is not expired

2. **Rate Limiting**
   - GitHub API has rate limits
   - Authenticated requests: 5,000 per hour
   - Consider caching or batching requests

3. **Parameter Passing Issues**
   - This project uses a patched MCP SDK to fix JSON Schema parameter handling
   - If you encounter `keyValidator._parse is not a function`, ensure you're using the forked SDK
   - See [docs/PARAMETER_BUG_RESOLUTION.md](docs/PARAMETER_BUG_RESOLUTION.md) for details

3. **Permission Errors**
   - Check repository permissions
   - Verify organization access
   - Some features require admin rights

4. **GraphQL Errors**
   - **Query Complexity**: Reduce query complexity or add pagination
   - **Discussions**: Repository must have discussions enabled
   - **Projects V2**: Requires `project` scope and project access
   - **Rate Limits**: GraphQL has different rate limiting (5,000 points/hour)
   - **Permissions**: Some GraphQL features need specific scopes

## What's New

See [CHANGELOG.md](CHANGELOG.md) for recent updates and version history.

## License

MIT - See [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Support

- **Issues**: [GitHub Issues](https://github.com/quanticsoul4772/github-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/quanticsoul4772/github-mcp/discussions)
- **Documentation**: [Full Documentation](docs/)
- **Quick Start**: [Get started in 5 minutes](docs/QUICK_START.md)

## Acknowledgments

- Built with [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- Powered by [Octokit](https://github.com/octokit/octokit.js)
- Testing with [Vitest](https://vitest.dev/)
- Type safety with [TypeScript](https://www.typescriptlang.org/)
