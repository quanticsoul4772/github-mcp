# SAFE Token Examples for Testing

When writing tests that need to validate token formats, **NEVER** use real-looking tokens.

## ❌ NEVER USE (Even in Tests)
```javascript
// DANGEROUS - Looks like a real token
// Example format: ghp_ followed by 36 alphanumeric characters
// Example format: gho_ followed by 36 alphanumeric characters
// DO NOT create tokens that match real GitHub token patterns!
```

## ✅ SAFE TEST TOKENS
```javascript
// SAFE - Obviously fake patterns
const mockPAT = 'ghp_' + 'X'.repeat(36);  
const mockOAuth = 'gho_' + 'TEST'.repeat(9);  
const fakeToken = 'ghp_THIS_IS_A_FAKE_TOKEN_FOR_TESTING_ONLY';
const testToken = 'ghp_' + '0'.repeat(36);
```

## Best Practices
1. Use obvious patterns (all X's, all 0's, repeating TEST)
2. Use environment variables for real tokens
3. Mock API calls instead of using real tokens
4. Add comments clarifying tokens are fake
5. Never generate random alphanumeric strings that could look real

## Environment Variables
```javascript
// Always use environment variables for real tokens
const token = process.env.GITHUB_TOKEN;
const oauth = process.env.GITHUB_OAUTH_TOKEN;

// In tests, mock the environment
process.env.GITHUB_TOKEN = 'ghp_' + 'MOCK'.repeat(9);
```

## Pre-commit Hook Active
A pre-commit hook is now active that will prevent commits containing patterns that look like real GitHub tokens.

## Token Pattern Reference
GitHub tokens follow these patterns (DO NOT use these in code):
- Personal Access Token (classic): ghp_ prefix
- OAuth Access Token: gho_ prefix  
- User-to-server Token: ghu_ prefix
- Server-to-server Token: ghs_ prefix
- Refresh Token: ghr_ prefix

All followed by 36 characters. Never create strings matching these patterns!
