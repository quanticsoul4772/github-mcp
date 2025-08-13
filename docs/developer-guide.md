# Developer Guide

## Prerequisites

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- Git
- GitHub Personal Access Token
- TypeScript knowledge (recommended)

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/quanticsoul4772/github-mcp.git
cd github-mcp
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Required
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here

# Optional
GITHUB_HOST=https://api.github.com
GITHUB_READ_ONLY=false
GITHUB_TOOLSETS=all
GITHUB_ENABLE_CACHE=true
GITHUB_ENABLE_DEDUPLICATION=true
GITHUB_ENABLE_MONITORING=true
GITHUB_TELEMETRY_VERBOSE=false
```

### 4. Build the Project

```bash
npm run build
```

## Development Workflow

### Running in Development Mode

Use TypeScript execution for hot reloading:

```bash
npm run dev
```

### Type Checking

Verify TypeScript types without building:

```bash
npm run typecheck
```

### Linting

Check code style and potential issues:

```bash
npm run lint
```

Fix auto-fixable issues:

```bash
npm run lint:fix
```

### Formatting

Format code with Prettier:

```bash
npm run format
```

Check formatting without changes:

```bash
npm run format:check
```

## Testing

### Run All Tests

```bash
npm test
```

### Test Coverage

Generate coverage report:

```bash
npm run test:coverage
```

### Watch Mode

Run tests in watch mode during development:

```bash
npm run test:watch
```

### Test Categories

Run specific test suites:

```bash
# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Performance tests
npm run test:performance

# Rate limiting tests
npm run test:rate-limiting
```

### Interactive Test UI

```bash
npm run test:ui
```

## Project Structure

```
github-mcp/
├── src/
│   ├── index.ts                 # Main server entry point
│   ├── types.ts                 # Core type definitions
│   ├── tool-types.ts            # Tool parameter/response types
│   ├── validation.ts            # Input validation utilities
│   ├── errors.ts                # Error handling
│   ├── env.ts                   # Environment configuration
│   ├── tools/                   # Tool implementations
│   │   ├── repositories.ts      # Repository operations
│   │   ├── issues.ts            # Issue management
│   │   ├── pull-requests.ts     # PR operations
│   │   ├── actions.ts           # GitHub Actions
│   │   └── ...                  # Other tool modules
│   ├── foundation/              # Core abstractions
│   │   ├── base-tool-handler.ts # Base tool handler class
│   │   ├── container.ts         # Dependency injection
│   │   └── interfaces.ts        # Core interfaces
│   ├── agents/                  # Agent system (experimental)
│   │   ├── base/               # Base agent classes
│   │   ├── analysis/           # Analysis agents
│   │   └── reporting/          # Reporting agents
│   └── __tests__/              # Test files
│       ├── unit/               # Unit tests
│       ├── integration/        # Integration tests
│       └── fixtures/           # Test data
├── docs/                       # Documentation
├── examples/                   # Usage examples
├── scripts/                    # Build and utility scripts
└── build/                      # Compiled JavaScript (generated)
```

## Adding New Features

### Creating a New Tool

1. Create a new file in `src/tools/`:

```typescript
// src/tools/my-feature.ts
import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';

export function createMyFeatureTools(
  octokit: Octokit,
  readOnly: boolean
): ToolConfig[] {
  return [
    {
      name: 'my_tool',
      description: 'Description of what the tool does',
      schema: {
        type: 'object',
        properties: {
          param1: {
            type: 'string',
            description: 'Parameter description'
          }
        },
        required: ['param1']
      },
      handler: async (params: any) => {
        // Validate parameters
        // Implement tool logic
        // Return results
      }
    }
  ];
}
```

2. Add types to `src/tool-types.ts`:

```typescript
export interface MyToolParams {
  param1: string;
  param2?: number;
}

export interface MyToolResult {
  success: boolean;
  data: any;
}
```

3. Register the tool in `src/index.ts`:

```typescript
import { createMyFeatureTools } from './tools/my-feature.js';

// In the tool registration section
if (this.enabledToolsets.has('my_feature')) {
  const myTools = createMyFeatureTools(this.octokit, this.readOnly);
  this.registerTools(myTools);
}
```

### Adding Performance Optimizations

1. Implement caching for your tool:

```typescript
import { cache } from '../cache.js';

const cacheKey = `my_tool:${JSON.stringify(params)}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;

const result = await performOperation();
await cache.set(cacheKey, result, 300); // 5 minutes TTL
return result;
```

2. Add request deduplication:

```typescript
import { deduplicator } from '../request-deduplication.js';

return deduplicator.deduplicate(
  requestKey,
  async () => performOperation()
);
```

3. Implement batch operations:

```typescript
import { BatchProcessor } from '../batch-operations.js';

const processor = new BatchProcessor({
  batchSize: 10,
  concurrency: 3
});

return processor.process(items, async (item) => {
  // Process individual item
});
```

## Debugging

### Enable Verbose Logging

```bash
GITHUB_TELEMETRY_VERBOSE=true npm run dev
```

### Debug with VS Code

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug MCP Server",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/src/index.ts",
      "preLaunchTask": "tsc: build",
      "outFiles": ["${workspaceFolder}/build/**/*.js"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_token",
        "GITHUB_TELEMETRY_VERBOSE": "true"
      }
    }
  ]
}
```

### Memory Profiling

```bash
node --inspect build/index.js
```

Then open Chrome DevTools at `chrome://inspect`.

## Best Practices

### TypeScript Guidelines

1. **Use strict types**: Avoid `any` when possible
2. **Define interfaces**: Create clear interfaces for parameters and returns
3. **Validate inputs**: Use validation utilities for user inputs
4. **Handle errors**: Use proper error types and messages

### Performance Guidelines

1. **Cache appropriately**: Cache read operations, not writes
2. **Batch when possible**: Group similar operations
3. **Stream large data**: Use pagination for large result sets
4. **Monitor metrics**: Track performance and errors

### Security Guidelines

1. **Validate all inputs**: Sanitize user-provided data
2. **Use environment variables**: Never hardcode secrets
3. **Implement rate limiting**: Respect GitHub's API limits
4. **Follow least privilege**: Request minimal permissions

### Testing Guidelines

1. **Write unit tests**: Test individual functions
2. **Add integration tests**: Test tool interactions
3. **Mock external calls**: Use MSW for API mocking
4. **Test error cases**: Verify error handling

## Common Issues

### Build Errors

If TypeScript compilation fails:

```bash
# Clean build artifacts
npm run clean

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

### Type Errors

Update TypeScript and type definitions:

```bash
npm update typescript @types/node
```

### Test Failures

Clear test cache:

```bash
npx vitest --clearCache
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run tests and linting
6. Submit a pull request

See [CONTRIBUTING.md](./contributing.md) for detailed guidelines.

## Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Octokit Documentation](https://octokit.github.io/rest.js/)
- [MCP SDK Documentation](https://modelcontextprotocol.io/docs)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Vitest Documentation](https://vitest.dev/)

## Support

- **Issues**: [GitHub Issues](https://github.com/quanticsoul4772/github-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/quanticsoul4772/github-mcp/discussions)
- **Documentation**: [Project Docs](./README.md)