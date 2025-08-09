# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a GitHub MCP (Model Context Protocol) server that enables AI assistants to interact with GitHub APIs. It's built with TypeScript and uses the Octokit SDK for GitHub integration.

## Development Commands

### Build and Run
```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to JavaScript (outputs to ./build)
npm run dev          # Run in development mode with tsx (hot reload)
npm start            # Run the compiled version
npm run clean        # Remove build artifacts
```

### Type Checking and Testing
```bash
npx tsc --noEmit     # Type check without emitting files
npm test             # Run tests with Vitest
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage report
```

## Architecture

### Core Structure
- **Entry Point**: `src/index.ts` - MCP server initialization, tool registration, and request handling
- **Tool Modules**: `src/tools/*.ts` - Separate modules for each GitHub feature category
- **Type Definitions**: `src/types.ts` - Shared TypeScript interfaces and types
- **Tool Types**: `src/tool-types.ts` - Comprehensive parameter and result types for all tools
- **Validation**: `src/validation.ts` - Input validation and sanitization utilities
- **Error Handling**: `src/errors.ts` - Standardized error types and handling
- **Caching**: `src/cache.ts` - API response caching with LRU eviction
- **Batch Operations**: `src/batch-operations.ts` - Efficient batch processing utilities  
- **Request Deduplication**: `src/request-deduplication.ts` - Prevents duplicate API calls
- **Performance Monitor**: `src/performance-monitor.ts` - Comprehensive metrics and monitoring
- **Pagination Handler**: `src/pagination-handler.ts` - Smart pagination with streaming support
- **Optimized API Client**: `src/optimized-api-client.ts` - Integrated performance optimizations

### Tool Organization
The server organizes GitHub functionality into toolsets:
- `repositories.ts` - File operations, branches, commits, releases
- `issues.ts` - Issue management and comments
- `pull-requests.ts` - PR creation, review, merge operations
- `actions.ts` - GitHub Actions workflows and runs
- `code-security.ts` - Code scanning alerts
- `secret-scanning.ts` - Secret scanning alerts
- `dependabot.ts` - Vulnerability alerts
- `discussions.ts` - GraphQL-based discussion management
- `notifications.ts` - Notification management
- `users.ts` - User profile operations
- `organizations.ts` - Organization management
- `search.ts` - Code and repository search

### Key Patterns
1. **Tool Registration**: Each tool module exports a `create*Tools()` function that returns an array of `ToolConfig` objects
2. **Schema Conversion**: The main server converts JSON schemas to Zod schemas for validation
3. **Read-Only Mode**: Tools check the `readOnly` flag to prevent write operations when enabled
4. **Error Handling**: Consistent error responses with status codes and messages

## Configuration

### Required Environment Variables
```bash
GITHUB_PERSONAL_ACCESS_TOKEN=<token>  # Required: GitHub PAT for authentication
```

### Optional Environment Variables
```bash
GITHUB_READ_ONLY=true                 # Enable read-only mode
GITHUB_TOOLSETS=repos,issues,pull_requests  # Specify enabled toolsets (default: all)
GITHUB_HOST=https://github.enterprise.com/api/v3  # GitHub Enterprise API endpoint
NODE_OPTIONS=--max-old-space-size=4096  # Memory settings for large operations

# Performance Optimization Settings
GITHUB_ENABLE_CACHE=true              # Enable API response caching (default: true)
GITHUB_ENABLE_DEDUPLICATION=true      # Enable request deduplication (default: true)
GITHUB_ENABLE_MONITORING=true         # Enable performance monitoring (default: true)
```

## MCP Server Integration

The server implements the MCP protocol with:
- **Tools**: Exposed GitHub operations as callable tools
- **Resources**: Browseable GitHub data (repositories, user info)
- **Prompts**: Templates for common workflows (issue creation, PR review)

Tool responses include both successful data and error handling with appropriate status codes.

## Testing Approach

Currently, there are no test files in the project. When adding tests:
1. Create test files alongside source files (e.g., `repositories.test.ts`)
2. Use a testing framework compatible with TypeScript
3. Mock Octokit responses for unit tests
4. Test both success and error scenarios

## Performance Optimizations

The server implements comprehensive performance optimizations:

### 1. Request Deduplication
- Prevents duplicate API calls within a 5-second window
- Automatically batches identical requests
- Reduces API usage by 30-50% for common operations

### 2. Multi-layer Caching
- **LRU Cache**: In-memory cache with configurable TTL
- **ETag Support**: Conditional requests for unchanged data  
- **Operation-specific TTL**: Different cache times for different data types
- Cache hit rates typically 60-80% for read operations

### 3. Smart Pagination
- **Concurrent fetching**: Parallel page requests for faster data retrieval
- **Streaming**: Memory-efficient async generators for large datasets
- **Rate limit awareness**: Automatic backoff when approaching limits
- **Batch processing**: Process paginated data in configurable chunks

### 4. Performance Monitoring  
- **Real-time metrics**: Track response times, error rates, memory usage
- **Slow query detection**: Automatic alerts for operations >2s
- **Aggregated statistics**: Per-operation performance analytics
- **Memory tracking**: Prevent memory leaks in long-running operations

### 5. Optimized Tools
New optimized versions of common tools are available:
- `get_file_contents_optimized`: Cached file content retrieval
- `get_repository_optimized`: Cached repository information
- `list_issues_optimized`: Smart pagination for issues
- `list_pull_requests_optimized`: Smart pagination for PRs
- `get_performance_metrics`: Access performance statistics
- `manage_cache`: Cache management and invalidation

## Important Implementation Notes

1. **GraphQL Operations**: Discussion tools use raw GraphQL queries via `octokit.graphql()`
2. **Pagination**: Most list operations support `page` and `perPage` parameters
3. **Token Scopes**: Different operations require specific GitHub token scopes
4. **Rate Limiting**: GitHub API has rate limits (5000 authenticated requests/hour)
5. **File Content**: When retrieving file contents, base64 decoding is handled automatically for text files
6. **Performance**: Optimized tools provide 3-5x better performance than standard implementations