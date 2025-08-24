/**
 * Environment configuration and validation
 *
 * This module validates environment variables using Zod schemas
 * and provides type-safe access to configuration values.
 */

import { z } from 'zod';
import { logger } from './logger.js';
import {
  ValidationResult,
  ValidationErrorDetail,
  ValidationWarning,
  createSuccessResult,
  createErrorResult,
  createValidationError,
  createValidationWarning,
  withRetry,
  DEFAULT_RETRY_CONFIG
} from './validation.js';

/**
 * Validation level enum for configurable strictness
 */
export enum ValidationLevel {
  STRICT = 'strict', // Current behavior with exact format matching
  MODERATE = 'moderate', // Check prefix and length range
  LENIENT = 'lenient', // Only check if non-empty
}

/**
 * Token format configuration interface
 */
interface TokenFormat {
  prefix: string;
  minLength: number;
  maxLength: number;
  pattern?: RegExp;
  description: string;
}

/**
 * Supported GitHub token formats with flexible validation
 * This configuration can be extended as GitHub introduces new token types
 */
const TOKEN_FORMATS: TokenFormat[] = [
  {
    prefix: 'ghp_',
    minLength: 40,
    maxLength: 40,
    pattern: /^ghp_[A-Za-z0-9_]{36}$/,
    description: 'GitHub Personal Access Token (classic)',
  },
  {
    prefix: 'github_pat_',
    minLength: 82,
    maxLength: 255,
    pattern: /^github_pat_[A-Za-z0-9]{70,}$/,
    description: 'GitHub Fine-grained Personal Access Token',
  },
  {
    prefix: 'gho_',
    minLength: 40,
    maxLength: 40,
    pattern: /^gho_[A-Za-z0-9_]{36}$/,
    description: 'GitHub OAuth token',
  },
  {
    prefix: 'ghu_',
    minLength: 40,
    maxLength: 255,
    pattern: /^ghu_[A-Za-z0-9_]{36,}$/,
    description: 'GitHub user access token',
  },
  {
    prefix: 'ghs_',
    minLength: 40,
    maxLength: 255,
    pattern: /^ghs_[A-Za-z0-9_]{36,}$/,
    description: 'GitHub server-to-server token',
  },
  {
    prefix: 'ghr_',
    minLength: 40,
    maxLength: 255,
    pattern: /^ghr_[A-Za-z0-9_]{36,}$/,
    description: 'GitHub refresh token',
  },
  {
    prefix: 'ghi_',
    minLength: 40,
    maxLength: 255,
    pattern: /^ghi_[A-Za-z0-9_]{36,}$/,
    description: 'GitHub installation access token',
  },
  // Legacy format - no prefix
  {
    prefix: '',
    minLength: 40,
    maxLength: 40,
    pattern: /^[a-f0-9]{40}$/i,
    description: 'Legacy GitHub token (40-character hex)',
  },
];


/**
 * Token validation result interface
 */
interface TokenValidationResult {
  isValid: boolean;
  format?: TokenFormat | undefined;
  error?: string | undefined;
}

/**
 * Validates a GitHub token format with configurable strictness
 * @param token - The token to validate
 * @param level - Validation level (defaults to MODERATE for backward compatibility)
 * @returns Token validation result or format type string for backward compatibility
 */
export function validateGitHubTokenFormat(
  token: string,
  level: ValidationLevel = ValidationLevel.MODERATE
): TokenValidationResult {
  if (!token || typeof token !== 'string') {
    return {
      isValid: false,
      error: 'Token must be a non-empty string',
    };
  }

  // LENIENT: Only check if token is non-empty
  if (level === ValidationLevel.LENIENT) {
    const isValid = token.trim().length > 0;
    if (isValid && token.length === 40 && /^[a-f0-9]{40}$/i.test(token)) {
      const legacyFormat = TOKEN_FORMATS.find(f => f.prefix === '');
      return {
        isValid: true,
        format: TOKEN_FORMATS.find(f => f.prefix === ''),
      };
    }
    return {
      isValid,
      error: !isValid ? 'Token cannot be empty' : undefined,
    };
  }

  // Find matching token format
  const format = TOKEN_FORMATS.find(fmt => {
    if (fmt.prefix === '') {
      // Legacy format - only match if no other prefixes match AND it looks like hex
      const hasKnownPrefix = TOKEN_FORMATS.some(
        otherFmt => otherFmt.prefix !== '' && token.startsWith(otherFmt.prefix)
      );
      if (hasKnownPrefix) return false;

      // For legacy format, also check that it's the right length and looks like hex
      return token.length === 40 && /^[a-f0-9]{40}$/i.test(token);
    }
    return token.startsWith(fmt.prefix);
  });

  if (!format) {
    return {
      isValid: false,
      error: 'Unrecognized token format',
    };
  }

  // Check length constraints
  if (token.length < format.minLength || token.length > format.maxLength) {
    return {
      isValid: false,
      format,
      error: `${format.description} must be between ${format.minLength} and ${format.maxLength} characters (got ${token.length})`,
    };
  }

  // MODERATE: Only check prefix and length
  if (level === ValidationLevel.MODERATE) {
    // Return format type for backward compatibility
    if (format.prefix === 'ghp_') {
      return {
        isValid: true,
        format,
      };
    }
    if (format.prefix === 'gho_') {
      return {
        isValid: true,
        format,
      };
    }
    if (format.prefix === 'github_pat_') {
      return {
        isValid: true,
        format,
      };
    }
    if (format.prefix === 'ghi_') {
      return {
        isValid: true,
        format,
      };
    }
    if (format.prefix === '') {
      return {
        isValid: true,
        format: TOKEN_FORMATS.find(f => f.prefix === ''),
      };
    }

    return {
      isValid: true,
      format,
    };
  }

  // STRICT: Full pattern validation
  if (format.pattern && !format.pattern.test(token)) {
    return {
      isValid: false,
      format,
      error: `${format.description} has invalid character pattern`,
    };
  }

  return {
    isValid: true,
    format,
  };
}


/**
 * Environment variable schema definition
 */
const configSchema = z
  .object({
    // Node.js environment
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    SKIP_VALIDATION: z.string().optional().default('false').transform(val => val === 'true'),

    // Server configuration
    PORT: z.string().regex(/^\d+$/, 'PORT must be a valid port number').default('3000'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    // GitHub configuration (required)
    GITHUB_PERSONAL_ACCESS_TOKEN: z
      .string()
      .min(1, 'GitHub Personal Access Token is required')
      .optional(),
    GITHUB_TOKEN: z.string().min(1, 'GitHub Token is required').optional(),

    // GitHub optional configuration
    GITHUB_READ_ONLY: z
      .string()
      .optional()
      .default('false')
      .transform(val => val === '1' || val === 'true'),
    GITHUB_TOOLSETS: z.string().default('all'),
    GITHUB_HOST: z.string().url().optional(),

    // Memory and performance settings
    NODE_OPTIONS: z.string().optional(),
    // Caching
    GITHUB_ENABLE_CACHE: z.string().optional().default('true').transform(val => val === 'true'),
    GITHUB_ENABLE_GRAPHQL_CACHE: z.string().optional().default('true').transform(val => val === 'true'),
    GITHUB_ENABLE_DEDUPLICATION: z.string().optional().default('true').transform(val => val === 'true'),
    GITHUB_ENABLE_MONITORING: z.string().optional().default('true').transform(val => val === 'true'),

    // Telemetry
    GITHUB_TELEMETRY_VERBOSE: z.string().optional().default('false').transform(val => val === 'true'),
    GITHUB_TELEMETRY_DISABLE: z.string().optional().default('false').transform(val => val === 'true'),
  })
  .refine(
    data => {
      // Ensure at least one GitHub token is provided
      return data.GITHUB_PERSONAL_ACCESS_TOKEN || data.GITHUB_TOKEN;
    },
    {
      message: 'Either GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_TOKEN must be provided',
      path: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    }
  ).refine(
    data => {
        const token = data.GITHUB_PERSONAL_ACCESS_TOKEN || data.GITHUB_TOKEN;
        if (!token) return false; // Previous refine should handle this
        return validateGitHubTokenFormat(token).isValid;
    },
    {
        message: 'Invalid GitHub token format.',
        path: ['GITHUB_TOKEN'],
    }
  );

/**
 * Validated environment configuration
 *
 * This object provides type-safe access to all environment variables
 * after validation through the Zod schema.
 */
export const config = (() => {
  try {
    return configSchema.parse(process.env);
  } catch (error) {
    // Environment validation failed - log using logger instead of console.error
    const errorMessage =
      error instanceof z.ZodError
        ? `Environment validation failed: ${error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')}`
        : `Environment validation failed: ${error}`;

    logger.error(errorMessage);

    if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        process.exit(1);
    }
    throw new Error(errorMessage);
  }
})();

/**
 * Type definition for the validated environment configuration
 */
export type Config = z.infer<typeof configSchema>;

/**
 * Get the GitHub authentication token
 * Prioritizes GITHUB_PERSONAL_ACCESS_TOKEN over GITHUB_TOKEN
 */
export function getGitHubToken(): string {
  const token = config.GITHUB_PERSONAL_ACCESS_TOKEN || config.GITHUB_TOKEN;
  if (!token) {
    throw new Error('No GitHub authentication token available');
  }
  return token;
}

/**
 * Get the server port as a number
 */
export function getPort(): number {
  return parseInt(config.PORT, 10);
}

/**
 * Check if the server is running in production mode
 */
export function isProduction(): boolean {
  return config.NODE_ENV === 'production';
}

/**
 * Check if the server is running in development mode
 */
export function isDevelopment(): boolean {
  return config.NODE_ENV === 'development';
}

/**
 * Check if the server is running in test mode
 */
export function isTest(): boolean {
  return config.NODE_ENV === 'test';
}

/**
 * Get enabled toolsets as an array
 */
export function getEnabledToolsets(): string[] {
  if (config.GITHUB_TOOLSETS === 'all') {
    return [
      'context',
      'repos',
      'issues',
      'pull_requests',
      'actions',
      'code_security',
      'users',
      'orgs',
      'notifications',
      'discussions',
      'dependabot',
      'secret_protection',
      'graphql_insights',
      'advanced_search',
      'project_management',
      'batch_operations',
      'monitoring',
    ];
  }

  return config.GITHUB_TOOLSETS.split(',').map(t => t.trim());
}

/**
 * Display environment configuration summary
 */
export function displayConfig(): void {
  logger.info('Environment configuration', {
    environment: config.NODE_ENV,
    port: config.PORT,
    logLevel: config.LOG_LEVEL,
    readOnly: config.GITHUB_READ_ONLY,
    toolsets: config.GITHUB_TOOLSETS,
    githubHost: config.GITHUB_HOST,
    tokenPrefix: getGitHubToken() ? getGitHubToken().substring(0, 10) + '...' : 'Not set',
  });
}

/**
 * Development mode bypass check with environment safety
 */
export function shouldBypassValidation(): boolean {
    // Only allow bypass in development mode with explicit flag
    return config.NODE_ENV === 'development' && config.SKIP_VALIDATION;
}

/**
 * Legacy GitHub token validation function (boolean return)
 * @deprecated Use validateGitHubTokenWithResult for better error handling
 */
export function validateGitHubToken(token: string): boolean {
  if (shouldBypassValidation()) {
    return true;
  }

  if (!token || typeof token !== 'string') {
    return false;
  }

  // Check for known token formats
  const format = TOKEN_FORMATS.find(fmt => {
    if (fmt.prefix === '') {
      // Legacy format - only match if no other prefixes match AND it looks like hex
      const hasKnownPrefix = TOKEN_FORMATS.some(
        otherFmt => otherFmt.prefix !== '' && token.startsWith(otherFmt.prefix)
      );
      if (hasKnownPrefix) return false;

      // For legacy format, also check that it's the right length and looks like hex
      return token.length === 40 && /^[a-f0-9]{40}$/i.test(token);
    }
    return token.startsWith(fmt.prefix);
  });

  if (!format) {
    return false;
  }

  // Check length constraints
  if (token.length < format.minLength || token.length > format.maxLength) {
    return false;
  }

  // Check pattern if available (for strict validation)
  if (format.pattern && !format.pattern.test(token)) {
    return false;
  }

  return true;
}

/**
 * Validates a GitHub token with detailed result information
 * @param token - The token to validate
 * @param level - Validation level (defaults to MODERATE)
 * @returns Detailed validation result with errors and warnings
 */
export function validateGitHubTokenWithResult(
  token: string,
  level: ValidationLevel = ValidationLevel.MODERATE
): ValidationResult<string> {
  const errors: ValidationErrorDetail[] = [];
  const warnings: ValidationWarning[] = [];

  // Early bypass for development mode
  if (shouldBypassValidation()) {
    warnings.push(
      createValidationWarning(
        'DEV_BYPASS',
        'Validation bypassed in development mode',
        'githubToken',
        'Only use this in development environments'
      )
    );
    return createSuccessResult(token, warnings);
  }

  // Sanitize the token by removing control characters
  const sanitizedToken = token ? token.replace(/[\x00-\x1f\x7f]/g, '') : token;

  // Check for missing token
  if (!sanitizedToken || typeof sanitizedToken !== 'string') {
    errors.push(
      createValidationError(
        'MISSING_TOKEN',
        'GitHub token is required',
        'githubToken',
        'error',
        true,
        'Provide a valid GitHub Personal Access Token'
      )
    );
    return createErrorResult(errors, warnings, [
      'Create a token at https://github.com/settings/tokens',
    ]);
  }

  // Check for whitespace in sanitized token
  const hasWhitespace =
    sanitizedToken.trim() !== sanitizedToken ||
    sanitizedToken.includes(' ') ||
    sanitizedToken.includes('\n') ||
    sanitizedToken.includes('\t');
  if (hasWhitespace) {
    errors.push(
      createValidationError(
        'TOKEN_CONTAINS_WHITESPACE',
        'Token contains whitespace characters',
        'githubToken',
        'error',
        true,
        'Remove any spaces, tabs, or newlines from the token'
      )
    );
  }

  // Validate token format using sanitized token
  const formatResult = validateGitHubTokenFormat(sanitizedToken, level);
  if (typeof formatResult === 'object' && !formatResult.isValid) {
    errors.push(
      createValidationError(
        'INVALID_TOKEN_FORMAT',
        formatResult.error || 'Invalid token format',
        'githubToken',
        'error',
        true,
        "Ensure the token follows GitHub's format requirements"
      )
    );
  }

  if (errors.length > 0) {
    return createErrorResult(errors, warnings, ['Check your token format and try again']);
  }

  return createSuccessResult(sanitizedToken, warnings);
}

/**
 * Runtime API verification for GitHub tokens
 * Validates token by making a test API call
 */
export async function validateGitHubTokenWithAPI(
  token: string,
  options: {
    timeout?: number;
    retries?: number;
  } = {}
): Promise<ValidationResult<{ token: string; user: any }>> {
  // First check format using the comprehensive validation
  const formatResult = validateGitHubTokenWithResult(token);
  if (!formatResult.valid) {
    return createErrorResult<{ token: string; user: any }>(
      formatResult.errors,
      formatResult.warnings,
      formatResult.suggestions
    );
  }

  // Development mode bypass
  if (shouldBypassValidation()) {
    return createSuccessResult(
      { token, user: { login: 'dev-user' } },
      [
        createValidationWarning(
          'DEV_BYPASS',
          'API validation bypassed in development mode',
          'githubToken'
        ),
      ],
      ['Set NODE_ENV=production to enable full API validation']
    );
  }

  // Check for fetch API availability
  if (typeof fetch === 'undefined' && typeof global !== 'undefined' && !global.fetch) {
    return createErrorResult<{ token: string; user: any }>([
      createValidationError(
        'FETCH_NOT_AVAILABLE',
        'Fetch API not available in this environment',
        'githubToken',
        'error',
        true,
        'API validation requires fetch support (Node.js 18+ or modern browser)'
      ),
    ]);
  }

  // Use retry logic with circuit breaker
  return withRetry(
    async () => {
      try {
        // Simple API call to validate token
        const response = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'github-mcp-server',
          },
        });

        if (response.status === 401) {
          return createErrorResult<{ token: string; user: any }>([
            createValidationError(
              'TOKEN_UNAUTHORIZED',
              'Token is invalid or expired',
              'githubToken',
              'error',
              true, // Recoverable - user can get new token
              'Create a new token at https://github.com/settings/tokens'
            ),
          ]);
        }

        if (response.status === 403) {
          const rateLimitReset = response.headers.get('x-ratelimit-reset');
          const resetTime = rateLimitReset
            ? new Date(parseInt(rateLimitReset) * 1000).toISOString()
            : 'unknown';

          return createErrorResult<{ token: string; user: any }>([
            createValidationError(
              'RATE_LIMITED',
              'API rate limit exceeded',
              'githubToken',
              'warning',
              true,
              `Wait until ${resetTime} before trying again`
            ),
          ]);
        }

        if (!response.ok) {
          return createErrorResult<{ token: string; user: any }>([
            createValidationError(
              'API_ERROR',
              `GitHub API returned ${response.status}: ${response.statusText}`,
              'githubToken',
              'warning',
              true,
              'Check GitHub status at https://www.githubstatus.com/'
            ),
          ]);
        }

        const user = await response.json();

        return createSuccessResult({ token, user }, [], ['Token validation successful']);
      } catch (error) {
        return createErrorResult<{ token: string; user: any }>([
          createValidationError(
            'NETWORK_ERROR',
            `Network error during validation: ${error instanceof Error ? error.message : String(error)}`,
            'githubToken',
            'warning',
            true,
            'Check your internet connection and try again'
          ),
        ]);
      }
    },
    DEFAULT_RETRY_CONFIG,
    'github-api'
  );
}

/**
 * Validates and sanitizes environment variables for security
 * - Checks for common security issues
 * - Validates format and content
 * - Returns sanitized value or null if invalid
 */
export function validateEnvironmentVariable(name: string, value: string): string | null {
  if (!name || !value || typeof name !== 'string' || typeof value !== 'string') {
    return null;
  }

  // Remove any null bytes or control characters
  const sanitized = value.replace(/[\x00-\x1f\x7f]/g, '');

  // Specific validation based on environment variable name
  switch (name.toUpperCase()) {
    case 'GITHUB_PERSONAL_ACCESS_TOKEN':
    case 'GITHUB_TOKEN':
      return validateGitHubToken(sanitized) ? sanitized : null;

    case 'GITHUB_HOST':
    case 'GITHUB_API_URL':
      return validateApiUrl(sanitized) ? sanitized : null;

    case 'GITHUB_READ_ONLY':
      return ['1', 'true', 'false', '0'].includes(sanitized.toLowerCase()) ? sanitized : null;

    case 'GITHUB_TOOLSETS':
      return validateToolsets(sanitized) ? sanitized : null;

    case 'NODE_OPTIONS':
      return validateNodeOptions(sanitized) ? sanitized : null;

    default:
      // Generic validation for other environment variables
      // Prevent common injection patterns
      if (
        sanitized.includes('$(') ||
        sanitized.includes('`') ||
        sanitized.includes('&&') ||
        sanitized.includes('||')
      ) {
        return null;
      }
      return sanitized.length <= 1000 ? sanitized : null;
  }
}

/**
 * Validates GitHub API URL format
 */
function validateApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;

    const host = parsed.hostname.toLowerCase();

    // Disallow loopback and unspecified hosts
    const disallowedHosts = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
    if (disallowedHosts.has(host)) return false;

    // Disallow private and link-local IP ranges
    const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    if (isIpv4) {
      const parts = host.split('.').map(Number);
      const [a, b = 0] = parts;
      // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
      const isPrivate =
        a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 169 && b === 254);
      if (isPrivate) return false;
    }

    // For IPv6 literals, reject link-local/unique-local ranges
    if (host.includes(':')) {
      const h = host.replace(/\[/g, '').replace(/\]/g, '');
      // Block fc00::/7 (ULA) and fe80::/10 (link-local)
      if (
        h.startsWith('fc') ||
        h.startsWith('fd') ||
        h.startsWith('fe8') ||
        h.startsWith('fe9') ||
        h.startsWith('fea') ||
        h.startsWith('feb')
      ) {
        return false;
      }
    }

    // Hostname must be non-empty
    if (!host) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Validates toolsets configuration
 */
function validateToolsets(toolsets: string): boolean {
  if (toolsets === 'all') {
    return true;
  }

  const validToolsets = [
    'context',
    'repos',
    'issues',
    'pull_requests',
    'actions',
    'code_security',
    'users',
    'orgs',
    'notifications',
    'discussions',
    'dependabot',
    'secret_protection',
  ];

  const specified = toolsets.split(',').map(t => t.trim());
  return specified.every(t => validToolsets.includes(t));
}

/**
 * Validates Node.js options for security
 */
function validateNodeOptions(options: string): boolean {
  const allowedOptions = [
    '--max-old-space-size',
    '--expose-gc',
    '--max-semi-space-size',
    '--max-new-space-size',
  ];

  const parts = options.split(' ').filter(p => p.length > 0);

  for (const part of parts) {
    if (part.startsWith('--')) {
      const option = part.split('=')[0];
      if (!allowedOptions.includes(option)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Securely loads and validates environment variables (legacy version)
 * @deprecated Use validateEnvironmentConfigurationWithResult for better error handling
 */
export function validateEnvironmentConfiguration(): {
  isValid: boolean;
  errors: string[];
  sanitizedValues: Record<string, string>;
} {
  const result = validateEnvironmentConfigurationWithResult();
  return {
    isValid: result.valid,
    errors: result.errors.map(e => e.message),
    sanitizedValues: result.value || {},
  };
}

/**
 * Securely loads and validates environment variables with detailed error reporting
 * - Validates all security-relevant environment variables
 * - Returns comprehensive validation results with recovery options
 */
export function validateEnvironmentConfigurationWithResult(): ValidationResult<
  Record<string, string>
> {
  // Development mode bypass
  if (shouldBypassValidation()) {
    const mockValues = {
      GITHUB_TOKEN: 'dev-token-bypassed',
    };
    return createSuccessResult(
      mockValues,
      [
        createValidationWarning(
          'DEV_BYPASS',
          'Environment validation bypassed in development mode',
          'environment'
        ),
      ],
      ['Set NODE_ENV=production to enable full environment validation']
    );
  }

  const errors: ValidationErrorDetail[] = [];
  const warnings: ValidationWarning[] = [];
  const sanitizedValues: Record<string, string> = {};
  const suggestions: string[] = [];

  // Safe environment variable access
  const getEnvVar = (name: string): string | undefined => {
    if (typeof process === 'undefined' || !process.env) {
      return undefined;
    }
    return process.env[name];
  };

  // Required variables - GitHub token
  const token = getEnvVar('GITHUB_PERSONAL_ACCESS_TOKEN') || getEnvVar('GITHUB_TOKEN');
  if (!token) {
    errors.push(
      createValidationError(
        'MISSING_REQUIRED_TOKEN',
        'GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_TOKEN environment variable is required',
        'GITHUB_TOKEN',
        'error',
        false,
        'Set one of these environment variables with your GitHub Personal Access Token'
      )
    );
    suggestions.push('Create a token at: https://github.com/settings/tokens');
    suggestions.push('Required scopes: repo, workflow, user, notifications');
  } else {
    const tokenResult = validateGitHubTokenWithResult(token);
    if (!tokenResult.valid) {
      // Propagate token validation errors
      errors.push(...tokenResult.errors);
      warnings.push(...tokenResult.warnings);
      suggestions.push(...tokenResult.suggestions);
    } else {
      sanitizedValues.GITHUB_TOKEN = tokenResult.value!;
      warnings.push(...tokenResult.warnings);
    }
  }

  // Optional variables with detailed validation
  const optionalVars = [
    { name: 'GITHUB_HOST', validator: 'GITHUB_HOST' },
    { name: 'GITHUB_API_URL', validator: 'GITHUB_API_URL' },
    { name: 'GITHUB_READ_ONLY', validator: 'GITHUB_READ_ONLY' },
    { name: 'GITHUB_TOOLSETS', validator: 'GITHUB_TOOLSETS' },
    { name: 'NODE_OPTIONS', validator: 'NODE_OPTIONS' },
  ];

  for (const { name, validator } of optionalVars) {
    const value = getEnvVar(name);
    if (value) {
      const sanitized = validateEnvironmentVariable(validator, value);
      if (sanitized === null) {
        errors.push(
          createValidationError(
            'INVALID_ENV_VAR_FORMAT',
            `Invalid format for environment variable ${name}`,
            name,
            'error',
            false,
            `Check the format requirements for ${name}`
          )
        );
      } else {
        sanitizedValues[name] = sanitized;

        // Add specific suggestions for environment variables
        if (name === 'GITHUB_READ_ONLY' && sanitized === 'true') {
          warnings.push(
            createValidationWarning(
              'READ_ONLY_MODE',
              'Running in read-only mode - write operations will be disabled',
              name,
              'Set to false to enable write operations'
            )
          );
        }
      }
    }
  }

  // Additional environment checks
  const nodeEnv = getEnvVar('NODE_ENV');
  if (!nodeEnv) {
    warnings.push(
      createValidationWarning(
        'NODE_ENV_NOT_SET',
        'NODE_ENV environment variable is not set',
        'NODE_ENV',
        'Set NODE_ENV=production for production deployments'
      )
    );
  }

  if (nodeEnv === 'development') {
    warnings.push(
      createValidationWarning(
        'DEVELOPMENT_MODE',
        'Running in development mode',
        'NODE_ENV',
        'Use NODE_ENV=production for production deployments'
      )
    );
  }

  // Security checks
  if (getEnvVar('DEBUG') && nodeEnv === 'production') {
    warnings.push(
      createValidationWarning(
        'DEBUG_IN_PRODUCTION',
        'DEBUG environment variable is set in production mode',
        'DEBUG',
        'Remove DEBUG variable in production for security'
      )
    );
  }

  return errors.length > 0
    ? createErrorResult<Record<string, string>>(errors, warnings, suggestions)
    : createSuccessResult(sanitizedValues, warnings, suggestions);
}

/**
 * Enhanced environment configuration validation with graceful degradation
 * This version attempts to provide fallbacks and warnings instead of hard failures
 */
export function validateEnvironmentConfigurationGraceful(): ValidationResult<{
  sanitizedValues: Record<string, string>;
  degradedMode: boolean;
  missingFeatures: string[];
}> {
  const result = validateEnvironmentConfigurationWithResult();

  // If validation passed normally, return success
  if (result.valid) {
    return createSuccessResult(
      {
        sanitizedValues: result.value!,
        degradedMode: false,
        missingFeatures: [],
      },
      result.warnings,
      result.suggestions
    );
  }

  // Try graceful degradation
  const sanitizedValues: Record<string, string> = {};
  const missingFeatures: string[] = [];
  const warnings: ValidationWarning[] = [...result.warnings];
  const suggestions: string[] = [...result.suggestions];

  // Check for critical vs non-critical errors
  const criticalErrors = result.errors.filter(e => !e.recoverable);
  const recoverableErrors = result.errors.filter(e => e.recoverable);

  // If there are critical errors (like missing token), we can't proceed
  if (criticalErrors.length > 0) {
    return createErrorResult(result.errors, warnings, suggestions);
  }

  // Safe environment variable access for degraded mode
  const getEnvVar = (name: string): string | undefined => {
    if (typeof process === 'undefined' || !process.env) {
      return undefined;
    }
    return process.env[name];
  };

  // For recoverable errors, provide degraded functionality
  const token = getEnvVar('GITHUB_PERSONAL_ACCESS_TOKEN') || getEnvVar('GITHUB_TOKEN');
  if (token) {
    // Even if token validation failed, try to proceed with warnings
    sanitizedValues.GITHUB_TOKEN = token;
    missingFeatures.push('Token validation');
    warnings.push(
      createValidationWarning(
        'DEGRADED_TOKEN_VALIDATION',
        'Token format validation failed, proceeding with degraded validation',
        'GITHUB_TOKEN',
        'Fix token format issues for full functionality'
      )
    );
  }

  // Add other environment variables that might be partially valid
  const optionalVars = [
    'GITHUB_HOST',
    'GITHUB_API_URL',
    'GITHUB_READ_ONLY',
    'GITHUB_TOOLSETS',
    'NODE_OPTIONS',
  ];
  for (const varName of optionalVars) {
    const value = getEnvVar(varName);
    if (value) {
      sanitizedValues[varName] = value; // Use raw value in degraded mode
      missingFeatures.push(`${varName} validation`);
    }
  }

  return createSuccessResult(
    {
      sanitizedValues,
      degradedMode: true,
      missingFeatures,
    },
    warnings,
    [
      ...suggestions,
      'Application running in degraded mode - some features may not work correctly',
      'Fix validation errors for full functionality',
    ]
  );
}

/**
 * Validates environment variables (legacy version)
 */
export function validateEnvironment(
  env: Record<string, string>
): ValidationResult<Record<string, string>> {
  // Temporarily override process.env to validate the provided environment
  const originalEnv = process.env;
  try {
    process.env = { ...env };
    const result = validateEnvironmentConfigurationWithResult();
    return result;
  } finally {
    process.env = originalEnv;
  }
}

export function isDisallowedHost(host: string): boolean {
  const disallowedHosts = new Set([
    'localhost',
    'broadcasthost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '::',
    'ip6-localhost',
    'ip6-loopback',
  ]);
  return disallowedHosts.has(host);
}

export function isPrivateIPv4(a: number, b: number, c: number, d: number): boolean {
  // 10.0.0.0/8 - Private
  if (a === 10) return true;

  // 172.16.0.0/12 - Private
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 - Private
  if (a === 192 && b === 168) return true;

  return false;
}

export function isReservedIPv4(a: number, b: number, c: number, d: number): boolean {
  // 127.0.0.0/8 - Loopback
  if (a === 127) return true;

  // 0.0.0.0/8 - "This" Network
  if (a === 0) return true;

  // 224.0.0.0/4 - Multicast
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 - Reserved for future use
  if (a >= 240) return true;

  // 169.254.0.0/16 - Link-local
  if (a === 169 && b === 254) return true;

  // 100.64.0.0/10 - Carrier-grade NAT
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

export function isDocumentationIPv4(a: number, b: number, c: number): boolean {
  // 198.18.0.0/15 - Benchmarking
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 203.0.113.0/24 - Documentation
  if (a === 203 && b === 0 && c === 113) return true;

  // 192.0.2.0/24 - Documentation
  if (a === 192 && b === 0 && c === 2) return true;

  // 198.51.100.0/24 - Documentation
  if (a === 198 && b === 51 && c === 100) return true;

  return false;
}

export function isPrivateOrReservedIPv6(normalizedHost: string): boolean {
  // Loopback and unspecified
  if (normalizedHost === '::1' || normalizedHost === '::') return true;

  // fc00::/7 - Unique local addresses (private)
  if (normalizedHost.startsWith('fc') || normalizedHost.startsWith('fd')) return true;

  // fe80::/10 - Link-local
  if (
    normalizedHost.startsWith('fe8') ||
    normalizedHost.startsWith('fe9') ||
    normalizedHost.startsWith('fea') ||
    normalizedHost.startsWith('feb')
  )
    return true;

  // ff00::/8 - Multicast
  if (normalizedHost.startsWith('ff')) return true;

  // 2001:db8::/32 - Documentation
  if (normalizedHost.startsWith('2001:db8') || normalizedHost.startsWith('2001:0db8')) return true;

  // ::ffff:0:0/96 - IPv4-mapped IPv6 addresses
  if (normalizedHost.includes('::ffff:')) return true;

  // 2002::/16 - 6to4 (may expose internal networks)
  if (normalizedHost.startsWith('2002:')) return true;

  return false;
}

export function isPrivateOrReservedIP(host: string): boolean {
  // Check disallowed hosts first
  if (isDisallowedHost(host)) {
    return true;
  }

  // Check IPv4 addresses
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = host.match(ipv4Pattern);

  if (ipv4Match) {
    const [, a, b, c, d] = ipv4Match.map(Number);

    // Validate each octet is in range 0-255
    if (a > 255 || b > 255 || c > 255 || d > 255) {
      return true; // Invalid IPv4 format
    }

    return isPrivateIPv4(a, b, c, d) || isReservedIPv4(a, b, c, d) || isDocumentationIPv4(a, b, c);
  }

  // Check IPv6 addresses
  if (host.includes(':')) {
    const normalizedHost = host.toLowerCase();
    return isPrivateOrReservedIPv6(normalizedHost);
  }

  return false;
}
