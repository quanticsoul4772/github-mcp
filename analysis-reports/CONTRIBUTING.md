# Contributing to GitHub MCP Server

Thank you for your interest in contributing to the GitHub MCP Server! This guide will help you get started with development, testing, and submitting contributions.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Adding New Tools](#adding-new-tools)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A GitHub Personal Access Token with appropriate scopes
- TypeScript knowledge for development
- Familiarity with the MCP (Model Context Protocol) specification

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/github-mcp.git
   cd github-mcp
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env and add your GitHub token
   ```

4. **Build and Test**
   ```bash
   npm run build
   npm test
   ```

5. **Run in Development Mode**
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── index.ts              # Main server entry point
├── types.ts              # Shared TypeScript types
├── tool-types.ts         # Tool parameter and result types
├── validation.ts         # Input validation utilities
├── errors.ts             # Error handling classes
├── cache.ts              # API response caching
├── batch-operations.ts   # Batch processing utilities
├── utils.ts              # General utilities
└── tools/                # Tool implementation modules
    ├── repositories.ts   # Repository management tools
    ├── issues.ts         # Issue management tools
    ├── pull-requests.ts  # Pull request tools
    ├── actions.ts        # GitHub Actions tools
    ├── code-security.ts  # Security scanning tools
    ├── secret-scanning.ts# Secret scanning tools
    ├── dependabot.ts     # Dependabot alerts
    ├── discussions.ts    # Discussions (GraphQL)
    ├── notifications.ts  # Notification tools
    ├── users.ts          # User management tools
    ├── organizations.ts  # Organization tools
    └── search.ts         # Search tools
```

## Development Workflow

### Running the Server

**Development Mode (with hot reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm run build
npm start
```

### Type Checking

```bash
npx tsc --noEmit
```

### Testing

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Environment Variables for Development

```bash
# Required
GITHUB_PERSONAL_ACCESS_TOKEN=your_token_here

# Optional development settings
GITHUB_READ_ONLY=false
GITHUB_TOOLSETS=all
NODE_OPTIONS=--max-old-space-size=4096
```

## Testing

### Test Framework

We use Vitest for testing with the following configuration:
- Test files: `*.test.ts` or `*.spec.ts`
- Coverage provider: v8
- Environment: Node.js

### Writing Tests

1. **Create test files alongside source files**
   ```
   src/validation.ts
   src/validation.test.ts
   ```

2. **Mock Octokit responses** for unit tests
   ```typescript
   import { vi } from 'vitest';
   
   const mockOctokit = {
     issues: {
       get: vi.fn().mockResolvedValue({ data: mockIssueData })
     }
   };
   ```

3. **Test both success and error scenarios**
   ```typescript
   describe('validateRepoName', () => {
     it('should accept valid repository names', () => {
       expect(validateRepoName('my-repo')).toBe(true);
     });
     
     it('should reject invalid repository names', () => {
       expect(validateRepoName('')).toBe(false);
       expect(validateRepoName('.invalid')).toBe(false);
     });
   });
   ```

### Current Test Coverage

As noted in CLAUDE.md, there are currently limited test files. When adding tests:
- Focus on validation functions first
- Add tool handler tests with mocked Octokit
- Include error handling scenarios
- Test edge cases and boundary conditions

## Code Style

### TypeScript Guidelines

- Use strict TypeScript settings (already configured)
- Prefer interfaces over types for object shapes
- Use meaningful names for variables and functions
- Add JSDoc comments for public APIs
- Use async/await instead of Promises where possible

### Code Organization

- Keep tool modules focused on single responsibility
- Use consistent error handling patterns
- Follow the established validation pattern
- Maintain backward compatibility when possible

### Import/Export Conventions

```typescript
// Use .js extensions for imports (for ESM compatibility)
import { ToolConfig } from '../types.js';

// Named exports preferred
export function createMyTools(): ToolConfig[] { ... }
```

## Adding New Tools

### 1. Plan the Tool

Consider:
- Which toolset the new tool belongs to
- Required parameters and validation
- Expected return types
- Error scenarios
- Rate limiting implications

### 2. Define Types

Add parameter and result types in `src/tool-types.ts`:

```typescript
export interface MyToolParams {
  owner: string;
  repo: string;
  // ... other parameters
}

export interface MyToolResult {
  // ... result structure
}
```

### 3. Implement the Tool

In the appropriate tool module (e.g., `src/tools/repositories.ts`):

```typescript
tools.push({
  tool: {
    name: 'my_new_tool',
    description: 'Clear description of what the tool does',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Repository owner',
        },
        // ... other properties
      },
      required: ['owner', 'repo'],
    },
  },
  handler: async (args: MyToolParams): Promise<MyToolResult> => {
    // Validate inputs
    if (!validateOwnerName(args.owner)) {
      throw new ValidationError('owner', 'Invalid repository owner');
    }
    
    // Handle read-only mode if needed
    if (readOnly && isWriteOperation) {
      throw new Error('Operation not available in read-only mode');
    }
    
    try {
      // Make API call
      const { data } = await octokit.someApi.someMethod(args);
      
      // Transform and return result
      return {
        // ... transformed data
      };
    } catch (error) {
      // Handle and re-throw with context
      throw new GitHubMCPError(
        'Failed to perform operation',
        'OPERATION_FAILED',
        error.status,
        { operation: 'my_new_tool', ...args },
        error
      );
    }
  },
});
```

### 4. Add Validation

If new validation patterns are needed, add them to `src/validation.ts`:

```typescript
export function validateMyInput(input: string): boolean {
  // Implement validation logic
  return true; // or false
}
```

### 5. Update Documentation

- Add the tool to `API_REFERENCE.md`
- Update the README.md if needed
- Consider adding usage examples

### 6. Add Tests

Create comprehensive tests covering:
- Valid inputs and expected outputs
- Invalid inputs and error handling
- Edge cases and boundary conditions
- Read-only mode behavior (if applicable)

## Submitting Changes

### Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/my-new-tool
   ```

2. **Make your changes**
   - Implement the feature
   - Add tests
   - Update documentation
   - Ensure type checking passes

3. **Test thoroughly**
   ```bash
   npm run build
   npm test
   npx tsc --noEmit
   ```

4. **Commit with clear messages**
   ```bash
   git add .
   git commit -m "feat: add my_new_tool for repository management"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/my-new-tool
   ```

### PR Guidelines

- **Clear title and description** explaining the changes
- **Reference related issues** if applicable
- **Include test coverage** for new functionality
- **Update documentation** as needed
- **Follow semantic commit conventions**:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation changes
  - `refactor:` for code refactoring
  - `test:` for adding tests

### Code Review Process

- All PRs require review before merging
- Address feedback promptly and professionally  
- Update PR based on review comments
- Ensure CI/CD checks pass

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for backward-compatible functionality additions  
- **PATCH** version for backward-compatible bug fixes

### Release Steps

1. Update version in `package.json`
2. Update `CHANGELOG.md` with release notes
3. Create and push version tag
4. Publish release on GitHub
5. Update documentation if needed

## Getting Help

### Resources

- [MCP Specification](https://modelcontextprotocol.io/docs)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Octokit Documentation](https://octokit.github.io/rest.js/)

### Support Channels

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Code Review**: For implementation feedback

### Common Development Tasks

**Adding a new GitHub API endpoint:**
1. Check if it fits in existing toolset or needs new one
2. Define types in `tool-types.ts`
3. Implement in appropriate tool module
4. Add validation if needed
5. Write tests
6. Update API reference documentation

**Debugging tool issues:**
1. Enable debug logging: `DEBUG=github-mcp npm run dev`
2. Check authentication and permissions
3. Verify API endpoint and parameters
4. Test with minimal reproduction case

**Performance optimization:**
1. Use batch operations where possible
2. Implement caching for frequently accessed data
3. Consider pagination for large result sets
4. Monitor rate limit usage

## Code of Conduct

Please be respectful and professional in all interactions. We're building this tool together to benefit the entire community.

Thank you for contributing to the GitHub MCP Server!