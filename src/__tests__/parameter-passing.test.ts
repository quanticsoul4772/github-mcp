import { describe, it, expect, beforeAll, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ToolRegistry } from '../tool-registry.js';
import { ToolConfig } from '../types.js';

describe('Parameter Passing Tests', () => {
  let mockServer: any;
  let registry: ToolRegistry;
  let registeredTools: Map<string, any>;

  beforeAll(() => {
    // Create a mock MCP server that captures tool registrations
    registeredTools = new Map();
    
    mockServer = {
      tool: vi.fn((name: string, description: string, schemaOrHandler: any, handlerOrUndefined?: any) => {
        const hasSchema = typeof schemaOrHandler !== 'function';
        const handler = hasSchema ? handlerOrUndefined : schemaOrHandler;
        const schema = hasSchema ? schemaOrHandler : null;
        
        registeredTools.set(name, {
          name,
          description,
          schema,
          handler
        });
      })
    };

    // Create mock dependencies
    const mockOctokit = {} as any;
    const mockOptimizedClient = {} as any;
    const mockReliabilityManager = {} as any;
    const mockHealthManager = {} as any;
    const mockRateLimiter = {} as any;
    
    registry = new ToolRegistry(
      mockServer,
      mockOctokit,
      mockOptimizedClient,
      mockReliabilityManager,
      mockHealthManager,
      mockRateLimiter,
      false
    );
  });

  it('should register tools with no parameters correctly', async () => {
    const testTool: ToolConfig = {
      tool: {
        name: 'no_params_tool',
        description: 'Tool with no parameters',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      handler: async (args: any) => {
        return { received: args, success: true };
      }
    };

    registry.registerTool(testTool);
    
    const registered = registeredTools.get('no_params_tool');
    expect(registered).toBeDefined();
    expect(registered.schema).toBeNull(); // No schema for no-params tools
    
    // Test calling the handler
    const result = await registered.handler();
    expect(result.content[0].text).toContain('"success": true');
  });

  it('should register tools with required parameters correctly', async () => {
    const testTool: ToolConfig = {
      tool: {
        name: 'required_params_tool',
        description: 'Tool with required parameters',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Owner name' },
            repo: { type: 'string', description: 'Repository name' }
          },
          required: ['owner', 'repo']
        }
      },
      handler: async (args: any) => {
        return { 
          receivedOwner: args.owner,
          receivedRepo: args.repo,
          success: true 
        };
      }
    };

    registry.registerTool(testTool);
    
    const registered = registeredTools.get('required_params_tool');
    expect(registered).toBeDefined();
    expect(registered.schema).toBeDefined();
    expect(registered.schema.owner).toBeDefined();
    expect(registered.schema.repo).toBeDefined();
    
    // Test calling the handler with parameters
    const testParams = { owner: 'test-owner', repo: 'test-repo' };
    const result = await registered.handler(testParams);
    expect(result.content[0].text).toContain('"receivedOwner": "test-owner"');
    expect(result.content[0].text).toContain('"receivedRepo": "test-repo"');
  });

  it('should register tools with optional parameters correctly', async () => {
    const testTool: ToolConfig = {
      tool: {
        name: 'optional_params_tool',
        description: 'Tool with optional parameters',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'number', description: 'Result limit', minimum: 1, maximum: 100 },
            sort: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order' }
          },
          required: ['query']
        }
      },
      handler: async (args: any) => {
        return { 
          receivedQuery: args.query,
          receivedLimit: args.limit || 'not provided',
          receivedSort: args.sort || 'not provided',
          success: true 
        };
      }
    };

    registry.registerTool(testTool);
    
    const registered = registeredTools.get('optional_params_tool');
    expect(registered).toBeDefined();
    expect(registered.schema).toBeDefined();
    expect(registered.schema.query).toBeDefined();
    expect(registered.schema.limit).toBeDefined();
    expect(registered.schema.sort).toBeDefined();
    
    // Test with all parameters
    const fullParams = { query: 'test', limit: 10, sort: 'desc' };
    const result1 = await registered.handler(fullParams);
    expect(result1.content[0].text).toContain('"receivedQuery": "test"');
    expect(result1.content[0].text).toContain('"receivedLimit": 10');
    expect(result1.content[0].text).toContain('"receivedSort": "desc"');
    
    // Test with only required parameters
    const minParams = { query: 'test' };
    const result2 = await registered.handler(minParams);
    expect(result2.content[0].text).toContain('"receivedQuery": "test"');
    expect(result2.content[0].text).toContain('"receivedLimit": "not provided"');
  });

  it('should handle undefined/null parameters gracefully', async () => {
    const testTool: ToolConfig = {
      tool: {
        name: 'defensive_tool',
        description: 'Tool that handles undefined gracefully',
        inputSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' }
          }
        }
      },
      handler: async (args: any) => {
        return { 
          argsType: typeof args,
          argsIsNull: args === null,
          argsIsUndefined: args === undefined,
          hasValue: args?.value || 'no value',
          success: true 
        };
      }
    };

    registry.registerTool(testTool);
    
    const registered = registeredTools.get('defensive_tool');
    expect(registered).toBeDefined();
    
    // Test with undefined (converted to empty object by our fix)
    const result1 = await registered.handler(undefined);
    expect(result1.content[0].text).toContain('"argsType": "object"');
    expect(result1.content[0].text).toContain('"hasValue": "no value"');
    
    // Test with null (converted to empty object by our fix)
    const result2 = await registered.handler(null);
    expect(result2.content[0].text).toContain('"argsType": "object"');
    
    // Test with empty object
    const result3 = await registered.handler({});
    expect(result3.content[0].text).toContain('"argsType": "object"');
    expect(result3.content[0].text).toContain('"hasValue": "no value"');
    
    // Test with proper value
    const result4 = await registered.handler({ value: 'test' });
    expect(result4.content[0].text).toContain('"hasValue": "test"');
  });

  it('should convert JSON schema types to Zod correctly', async () => {
    const testTool: ToolConfig = {
      tool: {
        name: 'type_conversion_tool',
        description: 'Tool to test type conversions',
        inputSchema: {
          type: 'object',
          properties: {
            stringProp: { type: 'string' },
            numberProp: { type: 'number', minimum: 0, maximum: 100 },
            boolProp: { type: 'boolean' },
            enumProp: { type: 'string', enum: ['option1', 'option2', 'option3'] },
            arrayProp: { type: 'array', items: { type: 'string' } },
            objectProp: { type: 'object' }
          }
        }
      },
      handler: async (args: any) => args
    };

    registry.registerTool(testTool);
    
    const registered = registeredTools.get('type_conversion_tool');
    expect(registered).toBeDefined();
    expect(registered.schema).toBeDefined();
    
    // Verify each type was converted to Zod
    const schema = registered.schema;
    expect(schema.stringProp).toBeDefined();
    expect(schema.numberProp).toBeDefined();
    expect(schema.boolProp).toBeDefined();
    expect(schema.enumProp).toBeDefined();
    expect(schema.arrayProp).toBeDefined();
    expect(schema.objectProp).toBeDefined();
  });
});