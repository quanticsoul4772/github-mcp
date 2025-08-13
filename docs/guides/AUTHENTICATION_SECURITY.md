# Authentication Security Documentation

This document outlines the comprehensive authentication testing and security measures implemented in the GitHub MCP Server to address the authentication testing gaps identified in issue #35.

## Overview

The GitHub MCP Server now includes extensive authentication tests that cover real token validation, security measures, and integration scenarios. This addresses the critical gap where previous tests only used mocked tokens.

## Test Coverage Implemented

### 1. Real Token Format Validation (`src/__tests__/authentication.test.ts`)

#### GitHub Token Format Support
- **Personal Access Tokens (classic)**: `ghp_` + 36 alphanumeric characters
- **OAuth Access Tokens**: `gho_` + 36 alphanumeric characters
- **User Access Tokens**: `ghu_` + 36 alphanumeric characters
- **Server-to-Server Tokens**: `ghs_` + 36 alphanumeric characters
- **Refresh Tokens**: `ghr_` + 36 alphanumeric characters
- **Legacy Format**: 40-character hexadecimal strings

#### Validation Tests
```typescript
// Example test cases
expect(validateGitHubToken('ghp_' + 'A'.repeat(36))).toBe(true);
expect(validateGitHubToken('invalid-token')).toBe(false);
```

### 2. Token Security and Masking

#### Sensitive Data Protection
- **Token Masking in Logs**: All tokens are automatically masked using regex pattern `/gh[porus]_[A-Za-z0-9]{36}/g`
- **Error Message Sanitization**: Raw tokens are never included in error messages
- **Memory Protection**: Control characters and null bytes are stripped from tokens

#### Security Implementation
```typescript
const maskSensitiveData = (data: any): any => {
  if (typeof data === 'string') {
    return data.replace(/gh[porus]_[A-Za-z0-9]{36}/g, 'gh*_****');
  }
  // ... additional masking logic
};
```

### 3. Environment Configuration Validation (`src/validation.ts`)

#### Secure Environment Loading
- **Token Priority**: `GITHUB_PERSONAL_ACCESS_TOKEN` takes precedence over `GITHUB_TOKEN`
- **Format Validation**: All tokens are validated before use
- **Injection Prevention**: Environment variables are sanitized against injection attacks
- **URL Validation**: GitHub API URLs are validated to prevent SSRF attacks

#### Validation Features
- Control character removal
- Length limitations
- Pattern matching for known attack vectors
- Secure defaults for all configuration options

### 4. Integration Test Framework (`src/__tests__/integration/authentication-integration.test.ts`)

#### Real API Testing
- **Live Authentication**: Tests actual GitHub API authentication (when `GITHUB_TEST_TOKEN` provided)
- **Permission Boundary Testing**: Verifies token scopes and permissions
- **Rate Limit Handling**: Tests rate limit detection and response
- **Error Normalization**: Ensures consistent error handling

#### Test Token Management
```typescript
// Test utilities for safe token handling
export const integrationTestUtils = {
  createTestToken: (prefix: string = 'ghp'): string => `${prefix}_${'T'.repeat(36)}`,
  shouldSkipIntegrationTests: () => !process.env.GITHUB_TEST_TOKEN,
  isTestTokenSafe: (token: string): boolean => token.includes('test'),
  maskSensitiveData: (data: any): any => /* masking implementation */
};
```

### 5. OAuth Flow Testing Infrastructure (`src/__tests__/oauth-flow.test.ts`)

#### OAuth Security Testing
- **Token Exchange Simulation**: Tests authorization code to access token flow
- **Refresh Token Handling**: Validates refresh token rotation
- **Scope Validation**: Ensures proper scope checking
- **CSRF Protection**: State parameter validation
- **Secure Redirect URIs**: HTTPS enforcement for production

#### OAuth Error Scenarios
- Invalid client credentials
- Insufficient scope errors
- Rate limiting in OAuth flow
- Token expiration handling

## Security Measures Implemented

### 1. Token Storage Security

#### Best Practices
- **No Plain Text Storage**: Tokens should never be stored in plain text
- **Memory Protection**: Tokens are cleared from memory when possible
- **Rotation Support**: System supports token rotation without downtime

#### Implementation Guidelines
```typescript
// Secure token storage pattern
const secureTokenStorage = {
  store: (key: string, token: string) => {
    // Encrypt token before storage
    return encrypt(token);
  },
  retrieve: (key: string, encryptedToken: string) => {
    // Decrypt token for use
    return decrypt(encryptedToken);
  }
};
```

### 2. Error Handling Security

#### Sensitive Information Protection
- **Token Exclusion**: Raw tokens never appear in error messages
- **Context Sanitization**: Error contexts are sanitized before logging
- **Consistent Error Responses**: All authentication errors use standardized format

#### Error Response Format
```json
{
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid token",
    "details": {
      "statusCode": 401,
      "isRetryable": false
    }
  }
}
```

### 3. Network Security

#### HTTPS Enforcement
- All API endpoints must use HTTPS
- Redirect URIs validated for security
- Private IP ranges blocked for webhooks

#### Rate Limit Protection
- Automatic rate limit detection
- Exponential backoff implementation
- Circuit breaker pattern for failed requests

## Integration with Existing Codebase

### 1. Validation Module Enhancement

Enhanced `src/validation.ts` with:
- `validateGitHubToken()` - Comprehensive token format validation
- `validateEnvironmentConfiguration()` - Secure environment loading
- Injection attack prevention
- URL security validation

### 2. Error Handling Integration

The authentication tests integrate with existing error handling in `src/errors.ts`:
- `AuthenticationError` - 401 errors
- `AuthorizationError` - 403 errors  
- `RateLimitError` - 429 errors with retry information
- Consistent error normalization

### 3. Test Infrastructure

#### New Test Files
- `src/__tests__/authentication.test.ts` - Comprehensive authentication tests
- `src/__tests__/integration/authentication-integration.test.ts` - Real API integration tests
- `src/__tests__/oauth-flow.test.ts` - OAuth flow testing infrastructure

#### Enhanced Existing Files
- `src/validation.test.ts` - Added comprehensive token validation tests

## Usage Guidelines

### For Developers

#### Running Authentication Tests
```bash
# Run all authentication tests
npm test authentication

# Run validation tests (includes token validation)
npm test validation

# Run integration tests (requires GITHUB_TEST_TOKEN)
GITHUB_TEST_TOKEN=your_test_token npm test integration
```

#### Test Token Creation
```typescript
// Create test tokens for development
const testToken = 'ghp_' + 'T'.repeat(36);  // Always use 'T' for test tokens
expect(validateGitHubToken(testToken)).toBe(true);
```

### For Production

#### Environment Configuration
```bash
# Required
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_real_token

# Optional security settings
GITHUB_READ_ONLY=true                    # Enable read-only mode
GITHUB_HOST=https://github.enterprise.com/api/v3  # Enterprise GitHub
GITHUB_TOOLSETS=repos,issues,pull_requests        # Limit available tools
```

#### Token Security Checklist
- [ ] Use appropriate token type for use case
- [ ] Configure minimum required scopes
- [ ] Enable token expiration where possible  
- [ ] Monitor token usage and rotate regularly
- [ ] Never log or expose tokens in error messages
- [ ] Use HTTPS for all API communications

## Continuous Security Monitoring

### 1. Regular Security Audits

#### Automated Checks
- Token format validation in CI/CD
- Dependency vulnerability scanning
- Secret detection in commits
- Rate limit monitoring

#### Manual Reviews
- Quarterly authentication security review
- Token rotation procedures
- Access control validation
- Error handling assessment

### 2. Security Metrics

#### Key Performance Indicators
- Authentication success rate
- Token validation errors
- Rate limit hits
- Security incident response time

### 3. Incident Response

#### Authentication Security Incidents
1. **Token Compromise**: Immediate revocation and rotation
2. **Rate Limit Exceeded**: Implement backoff and investigate cause  
3. **Authorization Failures**: Review permissions and scope requirements
4. **Security Vulnerability**: Follow responsible disclosure process

## Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Main project documentation
- [GitHub Token Documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [OAuth App Security](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps)

## Security Contact

For security issues related to authentication:
1. Review this documentation
2. Check existing tests for examples
3. File issues with security label
4. Follow responsible disclosure for vulnerabilities

---

*This documentation addresses the authentication testing gaps identified in issue #35 and provides comprehensive security guidelines for the GitHub MCP Server.*