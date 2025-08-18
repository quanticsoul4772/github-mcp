/**
 * Environment configuration and validation
 *
 * This module validates environment variables using Zod schemas
 * and provides type-safe access to configuration values.
 */

import { z } from 'zod';
import { logger } from './logger.js';

/**
 * Environment variable schema definition
 */
const envSchema = z
  .object({
    // Node.js environment
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

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
  );

/**
 * Validated environment configuration
 *
 * This object provides type-safe access to all environment variables
 * after validation through the Zod schema.
 */
export const env = (() => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    // Environment validation failed - log using logger instead of console.error
    const errorMessage =
      error instanceof z.ZodError
        ? `Environment validation failed: ${error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')}`
        : `Environment validation failed: ${error}`;

    logger.error(errorMessage);

    process.exit(1);
  }
})();

/**
 * Type definition for the validated environment configuration
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Get the GitHub authentication token
 * Prioritizes GITHUB_PERSONAL_ACCESS_TOKEN over GITHUB_TOKEN
 */
export function getGitHubToken(): string {
  const token = env.GITHUB_PERSONAL_ACCESS_TOKEN || env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('No GitHub authentication token available');
  }
  return token;
}

/**
 * Get the server port as a number
 */
export function getPort(): number {
  return parseInt(env.PORT, 10);
}

/**
 * Check if the server is running in production mode
 */
export function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}

/**
 * Check if the server is running in development mode
 */
export function isDevelopment(): boolean {
  return env.NODE_ENV === 'development';
}

/**
 * Check if the server is running in test mode
 */
export function isTest(): boolean {
  return env.NODE_ENV === 'test';
}

/**
 * Get enabled toolsets as an array
 */
export function getEnabledToolsets(): string[] {
  if (env.GITHUB_TOOLSETS === 'all') {
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
    ];
  }

  return env.GITHUB_TOOLSETS.split(',').map(t => t.trim());
}

/**
 * Display environment configuration summary
 */
export function displayConfig(): void {
  logger.info('Environment configuration', {
    environment: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    readOnly: env.GITHUB_READ_ONLY,
    toolsets: env.GITHUB_TOOLSETS,
    githubHost: env.GITHUB_HOST,
    tokenPrefix: getGitHubToken().substring(0, 10) + '...',
  });
}
