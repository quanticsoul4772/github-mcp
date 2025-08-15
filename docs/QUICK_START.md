# Quick Start Guide

Get up and running with the GitHub MCP Server in 5 minutes!

## Prerequisites

Before you begin, ensure you have:

- ✅ Node.js 18.0.0 or later installed
- ✅ npm 8.0.0 or later installed
- ✅ A GitHub account
- ✅ Claude Desktop installed (for MCP integration)

## Step 1: Get a GitHub Token

1. Go to GitHub Settings: https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Give your token a descriptive name (e.g., "GitHub MCP Server")
4. Select these essential scopes:
   - `repo` - For repository access
   - `workflow` - For GitHub Actions (optional)
   - `notifications` - For notifications (optional)
5. Click **"Generate token"**
6. **Copy the token immediately** (you won't see it again!)

## Step 2: Install the Server

```bash
# Clone the repository
git clone https://github.com/quanticsoul4772/github-mcp.git
cd github-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Step 3: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your favorite editor
nano .env  # or vim, code, etc.
```

Add your GitHub token to the `.env` file:

```env
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here
```

## Step 4: Test the Installation

```bash
# Run in development mode to test
npm run dev

# You should see output like:
# GitHub MCP Server started successfully
# Tools registered: 100+
# Ready for connections...
```

Press `Ctrl+C` to stop the test run.

## Step 5: Configure Claude Desktop

### macOS/Linux

Edit `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": [
        "/absolute/path/to/github-mcp/build/index.js"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

### Windows

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": [
        "C:\\path\\to\\github-mcp\\build\\index.js"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

## Step 6: Restart Claude Desktop

1. Quit Claude Desktop completely
2. Start Claude Desktop again
3. The GitHub MCP Server should now be available!

## Step 7: Test in Claude

Try these commands in Claude:

```
"Show me my GitHub profile"
"List my recent repositories"
"Get the README from owner/repo"
"Show my recent issues"
```

## 🎉 Success!

You're now ready to use the GitHub MCP Server with Claude!

## Common Quick Start Issues

### "Authentication failed"

**Solution**: Check your GitHub token:
- Ensure it's correctly copied (no extra spaces)
- Verify it hasn't expired
- Check it has the required scopes

### "Command not found: node"

**Solution**: Install Node.js:
```bash
# macOS with Homebrew
brew install node

# Ubuntu/Debian
sudo apt-get install nodejs npm

# Windows
# Download from https://nodejs.org/
```

### "Cannot find module"

**Solution**: Ensure you built the project:
```bash
cd github-mcp
npm install
npm run build
```

### "Server not appearing in Claude"

**Solution**: Check your config file:
1. Ensure the path to `index.js` is absolute
2. Verify the JSON syntax is correct
3. Restart Claude Desktop completely

## Next Steps

### Customize Your Setup

1. **Enable specific features only**:
   ```json
   "env": {
     "GITHUB_PERSONAL_ACCESS_TOKEN": "your_token",
     "GITHUB_TOOLSETS": "repos,issues,pull_requests"
   }
   ```

2. **Run in read-only mode** (safer for testing):
   ```json
   "env": {
     "GITHUB_PERSONAL_ACCESS_TOKEN": "your_token",
     "GITHUB_READ_ONLY": "true"
   }
   ```

3. **Improve performance** for large repositories:
   ```json
   "args": [
     "--max-old-space-size=4096",
     "/path/to/github-mcp/build/index.js"
   ]
   ```

### Learn More

- 📖 [Full Configuration Guide](CONFIGURATION.md)
- 🔧 [Tool Reference](tool-reference.md)
- 🧪 [Testing Guide](TESTING.md)
- 🚀 [Performance Tuning](performance.md)
- 🔍 [Troubleshooting](TROUBLESHOOTING.md)

## Quick Commands Reference

### In Claude, you can:

**Repository Operations**:
- "Create a new repository called my-project"
- "Get the file contents of src/index.js from owner/repo"
- "List branches in owner/repo"
- "Create a new branch called feature-x"

**Issues & PRs**:
- "Create an issue titled 'Bug: Something broken'"
- "Show open pull requests in owner/repo"
- "Merge pull request #123"
- "Comment on issue #456"

**GitHub Actions**:
- "Show recent workflow runs"
- "Trigger the CI workflow"
- "Get logs from the latest build"

**Search**:
- "Search for repositories about machine learning"
- "Find TypeScript files containing 'async'"
- "Search my issues mentioning 'bug'"

## Getting Help

- 💬 [GitHub Issues](https://github.com/quanticsoul4772/github-mcp/issues)
- 📚 [Documentation](https://github.com/quanticsoul4772/github-mcp/docs)
- 🤝 [Contributing Guide](../CONTRIBUTING.md)

## Safety Tips

1. **Never share your GitHub token**
2. **Use minimal required scopes**
3. **Start with read-only mode** when testing
4. **Rotate tokens regularly** (every 90 days)
5. **Monitor your GitHub API usage** to avoid rate limits

---

**Ready to explore more?** Check out our [examples](EXAMPLES.md) for advanced use cases!