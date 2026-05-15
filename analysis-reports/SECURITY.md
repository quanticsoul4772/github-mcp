# Security Policy

## Supported Versions

We actively support the latest major version of the GitHub MCP Server. Security updates are provided for:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of the GitHub MCP Server seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. **DO** email security reports to: [security@example.com] (replace with actual email)
3. **DO** use GitHub's private vulnerability reporting feature: [Report a vulnerability](https://github.com/quanticsoul4772/github-mcp/security/advisories/new)

### What to Include

When reporting a vulnerability, please include:

- **Description**: A clear description of the vulnerability
- **Impact**: Potential impact and attack scenarios  
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Proof of Concept**: If possible, include a minimal proof of concept
- **Environment**: Version information, operating system, Node.js version
- **Suggested Fix**: If you have ideas for fixing the issue (optional)

### Response Timeline

We aim to:

- **Acknowledge** your report within **48 hours**
- **Provide an initial assessment** within **5 business days**
- **Release a fix** for critical vulnerabilities within **30 days**
- **Release a fix** for other vulnerabilities within **90 days**

### Responsible Disclosure

We request that you:

- Give us reasonable time to investigate and fix the issue before public disclosure
- Do not access or modify data that doesn't belong to you
- Do not perform any destructive testing
- Do not use social engineering, physical attacks, or attacks against our staff
- Do not spam or DoS our systems

## Security Best Practices

### For Users

When using the GitHub MCP Server:

1. **Token Security**:
   - Use GitHub Personal Access Tokens with minimal required scopes
   - Store tokens securely using environment variables
   - Never commit tokens to version control
   - Rotate tokens regularly

2. **Environment Variables**:
   - Use `.env` files for local development (never commit them)
   - Validate environment variables before use
   - Use read-only mode (`GITHUB_READ_ONLY=true`) when possible

3. **Access Control**:
   - Apply principle of least privilege
   - Regularly review and audit access permissions
   - Monitor for unusual activity

### For Contributors

When contributing to the project:

1. **Code Security**:
   - Follow secure coding practices
   - Validate all inputs and sanitize outputs
   - Use dependency scanning tools
   - Keep dependencies up to date

2. **Pre-commit Checks**:
   - Run security linters and scanners
   - Check for hardcoded secrets
   - Validate environment variable handling

## Security Features

The GitHub MCP Server includes several built-in security features:

### Input Validation
- Repository name validation (`src/validation.ts:validateRepoName`)
- User/organization name validation (`src/validation.ts:validateOwnerName`) 
- File path sanitization (`src/validation.ts:validateFilePath`)
- Branch/ref name validation (`src/validation.ts:validateRef`)
- Commit SHA validation (`src/validation.ts:validateCommitSha`)
- Text sanitization (`src/validation.ts:sanitizeText`)

### Access Controls
- Read-only mode support
- Configurable toolset restrictions
- Token scope validation
- Rate limiting awareness

### Secure Configuration
- Environment variable-based configuration
- No hardcoded credentials
- Secure defaults
- Optional GitHub Enterprise support

## Security Monitoring

We continuously monitor for:

- Dependency vulnerabilities (Dependabot)
- Secret scanning (GitHub Advanced Security)
- Code scanning (CodeQL)
- License compliance
- Security scorecard metrics

## Known Security Considerations

### GitHub Token Scopes

The MCP server requires various GitHub token scopes depending on functionality:

- `repo`: Repository access (read/write)
- `workflow`: GitHub Actions access
- `user`: User profile access
- `notifications`: Notification management
- `read:org`: Organization data access
- `security_events`: Security alert access

**Important**: Only grant the minimum scopes required for your use case.

### Network Security

- All API calls use HTTPS
- Supports GitHub Enterprise Server with custom endpoints
- Respects GitHub API rate limits
- Uses official GitHub SDKs (Octokit)

### Data Handling

- No persistent data storage
- Minimal logging of sensitive information
- Proper error handling to prevent information leakage
- Input sanitization for all user-provided data

## Updates and Notifications

- Security updates are announced via GitHub releases
- Critical vulnerabilities are disclosed through GitHub Security Advisories
- Follow this repository to receive notifications about security updates

---

**Last Updated**: [Current Date]
**Version**: 1.0.0

For general questions about security, please open a regular GitHub issue with the `security` label.