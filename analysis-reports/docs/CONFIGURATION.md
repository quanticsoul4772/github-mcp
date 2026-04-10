# Configuration Guide

## Overview

The GitHub MCP Server offers extensive configuration options to customize its behavior, performance, and security settings. This guide covers all configuration aspects from basic setup to advanced optimization.

## Environment Variables

### Core Configuration

#### Authentication (Required)

```bash
# GitHub Personal Access Token (Required)
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Alternative token variable (if GITHUB_PERSONAL_ACCESS_TOKEN not set)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

#### API Endpoint Configuration

```bash
# GitHub API URL (for GitHub Enterprise)
GITHUB_HOST=https://github.enterprise.com/api/v3
# or
GITHUB_API_URL=https://api.github.com

# GraphQL endpoint (automatically derived from GITHUB_HOST if not set)
GITHUB_GRAPHQL_URL=https://api.github.com/graphql
```

### Feature Toggles

#### Read-Only Mode

Prevents all write operations:

```bash
GITHUB_READ_ONLY=true  # or "1", "yes", "on"
```

When enabled, the following operations are blocked:
- Creating/updating/deleting files
- Creating/updating issues and PRs
- Triggering workflows
- Modifying repository settings

#### Toolset Selection

Control which tool modules are loaded:

```bash
# Enable specific toolsets (comma-separated)
GITHUB_TOOLSETS=repos,issues,pull_requests,actions

# Enable all toolsets (default)
GITHUB_TOOLSETS=all

# Available toolsets:
# - context          (User context tools)
# - repos           (Repository management)
# - issues          (Issue management)
# - pull_requests   (Pull request tools)
# - actions         (GitHub Actions)
# - code_security   (Code scanning)
# - secret_scanning (Secret detection)
# - dependabot      (Vulnerability alerts)
# - discussions     (GraphQL discussions)
# - notifications   (Notification management)
# - users          (User management)
# - orgs           (Organization tools)
# - search         (Search capabilities)
# - graphql_insights (Repository analytics)
# - project_management (Projects V2)
# - advanced_search (Enhanced search)
```

#### Dynamic Toolset Discovery

Enable runtime toolset discovery:

```bash
GITHUB_DYNAMIC_TOOLSETS=true
```

### Performance Configuration

#### Caching

```bash
# Enable/disable API response caching
GITHUB_ENABLE_CACHE=true  # Default: true

# Cache TTL in milliseconds
GITHUB_CACHE_TTL=300000  # Default: 5 minutes

# Maximum cache size (number of entries)
GITHUB_CACHE_MAX_SIZE=1000  # Default: 1000

# Cache statistics logging interval
GITHUB_CACHE_STATS_INTERVAL=60000  # Default: 1 minute
```

#### Request Optimization

```bash
# Enable request deduplication
GITHUB_ENABLE_DEDUPLICATION=true  # Default: true

# Deduplication window in milliseconds
GITHUB_DEDUP_WINDOW=5000  # Default: 5 seconds

# Maximum concurrent requests
GITHUB_MAX_CONCURRENT_REQUESTS=10  # Default: 10

# Request timeout in milliseconds
GITHUB_REQUEST_TIMEOUT=30000  # Default: 30 seconds
```

#### Batch Operations

```bash
# Maximum batch size for batch operations
GITHUB_BATCH_SIZE=50  # Default: 50

# Batch processing concurrency
GITHUB_BATCH_CONCURRENCY=5  # Default: 5

# Batch operation timeout
GITHUB_BATCH_TIMEOUT=120000  # Default: 2 minutes
```

### Reliability Settings

#### Circuit Breaker

```bash
# Enable circuit breaker
GITHUB_ENABLE_CIRCUIT_BREAKER=true  # Default: true

# Failure threshold before opening circuit
GITHUB_CIRCUIT_BREAKER_THRESHOLD=5  # Default: 5 failures

# Circuit breaker timeout (ms)
GITHUB_CIRCUIT_BREAKER_TIMEOUT=60000  # Default: 1 minute

# Success threshold to close circuit
GITHUB_CIRCUIT_BREAKER_SUCCESS_THRESHOLD=2  # Default: 2
```

#### Retry Configuration

```bash
# Enable automatic retries
GITHUB_ENABLE_RETRY=true  # Default: true

# Maximum retry attempts
GITHUB_MAX_RETRIES=3  # Default: 3

# Initial retry delay (ms)
GITHUB_RETRY_INITIAL_DELAY=1000  # Default: 1 second

# Maximum retry delay (ms)
GITHUB_RETRY_MAX_DELAY=30000  # Default: 30 seconds

# Retry backoff multiplier
GITHUB_RETRY_BACKOFF_MULTIPLIER=2  # Default: 2
```

### Monitoring & Telemetry

```bash
# Enable performance monitoring
GITHUB_ENABLE_MONITORING=true  # Default: true

# Enable telemetry
GITHUB_TELEMETRY_DISABLE=false  # Default: false

# Verbose telemetry logging
GITHUB_TELEMETRY_VERBOSE=true  # Default: false

# Metrics collection interval (ms)
GITHUB_METRICS_INTERVAL=10000  # Default: 10 seconds

# Performance threshold warnings (ms)
GITHUB_PERF_WARN_THRESHOLD=1000  # Default: 1 second
```

### Node.js Runtime

```bash
# Memory allocation
NODE_OPTIONS=--max-old-space-size=4096

# Garbage collection
NODE_OPTIONS=--expose-gc --max-semi-space-size=64

# Combined settings (recommended for production)
NODE_OPTIONS="--max-old-space-size=4096 --expose-gc --max-semi-space-size=64"
```

## Configuration Files

### .env File

Create a `.env` file in the project root:

```bash
# .env
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_READ_ONLY=false
GITHUB_TOOLSETS=all
GITHUB_ENABLE_CACHE=true
GITHUB_ENABLE_MONITORING=true
NODE_OPTIONS=--max-old-space-size=4096
```

### .env.example

A template file is provided:

```bash
cp .env.example .env
# Edit .env with your settings
```

## Claude Desktop Configuration

### Basic Configuration

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": [
        "/path/to/github-mcp/build/index.js"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

### Advanced Configuration

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": [
        "--max-old-space-size=4096",
        "--expose-gc",
        "/path/to/github-mcp/build/index.js"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx",
        "GITHUB_TOOLSETS": "repos,issues,pull_requests",
        "GITHUB_ENABLE_CACHE": "true",
        "GITHUB_ENABLE_MONITORING": "true",
        "GITHUB_READ_ONLY": "false",
        "NODE_OPTIONS": "--max-old-space-size=4096"
      },
      "type": "stdio"
    }
  }
}
```

### Multiple Configurations

You can run multiple instances with different configurations:

```json
{
  "mcpServers": {
    "github-readonly": {
      "command": "node",
      "args": ["/path/to/github-mcp/build/index.js"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_readonly_token",
        "GITHUB_READ_ONLY": "true",
        "GITHUB_TOOLSETS": "repos,issues,search"
      }
    },
    "github-admin": {
      "command": "node",
      "args": ["/path/to/github-mcp/build/index.js"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_admin_token",
        "GITHUB_TOOLSETS": "all"
      }
    }
  }
}
```

## GitHub Token Scopes

### Minimal Scopes (Read-Only)

For read-only operations:
- `public_repo` - Access public repositories
- `read:user` - Read user profile data
- `read:org` - Read organization data

### Standard Scopes

For typical usage:
- `repo` - Full control of private repositories
- `workflow` - Update GitHub Action workflows
- `read:packages` - Download packages
- `read:discussion` - Read discussions
- `notifications` - Access notifications

### Full Scopes

For complete functionality:
- `repo` - Full repository control
- `workflow` - Manage workflows
- `write:packages` - Upload packages
- `delete:packages` - Delete packages
- `admin:org` - Manage organizations
- `admin:public_key` - Manage keys
- `admin:repo_hook` - Manage webhooks
- `gist` - Create gists
- `notifications` - Manage notifications
- `user` - Update profile
- `write:discussion` - Write discussions
- `project` - Manage projects
- `delete_repo` - Delete repositories

## Performance Tuning

### For Large Repositories

```bash
# Increase memory allocation
NODE_OPTIONS=--max-old-space-size=8192

# Optimize batch operations
GITHUB_BATCH_SIZE=100
GITHUB_BATCH_CONCURRENCY=10

# Extend timeouts
GITHUB_REQUEST_TIMEOUT=60000
GITHUB_BATCH_TIMEOUT=300000
```

### For High-Traffic Usage

```bash
# Aggressive caching
GITHUB_ENABLE_CACHE=true
GITHUB_CACHE_TTL=600000  # 10 minutes
GITHUB_CACHE_MAX_SIZE=5000

# Request optimization
GITHUB_ENABLE_DEDUPLICATION=true
GITHUB_MAX_CONCURRENT_REQUESTS=20

# Circuit breaker tuning
GITHUB_CIRCUIT_BREAKER_THRESHOLD=10
```

### For Limited Resources

```bash
# Reduce memory usage
NODE_OPTIONS=--max-old-space-size=2048

# Limit concurrency
GITHUB_MAX_CONCURRENT_REQUESTS=5
GITHUB_BATCH_CONCURRENCY=2

# Smaller cache
GITHUB_CACHE_MAX_SIZE=500
```

## Security Configuration

### Production Settings

```bash
# Strict mode
GITHUB_READ_ONLY=true  # Start with read-only
GITHUB_TELEMETRY_VERBOSE=false  # Reduce log exposure
GITHUB_ENABLE_MONITORING=true  # Track usage

# Minimal toolsets
GITHUB_TOOLSETS=repos,issues  # Only what's needed

# Token rotation reminder
# Set up automated token rotation every 90 days
```

### Development Settings

```bash
# Debug mode
GITHUB_TELEMETRY_VERBOSE=true
GITHUB_ENABLE_MONITORING=true

# Full access for testing
GITHUB_READ_ONLY=false
GITHUB_TOOLSETS=all

# Shorter timeouts for faster feedback
GITHUB_REQUEST_TIMEOUT=10000
```

## Troubleshooting Configuration

### Debug Mode

Enable comprehensive debugging:

```bash
# Maximum verbosity
GITHUB_TELEMETRY_VERBOSE=true
GITHUB_ENABLE_MONITORING=true
DEBUG=* # Enable all debug output

# Log performance metrics
GITHUB_METRICS_INTERVAL=5000
GITHUB_PERF_WARN_THRESHOLD=500
```

### Common Issues

1. **Out of Memory Errors**
   ```bash
   NODE_OPTIONS=--max-old-space-size=8192
   ```

2. **Rate Limiting**
   ```bash
   GITHUB_ENABLE_CACHE=true
   GITHUB_CACHE_TTL=600000
   GITHUB_MAX_CONCURRENT_REQUESTS=5
   ```

3. **Timeout Errors**
   ```bash
   GITHUB_REQUEST_TIMEOUT=60000
   GITHUB_BATCH_TIMEOUT=300000
   ```

4. **Connection Issues**
   ```bash
   GITHUB_MAX_RETRIES=5
   GITHUB_RETRY_INITIAL_DELAY=2000
   ```

## Environment-Specific Configurations

### Docker

```dockerfile
ENV GITHUB_PERSONAL_ACCESS_TOKEN=${GITHUB_TOKEN}
ENV GITHUB_ENABLE_CACHE=true
ENV GITHUB_ENABLE_MONITORING=true
ENV NODE_OPTIONS="--max-old-space-size=4096"
```

### Kubernetes

```yaml
env:
  - name: GITHUB_PERSONAL_ACCESS_TOKEN
    valueFrom:
      secretKeyRef:
        name: github-secrets
        key: token
  - name: GITHUB_ENABLE_CACHE
    value: "true"
  - name: NODE_OPTIONS
    value: "--max-old-space-size=4096"
```

### CI/CD

```yaml
env:
  GITHUB_PERSONAL_ACCESS_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  GITHUB_READ_ONLY: true
  GITHUB_TOOLSETS: repos,issues
  GITHUB_ENABLE_CACHE: false  # Disable cache in CI
```

## Best Practices

1. **Start Minimal**: Begin with read-only mode and minimal toolsets
2. **Monitor Performance**: Enable monitoring to track usage patterns
3. **Use Caching**: Enable caching for better performance
4. **Set Appropriate Timeouts**: Adjust timeouts based on your network
5. **Rotate Tokens**: Regularly rotate GitHub tokens
6. **Environment Variables**: Use environment variables over hardcoded values
7. **Separate Configurations**: Use different configs for dev/staging/prod
8. **Document Changes**: Keep track of configuration changes
9. **Test Configurations**: Test new configurations in development first
10. **Monitor Logs**: Regularly review logs for errors and warnings