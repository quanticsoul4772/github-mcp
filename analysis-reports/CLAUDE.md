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

### Testing and Quality Checks
```bash
# Type checking
npm run typecheck    # Type check without emitting files (alias: npm run type-check)

# Testing
npm test            # Run all tests with Vitest
npm run test:ui     # Run tests with UI
npm run test:coverage  # Run tests with coverage report
npm run test:unit   # Run unit tests only (excludes integration tests)
npm run test:integration  # Run integration tests only
npm run test:watch  # Run tests in watch mode

# Linting and formatting
npm run lint        # Run ESLint (fails on warnings)
npm run lint:fix    # Run ESLint with auto-fix
npm run format      # Format code with Prettier
npm run format:check  # Check formatting without fixing

# Security
npm run security:scan  # Run security audit and secret scanning
```

## Architecture

### Entry Points
- **Main Server**: `src/main.ts` - Production entry point (loads .env, starts server)
- **Server Class**: `src/index.ts` - GitHubMCPServer class with MCP protocol implementation
- **Tool Registry**: `src/tool-registry.ts` - Dynamic tool registration and management

### Core Modules
- **Performance**: `src/optimized-api-client.ts` - Centralized client with caching, deduplication, and monitoring
- **Reliability**: `src/reliability.ts` - Circuit breaker pattern and exponential backoff retry
- **Health**: `src/health.ts` - System health checks and GitHub API connectivity monitoring
- **GraphQL**: `src/graphql-utils.ts` - GraphQL query builder with complexity analysis
- **Validation**: `src/validation.ts` - Input sanitization and schema validation

### Tool Organization
Tools are organized in `src/tools/` by feature area. Each module exports a `create*Tools()` function:
- `repositories.ts` - File operations, branches, commits, releases
- `issues.ts` - Issue management (uses modular architecture in `issues/` subdirectory)
- `pull-requests.ts` - PR creation, review, merge operations
- `actions.ts` - GitHub Actions workflows and runs
- `discussions.ts` - GraphQL-based discussion management
- `advanced-search.ts` - Enhanced search with GraphQL
- `project-management.ts` - GitHub Projects V2 integration
- `repository-insights.ts` - Repository analytics and statistics

### Key Architectural Patterns
1. **Tool Registration**: Each tool module exports `create*Tools()` returning `ToolConfig[]`
2. **Schema Conversion**: JSON schemas are converted to Zod schemas for runtime validation
3. **Unified Error Handling**: All tools use `formatErrorResponse()` for consistent error messages
4. **Performance by Default**: All API calls go through OptimizedAPIClient with caching/deduplication
5. **Reliability Pattern**: Circuit breaker + exponential backoff on all external calls
6. **GraphQL Integration**: Complex queries use GraphQL with automatic pagination and complexity analysis
7. **Modular Tool Architecture**: Complex tools (like issues) use separate handler files for each operation

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

## Testing Strategy

### Test Organization
Tests are located alongside source files (`*.test.ts`) and in `src/__tests__/` for integration tests:
- Unit tests: Test individual functions and classes in isolation
- Integration tests: Test API interactions with mocked Octokit
- Performance tests: Benchmark critical paths and memory usage
- Load tests: Simulate concurrent API requests

### Running Specific Tests
```bash
# Run a single test file
npm test src/tools/issues.test.ts

# Run tests matching a pattern
npm test -- --grep "should create issue"

# Debug a specific test
npm test -- --inspect-brk src/tools/issues.test.ts
```

## Agent System

The codebase includes an AI agent system (`src/agents/`) for automated analysis:
- **Code Analysis Agent**: Static analysis and code quality checks
- **Security Agent**: Security vulnerability scanning
- **Testing Agent**: Test generation and coverage analysis
- **Type Safety Agent**: TypeScript type checking and inference

Use agent commands:
```bash
npm run agents:analyze        # Run comprehensive analysis
npm run agents:security-scan  # Security-focused scan
npm run agents:generate-tests # Generate tests for a file
```

## Common Development Tasks

### Adding a New Tool
1. Create tool module in `src/tools/your-tool.ts`
2. Export `createYourTools()` function returning `ToolConfig[]`
3. Add to `TOOLSET_MAPPING` in `src/tool-registry.ts`
4. Write tests in `src/tools/your-tool.test.ts`
5. Update type definitions in `src/tool-types.ts`

### Debugging API Issues
1. Enable verbose telemetry: `GITHUB_TELEMETRY_VERBOSE=true`
2. Check rate limits: Look for `X-RateLimit-*` headers in logs
3. Use health endpoint to verify connectivity
4. Review circuit breaker status in telemetry output

### Working with GraphQL
GraphQL queries are used for complex operations (discussions, projects, insights):
1. Define query in tool implementation
2. Use `GraphQLQueryBuilder` for dynamic queries
3. Complexity is automatically calculated and validated
4. Pagination is handled by `GraphQLPaginationHandler`
