# Troubleshooting Guide

This guide helps you diagnose and fix common issues with the GitHub MCP Server.

## Table of Contents

- [Authentication Issues](#authentication-issues)
- [Permission Errors](#permission-errors)
- [Rate Limiting](#rate-limiting)
- [Configuration Problems](#configuration-problems)
- [Tool Errors](#tool-errors)
- [Performance Issues](#performance-issues)
- [Development Issues](#development-issues)
- [Getting More Help](#getting-more-help)

## Authentication Issues

### "Authentication Failed" or 401 Errors

**Problem:** The server cannot authenticate with GitHub's API.

**Solutions:**
1. **Check your GitHub token:**
   ```bash
   echo $GITHUB_PERSONAL_ACCESS_TOKEN
   ```
   - Ensure the token is set and not empty
   - Verify the token hasn't expired

2. **Test token manually:**
   ```bash
   curl -H "Authorization: token $GITHUB_PERSONAL_ACCESS_TOKEN" https://api.github.com/user
   ```

3. **Verify token scopes:**
   - Go to [GitHub Settings > Personal access tokens](https://github.com/settings/tokens)
   - Ensure your token has the required scopes:
     - `repo` - Full control of repositories
     - `workflow` - Update GitHub Action workflows
     - `user` - Update user profile
     - `notifications` - Access notifications
     - Additional scopes based on features you need

4. **Check environment variable names:**
   - Use `GITHUB_PERSONAL_ACCESS_TOKEN` or `GITHUB_TOKEN`
   - Ensure no extra spaces or quotes around the token

### Token Scope Errors

**Problem:** Operations fail with "Insufficient permissions" errors.

**Solution:**
1. Review the [GitHub token scopes documentation](https://docs.github.com/en/developers/apps/building-oauth-apps/scopes-for-oauth-apps)
2. Add missing scopes to your token:
   - `write:packages` - For package operations
   - `admin:org` - For organization management
   - `write:discussion` - For discussion operations
   - `project` - For project management

## Permission Errors

### 403 Forbidden Errors

**Problem:** You're authenticated but don't have permission for the operation.

**Common Causes & Solutions:**

1. **Repository Access:**
   - Ensure you have the required access level to the repository
   - For private repositories, you need to be a collaborator or member
   - For organization repositories, check your organization role

2. **Organization Permissions:**
   - Some operations require organization ownership or admin rights
   - Check your role in the organization settings

3. **Branch Protection Rules:**
   - Push operations may fail due to branch protection
   - Review branch protection settings in repository settings

4. **Required Status Checks:**
   - Merging PRs may fail if required checks haven't passed
   - Wait for checks to complete or adjust protection rules

### Read-Only Mode Issues

**Problem:** Write operations fail in read-only mode.

**Solution:**
```bash
# Disable read-only mode
unset GITHUB_READ_ONLY
# or
GITHUB_READ_ONLY=false npm start
```

## Rate Limiting

### "Rate limit exceeded" Errors

**Problem:** GitHub API rate limits have been exceeded.

**Rate Limits:**
- Authenticated requests: 5,000 per hour
- Search API: 30 requests per minute
- GraphQL API: 5,000 points per hour

**Solutions:**

1. **Check current rate limit status:**
   ```bash
   curl -H "Authorization: token $GITHUB_PERSONAL_ACCESS_TOKEN" https://api.github.com/rate_limit
   ```

2. **Implement request batching:**
   - Use batch operations when available
   - Reduce frequency of API calls
   - Cache results when appropriate

3. **Use conditional requests:**
   - Implement ETag caching for frequently accessed data
   - Use `If-None-Match` headers to avoid unnecessary data transfer

4. **GitHub Enterprise:**
   - Consider GitHub Enterprise for higher rate limits
   - Set `GITHUB_HOST` for enterprise instances

### Search API Rate Limiting

**Problem:** Search operations frequently hit rate limits.

**Solutions:**
1. **Reduce search frequency:**
   - Batch search queries
   - Cache search results
   - Use more specific queries

2. **Use alternative approaches:**
   - Use repository-specific searches instead of global search
   - Consider using Git operations for code searches in specific repos

## Configuration Problems

### Environment Variables Not Loading

**Problem:** Configuration settings aren't being applied.

**Solutions:**

1. **Check .env file location:**
   ```bash
   ls -la .env
   ```

2. **Verify .env format:**
   ```bash
   # Good
   GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxxxxxxxxxx
   
   # Bad (no quotes needed, no spaces)
   GITHUB_PERSONAL_ACCESS_TOKEN = "ghp_xxxxxxxxxxxx"
   ```

3. **Manual environment variable setting:**
   ```bash
   export GITHUB_PERSONAL_ACCESS_TOKEN=your_token_here
   npm start
   ```

### Toolset Configuration Issues

**Problem:** Expected tools are not available.

**Solutions:**

1. **Check GITHUB_TOOLSETS setting:**
   ```bash
   echo $GITHUB_TOOLSETS
   ```

2. **Enable specific toolsets:**
   ```bash
   GITHUB_TOOLSETS="repos,issues,pull_requests" npm start
   ```

3. **Enable all toolsets:**
   ```bash
   GITHUB_TOOLSETS="all" npm start
   ```

### Claude Desktop Integration Issues

**Problem:** Tools don't appear in Claude Desktop.

**Solutions:**

1. **Verify configuration file path:**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Check configuration syntax:**
   ```json
   {
     "mcpServers": {
       "github": {
         "command": "node",
         "args": ["/absolute/path/to/github-mcp/build/index.js"],
         "env": {
           "GITHUB_PERSONAL_ACCESS_TOKEN": "your_token_here"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop** after configuration changes

## Tool Errors

### "Tool not found" Errors

**Problem:** Specific tools are not available.

**Solutions:**

1. **Check if toolset is enabled:**
   ```bash
   # Enable the toolset containing the tool
   GITHUB_TOOLSETS="repos,issues,pull_requests,actions" npm start
   ```

2. **Verify tool name spelling** in your requests

3. **Check server logs** for registration errors

### Input Validation Errors

**Problem:** Tools reject valid-looking inputs.

**Solutions:**

1. **Check parameter format:**
   - Repository names: alphanumeric, hyphens, underscores, dots
   - Usernames: alphanumeric, hyphens
   - File paths: valid GitHub paths (no `..` or absolute paths)

2. **Review API_REFERENCE.md** for correct parameter formats

3. **Check required vs optional parameters**

## Performance Issues

### Slow Response Times

**Problem:** Tools take a long time to respond.

**Solutions:**

1. **Increase memory allocation:**
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm start
   ```

2. **Check network connectivity to GitHub:**
   ```bash
   curl -w "@curl-format.txt" -s https://api.github.com/zen
   ```

3. **Optimize queries:**
   - Use pagination for large result sets
   - Be specific in search queries
   - Limit data requested with appropriate parameters

### Memory Issues

**Problem:** Server crashes with out-of-memory errors.

**Solutions:**

1. **Increase Node.js memory limit:**
   ```bash
   NODE_OPTIONS="--max-old-space-size=8192" npm start
   ```

2. **Enable garbage collection:**
   ```bash
   NODE_OPTIONS="--expose-gc --max-semi-space-size=64" npm start
   ```

3. **Monitor memory usage:**
   ```bash
   node --inspect build/index.js
   ```

## Development Issues

### TypeScript Compilation Errors

**Problem:** Build fails with TypeScript errors.

**Solutions:**

1. **Update dependencies:**
   ```bash
   npm update
   ```

2. **Clean build directory:**
   ```bash
   npm run clean
   npm run build
   ```

3. **Check TypeScript version compatibility:**
   ```bash
   npx tsc --version
   ```

### Test Failures

**Problem:** Tests fail during development.

**Solutions:**

1. **Run tests with verbose output:**
   ```bash
   npm test -- --verbose
   ```

2. **Clear test cache:**
   ```bash
   npx vitest --run --reporter=verbose
   ```

3. **Check test environment:**
   - Ensure test API keys are valid
   - Verify mock configurations

### Import/Export Issues

**Problem:** Module import errors in development.

**Solutions:**

1. **Use .js extensions for imports:**
   ```typescript
   import { createTools } from './tools/repositories.js';
   ```

2. **Check module type in package.json:**
   ```json
   {
     "type": "module"
   }
   ```

3. **Verify TypeScript configuration:**
   ```json
   {
     "compilerOptions": {
       "module": "node16",
       "moduleResolution": "node16"
     }
   }
   ```

## Getting More Help

### Debug Information

When reporting issues, include:

1. **Environment details:**
   ```bash
   node --version
   npm --version
   echo $GITHUB_TOOLSETS
   echo ${GITHUB_PERSONAL_ACCESS_TOKEN:0:10}...
   ```

2. **Error messages and stack traces**

3. **Server logs:**
   ```bash
   DEBUG=github-mcp npm start 2>&1 | tee debug.log
   ```

### Common Commands for Debugging

```bash
# Check server health
curl -s https://api.github.com/zen

# Verify token permissions
curl -H "Authorization: token $TOKEN" https://api.github.com/user

# Test specific repository access
curl -H "Authorization: token $TOKEN" https://api.github.com/repos/owner/repo

# Check rate limit status
curl -H "Authorization: token $TOKEN" https://api.github.com/rate_limit
```

### Resources

- [GitHub API Documentation](https://docs.github.com/en/rest)
- [MCP Specification](https://modelcontextprotocol.io/docs)
- [Octokit Documentation](https://octokit.github.io/rest.js/)
- [GitHub Status Page](https://www.githubstatus.com/)

### Reporting Issues

When creating an issue:

1. **Search existing issues first**
2. **Provide a minimal reproduction case**
3. **Include error messages and logs**
4. **Specify your environment (OS, Node version, etc.)**
5. **Remove sensitive information** (tokens, private repo names)

### Community Support

- **GitHub Issues:** For bug reports and feature requests
- **GitHub Discussions:** For questions and community support
- **Stack Overflow:** Tag questions with `github-mcp` and `model-context-protocol`

---

If you're still experiencing issues after trying these solutions, please create an issue with detailed information about your problem and environment.