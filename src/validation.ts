/**
 * Input validation utilities for GitHub MCP Server
 * Provides security-focused validation for user inputs
 */

/**
 * Validates a repository name according to GitHub's rules
 * - Can only contain alphanumeric characters, hyphens, underscores, and dots
 * - Cannot start or end with a dot
 * - Cannot contain consecutive dots
 * - Maximum 100 characters
 */
export function validateRepoName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }
  
  // Check length
  if (name.length === 0 || name.length > 100) {
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
  
  // Check length
  if (name.length === 0 || name.length > 39) {
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
  
  // Remove leading slashes to ensure relative path
  sanitized = sanitized.replace(/^\/+/, '');
  
  // Prevent absolute Windows paths
  if (/^[a-zA-Z]:/.test(sanitized)) {
    return null;
  }
  
  // Normalize multiple slashes
  sanitized = sanitized.replace(/\/+/g, '/');
  
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
  format?: TokenFormat;
  error?: string;
}

/**
 * Validates a GitHub token format with configurable strictness
 * @param token - The token to validate
 * @param level - Validation level (defaults to MODERATE for backward compatibility)
 * @returns Token validation result
 */
export function validateGitHubTokenFormat(
  token: string,
  level: ValidationLevel = ValidationLevel.MODERATE
): TokenValidationResult {
  if (!token || typeof token !== 'string') {
    return {
      isValid: false,
      error: 'Token must be a non-empty string'
    };
  }

  // LENIENT: Only check if token is non-empty
  if (level === ValidationLevel.LENIENT) {
    return {
      isValid: token.trim().length > 0,
      error: token.trim().length === 0 ? 'Token cannot be empty' : undefined
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
      error: `Unrecognized token format. Supported prefixes: ${TOKEN_FORMATS.map(f => f.prefix || 'legacy').join(', ')}`
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
 * Legacy function for backward compatibility
 * Uses MODERATE validation level by default
 */
export function validateGitHubToken(token: string): boolean {
  return validateGitHubTokenFormat(token, ValidationLevel.MODERATE).isValid;
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
): Promise<{
  isValid: boolean;
  userInfo?: {
    login: string;
    id: number;
    type: string;
  };
  error?: string;
}> {
  // First validate format
  const formatResult = validateGitHubTokenFormat(token);
  if (!formatResult.isValid) {
    return {
      isValid: false,
      error: `Invalid token format: ${formatResult.error}`
    };
  }

  const { timeout = 5000, retries = 1 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Dynamic import to avoid issues if @octokit/rest is not available
      const { Octokit } = await import('@octokit/rest');
      
      const octokit = new Octokit({
        auth: token,
        request: {
          timeout
        }
      });

      const response = await octokit.rest.users.getAuthenticated();
      
      return {
        isValid: true,
        userInfo: {
          login: response.data.login,
          id: response.data.id,
          type: response.data.type
        }
      };
    } catch (error) {
      // If this is the last attempt, return the error
      if (attempt === retries) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Check for specific error types
        if (errorMessage.includes('Bad credentials') || errorMessage.includes('401')) {
          return {
            isValid: false,
            error: 'Invalid token: Authentication failed'
          };
        }
        
        if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
          return {
            isValid: false,
            error: 'Token validation timeout: Unable to reach GitHub API'
          };
        }
        
        return {
          isValid: false,
          error: `Token validation failed: ${errorMessage}`
        };
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return {
    isValid: false,
    error: 'Unexpected error during token validation'
  };
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
      const [a, b] = parts;
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
 * Securely loads and validates environment variables
 * - Validates all security-relevant environment variables
 * - Returns validation results and sanitized values
 */
export function validateEnvironmentConfiguration(): {
  isValid: boolean;
  errors: string[];
  sanitizedValues: Record<string, string>;
} {
  const errors: string[] = [];
  const sanitizedValues: Record<string, string> = {};
  
  // Required variables
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    errors.push('GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_TOKEN is required');
  } else {
    const sanitizedToken = validateEnvironmentVariable('GITHUB_PERSONAL_ACCESS_TOKEN', token);
    if (!sanitizedToken) {
      errors.push('Invalid GitHub token format');
    } else {
      sanitizedValues.GITHUB_TOKEN = sanitizedToken;
    }
  }
  
  // Optional variables
  const optionalVars = [
    'GITHUB_HOST',
    'GITHUB_API_URL', 
    'GITHUB_READ_ONLY',
    'GITHUB_TOOLSETS',
    'NODE_OPTIONS'
  ];
  
  for (const varName of optionalVars) {
    const value = process.env[varName];
    if (value) {
      const sanitized = validateEnvironmentVariable(varName, value);
      if (sanitized === null) {
        errors.push(`Invalid format for ${varName}`);
      } else {
        sanitizedValues[varName] = sanitized;
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValues
  };
}

/**
 * Creates a validation error with consistent format
 */
export class ValidationError extends Error {
  constructor(field: string, message: string) {
    super(`Validation failed for ${field}: ${message}`);
    this.name = 'ValidationError';
  }
}