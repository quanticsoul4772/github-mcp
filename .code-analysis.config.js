/**
 * Code Analysis Configuration
 * This file configures various code analysis tools to reduce false positives
 * and focus on actual security and quality issues.
 */

module.exports = {
  security: {
    // File patterns to exclude from security scanning
    excludePatterns: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/__tests__/**',
      '**/test/**',
      '**/tests/**',
      '**/spec/**',
      '**/fixtures/**',
      '**/mocks/**',
      'src/test-constants.ts',
      '**/*.md',
      'docs/**',
      'build/**',
      'dist/**',
      'node_modules/**',
      'coverage/**'
    ],
    
    // Custom rules for reducing false positives
    customRules: {
      'no-hardcoded-secrets': {
        // Exclude patterns that are commonly used in tests
        exclude: [
          'test',
          'spec', 
          'mock',
          'fake',
          'example',
          'sample',
          'TEST_CONSTANTS',
          'generateMockToken',
          'createTestEnv'
        ],
        // Only flag secrets in production code paths
        includePaths: [
          'src/**/*.ts',
          '!src/**/*.test.ts',
          '!src/__tests__/**',
          '!src/test-constants.ts'
        ]
      },
      
      'no-eval': {
        // Allow eval in test files for testing eval scenarios
        excludePaths: [
          '**/*.test.ts',
          '**/__tests__/**'
        ]
      }
    },
    
    // Thresholds for different severity levels
    thresholds: {
      critical: 0,  // Fail on any critical security issues
      high: 5,      // Allow up to 5 high-priority issues
      medium: 20,   // Allow up to 20 medium-priority issues
      low: -1       // Unlimited low-priority issues
    },
    
    // Whitelist specific patterns that are known to be safe
    whitelist: {
      // Test token patterns (these are mock values)
      testTokens: [
        /ghp_[A]{36}/,  // Mock classic PAT
        /ghp_[T]{36}/,  // Test classic PAT
        /github_pat_[A]{71}/,  // Mock fine-grained PAT
        /ghs_[A-Z]{36}/,  // Mock server tokens
        /ghr_[A-Z]{36}/   // Mock refresh tokens
      ],
      
      // Test constants and helper functions
      testHelpers: [
        'TEST_CONSTANTS',
        'generateMockToken',
        'createTestEnv',
        'MOCK_GITHUB_PAT',
        'MOCK_CLIENT_ID',
        'mock_token',
        'test_token'
      ]
    }
  },
  
  // Quality analysis configuration
  quality: {
    // Test quality rules
    tests: {
      requireAssertions: true,
      minAssertions: 1,
      allowedEmptyTestPatterns: [
        // Patterns for tests that are allowed to be empty (e.g., setup tests)
        /setup/i,
        /teardown/i,
        /before/i,
        /after/i
      ]
    },
    
    // Code complexity thresholds
    complexity: {
      maxCyclomaticComplexity: 10,
      maxFunctionLines: 50,
      maxFileLines: 500
    },
    
    // Code coverage requirements (for CI)
    coverage: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    }
  },
  
  // Integration with different tools
  integrations: {
    trufflehog: {
      configFile: '.trufflehogignore',
      onlyVerified: true,
      excludePathsFile: '.trufflehogignore'
    },
    
    semgrep: {
      configFile: '.semgrepignore',
      rules: ['auto'],
      excludeRules: [
        // Exclude rules that commonly flag test files
        'javascript.lang.security.audit.hardcoded-secret.hardcoded-secret'
      ]
    },
    
    codeql: {
      // CodeQL configuration
      queries: ['security-and-quality'],
      excludePaths: [
        '**/*.test.ts',
        'src/test-constants.ts'
      ]
    }
  }
};