/**
 * Test constants for GitHub MCP server testing
 * 
 * This file centralizes all mock credentials and test values to avoid 
 * false positive security alerts from hardcoded secrets in test files.
 * 
 * WARNING: These are MOCK values for testing only. Never use real credentials in tests.
 */

export const TEST_CONSTANTS = {
  // Mock GitHub Personal Access Tokens (classic format)
  MOCK_GITHUB_PAT_CLASSIC: 'ghp_' + 'A'.repeat(36),
  MOCK_GITHUB_PAT_CLASSIC_ALT: 'ghp_' + 'B'.repeat(36),
  MOCK_GITHUB_PAT_TEST: 'ghp_' + 'T'.repeat(36),
  
  // Mock Fine-grained Personal Access Tokens
  MOCK_GITHUB_PAT_FINE_GRAINED: 'github_pat_' + 'A'.repeat(71),
  MOCK_GITHUB_PAT_FINE_GRAINED_ALT: 'github_pat_' + 'B'.repeat(71),
  
  // Mock Server-to-Server Tokens
  MOCK_GITHUB_SERVER_TOKEN: 'ghs_' + 'C'.repeat(36),
  MOCK_GITHUB_SERVER_TOKEN_ALT: 'ghs_' + 'D'.repeat(36),
  
  // Mock Refresh Tokens
  MOCK_GITHUB_REFRESH_TOKEN: 'ghr_' + 'R'.repeat(36),
  MOCK_GITHUB_REFRESH_TOKEN_EXPIRED: 'ghr_expired_token',
  
  // Mock Client IDs and secrets
  MOCK_CLIENT_ID: 'mock_client_id_for_testing',
  MOCK_CLIENT_SECRET: 'mock_client_secret_for_testing',
  
  // Mock API endpoints
  MOCK_API_BASE: 'https://api.github.com',
  MOCK_ENTERPRISE_API: 'https://github.enterprise.com/api/v3',
  
  // Mock repository information
  MOCK_REPO: {
    owner: 'test-owner',
    repo: 'test-repo',
    fullName: 'test-owner/test-repo',
  },
  
  // Mock user information
  MOCK_USER: {
    login: 'test-user',
    id: 123456,
    email: 'test@example.com',
  },
  
  // Mock webhook secrets
  MOCK_WEBHOOK_SECRET: 'mock_webhook_secret_for_testing',
  
  // Mock JWT tokens for GitHub Apps
  MOCK_JWT_TOKEN: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.mock.payload.signature',
  
  // Environment variable names (not values) for reference
  ENV_VARS: {
    GITHUB_TOKEN: 'GITHUB_PERSONAL_ACCESS_TOKEN',
    GITHUB_CLIENT_ID: 'GITHUB_CLIENT_ID',
    GITHUB_CLIENT_SECRET: 'GITHUB_CLIENT_SECRET',
    GITHUB_WEBHOOK_SECRET: 'GITHUB_WEBHOOK_SECRET',
  },
  
  // Test data for various scenarios
  TEST_SCENARIOS: {
    // Invalid tokens for negative testing
    INVALID_TOKENS: {
      TOO_SHORT: 'ghp_short',
      TOO_LONG: 'ghp_' + 'A'.repeat(50),
      WRONG_PREFIX: 'invalid_' + 'A'.repeat(36),
      EMPTY: '',
      NULL: null,
      UNDEFINED: undefined,
    },
    
    // Malicious input patterns for security testing
    MALICIOUS_PATTERNS: {
      XSS_ATTEMPT: '<script>alert("xss")</script>',
      SQL_INJECTION: "'; DROP TABLE users; --",
      PATH_TRAVERSAL: '../../../etc/passwd',
      COMMAND_INJECTION: '; rm -rf /',
    },
    
    // Edge cases for testing
    EDGE_CASES: {
      UNICODE_STRING: '测试字符串',
      EMOJI_STRING: '🚀🔥💯',
      VERY_LONG_STRING: 'A'.repeat(10000),
      SPECIAL_CHARS: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    },
  },
} as const;

/**
 * Helper function to generate mock tokens for specific test scenarios
 */
export const generateMockToken = (type: 'pat' | 'fine-grained' | 'server' | 'refresh', length?: number): string => {
  switch (type) {
    case 'pat':
      return 'ghp_' + 'A'.repeat(36);
    case 'fine-grained':
      return 'github_pat_' + 'A'.repeat(length || 71);
    case 'server':
      return 'ghs_' + 'A'.repeat(36);
    case 'refresh':
      return 'ghr_' + 'A'.repeat(36);
    default:
      throw new Error(`Unknown token type: ${type}`);
  }
};

/**
 * Helper function to create test environment variables
 */
export const createTestEnv = (overrides: Record<string, string> = {}) => ({
  GITHUB_PERSONAL_ACCESS_TOKEN: TEST_CONSTANTS.MOCK_GITHUB_PAT_CLASSIC,
  GITHUB_CLIENT_ID: TEST_CONSTANTS.MOCK_CLIENT_ID,
  GITHUB_CLIENT_SECRET: TEST_CONSTANTS.MOCK_CLIENT_SECRET,
  GITHUB_WEBHOOK_SECRET: TEST_CONSTANTS.MOCK_WEBHOOK_SECRET,
  ...overrides,
});

/**
 * Type definitions for better type safety in tests
 */
export type TestTokenType = 'pat' | 'fine-grained' | 'server' | 'refresh';
export type TestEnvironment = ReturnType<typeof createTestEnv>;