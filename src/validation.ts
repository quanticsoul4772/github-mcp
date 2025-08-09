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
 * Validates a GitHub Personal Access Token format
 * - Must start with appropriate prefix (ghp_, gho_, ghu_, ghs_, ghr_)
 * - Must be the correct length for the token type
 * - Must contain only valid characters
 */
export function validateGitHubToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // GitHub Personal Access Token (classic) - starts with ghp_
  if (token.startsWith('ghp_')) {
    return token.length === 40 && /^ghp_[A-Za-z0-9]{36}$/.test(token);
  }
  
  // GitHub OAuth token - starts with gho_
  if (token.startsWith('gho_')) {
    return token.length === 40 && /^gho_[A-Za-z0-9]{36}$/.test(token);
  }
  
  // GitHub user access token - starts with ghu_
  if (token.startsWith('ghu_')) {
    return token.length === 40 && /^ghu_[A-Za-z0-9]{36}$/.test(token);
  }
  
  // GitHub server-to-server token - starts with ghs_
  if (token.startsWith('ghs_')) {
    return token.length === 40 && /^ghs_[A-Za-z0-9]{36}$/.test(token);
  }
  
  // GitHub refresh token - starts with ghr_
  if (token.startsWith('ghr_')) {
    return token.length === 40 && /^ghr_[A-Za-z0-9]{36}$/.test(token);
  }

  // Legacy format (40 characters, hex) - deprecated but still supported
  if (token.length === 40 && /^[a-f0-9]{40}$/i.test(token)) {
    return true;
  }

  return false;
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
    return parsed.protocol === 'https:' && 
           parsed.hostname.length > 0 &&
           !parsed.hostname.includes('localhost') &&
           !parsed.hostname.includes('127.0.0.1');
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