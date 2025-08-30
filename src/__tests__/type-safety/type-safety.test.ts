/**
 * Type Safety Tests
 *
 * These tests verify that our type safety utilities properly validate
 * parameters and prevent runtime errors from malformed input.
 */

import { z } from 'zod';
import { vi } from 'vitest';
import {
  createTypeSafeHandler,
  ParameterValidationError,
  jsonSchemaToZod,
  CommonSchemas,
  GitHubSchemas,
  TypeSafeHandlerFactory,
  validateParameters,
  combineSchemas,
} from '../../utils/type-safety.js';

describe('Type Safety Utilities', () => {
  describe('createTypeSafeHandler', () => {
    it('should validate parameters and call handler with typed params', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const mockHandler = vi.fn().mockResolvedValue({ success: true });
      const typeSafeHandler = createTypeSafeHandler(schema, mockHandler, 'test_tool');

      const validParams = { name: 'John', age: 30 };
      const result = await typeSafeHandler(validParams);

      expect(mockHandler).toHaveBeenCalledWith(validParams);
      expect(result).toEqual({ success: true });
    });

    it('should throw ParameterValidationError for invalid parameters', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const mockHandler = vi.fn();
      const typeSafeHandler = createTypeSafeHandler(schema, mockHandler, 'test_tool');

      const invalidParams = { name: 'John', age: 'thirty' }; // age should be number

      await expect(typeSafeHandler(invalidParams)).rejects.toThrow(ParameterValidationError);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should include tool name in error message', async () => {
      const schema = z.object({
        required_field: z.string(),
      });

      const mockHandler = vi.fn();
      const typeSafeHandler = createTypeSafeHandler(schema, mockHandler, 'my_test_tool');

      try {
        await typeSafeHandler({});
      } catch (error) {
        expect(error).toBeInstanceOf(ParameterValidationError);
        expect((error as any).message).toContain('my_test_tool');
        expect((error as any).toolName).toBe('my_test_tool');
      }
    });

    it('should pass through non-validation errors', async () => {
      const schema = z.object({
        name: z.string(),
      });

      const mockHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      const typeSafeHandler = createTypeSafeHandler(schema, mockHandler, 'test_tool');

      await expect(typeSafeHandler({ name: 'John' })).rejects.toThrow('Handler error');
    });
  });

  describe('jsonSchemaToZod', () => {
    it('should convert string schema', () => {
      const jsonSchema = { type: 'string' };
      const zodSchema = jsonSchemaToZod(jsonSchema);

      expect(zodSchema.parse('hello')).toBe('hello');
      expect(() => zodSchema.parse(123)).toThrow();
    });

    it('should convert string schema with enum', () => {
      const jsonSchema = { type: 'string', enum: ['red', 'green', 'blue'] };
      const zodSchema = jsonSchemaToZod(jsonSchema);

      expect(zodSchema.parse('red')).toBe('red');
      expect(() => zodSchema.parse('yellow')).toThrow();
    });

    it('should convert number schema with constraints', () => {
      const jsonSchema = { type: 'number', minimum: 0, maximum: 100 };
      const zodSchema = jsonSchemaToZod(jsonSchema);

      expect(zodSchema.parse(50)).toBe(50);
      expect(() => zodSchema.parse(-1)).toThrow();
      expect(() => zodSchema.parse(101)).toThrow();
    });

    it('should convert integer schema', () => {
      const jsonSchema = { type: 'integer' };
      const zodSchema = jsonSchemaToZod(jsonSchema);

      expect(zodSchema.parse(42)).toBe(42);
      expect(() => zodSchema.parse(3.14)).toThrow();
    });

    it('should convert boolean schema', () => {
      const jsonSchema = { type: 'boolean' };
      const zodSchema = jsonSchemaToZod(jsonSchema);

      expect(zodSchema.parse(true)).toBe(true);
      expect(zodSchema.parse(false)).toBe(false);
      expect(() => zodSchema.parse('true')).toThrow();
    });

    it('should convert array schema', () => {
      const jsonSchema = {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 3,
      };
      const zodSchema = jsonSchemaToZod(jsonSchema);

      expect(zodSchema.parse(['a', 'b'])).toEqual(['a', 'b']);
      expect(() => zodSchema.parse([])).toThrow(); // minItems violation
      expect(() => zodSchema.parse(['a', 'b', 'c', 'd'])).toThrow(); // maxItems violation
      expect(() => zodSchema.parse([1, 2])).toThrow(); // wrong item type
    });

    it('should convert object schema with required fields', () => {
      const jsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          email: { type: 'string' },
        },
        required: ['name', 'age'],
      };
      const zodSchema = jsonSchemaToZod(jsonSchema);

      expect(zodSchema.parse({ name: 'John', age: 30 })).toEqual({ name: 'John', age: 30 });
      expect(zodSchema.parse({ name: 'John', age: 30, email: 'john@example.com' })).toEqual({
        name: 'John',
        age: 30,
        email: 'john@example.com',
      });

      expect(() => zodSchema.parse({ name: 'John' })).toThrow(); // missing required age
      expect(() => zodSchema.parse({ age: 30 })).toThrow(); // missing required name
    });

    it('should handle object schema without required fields', () => {
      const jsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };
      const zodSchema = jsonSchemaToZod(jsonSchema);

      expect(zodSchema.parse({})).toEqual({});
      expect(zodSchema.parse({ name: 'John' })).toEqual({ name: 'John' });
    });

    it('should handle unknown types', () => {
      const jsonSchema = { type: 'unknown_type' };
      const zodSchema = jsonSchemaToZod(jsonSchema);

      expect(zodSchema.parse('anything')).toBe('anything');
      expect(zodSchema.parse(123)).toBe(123);
      expect(zodSchema.parse({})).toEqual({});
    });
  });

  describe('CommonSchemas', () => {
    it('should validate repository schema', () => {
      const validRepo = { owner: 'octocat', repo: 'Hello-World' };
      expect(CommonSchemas.repository.parse(validRepo)).toEqual(validRepo);

      expect(() => CommonSchemas.repository.parse({ owner: '', repo: 'test' })).toThrow();
      expect(() => CommonSchemas.repository.parse({ owner: 'test' })).toThrow();
    });

    it('should validate pagination schema', () => {
      const validPagination = { page: 2, per_page: 50 };
      expect(CommonSchemas.pagination.parse(validPagination)).toEqual(validPagination);
      expect(CommonSchemas.pagination.parse({})).toEqual({});

      expect(() => CommonSchemas.pagination.parse({ page: 0 })).toThrow();
      expect(() => CommonSchemas.pagination.parse({ per_page: 101 })).toThrow();
    });

    it('should validate issue number schema', () => {
      expect(CommonSchemas.issueNumber.parse({ issue_number: 123 })).toEqual({ issue_number: 123 });

      expect(() => CommonSchemas.issueNumber.parse({ issue_number: 0 })).toThrow();
      expect(() => CommonSchemas.issueNumber.parse({ issue_number: -1 })).toThrow();
      expect(() => CommonSchemas.issueNumber.parse({})).toThrow();
    });

    it('should validate state schema', () => {
      expect(CommonSchemas.state.parse({ state: 'open' })).toEqual({ state: 'open' });
      expect(CommonSchemas.state.parse({})).toEqual({});

      expect(() => CommonSchemas.state.parse({ state: 'invalid' })).toThrow();
    });
  });

  describe('combineSchemas', () => {
    it('should combine multiple schemas into one flat schema', () => {
      const schema1 = z.object({ name: z.string() });
      const schema2 = z.object({ age: z.number() });
      const schema3 = z.object({ email: z.string().optional() });

      const combinedSchema = combineSchemas({
        personal: schema1,
        demographics: schema2,
        contact: schema3,
      });

      const validInput = {
        name: 'John',
        age: 30,
        email: 'john@example.com',
      };

      const result = combinedSchema.parse(validInput);
      expect(result).toEqual({ name: 'John', age: 30, email: 'john@example.com' });
    });
  });

  describe('GitHubSchemas', () => {
    it('should validate getIssue schema', () => {
      const validParams = { owner: 'octocat', repo: 'Hello-World', issue_number: 123 };
      expect(GitHubSchemas.getIssue.parse(validParams)).toEqual(validParams);

      expect(() =>
        GitHubSchemas.getIssue.parse({ owner: 'octocat', repo: 'Hello-World' })
      ).toThrow();
    });

    it('should validate createIssue schema', () => {
      const validParams = {
        owner: 'octocat',
        repo: 'Hello-World',
        title: 'Bug report',
        body: 'Description',
        labels: ['bug', 'high-priority'],
      };
      expect(GitHubSchemas.createIssue.parse(validParams)).toEqual(validParams);

      expect(() =>
        GitHubSchemas.createIssue.parse({
          owner: 'octocat',
          repo: 'Hello-World',
          // missing required title
        })
      ).toThrow();
    });

    it('should validate listIssues schema with optional parameters', () => {
      const minimalParams = { owner: 'octocat', repo: 'Hello-World' };
      expect(GitHubSchemas.listIssues.parse(minimalParams)).toEqual(minimalParams);

      const fullParams = {
        owner: 'octocat',
        repo: 'Hello-World',
        page: 2,
        per_page: 50,
        state: 'open' as const,
        labels: ['bug'],
        sort: 'created',
        direction: 'desc' as const,
      };
      expect(GitHubSchemas.listIssues.parse(fullParams)).toEqual(fullParams);
    });
  });

  describe('TypeSafeHandlerFactory', () => {
    it('should create type-safe get issue handler', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ id: 123, title: 'Test Issue' });
      const typeSafeHandler = TypeSafeHandlerFactory.createGetIssueHandler(mockHandler);

      const validParams = { owner: 'octocat', repo: 'Hello-World', issue_number: 123 };
      const result = await typeSafeHandler(validParams);

      expect(mockHandler).toHaveBeenCalledWith(validParams);
      expect(result).toEqual({ id: 123, title: 'Test Issue' });
    });

    it('should create type-safe create issue handler', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ id: 124, number: 124 });
      const typeSafeHandler = TypeSafeHandlerFactory.createCreateIssueHandler(mockHandler);

      const validParams = {
        owner: 'octocat',
        repo: 'Hello-World',
        title: 'New Issue',
        body: 'Issue description',
      };
      const result = await typeSafeHandler(validParams);

      expect(mockHandler).toHaveBeenCalledWith(validParams);
      expect(result).toEqual({ id: 124, number: 124 });
    });

    it('should reject invalid parameters in factory-created handlers', async () => {
      const mockHandler = vi.fn();
      const typeSafeHandler = TypeSafeHandlerFactory.createGetIssueHandler(mockHandler);

      const invalidParams = { owner: 'octocat' }; // missing repo and issue_number

      await expect(typeSafeHandler(invalidParams)).rejects.toThrow(ParameterValidationError);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should create custom handler with custom schema', async () => {
      const customSchema = z.object({
        customField: z.string(),
        optionalField: z.number().optional(),
      });

      const mockHandler = vi.fn().mockResolvedValue({ processed: true });
      const typeSafeHandler = TypeSafeHandlerFactory.createCustomHandler(
        customSchema,
        mockHandler,
        'custom_tool'
      );

      const validParams = { customField: 'test', optionalField: 42 };
      const result = await typeSafeHandler(validParams);

      expect(mockHandler).toHaveBeenCalledWith(validParams);
      expect(result).toEqual({ processed: true });
    });
  });

  describe('validateParameters', () => {
    it('should validate and return parsed parameters', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const validParams = { name: 'John', age: 30 };
      const result = validateParameters(schema, validParams, 'test_tool');

      expect(result).toEqual(validParams);
    });

    it('should throw ParameterValidationError for invalid parameters', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const invalidParams = { name: 'John', age: 'thirty' };

      expect(() => validateParameters(schema, invalidParams, 'test_tool')).toThrow(
        ParameterValidationError
      );
    });
  });

  describe('Real-world GitHub API scenarios', () => {
    it('should handle complex issue creation with all optional fields', () => {
      const params = {
        owner: 'facebook',
        repo: 'react',
        title: 'Feature request: Add new hook',
        body: 'Detailed description of the feature request...',
        assignees: ['gaearon', 'sebmarkbage'],
        milestone: 42,
        labels: ['enhancement', 'good first issue'],
      };

      expect(() => GitHubSchemas.createIssue.parse(params)).not.toThrow();
    });

    it('should handle pull request creation with minimal required fields', () => {
      const params = {
        owner: 'microsoft',
        repo: 'vscode',
        title: 'Fix: Resolve syntax highlighting issue',
        head: 'feature/fix-highlighting',
        base: 'main',
      };

      expect(() => GitHubSchemas.createPullRequest.parse(params)).not.toThrow();
    });

    it('should handle repository search with complex filters', () => {
      const params = {
        q: 'language:typescript stars:>1000 created:>2020-01-01',
        page: 1,
        per_page: 25,
        sort: 'stars' as const,
        order: 'desc' as const,
      };

      expect(() => GitHubSchemas.searchRepositories.parse(params)).not.toThrow();
    });

    it('should reject malformed GitHub API parameters', () => {
      // Invalid issue number (must be positive)
      expect(() =>
        GitHubSchemas.getIssue.parse({
          owner: 'test',
          repo: 'test',
          issue_number: -1,
        })
      ).toThrow();

      // Invalid pagination (per_page too high)
      expect(() =>
        GitHubSchemas.listIssues.parse({
          owner: 'test',
          repo: 'test',
          per_page: 150,
        })
      ).toThrow();

      // Invalid state
      expect(() =>
        GitHubSchemas.listPullRequests.parse({
          owner: 'test',
          repo: 'test',
          state: 'invalid_state',
        })
      ).toThrow();
    });
  });

  describe('Error handling and debugging', () => {
    it('should provide detailed error messages for validation failures', async () => {
      const schema = z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        issue_number: z.number().int().min(1),
      });

      const handler = vi.fn();
      const typeSafeHandler = createTypeSafeHandler(schema, handler, 'get_issue');

      try {
        await typeSafeHandler({
          owner: '', // too short
          repo: 'test',
          issue_number: 0, // too small
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ParameterValidationError);
        expect((error as any).message).toContain('get_issue');
        expect((error as any).errors.issues).toHaveLength(2); // Two validation errors
      }
    });

    it('should preserve original Zod error details', async () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().int().min(0).max(120),
      });

      const handler = vi.fn();
      const typeSafeHandler = createTypeSafeHandler(schema, handler, 'test_tool');

      try {
        await typeSafeHandler({
          email: 'invalid-email',
          age: 150,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ParameterValidationError);
        expect((error as any).errors.issues).toHaveLength(2);

        const emailError = (error as any).errors.issues.find(
          (issue: any) => issue.path[0] === 'email'
        );
        const ageError = (error as any).errors.issues.find((issue: any) => issue.path[0] === 'age');

        expect(emailError.code).toBe('invalid_format');
        expect(ageError.code).toBe('too_big');
      }
    });
  });
});
