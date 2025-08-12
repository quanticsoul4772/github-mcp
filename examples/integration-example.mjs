/**
 * Example integration of parameter validation with existing GitHub MCP tools
 * This shows how to wrap existing tool handlers with our validation
 */

import { withParameterValidation } from '../build/validation/parameter-validation.js';

// Example of wrapping the existing get_issue handler
export function wrapIssueTools(originalTools) {
  return originalTools.map(tool => {
    // Only wrap tools we have schemas for
    const wrappedHandler = withParameterValidation(
      tool.tool.name,
      tool.handler
    );
    
    return {
      ...tool,
      handler: wrappedHandler
    };
  });
}

// Example usage in index.ts:
/*
// Original code:
const issueTools = createIssueTools(octokit, readOnly);

// With validation:
const issueTools = wrapIssueTools(createIssueTools(octokit, readOnly));
*/

// Example of what happens with bad parameters:
async function demonstrateImprovement() {
  console.log('=== Before: Unhelpful Error ===');
  console.log('Calling get_issue with wrong parameters...');
  console.log('Parameters: { wrong: "params", foo: "bar" }');
  console.log('Error: [object Object]');
  console.log('');
  
  console.log('=== After: Helpful Error ===');
  console.log('Calling get_issue with wrong parameters...');
  console.log('Parameters: { wrong: "params", foo: "bar" }');
  console.log(`
Parameter validation failed for get_issue:
  Missing required: owner, repo, issue_number
  Expected format: {
    "owner": "quanticsoul4772",
    "repo": "github-mcp",
    "issue_number": 38
  }
  
  Received: {
    "wrong": "params",
    "foo": "bar"
  }
  
  Required parameters: owner, repo, issue_number
  Optional parameters: none
  `);
  
  console.log('=== Multiple Format Support ===');
  console.log('All of these now work:');
  console.log('1. { owner: "quanticsoul4772", repo: "github-mcp", issue_number: 38 }');
  console.log('2. { repository: "quanticsoul4772/github-mcp", issue_number: 38 }');
  console.log('3. { owner: "quanticsoul4772", repo: "github-mcp", issueNumber: 38 }');
  console.log('4. { project: "quanticsoul4772/github-mcp", number: 38 }');
}

demonstrateImprovement();
