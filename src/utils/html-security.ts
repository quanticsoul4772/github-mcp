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
  return !/[&<>"'`=\/:]/`.test(text);
}

/**
 * Strips all HTML tags from a string, leaving only text content
 *
 * This function removes all HTML tags and returns only the text content.
 * It's useful for creating plain text versions of HTML content.
 * 
 * SECURITY FIX: This function now properly handles multi-character entities
 * and prevents double unescaping vulnerabilities.
 *
 * @param html - The HTML string to strip tags from
 * @returns The text content without HTML tags
 *
 * @example
 * ```typescript
 * stripHtmlTags('<p>Hello <strong>world</strong>!</p>')
 * // Returns: 'Hello world!'
 * ```
 */
export function stripHtmlTags(html: string): string {
  if (typeof html !== 'string') {
    throw new TypeError('stripHtmlTags expects a string input');
  }

  // First, repeatedly remove all HTML tags (fix incomplete multi-character sanitization)
  let result = html;
  let previous;
  do {
    previous = result;
    result = result.replace(/<[^>]*>/g, '');
  } while (result !== previous);
  
  // Then decode HTML entities in a safe single pass
  // This prevents double unescaping vulnerabilities
  result = result
    // Decode named entities (ampersand LAST to prevent double unescaping)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x60;/g, '`')
    .replace(/&#x3D;/g, '=')
    .replace(/&#x3A;/g, ':')
    // Decode numeric entities
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    // Decode ampersand LAST
    .replace(/&amp;/g, '&');
  
  return result.trim();
}

/**
 * Security-focused HTML template function
 *
 * This function provides a safe way to create HTML templates with automatic escaping.
 * All interpolated values are automatically escaped unless explicitly marked as safe.
 *
 * @param template - The HTML template string
 * @param values - Object containing values to interpolate
 * @returns The rendered HTML with all values safely escaped
 *
 * @example
 * ```typescript
 * const html = safeHtmlTemplate(
 *   '<div class="{{className}}">{{content}}</div>',
 *   { className: 'user-content', content: '<script>alert("xss")</script>' }
 * );
 * // Returns: '<div class="user-content">&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;</div>'
 * ```
 */
export function safeHtmlTemplate(template: string, values: Record<string, string>): string {
  if (typeof template !== 'string') {
    throw new TypeError('safeHtmlTemplate expects a string template');
  }

  if (!values || typeof values !== 'object') {
    throw new TypeError('safeHtmlTemplate expects an object of values');
  }

  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = values[key];
    if (value === undefined || value === null) {
      return '';
    }
    return escapeHtml(String(value));
  });
}

/**
 * Type guard to check if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Safely converts any value to a string and escapes it for HTML
 */
export function safeStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return escapeHtml(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return escapeHtml(String(value));
  }

  // For objects, arrays, etc., convert to JSON and escape
  try {
    return escapeHtml(JSON.stringify(value));
  } catch {
    return escapeHtml('[Object]');
  }
}