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

### Performance Optimization Features
- **Caching**: `src/cache.ts` - API response caching with LRU eviction
- **Batch Operations**: `src/batch-operations.ts` - Efficient batch processing utilities  
- **Request Deduplication**: `src/request-deduplication.ts` - Prevents duplicate API calls
- **Performance Monitor**: `src/performance-monitor.ts` - Comprehensive metrics and monitoring
- **Pagination Handler**: `src/pagination-handler.ts` - Smart pagination with streaming support
- **Optimized API Client**: `src/optimized-api-client.ts` - Integrated performance optimizations

### Reliability & Health Features
- **Reliability**: `src/reliability.ts` - Circuit breaker, retry logic, and telemetry
- **Health Monitoring**: `src/health.ts` - Health checks and system status monitoring

### Tool Organization
The server organizes GitHub functionality into toolsets:
- `repositories.ts` - File operations, branches, commits, releases
- `optimized-repositories.ts` - Performance-optimized repository operations
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
- `health.ts` - System health monitoring and diagnostics

### Key Patterns
1. **Tool Registration**: Each tool module exports a `create*Tools()` function that returns an array of `ToolConfig` objects
2. **Schema Conversion**: The main server converts JSON schemas to Zod schemas for validation
3. **Read-Only Mode**: Tools check the `readOnly` flag to prevent write operations when enabled
4. **Error Handling**: Consistent error responses with status codes and messages
5. **Performance Optimization**: Integrated caching, deduplication, and monitoring for all API operations
6. **Reliability Features**: All API operations use circuit breakers, exponential backoff retry, and telemetry tracking
7. **Health Monitoring**: Continuous monitoring of GitHub API connectivity and rate limits

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
GITHUB_TELEMETRY_DISABLE=true        # Disable telemetry and monitoring
GITHUB_TELEMETRY_VERBOSE=true        # Enable verbose telemetry logging
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
- **Performance Monitoring**: Real-time metrics and performance tracking
- **Health Checks**: System status and GitHub API connectivity monitoring

## Key Features

### Performance Optimizations
- **Smart Caching**: LRU cache with TTL for API responses
- **Request Deduplication**: Prevents duplicate concurrent API calls
- **Batch Operations**: Efficient processing of multiple items
- **Streaming Pagination**: Memory-efficient handling of large result sets
- **Connection Pooling**: Reuses HTTP connections for better performance
- **Parallel Processing**: Concurrent execution with configurable limits

### Reliability Features
- **Circuit Breaker**: Prevents cascading failures
- **Exponential Backoff**: Smart retry logic for transient failures
- **Health Monitoring**: Continuous system health checks
- **Rate Limit Management**: Proactive rate limit tracking
- **Telemetry**: Comprehensive monitoring and logging

## Error Handling

The server implements comprehensive error handling:
- Custom error types for different failure scenarios
- Automatic retry for transient failures
- Circuit breaker to prevent system overload
- Detailed error messages with remediation hints
- Error telemetry and monitoring

## Testing

```bash
npm test                  # Run all tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:coverage     # Generate coverage report
```

## Debugging

Enable verbose logging:
```bash
GITHUB_TELEMETRY_VERBOSE=true npm run dev
```

Monitor performance metrics:
```bash
GITHUB_ENABLE_MONITORING=true npm run dev
```

## Best Practices

1. Always validate environment configuration before starting
2. Use the optimized API client for better performance
3. Enable caching for read-heavy workloads
4. Monitor health status for production deployments
5. Configure appropriate retry and circuit breaker settings
6. Use batch operations for processing multiple items
7. Enable telemetry for production monitoring
