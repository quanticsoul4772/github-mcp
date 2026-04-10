# GitHub MCP Server - Migration Guide

## Version 2.0 Changes

### Breaking Changes
None - all existing parameter formats continue to work.

### New Features

1. **Clear Error Messages**
   - No more `[object Object]` errors
   - Detailed parameter validation messages

2. **Parameter Flexibility**
   - Multiple parameter formats accepted
   - Smart parameter normalization

3. **Tool Discovery**
   - Query tool schemas at runtime
   - Built-in documentation

### Parameter Format Examples

The following formats are now all accepted:

**Old format (still works):**
```json
{
  "issueNumber": 42,
  "repository": "owner/repo"
}
```

**New format (also works):**
```json
{
  "owner": "owner",
  "repo": "repo",
  "issue_number": 42
}
```

### Upgrade Steps

1. Update the GitHub MCP server:
   ```bash
   cd /Users/russellsmith/Projects/mcp-servers/github-mcp
   git pull
   npm install
   npm run build
   ```

2. Restart Claude Desktop app

3. Test with the new error messages:
   - Try calling a tool with wrong parameters
   - You should see helpful error messages

### Troubleshooting

If you encounter issues:

1. Check the logs:
   ```bash
   tail -f ~/Library/Logs/Claude/mcp.log
   ```

2. Enable debug mode:
   ```bash
   export GITHUB_MCP_DEBUG=true
   ```

3. Verify the server is running:
   ```bash
   ps aux | grep github-mcp
   ```