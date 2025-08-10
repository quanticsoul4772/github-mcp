/**
 * Input validation utilities for GitHub MCP Server
 * Provides security-focused validation for user inputs with error recovery and graceful degradation
 */

/**
 * Validation error detail with context information
 */
export interface ValidationErrorDetail {
  code: string;
  message: string;
  field: string;
  severity: 'error' | 'warning' | 'info';
  recoverable: boolean;
  suggestion?: string | undefined;
}

/**
 * Validation warning with helpful context
 */
export interface ValidationWarning {
  code: string;
  message: string;
  field: string;
  suggestion?: string | undefined;
}

/**
 * Comprehensive validation result
 */
export interface ValidationResult<T = any> {
  valid: boolean;
  value?: T;
  errors: ValidationErrorDetail[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

/**
 * Circuit breaker state for validation operations
 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2
};

/**
 * Circuit breaker registry for different validation types
 */
const circuitBreakers = new Map<string, CircuitBreakerState>();

/**
 * Validation result cache with TTL
 */
const validationCache = new Map<string, { result: ValidationResult; timestamp: number; ttl: number }>();

/**
 * Cache cleanup interval (5 minutes)
 */
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000;

// Setup cache cleanup with environment safety
let cacheCleanupTimer: NodeJS.Timeout | null = null;

/**
 * Cleanup function to clear timer and cache
 */
export function cleanupValidation(): void {
  if (cacheCleanupTimer) {
    clearInterval(cacheCleanupTimer);
    cacheCleanupTimer = null;
  }
  validationCache.clear();
  circuitBreakers.clear();
}

// Start cache cleanup timer
if (typeof process !== 'undefined' && typeof setInterval !== 'undefined') {
  cacheCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of validationCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        validationCache.delete(key);
      }
    }
  }, CACHE_CLEANUP_INTERVAL);

  // Register cleanup handlers for process exit
  if (process.on) {
    process.on('exit', cleanupValidation);
    process.on('SIGINT', () => {
      cleanupValidation();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      cleanupValidation();
      process.exit(0);
    });
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      cleanupValidation();
      process.exit(1);
    });
  }
}

/**
 * Development mode bypass check with environment safety
 */
function shouldBypassValidation(): boolean {
  // Safe environment check for universal compatibility
  if (typeof process === 'undefined' || !process.env) {
    return false;
  }
  // Allow bypass in development mode OR when explicitly set
  return (process.env.NODE_ENV === 'development' && process.env.SKIP_VALIDATION === 'true') ||
         process.env.BYPASS_VALIDATION === 'true';
}

/**
 * Creates a validation result with success
 */
function createSuccessResult<T>(value: T, warnings: ValidationWarning[] = [], suggestions: string[] = []): ValidationResult<T> {
  return {
    valid: true,
    value,
    errors: [],
    warnings,
    suggestions
  };
}

/**
 * Creates a validation result with errors
 */
function createErrorResult<T>(errors: ValidationErrorDetail[], warnings: ValidationWarning[] = [], suggestions: string[] = []): ValidationResult<T> {
  return {
    valid: false,
    errors,
    warnings,
    suggestions
  };
}

/**
 * Creates a validation error
 */
function createValidationError(code: string, message: string, field: string, severity: 'error' | 'warning' | 'info' = 'error', recoverable = false, suggestion?: string): ValidationErrorDetail {
  return { code, message, field, severity, recoverable, suggestion };
}

/**
 * Creates a validation warning
 */
function createValidationWarning(code: string, message: string, field: string, suggestion?: string): ValidationWarning {
  return { code, message, field, suggestion };
}

/**
 * Gets or creates a circuit breaker for a validation type
 */
function getCircuitBreaker(type: string): CircuitBreakerState {
  if (!circuitBreakers.has(type)) {
    circuitBreakers.set(type, {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed'
    });
  }
  return circuitBreakers.get(type)!;
}

/**
 * Updates circuit breaker state based on validation result
 */
function updateCircuitBreaker(type: string, success: boolean): void {
  const breaker = getCircuitBreaker(type);
  const now = Date.now();

  if (success) {
    breaker.failures = 0;
    breaker.state = 'closed';
  } else {
    breaker.failures++;
    breaker.lastFailureTime = now;

    // Open circuit after 5 failures
    if (breaker.failures >= 5) {
      breaker.state = 'open';
    }
  }

  // Auto-recovery after 5 minutes
  if (breaker.state === 'open' && now - breaker.lastFailureTime > 5 * 60 * 1000) {
    breaker.state = 'half-open';
    breaker.failures = 0;
  }
}

/**
 * Checks if circuit breaker allows validation
 */
function isCircuitBreakerOpen(type: string): boolean {
  const breaker = getCircuitBreaker(type);
  return breaker.state === 'open';
}

/**
 * Sleeps for specified milliseconds
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes a validation function with retry logic and exponential backoff
 */
async function withRetry<T>(
  validationFn: () => Promise<ValidationResult<T>> | ValidationResult<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  circuitBreakerType?: string
): Promise<ValidationResult<T>> {
  let lastResult: ValidationResult<T> | null = null;
  let delay = config.baseDelayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      // Check circuit breaker if specified
      if (circuitBreakerType && isCircuitBreakerOpen(circuitBreakerType)) {
        return createErrorResult([createValidationError(
          'CIRCUIT_BREAKER_OPEN',
          `Validation circuit breaker is open for ${circuitBreakerType}. Service may be experiencing issues.`,
          circuitBreakerType,
          'warning',
          true,
          'Wait a few minutes and try again, or check service status'
        )]);
      }

      const result = await validationFn();
      
      // Update circuit breaker on success
      if (circuitBreakerType) {
        updateCircuitBreaker(circuitBreakerType, result.valid);
      }

      // Return immediately if validation succeeded
      if (result.valid) {
        return result;
      }

      lastResult = result;

      // Check if any errors are non-recoverable
      const hasNonRecoverableError = result.errors.some(error => !error.recoverable);
      if (hasNonRecoverableError) {
        break;
      }

      // Wait before retry (except on last attempt)
      if (attempt < config.maxAttempts) {
        await sleep(Math.min(delay, config.maxDelayMs));
        delay *= config.backoffMultiplier;
      }

    } catch (error) {
      // Update circuit breaker on exception
      if (circuitBreakerType) {
        updateCircuitBreaker(circuitBreakerType, false);
      }

      // On last attempt, return the error
      if (attempt === config.maxAttempts) {
        return createErrorResult([createValidationError(
          'VALIDATION_EXCEPTION',
          `Validation failed with exception: ${error instanceof Error ? error.message : String(error)}`,
          'unknown',
          'error',
          true,
          'Check input format and try again'
        )]);
      }

      // Wait before retry
      await sleep(Math.min(delay, config.maxDelayMs));
      delay *= config.backoffMultiplier;
    }
  }

  return lastResult || createErrorResult([createValidationError(
    'VALIDATION_FAILED',
    'Validation failed after all retry attempts',
    'unknown',
    'error',
    true
  )]);
}

/**
 * Gets cached validation result if available and not expired
 */
function getCachedValidationResult<T>(cacheKey: string): ValidationResult<T> | null {
  const cached = validationCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  const now = Date.now();
  if (now - cached.timestamp > cached.ttl) {
    validationCache.delete(cacheKey);
    return null;
  }

  return cached.result as ValidationResult<T>;
}

/**
 * Caches validation result with TTL
 */
function setCachedValidationResult<T>(cacheKey: string, result: ValidationResult<T>, ttlMs = 60000): void {
  validationCache.set(cacheKey, {
    result,
    timestamp: Date.now(),
    ttl: ttlMs
  });
}

/**
 * Validates a repository name according to GitHub's rules (legacy boolean version)
 * @deprecated Use validateRepoNameWithResult for better error handling
 */
export function validateRepoName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }
  
  // Check length - minimum 2 characters
  if (name.length < 2 || name.length > 100) {
    return false;
  }
  
  // Cannot start or end with a dot
  if (name.startsWith('.') || name.endsWith('.')) {
    return false;
  }
  
  // Cannot contain consecutive dots
  if (name.includes('..')) {
    return false;
  }
  
  // Only allow alphanumeric, hyphen, underscore, and dot
  const validPattern = /^[a-zA-Z0-9._-]+$/;
  return validPattern.test(name);
}

/**
 * Validates a repository name according to GitHub's rules
 * - Can only contain alphanumeric characters, hyphens, underscores, and dots
 * - Cannot start or end with a dot
 * - Cannot contain consecutive dots
 * - Maximum 100 characters
 */
export function validateRepoNameWithResult(name: string): ValidationResult<string> {
  // Development mode bypass with safe check
  if (shouldBypassValidation()) {
    return createSuccessResult(name, [
      createValidationWarning('DEV_BYPASS', 'Validation bypassed in development mode', 'repoName')
    ], ['Set NODE_ENV=production to enable full validation']);
  }

  // Check cache first
  const cacheKey = `repo-name:${name}`;
  const cached = getCachedValidationResult<string>(cacheKey);
  if (cached) {
    return cached;
  }

  const errors: ValidationErrorDetail[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  if (!name || typeof name !== 'string') {
    const result = createErrorResult<string>([
      createValidationError(
        'INVALID_TYPE',
        'Repository name must be a non-empty string',
        'repoName',
        'error',
        false,
        'Provide a valid repository name as a string'
      )
    ], [], ['Repository names must be strings']);
    setCachedValidationResult(cacheKey, result, 30000); // Cache errors for 30 seconds
    return result;
  }

  // Check length
  if (name.length === 0) {
    const result = createErrorResult<string>([
      createValidationError(
        'EMPTY_NAME',
        'Repository name cannot be empty',
        'repoName',
        'error',
        false,
        'Provide a repository name'
      )
    ], [], ['Repository names must be at least 1 character']);
    setCachedValidationResult(cacheKey, result, 30000);
    return result;
  }

  if (name.length > 100) {
    const result = createErrorResult<string>([
      createValidationError(
        'NAME_TOO_LONG',
        `Repository name is ${name.length} characters, maximum is 100`,
        'repoName',
        'error',
        false,
        'Shorten the repository name to 100 characters or less'
      )
    ], [], ['Repository names have a maximum length of 100 characters']);
    setCachedValidationResult(cacheKey, result, 30000);
    return result;
  }

  // Cannot start or end with a dot
  if (name.startsWith('.')) {
    errors.push(createValidationError(
      'STARTS_WITH_DOT',
      'Repository name cannot start with a dot',
      'repoName',
      'error',
      false,
      'Remove the leading dot from the repository name'
    ));
  }

  if (name.endsWith('.')) {
    errors.push(createValidationError(
      'ENDS_WITH_DOT',
      'Repository name cannot end with a dot',
      'repoName',
      'error',
      false,
      'Remove the trailing dot from the repository name'
    ));
  }

  // Cannot contain consecutive dots
  if (name.includes('..')) {
    errors.push(createValidationError(
      'CONSECUTIVE_DOTS',
      'Repository name cannot contain consecutive dots (..)',
      'repoName',
      'error',
      false,
      'Replace consecutive dots with a single dot or another character'
    ));
  }

  // Only allow alphanumeric, hyphen, underscore, and dot
  const validPattern = /^[a-zA-Z0-9._-]+$/;
  if (!validPattern.test(name)) {
    const invalidChars = name.split('').filter(char => !/[a-zA-Z0-9._-]/.test(char));
    errors.push(createValidationError(
      'INVALID_CHARACTERS',
      `Repository name contains invalid characters: ${[...new Set(invalidChars)].join(', ')}`,
      'repoName',
      'error',
      false,
      'Repository names can only contain letters, numbers, dots, hyphens, and underscores'
    ));
    suggestions.push('Use only alphanumeric characters, dots (.), hyphens (-), and underscores (_)');
  }

  // Add general suggestions
  if (name.length > 50) {
    warnings.push(createValidationWarning(
      'LONG_NAME',
      'Repository name is quite long, consider using a shorter name',
      'repoName',
      'Shorter names are easier to remember and type'
    ));
  }

  const result = errors.length > 0 
    ? createErrorResult<string>(errors, warnings, suggestions)
    : createSuccessResult(name, warnings, suggestions);

  // Cache successful results for longer
  setCachedValidationResult(cacheKey, result, result.valid ? 300000 : 30000); // 5 min success, 30 sec failure

  return result;
}

/**
 * Validates a GitHub username/organization name
 * - Can only contain alphanumeric characters and hyphens
 * - Cannot start or end with a hyphen
 * - Cannot contain consecutive hyphens
 * - Maximum 39 characters
 */
export function validateOwnerName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }
  
  // Check length - minimum 2 characters, maximum 39
  if (name.length < 2 || name.length > 39) {
    return false;
  }
  
  // Cannot start or end with a hyphen
  if (name.startsWith('-') || name.endsWith('-')) {
    return false;
  }
  
  // Cannot contain consecutive hyphens
  if (name.includes('--')) {
    return false;
  }
  
  // Only allow alphanumeric and hyphen
  const validPattern = /^[a-zA-Z0-9-]+$/;
  return validPattern.test(name);
}

/**
 * Validates and sanitizes a file path
 * - Prevents directory traversal attacks
 * - Removes null bytes
 * - Normalizes the path
 */
export function validateFilePath(path: string): string | null {
  if (!path || typeof path !== 'string') {
    return null;
  }
  
  // Remove null bytes
  let sanitized = path.replace(/\0/g, '');
  
  // Prevent directory traversal
  if (sanitized.includes('../') || sanitized.includes('..\\')) {
    return null;
  }
  
  // Reject absolute paths (Unix and Windows)
  if (sanitized.startsWith('/') || /^[a-zA-Z]:/.test(sanitized)) {
    return null;
  }
  
  // Normalize multiple slashes
  sanitized = sanitized.replace(/\/+/g, '/');
  
  // Remove trailing slashes
  sanitized = sanitized.replace(/\/$/, '');
  
  // Maximum path length (GitHub's limit)
  if (sanitized.length > 255) {
    return null;
  }
  
  return sanitized;
}

/**
 * Validates a branch/tag/ref name
 * - Follows Git ref naming rules
 */
export function validateRef(ref: string): boolean {
  if (!ref || typeof ref !== 'string') {
    return false;
  }
  
  // Cannot be empty or too long
  if (ref.length === 0 || ref.length > 255) {
    return false;
  }
  
  // Cannot contain certain characters
  const invalidChars = ['~', '^', ':', '\\', ' ', '\t', '\n'];
  for (const char of invalidChars) {
    if (ref.includes(char)) {
      return false;
    }
  }
  
  // Cannot start with a dot or dash
  if (ref.startsWith('.') || ref.startsWith('-')) {
    return false;
  }
  
  // Cannot end with .lock
  if (ref.endsWith('.lock')) {
    return false;
  }
  
  // Cannot contain consecutive dots or @{
  if (ref.includes('..') || ref.includes('@{')) {
    return false;
  }
  
  return true;
}

/**
 * Validates a commit SHA
 * - Must be a valid 40-character hex string
 */
export function validateCommitSha(sha: string): boolean {
  if (!sha || typeof sha !== 'string') {
    return false;
  }
  
  // Must be exactly 40 hex characters
  const shaPattern = /^[a-f0-9]{40}$/i;
  return shaPattern.test(sha);
}

/**
 * Sanitizes user-provided text to prevent injection
 * - Removes control characters
 * - Limits length
 */
export function sanitizeText(text: string, maxLength: number = 1000): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Remove control characters except newlines and tabs
  let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
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
 * Validation level enum for configurable strictness
 */
export enum ValidationLevel {
  STRICT = 'strict',     // Current behavior with exact format matching
  MODERATE = 'moderate', // Check prefix and length range
  LENIENT = 'lenient'    // Only check if non-empty
}

/**
 * Supported GitHub token formats with flexible validation
 * This configuration can be extended as GitHub introduces new token types
 */
const TOKEN_FORMATS: TokenFormat[] = [
  {
    prefix: 'ghp_',
    minLength: 40,
    maxLength: 255,
    pattern: /^ghp_[A-Za-z0-9_]{36,}$/,
    description: 'GitHub Personal Access Token (classic)'
  },
  {
    prefix: 'github_pat_',
    minLength: 82,
    maxLength: 255,
    pattern: /^github_pat_[A-Za-z0-9]{70,}$/,
    description: 'GitHub Fine-grained Personal Access Token'
  },
  {
    prefix: 'gho_',
    minLength: 40,
    maxLength: 255,
    pattern: /^gho_[A-Za-z0-9_]{36,}$/,
    description: 'GitHub OAuth token'
  },
  {
    prefix: 'ghu_',
    minLength: 40,
    maxLength: 255,
    pattern: /^ghu_[A-Za-z0-9_]{36,}$/,
    description: 'GitHub user access token'
  },
  {
    prefix: 'ghs_',
    minLength: 40,
    maxLength: 255,
    pattern: /^ghs_[A-Za-z0-9_]{36,}$/,
    description: 'GitHub server-to-server token'
  },
  {
    prefix: 'ghr_',
    minLength: 40,
    maxLength: 255,
    pattern: /^ghr_[A-Za-z0-9_]{36,}$/,
    description: 'GitHub refresh token'
  },
  {
    prefix: 'ghi_',
    minLength: 40,
    maxLength: 255,
    pattern: /^ghi_[A-Za-z0-9_]{36,}$/,
    description: 'GitHub installation access token'
  },
  // Legacy format - no prefix
  {
    prefix: '',
    minLength: 40,
    maxLength: 40,
    pattern: /^[a-f0-9]{40}$/i,
    description: 'Legacy GitHub token (40-character hex)'
  }
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
      const hasKnownPrefix = TOKEN_FORMATS.some(otherFmt => 
        otherFmt.prefix !== '' && token.startsWith(otherFmt.prefix)
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
  return token.length >= format.minLength && token.length <= format.maxLength;
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
): TokenValidationResult | string {
  if (!token || typeof token !== 'string') {
    return {
      isValid: false,
      error: 'Token must be a non-empty string'
    };
  }

  // LENIENT: Only check if token is non-empty
  if (level === ValidationLevel.LENIENT) {
    const isValid = token.trim().length > 0;
    if (isValid && token.length === 40 && /^[a-f0-9]{40}$/i.test(token)) {
      return 'legacy';
    }
    return {
      isValid,
      error: !isValid ? 'Token cannot be empty' : undefined
    };
  }

  // Find matching token format
  const format = TOKEN_FORMATS.find(fmt => {
    if (fmt.prefix === '') {
      // Legacy format - only match if no other prefixes match AND it looks like hex
      const hasKnownPrefix = TOKEN_FORMATS.some(otherFmt => 
        otherFmt.prefix !== '' && token.startsWith(otherFmt.prefix)
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
      error: 'Unrecognized token format'
    };
  }

  // Check length constraints
  if (token.length < format.minLength || token.length > format.maxLength) {
    return {
      isValid: false,
      format,
      error: `${format.description} must be between ${format.minLength} and ${format.maxLength} characters (got ${token.length})`
    };
  }

  // MODERATE: Only check prefix and length
  if (level === ValidationLevel.MODERATE) {
    // Return format type for backward compatibility
    if (format.prefix === 'ghp_') {
      return {
        isValid: true,
        format: 'classic_pat'
      };
    }
    if (format.prefix === 'gho_') {
      return {
        isValid: true,
        format: 'oauth'
      };
    }
    if (format.prefix === 'github_pat_') {
      return {
        isValid: true,
        format: 'fine_grained_pat'
      };
    }
    if (format.prefix === 'ghi_') {
      return {
        isValid: true,
        format: 'installation'
      };
    }
    if (format.prefix === '') {
      return {
        isValid: true,
        format: 'legacy'
      };
    }
    
    return {
      isValid: true,
      format
    };
  }

  // STRICT: Full pattern validation
  if (format.pattern && !format.pattern.test(token)) {
    return {
      isValid: false,
      format,
      error: `${format.description} has invalid character pattern`
    };
  }

  return {
    isValid: true,
    format
  };
}



/**
 * Validates a GitHub Personal Access Token format with detailed error reporting
 * - Must start with appropriate prefix (ghp_, gho_, ghu_, ghs_, ghr_)
 * - Must be the correct length for the token type
 * - Must contain only valid characters
 */
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
    warnings.push(createValidationWarning(
      'DEV_BYPASS',
      'Validation bypassed in development mode',
      'githubToken',
      'Only use this in development environments'
    ));
    return createSuccessResult(token, warnings);
  }
  
  // Check for missing token
  if (!token || typeof token !== 'string') {
    errors.push(createValidationError(
      'MISSING_TOKEN',
      'GitHub token is required',
      'githubToken',
      'error',
      true,
      'Provide a valid GitHub Personal Access Token'
    ));
    return createErrorResult(errors, warnings, ['Create a token at https://github.com/settings/tokens']);
  }
  
  // Check for whitespace
  const hasWhitespace = token.trim() !== token || token.includes(' ') || token.includes('\n') || token.includes('\t');
  if (hasWhitespace) {
    errors.push(createValidationError(
      'TOKEN_CONTAINS_WHITESPACE',
      'Token contains whitespace characters',
      'githubToken',
      'error',
      true,
      'Remove any spaces, tabs, or newlines from the token'
    ));
  }
  
  // Validate token format
  const formatResult = validateGitHubTokenFormat(token, level);
  if (typeof formatResult === 'object' && !formatResult.isValid) {
    errors.push(createValidationError(
      'INVALID_TOKEN_FORMAT',
      formatResult.error || 'Invalid token format',
      'githubToken',
      'error',
      true,
      'Ensure the token follows GitHub\'s format requirements'
    ));
  }
  
  if (errors.length > 0) {
    return createErrorResult(errors, warnings, ['Check your token format and try again']);
  }
  
  return createSuccessResult(token, warnings);
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
    return createErrorResult<{ token: string; user: any }>(formatResult.errors, formatResult.warnings, formatResult.suggestions);
  }

  // Development mode bypass
  if (shouldBypassValidation()) {
    return createSuccessResult(
      { token, user: { login: 'dev-user' } },
      [createValidationWarning('DEV_BYPASS', 'API validation bypassed in development mode', 'githubToken')],
      ['Set NODE_ENV=production to enable full API validation']
    );
  }

  // Check for fetch API availability
  if (typeof fetch === 'undefined' && typeof global !== 'undefined' && !global.fetch) {
    return createErrorResult<{ token: string; user: any }>([createValidationError(
      'FETCH_NOT_AVAILABLE',
      'Fetch API not available in this environment',
      'githubToken',
      'error',
      true,
      'API validation requires fetch support (Node.js 18+ or modern browser)'
    )]);
  }

  // Use retry logic with circuit breaker
  return withRetry(async () => {
    try {
      // Simple API call to validate token
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'github-mcp-server'
        }
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
          )
        ]);
      }

      if (response.status === 403) {
        const rateLimitReset = response.headers.get('x-ratelimit-reset');
        const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toISOString() : 'unknown';
        
        return createErrorResult<{ token: string; user: any }>([
          createValidationError(
            'RATE_LIMITED',
            'API rate limit exceeded',
            'githubToken',
            'warning',
            true,
            `Wait until ${resetTime} before trying again`
          )
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
          )
        ]);
      }

      const user = await response.json();
      
      return createSuccessResult(
        { token, user },
        [],
        ['Token validation successful']
      );

    } catch (error) {
      return createErrorResult<{ token: string; user: any }>([
        createValidationError(
          'NETWORK_ERROR',
          `Network error during validation: ${error instanceof Error ? error.message : String(error)}`,
          'githubToken',
          'warning',
          true,
          'Check your internet connection and try again'
        )
      ]);
    }
  }, DEFAULT_RETRY_CONFIG, 'github-api');
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
      if (sanitized.includes('$(') || sanitized.includes('`') || sanitized.includes('&&') || sanitized.includes('||')) {
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
      if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) {
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
    'context', 'repos', 'issues', 'pull_requests', 'actions', 
    'code_security', 'users', 'orgs', 'notifications', 
    'discussions', 'dependabot', 'secret_protection'
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
    '--max-new-space-size'
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
    sanitizedValues: result.value || {}
  };
}

/**
 * Securely loads and validates environment variables with detailed error reporting
 * - Validates all security-relevant environment variables
 * - Returns comprehensive validation results with recovery options
 */
export function validateEnvironmentConfigurationWithResult(): ValidationResult<Record<string, string>> {
  // Development mode bypass
  if (shouldBypassValidation()) {
    const mockValues = {
      GITHUB_TOKEN: 'dev-token-bypassed'
    };
    return createSuccessResult(mockValues, [
      createValidationWarning('DEV_BYPASS', 'Environment validation bypassed in development mode', 'environment')
    ], ['Set NODE_ENV=production to enable full environment validation']);
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
    errors.push(createValidationError(
      'MISSING_REQUIRED_TOKEN',
      'GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_TOKEN environment variable is required',
      'GITHUB_TOKEN',
      'error',
      false,
      'Set one of these environment variables with your GitHub Personal Access Token'
    ));
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
    { name: 'NODE_OPTIONS', validator: 'NODE_OPTIONS' }
  ];

  for (const { name, validator } of optionalVars) {
    const value = getEnvVar(name);
    if (value) {
      const sanitized = validateEnvironmentVariable(validator, value);
      if (sanitized === null) {
        errors.push(createValidationError(
          'INVALID_ENV_VAR_FORMAT',
          `Invalid format for environment variable ${name}`,
          name,
          'error',
          false,
          `Check the format requirements for ${name}`
        ));
      } else {
        sanitizedValues[name] = sanitized;
        
        // Add specific suggestions for environment variables
        if (name === 'GITHUB_READ_ONLY' && sanitized === 'true') {
          warnings.push(createValidationWarning(
            'READ_ONLY_MODE',
            'Running in read-only mode - write operations will be disabled',
            name,
            'Set to false to enable write operations'
          ));
        }
      }
    }
  }

  // Additional environment checks
  const nodeEnv = getEnvVar('NODE_ENV');
  if (!nodeEnv) {
    warnings.push(createValidationWarning(
      'NODE_ENV_NOT_SET',
      'NODE_ENV environment variable is not set',
      'NODE_ENV',
      'Set NODE_ENV=production for production deployments'
    ));
  }

  if (nodeEnv === 'development') {
    warnings.push(createValidationWarning(
      'DEVELOPMENT_MODE',
      'Running in development mode',
      'NODE_ENV',
      'Use NODE_ENV=production for production deployments'
    ));
  }

  // Security checks
  if (getEnvVar('DEBUG') && nodeEnv === 'production') {
    warnings.push(createValidationWarning(
      'DEBUG_IN_PRODUCTION',
      'DEBUG environment variable is set in production mode',
      'DEBUG',
      'Remove DEBUG variable in production for security'
    ));
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
    return createSuccessResult({
      sanitizedValues: result.value!,
      degradedMode: false,
      missingFeatures: []
    }, result.warnings, result.suggestions);
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
    warnings.push(createValidationWarning(
      'DEGRADED_TOKEN_VALIDATION',
      'Token format validation failed, proceeding with degraded validation',
      'GITHUB_TOKEN',
      'Fix token format issues for full functionality'
    ));
  }

  // Add other environment variables that might be partially valid
  const optionalVars = ['GITHUB_HOST', 'GITHUB_API_URL', 'GITHUB_READ_ONLY', 'GITHUB_TOOLSETS', 'NODE_OPTIONS'];
  for (const varName of optionalVars) {
    const value = getEnvVar(varName);
    if (value) {
      sanitizedValues[varName] = value; // Use raw value in degraded mode
      missingFeatures.push(`${varName} validation`);
    }
  }

  return createSuccessResult({
    sanitizedValues,
    degradedMode: true,
    missingFeatures
  }, warnings, [
    ...suggestions,
    'Application running in degraded mode - some features may not work correctly',
    'Fix validation errors for full functionality'
  ]);
}

/**
 * Validation health check endpoint
 * Provides status of validation system components
 */
export function getValidationHealthStatus(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
    lastCheck: string;
  }>;
  circuitBreakers: Array<{
    type: string;
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    lastFailure: string | null;
  }>;
  cache: {
    size: number;
    hitRate: number;
  };
} {
  const checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
    lastCheck: string;
  }> = [];
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  // Check environment configuration
  try {
    const envResult = validateEnvironmentConfigurationWithResult();
    if (envResult.valid) {
      checks.push({
        name: 'Environment Configuration',
        status: 'pass' as const,
        message: 'All environment variables valid',
        lastCheck: new Date().toISOString()
      });
    } else {
      const hasRecoverableErrors = envResult.errors.some(e => e.recoverable);
      checks.push({
        name: 'Environment Configuration',
        status: hasRecoverableErrors ? 'warn' as const : 'fail' as const,
        message: `${envResult.errors.length} validation errors`,
        lastCheck: new Date().toISOString()
      });
      if (!hasRecoverableErrors) {
        overallStatus = 'unhealthy';
      } else if (overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    }
  } catch (error) {
    checks.push({
      name: 'Environment Configuration',
      status: 'fail' as const,
      message: `Check failed: ${error instanceof Error ? error.message : String(error)}`,
      lastCheck: new Date().toISOString()
    });
    overallStatus = 'unhealthy';
  }
  
  // Check circuit breakers
  const breakerStatuses = [];
  let hasOpenBreakers = false;
  
  for (const [type, breaker] of circuitBreakers.entries()) {
    breakerStatuses.push({
      type,
      state: breaker.state,
      failures: breaker.failures,
      lastFailure: breaker.lastFailureTime > 0 ? new Date(breaker.lastFailureTime).toISOString() : null
    });
    
    if (breaker.state === 'open') {
      hasOpenBreakers = true;
    }
  }
  
  if (hasOpenBreakers) {
    checks.push({
      name: 'Circuit Breakers',
      status: 'warn' as const,
      message: 'One or more circuit breakers are open',
      lastCheck: new Date().toISOString()
    });
    if (overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }
  } else {
    checks.push({
      name: 'Circuit Breakers',
      status: 'pass' as const,
      message: 'All circuit breakers closed',
      lastCheck: new Date().toISOString()
    });
  }
  
  // Cache statistics (simplified)
  const cacheSize = validationCache.size;
  checks.push({
    name: 'Validation Cache',
    status: cacheSize < 1000 ? 'pass' as const : 'warn' as const,
    message: `${cacheSize} cached entries`,
    lastCheck: new Date().toISOString()
  });
  
  return {
    status: overallStatus,
    checks,
    circuitBreakers: breakerStatuses,
    cache: {
      size: cacheSize,
      hitRate: 0 // TODO: Implement hit rate tracking
    }
  };
}

/**
 * Clears validation caches and resets circuit breakers
 * Useful for debugging and testing
 */
export function resetValidationState(): void {
  validationCache.clear();
  circuitBreakers.clear();
}

/**
 * Gets validation statistics for monitoring
 */
export function getValidationStats(): {
  cacheSize: number;
  circuitBreakerCount: number;
  openCircuitBreakers: string[];
} {
  return {
    cacheSize: validationCache.size,
    circuitBreakerCount: circuitBreakers.size,
    openCircuitBreakers: Array.from(circuitBreakers.entries())
      .filter(([, breaker]) => breaker.state === 'open')
      .map(([type]) => type)
  };
}

/**
 * Validates a branch name according to Git naming rules
 * - Cannot be empty or too long
 * - Cannot contain certain characters
 * - Cannot start with a dot or dash
 * - Cannot end with .lock
 * - Cannot contain consecutive dots or @{
 */
export function validateBranchName(branch: string): boolean {
  if (!branch || typeof branch !== 'string') {
    return false;
  }
  
  // Cannot be empty or too long
  if (branch.length === 0 || branch.length > 255) {
    return false;
  }
  
  // Cannot contain certain characters
  const invalidChars = ['~', '^', ':', '\\', ' ', '\t', '\n', '?', '*', '['];
  for (const char of invalidChars) {
    if (branch.includes(char)) {
      return false;
    }
  }
  
  // Cannot start or end with a dot or dash
  if (branch.startsWith('.') || branch.startsWith('-') || branch.endsWith('.')) {
    return false;
  }
  
  // Cannot end with .lock
  if (branch.endsWith('.lock')) {
    return false;
  }
  
  // Cannot contain consecutive dots or @{
  if (branch.includes('..') || branch.includes('@{')) {
    return false;
  }
  
  return true;
}

/**
 * Validates a SHA hash (40-character hex string)
 */
export function validateSHA(sha: string): boolean {
  if (!sha || typeof sha !== 'string') {
    return false;
  }
  
  // Must be exactly 40 hex characters
  const shaPattern = /^[a-f0-9]{40}$/i;
  return shaPattern.test(sha);
}

/**
 * Validates a URL for security
 * - Must be HTTP/HTTPS
 * - Cannot contain authentication
 * - Cannot point to private IP ranges
 */
export function validateURL(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    const parsed = new URL(url);
    
    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    // No authentication in URL
    if (parsed.username || parsed.password) {
      return false;
    }
    
    const host = parsed.hostname.toLowerCase();
    
    // Disallow loopback and unspecified hosts
    const disallowedHosts = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
    if (disallowedHosts.has(host)) {
      return false;
    }
    
    // Disallow private IP ranges
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
      if (isPrivate) {
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates an issue number
 */
export function validateIssueNumber(issueNumber: number): boolean {
  return Number.isInteger(issueNumber) && issueNumber > 0;
}

/**
 * Validates per_page parameter for pagination
 */
export function validatePerPage(perPage: number): boolean {
  return Number.isInteger(perPage) && perPage >= 1 && perPage <= 100;
}

/**
 * Validates a search query
 */
export function validateSearchQuery(query: string): boolean {
  if (!query || typeof query !== 'string') {
    return false;
  }
  
  const trimmed = query.trim();
  return trimmed.length > 0 && trimmed.length <= 256;
}

/**
 * Validates a workflow file name
 */
export function validateWorkflowFileName(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return false;
  }
  
  // Must end with .yml or .yaml
  if (!filename.endsWith('.yml') && !filename.endsWith('.yaml')) {
    return false;
  }
  
  // Must be a valid file path
  const sanitized = validateFilePath(filename);
  return sanitized !== null;
}

/**
 * Validates environment variables (legacy version)
 */
export function validateEnvironment(env: Record<string, string>): ValidationResult<Record<string, string>> {
  const result = validateEnvironmentConfigurationWithResult();
  return result;
}

/**
 * Validates git operations for security
 */
export function validateGitOperation(operation: string): boolean {
  if (!operation || typeof operation !== 'string') {
    return false;
  }
  
  const safeOperations = [
    'status', 'log', 'diff', 'branch', 'show', 'ls-files',
    'rev-parse', 'describe', 'tag', 'remote', 'config'
  ];
  
  const dangerousPatterns = [
    '--force', '--hard', 'rm -rf', 'clean -f', '--exec=',
    'push --force', 'reset --hard'
  ];
  
  // Check if operation contains dangerous patterns
  for (const pattern of dangerousPatterns) {
    if (operation.includes(pattern)) {
      return false;
    }
  }
  
  // Check if it's a safe operation
  const baseOperation = operation.split(' ')[0];
  return safeOperations.includes(baseOperation);
}

/**
 * Validates command options for security
 */
export function validateCommandOptions(options: string): boolean {
  if (!options || typeof options !== 'string') {
    return true; // Empty options are safe
  }
  
  const dangerousOptions = [
    '--force', '--exec=', '--upload-pack=', '--receive-pack=',
    '--config=', '--work-tree=', '--git-dir='
  ];
  
  for (const dangerous of dangerousOptions) {
    if (options.includes(dangerous)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Creates a validation error with consistent format
 * This class maintains backward compatibility with existing code
 */
export class ValidationError extends Error {
  public field: string;
  
  constructor(field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}