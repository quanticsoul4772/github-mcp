/**
 * Tests for createIssueToolsModular (issues/index.ts)
 */
import { describe, it, expect, vi } from 'vitest';
import { createIssueToolsModular } from './index.js';

const makeIssueService = () => ({
  listIssues: vi.fn(),
  getIssue: vi.fn(),
  createIssue: vi.fn(),
  updateIssue: vi.fn(),
});

const toolNames = (tools: { tool: { name: string } }[]) => tools.map(t => t.tool.name);

describe('createIssueToolsModular', () => {
  it('should return read-only tools when readOnly is true', () => {
    const service = makeIssueService();
    const tools = createIssueToolsModular({} as any, service as any, true);
    const names = toolNames(tools);
    expect(names).toContain('get_issue');
    expect(names).toContain('list_issues');
    expect(names).not.toContain('create_issue');
    expect(names).not.toContain('update_issue');
    expect(names).not.toContain('close_issue');
  });

  it('should return all tools when readOnly is false', () => {
    const service = makeIssueService();
    const tools = createIssueToolsModular({} as any, service as any, false);
    const names = toolNames(tools);
    expect(names).toContain('get_issue');
    expect(names).toContain('list_issues');
    expect(names).toContain('create_issue');
    expect(names).toContain('update_issue');
    expect(names).toContain('close_issue');
  });

  it('should return 2 tools in read-only mode', () => {
    const service = makeIssueService();
    const tools = createIssueToolsModular({} as any, service as any, true);
    expect(tools).toHaveLength(2);
  });

  it('should return 5 tools in write mode', () => {
    const service = makeIssueService();
    const tools = createIssueToolsModular({} as any, service as any, false);
    expect(tools).toHaveLength(5);
  });
});
