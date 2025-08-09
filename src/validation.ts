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
 * Creates a validation error with consistent format
 */
export class ValidationError extends Error {
  constructor(field: string, message: string) {
    super(`Validation failed for ${field}: ${message}`);
    this.name = 'ValidationError';
  }
}