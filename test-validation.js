#!/usr/bin/env node

/**
 * Test script to demonstrate enhanced parameter validation
 * Run with: node test-validation.js
 */

import { ParameterValidationError, parameterValidator } from '../src/errors-enhanced.js';
import { getToolSchema, getToolHelp, listAllTools } from '../src/schemas/tool-schemas.js';

console.log('='.repeat(60));
console.log('GitHub MCP Parameter Validation Test');
console.log('='.repeat(60));

// Test 1: Wrong parameter names
console.log('\nTest 1: Wrong parameter names');
console.log('-'.repeat(40));

try {
  const schema = getToolSchema('get_issue');
  const wrongParams = {
    issueNumber: 42,  // Should be issue_number
    repository: 'quanticsoul4772/github-mcp'  // Should be owner and repo
  };
  
  console.log('Attempting with wrong params:', wrongParams);
  
  throw new ParameterValidationError('get_issue', schema.properties, wrongParams);
} catch (error) {
  if (error instanceof ParameterValidationError) {
    console.log('\nError message:');
    console.log(error.message);
  }
}

// Test 2: Parameter normalization
console.log('\n' + '='.repeat(60));
console.log('\nTest 2: Parameter normalization');
console.log('-'.repeat(40));

const schema = getToolSchema('get_issue');
const variations = [
  { issueNumber: 42, owner: 'quanticsoul4772', repo: 'github-mcp' },
  { issue_number: 42, owner: 'quanticsoul4772', repo: 'github-mcp' },
  { number: 42, repository: 'quanticsoul4772/github-mcp' },
  { issue: 42, repo: 'quanticsoul4772/github-mcp' }
];

console.log('Testing different parameter variations:');
for (const params of variations) {
  console.log('\nOriginal:', JSON.stringify(params));
  const normalized = parameterValidator.normalizeParameters(
    params,
    { properties: schema.properties, required: schema.required }
  );
  console.log('Normalized:', JSON.stringify(normalized));
}

// Test 3: Get help for tools
console.log('\n' + '='.repeat(60));
console.log('\nTest 3: Tool help');
console.log('-'.repeat(40));

const helpText = getToolHelp('get_issue');
console.log(helpText);

// Test 4: List all available tools
console.log('\n' + '='.repeat(60));
console.log('\nTest 4: Available tools');
console.log('-'.repeat(40));

const tools = listAllTools();
console.log('Available GitHub MCP tools:');
tools.forEach(tool => console.log(`  - ${tool}`));

// Test 5: Type coercion
console.log('\n' + '='.repeat(60));
console.log('\nTest 5: Type coercion');
console.log('-'.repeat(40));

const stringNumberParams = {
  owner: 'quanticsoul4772',
  repo: 'github-mcp',
  issue_number: '42'  // String instead of number
};

console.log('Original params with string number:', stringNumberParams);
const normalizedWithCoercion = parameterValidator.normalizeParameters(
  stringNumberParams,
  { properties: schema.properties, required: schema.required }
);
console.log('After normalization and coercion:', normalizedWithCoercion);
console.log('Type of issue_number:', typeof normalizedWithCoercion.issue_number);

console.log('\n' + '='.repeat(60));
console.log('Test completed!');
console.log('='.repeat(60));
