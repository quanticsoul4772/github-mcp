/**
 * Secure HTML escaping utilities for preventing XSS vulnerabilities
 *
 * This module provides robust, Node.js-compatible HTML escaping functions
 * that properly sanitize user input for safe inclusion in HTML content.
 */

/**
 * HTML character entity map for escaping dangerous characters
 * Based on OWASP XSS Prevention guidelines
 */
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;', // Must be first to avoid double-escaping
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;', // More compatible than &apos;
  '/': '&#x2F;', // Forward slash for extra safety
  '`': '&#x60;', // Backtick for template literal safety
  '=': '&#x3D;', // Equals sign for attribute safety
  ':': '&#x3A;', // Colon for javascript: URL safety
} as const;

/**
 * Escapes HTML characters in a string to prevent XSS attacks
 *
 * This function replaces dangerous HTML characters with their corresponding
 * HTML entities, making the string safe for inclusion in HTML content.
 *
 * @param text - The text to escape
 * @returns The escaped text safe for HTML inclusion
 *
 * @example
 * ```typescript
 * escapeHtml('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
 *
 * escapeHtml('User input: "Hello & goodbye"')
 * // Returns: 'User input: &quot;Hello &amp; goodbye&quot;'
 * ```
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') {
    throw new TypeError('escapeHtml expects a string input');
  }

  // Use a single regex replace for optimal performance
  return text.replace(/[&<>"'`=\/:]/g, match => HTML_ESCAPE_MAP[match] || match);
}

/**
 * Escapes HTML attributes specifically
 *
 * This function is optimized for escaping text that will be used in HTML attributes.
 * It includes additional safety measures for attribute contexts.
 *
 * @param text - The text to escape for use in HTML attributes
 * @returns The escaped text safe for HTML attribute values
 *
 * @example
 * ```typescript
 * escapeHtmlAttribute('user"input')
 * // Returns: 'user&quot;input'
 * ```
 */
export function escapeHtmlAttribute(text: string): string {
  if (typeof text !== 'string') {
    throw new TypeError('escapeHtmlAttribute expects a string input');
  }

  // For attributes, we need to be extra careful with quotes and spaces
  return text.replace(/[&<>"'`=\/:\s]/g, match => {
    if (match === ' ') return '&#x20;';
    return HTML_ESCAPE_MAP[match] || match;
  });
}

/**
 * Sanitizes text for safe inclusion in JavaScript strings within HTML
 *
 * This function escapes characters that could break out of JavaScript string contexts
 * when the string is embedded in HTML script tags.
 *
 * @param text - The text to escape for JavaScript context
 * @returns The escaped text safe for JavaScript strings in HTML
 *
 * @example
 * ```typescript
 * escapeJavaScript('alert("hello"); //comment')
 * // Returns: 'alert(\\"hello\\"); \\x2F\\x2Fcomment'
 * ```
 */
export function escapeJavaScript(text: string): string {
  if (typeof text !== 'string') {
    throw new TypeError('escapeJavaScript expects a string input');
  }

  return text
    .replace(/\\/g, '\\\\') // Escape backslashes first
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/'/g, "\\'") // Escape single quotes
    .replace(/\n/g, '\\n') // Escape newlines
    .replace(/\r/g, '\\r') // Escape carriage returns
    .replace(/\t/g, '\\t') // Escape tabs
    .replace(/\//g, '\\x2F') // Escape forward slashes
    .replace(/</g, '\\x3C') // Escape less-than
    .replace(/>/g, '\\x3E'); // Escape greater-than
}

/**
 * Validates that a string contains only safe characters for HTML content
 *
 * This function checks if a string contains potentially dangerous characters
 * that should be escaped before including in HTML.
 *
 * @param text - The text to validate
 * @returns True if the text is safe, false if it contains dangerous characters
 */
export function isHtmlSafe(text: string): boolean {
  if (typeof text !== 'string') {
    return false;
  }

  // Check for dangerous characters
  return !/[&<>"'`=\/:]/