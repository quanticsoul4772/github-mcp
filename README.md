# GitHub MCP Server

A comprehensive Model Context Protocol (MCP) server for GitHub integration, enabling AI assistants to interact with GitHub repositories, issues, pull requests, actions, and more.

## Features

This MCP server provides tools for:

### Repository Management
- Browse and search repositories
- Get file contents and directory listings
- Create, update, and delete files
- Manage branches and tags
- Fork repositories
- Search code across GitHub

### Issues & Pull Requests
- List, create, and update issues
- Manage issue comments and labels
- Create and review pull requests
- Merge pull requests
- Get PR diffs and files
- Search issues and PRs

### GitHub Actions
- List and trigger workflows
- Monitor workflow runs
- Get job logs
- Manage artifacts
- Cancel and rerun workflows

### Security & Dependabot
- Code scanning alerts
- Secret scanning alerts
- Dependabot vulnerability alerts
- Security advisories
- Manage security settings

### Organizations & Users
- Search users and organizations
- Manage organization members
- List user repositories
- Follow/unfollow users
- Update profiles

### Notifications & Discussions
- List and manage notifications
- Watch/unwatch repositories
- Create and participate in discussions
- Manage discussion comments

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

- **🐳 Docker**: Production-ready containerized deployment
- **☸️ Kubernetes**: Scalable orchestrated deployment with auto-scaling
- **☁️ Cloud Platforms**: AWS EKS, Google GKE, Azure AKS
- **🚀 CI/CD**: GitHub Actions for automated deployments
- **📊 Monitoring**: Prometheus metrics and health checks

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Installation

1. Clone the repository:
```bash
cd /Users/russellsmith/Projects/mcp-servers/github-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
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
- `discussions` - Discussion tools
- `dependabot` - Dependabot alerts and settings
- `secret_protection` - Secret scanning tools

Example: `GITHUB_TOOLSETS="repos,issues,pull_requests"`

To enable all toolsets: `GITHUB_TOOLSETS="all"`

### Read-Only Mode

To run the server in read-only mode (prevents any write operations):

```bash
GITHUB_READ_ONLY=1 npm start
```

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

## Development

### Running in Development Mode

```bash
npm run dev
```

### Building

```bash
npm run build
```

### Type Checking

```bash
npx tsc --noEmit
```

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

3. **Permission Errors**
   - Check repository permissions
   - Verify organization access
   - Some features require admin rights

4. **GraphQL Errors (Discussions)**
   - Discussions require repository to have discussions enabled
   - Some GraphQL features need specific permissions

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please create an issue in the GitHub repository.
