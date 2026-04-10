/**
 * Tests for graphql-validation: validateGraphQLVariableValue, validateGraphQLInput, GraphQLValidationError
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  GraphQLValidationError,
  validateGraphQLInput,
  validateGraphQLVariableValue,
} from './graphql-validation.js';

describe('GraphQLValidationError', () => {
  it('should create error with field and code', () => {
    const err = new GraphQLValidationError('myField', 'bad value', 'BAD_VAL');
    expect(err.field).toBe('myField');
    expect(err.code).toBe('BAD_VAL');
    expect(err.message).toContain('myField');
    expect(err.name).toBe('GraphQLValidationError');
  });

  it('should use default code', () => {
    const err = new GraphQLValidationError('f', 'msg');
    expect(err.code).toBe('VALIDATION_ERROR');
  });
});

describe('validateGraphQLInput', () => {
  it('should return parsed value for valid input', () => {
    const schema = z.object({ name: z.string(), count: z.number() });
    const result = validateGraphQLInput(schema, { name: 'test', count: 5 }, 'ctx');
    expect(result.name).toBe('test');
    expect(result.count).toBe(5);
  });

  it('should throw GraphQLValidationError for invalid input (ZodError)', () => {
    const schema = z.object({ name: z.string() });
    expect(() => validateGraphQLInput(schema, { name: 123 }, 'ctx')).toThrow(GraphQLValidationError);
  });

  it('should throw GraphQLValidationError for non-ZodError', () => {
    const schema = { parse: () => { throw new Error('unexpected'); } } as any;
    expect(() => validateGraphQLInput(schema, {}, 'ctx')).toThrow(GraphQLValidationError);
  });
});

describe('validateGraphQLVariableValue', () => {
  // String branch
  it('should sanitize a normal string', () => {
    const result = validateGraphQLVariableValue('hello world', 'str');
    expect(typeof result).toBe('string');
  });

  it('should throw for string with injection pattern (${})', () => {
    expect(() => validateGraphQLVariableValue('${malicious}', 'str')).toThrow(GraphQLValidationError);
  });

  it('should throw for string with injection pattern (#{})', () => {
    expect(() => validateGraphQLVariableValue('#{inject}', 'str')).toThrow(GraphQLValidationError);
  });

  it('should throw for string with injection pattern ({{}})', () => {
    expect(() => validateGraphQLVariableValue('{{template}}', 'str')).toThrow(GraphQLValidationError);
  });

  // Number branch
  it('should return a valid finite number', () => {
    expect(validateGraphQLVariableValue(42, 'num')).toBe(42);
  });

  it('should throw for Infinity', () => {
    expect(() => validateGraphQLVariableValue(Infinity, 'num')).toThrow(GraphQLValidationError);
  });

  it('should throw for number out of safe range', () => {
    // Number.MAX_SAFE_INTEGER + 1 exceeds safe range
    expect(() => validateGraphQLVariableValue(Number.MAX_SAFE_INTEGER + 1, 'num')).toThrow(GraphQLValidationError);
  });

  // Boolean branch (line 445)
  it('should return boolean values directly', () => {
    expect(validateGraphQLVariableValue(true, 'bool')).toBe(true);
    expect(validateGraphQLVariableValue(false, 'bool')).toBe(false);
  });

  // Null/undefined branch (lines 448-450)
  it('should return null', () => {
    expect(validateGraphQLVariableValue(null, 'v')).toBeNull();
  });

  it('should return undefined', () => {
    expect(validateGraphQLVariableValue(undefined, 'v')).toBeUndefined();
  });

  // Array branch
  it('should validate array items recursively', () => {
    const result = validateGraphQLVariableValue(['a', 'b', 'c'], 'arr');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('should throw for array with more than 100 items', () => {
    const bigArray = Array.from({ length: 101 }, (_, i) => i);
    expect(() => validateGraphQLVariableValue(bigArray, 'arr')).toThrow(GraphQLValidationError);
  });

  // Object branch
  it('should validate object recursively', () => {
    const result = validateGraphQLVariableValue({ name: 'test', count: 5 }, 'obj') as Record<string, unknown>;
    expect(result.name).toBe('test');
    expect(result.count).toBe(5);
  });

  it('should throw for object with invalid property name', () => {
    expect(() => validateGraphQLVariableValue({ 'invalid-key': 1 }, 'obj')).toThrow(GraphQLValidationError);
  });

  it('should throw for object with too many properties', () => {
    const bigObj: Record<string, number> = {};
    for (let i = 0; i < 51; i++) {
      bigObj[`key${i}`] = i;
    }
    expect(() => validateGraphQLVariableValue(bigObj, 'obj')).toThrow(GraphQLValidationError);
  });

  // Unsupported type branch (line 489)
  it('should throw for unsupported type (symbol)', () => {
    expect(() => validateGraphQLVariableValue(Symbol('test'), 'sym')).toThrow(GraphQLValidationError);
  });

  it('should throw for unsupported type (function)', () => {
    expect(() => validateGraphQLVariableValue(() => {}, 'fn')).toThrow(GraphQLValidationError);
  });
});
