#!/usr/bin/env node

/**
 * Standalone demo of Phase 1 improvements
 * This demonstrates the new error handling without needing TypeScript compilation
 */

console.log('GitHub MCP Phase 1 Demo: Enhanced Error Messages');
console.log('=================================================\n');

// Simulate the enhanced parameter validation
class ParameterValidationError extends Error {
  constructor(toolName, expectedSchema, receivedParams, missingParams, invalidParams) {
    const lines = [`Parameter validation failed for ${toolName}:`];
    
    if (missingParams.length > 0) {
      lines.push(`\n❌ Missing required parameters: ${missingParams.join(', ')}`);
    }
    
    if (invalidParams.length > 0) {
      lines.push(`\n❌ Invalid parameters: ${invalidParams.join(', ')}`);
    }
    
    lines.push('\n📋 Expected parameters:');
    if (expectedSchema.properties) {
      Object.entries(expectedSchema.properties).forEach(([key, schema]) => {
        const required = expectedSchema.required?.includes(key) ? '(required)' : '(optional)';
        lines.push(`   • ${key}: ${schema.type} ${required} - ${schema.description || 'No description'}`);
      });
    }
    
    lines.push('\n📥 Received parameters:');
    lines.push(`   ${JSON.stringify(receivedParams, null, 2).replace(/\n/g, '\n   ')}`);
    
    lines.push('\n💡 Example usage:');
    lines.push(`   ${JSON.stringify(generateExample(toolName, expectedSchema), null, 2).replace(/\n/g, '\n   ')}`);
    
    super(lines.join('\n'));
    this.name = 'ParameterValidationError';
  }
}

function generateExample(toolName, schema) {
  const example = {};
  if (schema.properties) {
    Object.entries(schema.properties).forEach(([key, propSchema]) => {
      if (schema.required?.includes(key)) {
        switch (propSchema.type) {
          case 'string':
            example[key] = key === 'owner' ? 'octocat' : 
                          key === 'repo' ? 'hello-world' : 
                          `example_${key}`;
            break;
          case 'number':
            example[key] = key === 'issue_number' ? 42 : 1;
            break;
          case 'boolean':
            example[key] = false;
            break;
          default:
            example[key] = `<${propSchema.type}>`;
        }
      }
    });
  }
  return example;
}

// Define the schema for get_issue
const getIssueSchema = {
  type: 'object',
  properties: {
    owner: {
      type: 'string',
      description: 'The owner of the repository'
    },
    repo: {
      type: 'string',
      description: 'The name of the repository'
    },
    issue_number: {
      type: 'number',
      description: 'The number of the issue'
    }
  },
  required: ['owner', 'repo', 'issue_number']
};

console.log('BEFORE (Current GitHub MCP):');
console.log('----------------------------');
console.log('Error: [object Object]');
console.log('(No helpful information about what went wrong)\n');

console.log('AFTER (With Phase 1 Improvements):');
console.log('-----------------------------------\n');

// Demo 1: Missing parameters
console.log('Demo 1: User tries to get an issue but forgets parameters');
console.log('User input: { issueNumber: 42, repository: "octocat/hello-world" }\n');

const error1 = new ParameterValidationError(
  'get_issue',
  getIssueSchema,
  { issueNumber: 42, repository: "octocat/hello-world" },
  ['owner', 'repo'],
  ['issue_number (expected number, got undefined)']
);

console.log(error1.message);

console.log('\n' + '='.repeat(60) + '\n');

// Demo 2: Wrong parameter types
console.log('Demo 2: User provides wrong parameter types');
console.log('User input: { owner: "octocat", repo: "hello-world", issue_number: "42" }\n');

const error2 = new ParameterValidationError(
  'get_issue',
  getIssueSchema,
  { owner: "octocat", repo: "hello-world", issue_number: "42" },
  [],
  ['issue_number (expected number, got string)']
);

console.log(error2.message);

console.log('\n' + '='.repeat(60) + '\n');

// Demo help tool
console.log('Demo 3: Help Tool Output');
console.log('User query: get_tool_help({ tool_name: "get_issue" })\n');

const helpOutput = {
  name: 'get_issue',
  description: 'Get details of a specific GitHub issue',
  required_parameters: ['owner', 'repo', 'issue_number'],
  parameters: {
    owner: {
      type: 'string',
      description: 'The owner of the repository',
      required: true
    },
    repo: {
      type: 'string',
      description: 'The name of the repository',
      required: true
    },
    issue_number: {
      type: 'number',
      description: 'The number of the issue',
      required: true
    }
  },
  examples: [
    {
      description: 'Get issue #38 from quanticsoul4772/github-mcp',
      params: {
        owner: 'quanticsoul4772',
        repo: 'github-mcp',
        issue_number: 38
      }
    }
  ],
  parameter_aliases: {
    owner: ['owner', 'user', 'org', 'username'],
    repo: ['repo', 'repository', 'project', 'repo_name'],
    issue_number: ['issue_number', 'issueNumber', 'number', 'issue', 'id', 'issue_id']
  }
};

console.log(JSON.stringify(helpOutput, null, 2));

console.log('\n' + '='.repeat(60) + '\n');

console.log('✅ Phase 1 Complete: Summary');
console.log('-----------------------------');
console.log('1. ✅ Replaced [object Object] with detailed error messages');
console.log('2. ✅ Shows missing parameters clearly');
console.log('3. ✅ Shows type mismatches explicitly');
console.log('4. ✅ Provides working examples in errors');
console.log('5. ✅ Created help tool for parameter discovery');
console.log('6. ✅ Documents parameter aliases');
console.log('7. ✅ Accepts multiple parameter formats');
console.log('\nNo more guessing what went wrong!');
