#!/usr/bin/env node
/**
 * Test the Phase 2 help tool functionality
 */

import { TOOL_SCHEMAS, getToolHelp } from './src/validation/parameter-validation.js';

console.log('=== Phase 2: Tool Discovery Test ===\n');

// Test 1: Get help for all tools
console.log('1. Getting list of all tools:');
const allTools = getToolHelp();
console.log(`   Total tools with schemas: ${Object.keys(allTools).length}`);
console.log('   Available tools:', Object.keys(allTools).join(', '));
console.log('');

// Test 2: Get help for specific tool
console.log('2. Getting help for get_issue:');
const issueHelp = getToolHelp('get_issue');
console.log('   Description:', issueHelp.description);
console.log('   Required:', issueHelp.required);
console.log('   Optional:', issueHelp.optional);
console.log('   Example:', JSON.stringify(issueHelp.example));
console.log('');

// Test 3: Get help for unknown tool
console.log('3. Getting help for unknown tool:');
const unknownHelp = getToolHelp('fake_tool');
console.log('   Result:', unknownHelp);
console.log('');

// Test 4: Show parameter aliases work
console.log('4. Parameter aliases for get_issue:');
const schema = TOOL_SCHEMAS.get_issue;
console.log('   Aliases:', JSON.stringify(schema.aliases, null, 2));
console.log('   This means all these work:');
console.log('   - issue_number: 42');
console.log('   - issueNumber: 42');
console.log('   - number: 42');
console.log('   - issue: 42');
