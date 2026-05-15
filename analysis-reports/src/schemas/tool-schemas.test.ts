/**
 * Tests for tool-schemas: getToolSchema, getToolHelp, listAllTools, generateToolDocumentation
 */
import { describe, it, expect } from 'vitest';
import {
  ISSUE_TOOL_SCHEMAS,
  PR_TOOL_SCHEMAS,
  REPO_TOOL_SCHEMAS,
  ALL_TOOL_SCHEMAS,
  getToolSchema,
  getToolHelp,
  listAllTools,
  generateToolDocumentation,
} from './tool-schemas.js';

describe('tool-schemas', () => {
  describe('schema constants', () => {
    it('ISSUE_TOOL_SCHEMAS should have at least one entry', () => {
      expect(Object.keys(ISSUE_TOOL_SCHEMAS).length).toBeGreaterThan(0);
    });

    it('PR_TOOL_SCHEMAS should have at least one entry', () => {
      expect(Object.keys(PR_TOOL_SCHEMAS).length).toBeGreaterThan(0);
    });

    it('REPO_TOOL_SCHEMAS should have at least one entry', () => {
      expect(Object.keys(REPO_TOOL_SCHEMAS).length).toBeGreaterThan(0);
    });

    it('ALL_TOOL_SCHEMAS should combine all schemas', () => {
      const allCount = Object.keys(ALL_TOOL_SCHEMAS).length;
      expect(allCount).toBeGreaterThanOrEqual(
        Object.keys(ISSUE_TOOL_SCHEMAS).length +
          Object.keys(PR_TOOL_SCHEMAS).length +
          Object.keys(REPO_TOOL_SCHEMAS).length
      );
    });

    it('each schema should have required fields', () => {
      for (const [, schema] of Object.entries(ISSUE_TOOL_SCHEMAS)) {
        expect(schema.name).toBeDefined();
        expect(schema.properties).toBeDefined();
        expect(Array.isArray(schema.required)).toBe(true);
        expect(Array.isArray(schema.examples)).toBe(true);
      }
    });
  });

  describe('getToolSchema', () => {
    it('should return schema for a known tool', () => {
      const toolName = Object.keys(ALL_TOOL_SCHEMAS)[0];
      const schema = getToolSchema(toolName);
      expect(schema).toBeDefined();
      expect(schema!.name).toBe(toolName);
    });

    it('should return undefined for unknown tool', () => {
      expect(getToolSchema('nonexistent_tool_xyz')).toBeUndefined();
    });
  });

  describe('getToolHelp', () => {
    it('should return unknown message for missing tool', () => {
      const help = getToolHelp('no_such_tool');
      expect(help).toBe('Unknown tool: no_such_tool');
    });

    it('should return help text containing tool name for known tool', () => {
      const toolName = Object.keys(ALL_TOOL_SCHEMAS)[0];
      const help = getToolHelp(toolName);
      expect(help).toContain(toolName);
      expect(typeof help).toBe('string');
      expect(help.length).toBeGreaterThan(0);
    });

    it('should include required parameters section when tool has required params', () => {
      // find a tool with required params
      const entry = Object.entries(ALL_TOOL_SCHEMAS).find(
        ([, s]) => s.required.length > 0
      );
      if (entry) {
        const [toolName] = entry;
        const help = getToolHelp(toolName);
        expect(help).toContain('Required parameters:');
      }
    });

    it('should include examples section when tool has examples', () => {
      const entry = Object.entries(ALL_TOOL_SCHEMAS).find(
        ([, s]) => s.examples.length > 0
      );
      if (entry) {
        const [toolName] = entry;
        const help = getToolHelp(toolName);
        expect(help).toContain('Examples:');
      }
    });

    it('should include optional parameters section when tool has optional params', () => {
      // find a tool where some props are not in required
      const entry = Object.entries(ALL_TOOL_SCHEMAS).find(([, s]) => {
        const optionalCount = Object.keys(s.properties).filter(
          k => !s.required.includes(k)
        ).length;
        return optionalCount > 0;
      });
      if (entry) {
        const [toolName] = entry;
        const help = getToolHelp(toolName);
        expect(help).toContain('Optional parameters:');
      }
    });
  });

  describe('listAllTools', () => {
    it('should return an array of strings', () => {
      const tools = listAllTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      expect(typeof tools[0]).toBe('string');
    });

    it('should match ALL_TOOL_SCHEMAS keys', () => {
      const tools = listAllTools();
      const expected = Object.keys(ALL_TOOL_SCHEMAS);
      expect(tools).toEqual(expected);
    });
  });

  describe('generateToolDocumentation', () => {
    it('should return a non-empty string', () => {
      const doc = generateToolDocumentation();
      expect(typeof doc).toBe('string');
      expect(doc.length).toBeGreaterThan(0);
    });

    it('should contain tool reference header', () => {
      const doc = generateToolDocumentation();
      expect(doc).toContain('# GitHub MCP Tool Reference');
    });

    it('should contain Issues section', () => {
      const doc = generateToolDocumentation();
      expect(doc).toContain('Issues');
    });

    it('should contain Pull Requests section', () => {
      const doc = generateToolDocumentation();
      expect(doc).toContain('Pull Requests');
    });

    it('should contain Repositories section', () => {
      const doc = generateToolDocumentation();
      expect(doc).toContain('Repositories');
    });
  });
});
