import { logger } from './logger.js';
import { shouldBypassValidation, isPrivateOrReservedIP } from './config.js';

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
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Circuit breaker registry for different validation types
 */
const circuitBreakers = new Map<string, CircuitBreakerState>();

/**
 * Validation result cache with TTL
 */
const validationCache = new Map<
  string,
  { result: ValidationResult; timestamp: number; ttl: number }
>();

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
    process.on('uncaughtException', error => {
      logger.error('Uncaught exception:', error);
      cleanupValidation();
      process.exit(1);
    });
  }
}

/**
 * Creates a validation result with success
 */
export function createSuccessResult<T>(
  value: T,
  warnings: ValidationWarning[] = [],
  suggestions: string[] = []
): ValidationResult<T> {
  return {
    valid: true,
    value,
    errors: [],
    warnings,
    suggestions,
  };
}

/**
 * Creates a validation result with errors
 */
export function createErrorResult<T>(
  errors: ValidationErrorDetail[],
  warnings: ValidationWarning[] = [],
  suggestions: string[] = []
): ValidationResult<T> {
  return {
    valid: false,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Creates a validation error
 */
export function createValidationError(
  code: string,
  message: string,
  field: string,
  severity: 'error' | 'warning' | 'info' = 'error',
  recoverable = false,
  suggestion?: string
): ValidationErrorDetail {
  return { code, message, field, severity, recoverable, suggestion };
}

/**
 * Creates a validation warning
 */
export function createValidationWarning(
  code: string,
  message: string,
  field: string,
  suggestion?: string
): ValidationWarning {
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
      state: 'closed',
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
export async function withRetry<T>(
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
        return createErrorResult([
          createValidationError(
            'CIRCUIT_BREAKER_OPEN',
            `Validation circuit breaker is open for ${circuitBreakerType}. Service may be experiencing issues.`,
            circuitBreakerType,
            'warning',
            true,
            'Wait a few minutes and try again, or check service status'
          ),
        ]);
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
        return createErrorResult([
          createValidationError(
            'VALIDATION_EXCEPTION',
            `Validation failed with exception: ${error instanceof Error ? error.message : String(error)}`,
            'unknown',
            'error',
            true,
            'Check input format and try again'
          ),
        ]);
      }

      // Wait before retry
      await sleep(Math.min(delay, config.maxDelayMs));
      delay *= config.backoffMultiplier;
    }
  }

  return (
    lastResult ||
    createErrorResult([
      createValidationError(
        'VALIDATION_FAILED',
        'Validation failed after all retry attempts',
        'unknown',
        'error',
        true
      ),
    ])
  );
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
function setCachedValidationResult<T>(
  cacheKey: string,
  result: ValidationResult<T>,
  ttlMs = 60000
): void {
  validationCache.set(cacheKey, {
    result,
    timestamp: Date.now(),
    ttl: ttlMs,
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
    return createSuccessResult(
      name,
      [
        createValidationWarning(
          'DEV_BYPASS',
          'Validation bypassed in development mode',
          'repoName'
        ),
      ],
      ['Set NODE_ENV=production to enable full validation']
    );
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
    const result = createErrorResult<string>(
      [
        createValidationError(
          'INVALID_TYPE',
          'Repository name must be a non-empty string',
          'repoName',
          'error',
          false,
          'Provide a valid repository name as a string'
        ),
      ],
      [],
      ['Repository names must be strings']
    );
    setCachedValidationResult(cacheKey, result, 30000); // Cache errors for 30 seconds
    return result;
  }

  // Check length
  if (name.length === 0) {
    const result = createErrorResult<string>(
      [
        createValidationError(
          'EMPTY_NAME',
          'Repository name cannot be empty',
          'repoName',
          'error',
          false,
          'Provide a repository name'
        ),
      ],
      [],
      ['Repository names must be at least 1 character']
    );
    setCachedValidationResult(cacheKey, result, 30000);
    return result;
  }

  if (name.length > 100) {
    const result = createErrorResult<string>(
      [
        createValidationError(
          'NAME_TOO_LONG',
          `Repository name is ${name.length} characters, maximum is 100`,
          'repoName',
          'error',
          false,
          'Shorten the repository name to 100 characters or less'
        ),
      ],
      [],
      ['Repository names have a maximum length of 100 characters']
    );
    setCachedValidationResult(cacheKey, result, 30000);
    return result;
  }

  // Cannot start or end with a dot
  if (name.startsWith('.')) {
    errors.push(
      createValidationError(
        'STARTS_WITH_DOT',
        'Repository name cannot start with a dot',
        'repoName',
        'error',
        false,
        'Remove the leading dot from the repository name'
      )
    );
  }

  if (name.endsWith('.')) {
    errors.push(
      createValidationError(
        'ENDS_WITH_DOT',
        'Repository name cannot end with a dot',
        'repoName',
        'error',
        false,
        'Remove the trailing dot from the repository name'
      )
    );
  }

  // Cannot contain consecutive dots
  if (name.includes('..')) {
    errors.push(
      createValidationError(
        'CONSECUTIVE_DOTS',
        'Repository name cannot contain consecutive dots (..)',
        'repoName',
        'error',
        false,
        'Replace consecutive dots with a single dot or another character'
      )
    );
  }

  // Only allow alphanumeric, hyphen, underscore, and dot
  const validPattern = /^[a-zA-Z0-9._-]+$/;
  if (!validPattern.test(name)) {
    const invalidChars = name.split('').filter(char => !/[a-zA-Z0-9._-]/.test(char));
    errors.push(
      createValidationError(
        'INVALID_CHARACTERS',
        `Repository name contains invalid characters: ${[...new Set(invalidChars)].join(', ')}`,
        'repoName',
        'error',
        false,
        'Repository names can only contain letters, numbers, dots, hyphens, and underscores'
      )
    );
    suggestions.push(
      'Use only alphanumeric characters, dots (.), hyphens (-), and underscores (_)'
    );
  }

  // Add general suggestions
  if (name.length > 50) {
    warnings.push(
      createValidationWarning(
        'LONG_NAME',
        'Repository name is quite long, consider using a shorter name',
        'repoName',
        'Shorter names are easier to remember and type'
      )
    );
  }

  const result =
    errors.length > 0
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

  // Remove leading slashes to convert absolute paths to relative
  sanitized = sanitized.replace(/^\/+/, '');

  // Reject Windows absolute paths
  if (/^[a-zA-Z]:/.test(sanitized)) {
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

    // Comprehensive IP address validation
    return !isPrivateOrReservedIP(host);
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
 * Validates git operations for security
 */
export function validateGitOperation(operation: string): boolean {
  if (!operation || typeof operation !== 'string') {
    return false;
  }

  const safeOperations = [
    'status',
    'log',
    'diff',
    'branch',
    'show',
    'ls-files',
    'rev-parse',
    'describe',
    'tag',
    'remote',
    'config',
  ];

  const dangerousPatterns = [
    '--force',
    '--hard',
    'rm -rf',
    'clean -f',
    '--exec=',
    'push --force',
    'reset --hard',
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
    '--force',
    '--exec=',
    '--upload-pack=',
    '--receive-pack=',
    '--config=',
    '--work-tree=',
    '--git-dir=',
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
    super(`Validation failed for ${field}: ${message}`);
    this.name = 'ValidationError';
    this.field = field;
  }
}
