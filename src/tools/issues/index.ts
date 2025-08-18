import { ToolConfig } from '../../types.js';
import { IIssueService } from '../../foundation/interfaces.js';
import { createGetIssueTool } from './get-issue-tool.js';
import { createListIssuesTool } from './list-issues-tool.js';

/**
 * Factory function to create all issue-related tools
 * This demonstrates the new modular approach where:
 * 1. Each tool is in its own file
 * 2. Tools use dependency injection to get services
 * 3. Common patterns are extracted to base classes
 */
export function createIssueToolsModular(
  octokit: any,
  issueService: IIssueService,
  readOnly: boolean
): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // Read-only tools (always available)
  tools.push(createGetIssueTool(octokit, issueService));
  tools.push(createListIssuesTool(octokit, issueService));

  // Write tools (only when not in read-only mode)
  if (!readOnly) {
    // TODO: Add create, update, close issue tools
    // These would follow the same pattern:
    // tools.push(createCreateIssueTool(octokit, issueService));
    // tools.push(createUpdateIssueTool(octokit, issueService));
    // tools.push(createCloseIssueTool(octokit, issueService));
  }

  return tools;
}
