/**
 * Tests for config module — functions not covered by validation.test.ts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getPort,
  isProduction,
  isDevelopment,
  isTest,
  getEnabledToolsets,
  validateEnvironmentVariable,
  validateEnvironmentConfiguration,
  validateEnvironmentConfigurationWithResult,
  validateEnvironmentConfigurationGraceful,
  validateEnvironment,
} from './config.js';

describe('config utility functions', () => {
  describe('getPort', () => {
    it('should return a number', () => {
      const port = getPort();
      expect(typeof port).toBe('number');
    });
  });

  describe('isProduction / isDevelopment / isTest', () => {
    it('isProduction returns boolean', () => {
      expect(typeof isProduction()).toBe('boolean');
    });

    it('isDevelopment returns boolean', () => {
      expect(typeof isDevelopment()).toBe('boolean');
    });

    it('isTest returns boolean', () => {
      expect(typeof isTest()).toBe('boolean');
    });
  });

  describe('getEnabledToolsets', () => {
    it('should return an array of strings', () => {
      const toolsets = getEnabledToolsets();
      expect(Array.isArray(toolsets)).toBe(true);
      expect(toolsets.length).toBeGreaterThan(0);
    });
  });
});

describe('validateEnvironmentVariable', () => {
  it('should return null for empty name', () => {
    expect(validateEnvironmentVariable('', 'value')).toBeNull();
  });

  it('should return null for empty value', () => {
    expect(validateEnvironmentVariable('NAME', '')).toBeNull();
  });

  it('should sanitize control characters', () => {
    const result = validateEnvironmentVariable('SOME_VAR', 'value\x00clean');
    // null bytes removed — should pass generic validation
    expect(result).not.toBeNull();
  });

  it('should validate GITHUB_READ_ONLY with valid values', () => {
    expect(validateEnvironmentVariable('GITHUB_READ_ONLY', 'true')).toBe('true');
    expect(validateEnvironmentVariable('GITHUB_READ_ONLY', 'false')).toBe('false');
    expect(validateEnvironmentVariable('GITHUB_READ_ONLY', '1')).toBe('1');
    expect(validateEnvironmentVariable('GITHUB_READ_ONLY', '0')).toBe('0');
  });

  it('should reject GITHUB_READ_ONLY with invalid values', () => {
    expect(validateEnvironmentVariable('GITHUB_READ_ONLY', 'yes')).toBeNull();
  });

  it('should reject values with injection patterns', () => {
    expect(validateEnvironmentVariable('SOME_VAR', '$(rm -rf /)')).toBeNull();
    expect(validateEnvironmentVariable('SOME_VAR', 'value`cmd`')).toBeNull();
  });
});

describe('validateEnvironmentConfiguration', () => {
  const origToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

  afterEach(() => {
    if (origToken !== undefined) {
      process.env.GITHUB_PERSONAL_ACCESS_TOKEN = origToken;
    } else {
      delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    }
  });

  it('should return isValid and errors fields', () => {
    const result = validateEnvironmentConfiguration();
    expect(typeof result.isValid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(typeof result.sanitizedValues).toBe('object');
  });
});

describe('validateEnvironmentConfigurationWithResult', () => {
  it('should return a ValidationResult with isValid field', () => {
    const result = validateEnvironmentConfigurationWithResult();
    expect(typeof result.isValid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('should bypass validation in dev mode with SKIP_VALIDATION', () => {
    const origEnv = process.env.NODE_ENV;
    const origSkip = process.env.SKIP_VALIDATION;
    process.env.NODE_ENV = 'development';
    process.env.SKIP_VALIDATION = 'true';
    try {
      const result = validateEnvironmentConfigurationWithResult();
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origSkip !== undefined) {
        process.env.SKIP_VALIDATION = origSkip;
      } else {
        delete process.env.SKIP_VALIDATION;
      }
    }
  });
});

describe('validateEnvironmentConfigurationGraceful', () => {
  it('should return a ValidationResult', () => {
    const result = validateEnvironmentConfigurationGraceful();
    expect(typeof result.isValid).toBe('boolean');
  });
});

describe('validateEnvironment', () => {
  it('should return validation result with expected fields', () => {
    const result = validateEnvironment();
    expect(typeof result.isValid).toBe('boolean');
    expect(typeof result.errors).toBe('object');
  });
});
