/**
 * Tests for the modular issues tools (issues/ subdirectory)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCreateIssueTool } from './create-issue-tool.js';
import { createGetIssueTool } from './get-issue-tool.js';
import { createListIssuesTool } from './list-issues-tool.js';
import { createUpdateIssueTool } from './update-issue-tool.js';
import { createCloseIssueTool } from './close-issue-tool.js';

const makeIssue = (number = 1) => ({
  number,
  title: `Issue ${number}`,
  state: 'open',
  body: 'Issue body',
  user: { login: 'user1', type: 'User' },
  labels: [{ name: 'bug' }, { name: 'help wanted' }],
  assignees: [{ login: 'assignee1', type: 'User' }],
  milestone: { title: 'v1.0', number: 1, state: 'open' },
  comments: 3,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  closed_at: null,
  html_url: `https://github.com/owner/repo/issues/${number}`,
});

const makeIssueService = () => ({
  listIssues: vi.fn(),
  getIssue: vi.fn(),
  createIssue: vi.fn(),
  updateIssue: vi.fn(),
});

const makeOctokit = () => ({});

describe('Modular Issues Tools', () => {
  let mockOctokit: ReturnType<typeof makeOctokit>;
  let mockIssueService: ReturnType<typeof makeIssueService>;

  beforeEach(() => {
    mockOctokit = makeOctokit();
    mockIssueService = makeIssueService();
  });

  // ============================================================================
  // create_issue
  // ============================================================================

  describe('create_issue', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = createCreateIssueTool(mockOctokit, mockIssueService);
      expect(tool.tool.name).toBe('create_issue');
      handler = tool.handler;
    });

    it('should create an issue', async () => {
      mockIssueService.createIssue.mockResolvedValue(makeIssue(42));

      const result = (await handler({
        owner: 'owner',
        repo: 'repo',
        title: 'New bug',
        body: 'Description',
        labels: ['bug'],
        assignees: ['user1'],
      })) as any;

      expect(mockIssueService.createIssue).toHaveBeenCalledWith('owner', 'repo', {
        title: 'New bug',
        body: 'Description',
        labels: ['bug'],
        assignees: ['user1'],
        milestone: undefined,
      });
      expect(result.number).toBe(42);
      expect(result.title).toBe('Issue 42');
      expect(result.state).toBe('open');
    });

    it('should throw on missing required fields', async () => {
      await expect(handler({ owner: 'owner', repo: 'repo' })).rejects.toBeDefined();
    });

    it('should throw on missing owner', async () => {
      await expect(handler({ repo: 'repo', title: 'Test' })).rejects.toBeDefined();
    });
  });

  // ============================================================================
  // get_issue
  // ============================================================================

  describe('get_issue', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = createGetIssueTool(mockOctokit, mockIssueService);
      expect(tool.tool.name).toBe('get_issue');
      handler = tool.handler;
    });

    it('should get an issue', async () => {
      mockIssueService.getIssue.mockResolvedValue(makeIssue(5));

      const result = (await handler({ owner: 'owner', repo: 'repo', issue_number: 5 })) as any;
      expect(mockIssueService.getIssue).toHaveBeenCalledWith('owner', 'repo', 5);
      expect(result.number).toBe(5);
      expect(result.labels).toEqual(['bug', 'help wanted']);
      expect(result.assignees).toHaveLength(1);
      expect(result.milestone.title).toBe('v1.0');
    });

    it('should handle null user/milestone', async () => {
      const bare = { ...makeIssue(1), user: null, milestone: null, assignees: [] };
      mockIssueService.getIssue.mockResolvedValue(bare);

      const result = (await handler({ owner: 'owner', repo: 'repo', issue_number: 1 })) as any;
      expect(result.user).toBeNull();
      expect(result.milestone).toBeNull();
      expect(result.assignees).toHaveLength(0);
    });

    it('should handle string labels', async () => {
      const withStrLabels = { ...makeIssue(1), labels: ['bug', 'feature'] };
      mockIssueService.getIssue.mockResolvedValue(withStrLabels);

      const result = (await handler({ owner: 'owner', repo: 'repo', issue_number: 1 })) as any;
      expect(result.labels).toEqual(['bug', 'feature']);
    });
  });

  // ============================================================================
  // list_issues
  // ============================================================================

  describe('list_issues', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = createListIssuesTool(mockOctokit, mockIssueService);
      expect(tool.tool.name).toBe('list_issues');
      handler = tool.handler;
    });

    it('should list issues', async () => {
      mockIssueService.listIssues.mockResolvedValue([makeIssue(1), makeIssue(2)]);

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any[];
      expect(mockIssueService.listIssues).toHaveBeenCalledWith('owner', 'repo', expect.any(Object));
      expect(result).toHaveLength(2);
      expect(result[0].number).toBe(1);
    });

    it('should pass filter options', async () => {
      mockIssueService.listIssues.mockResolvedValue([]);

      await handler({ owner: 'owner', repo: 'repo', state: 'closed', labels: ['bug'], sort: 'updated', direction: 'asc', per_page: 50 });
      expect(mockIssueService.listIssues).toHaveBeenCalledWith(
        'owner',
        'repo',
        expect.objectContaining({ state: 'closed', labels: ['bug'], sort: 'updated', direction: 'asc', per_page: 50 })
      );
    });
  });

  // ============================================================================
  // update_issue
  // ============================================================================

  describe('update_issue', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = createUpdateIssueTool(mockOctokit, mockIssueService);
      expect(tool.tool.name).toBe('update_issue');
      handler = tool.handler;
    });

    it('should update an issue', async () => {
      const updated = { ...makeIssue(3), title: 'Updated title', state: 'closed', closed_at: '2024-03-01T00:00:00Z' };
      mockIssueService.updateIssue.mockResolvedValue(updated);

      const result = (await handler({
        owner: 'owner',
        repo: 'repo',
        issue_number: 3,
        title: 'Updated title',
        state: 'closed',
      })) as any;

      expect(mockIssueService.updateIssue).toHaveBeenCalledWith(
        'owner', 'repo', 3,
        expect.objectContaining({ title: 'Updated title', state: 'closed' })
      );
      expect(result.title).toBe('Updated title');
      expect(result.state).toBe('closed');
    });

    it('should only include defined fields in update data', async () => {
      mockIssueService.updateIssue.mockResolvedValue(makeIssue(1));

      await handler({ owner: 'owner', repo: 'repo', issue_number: 1, title: 'New title' });
      const callArgs = mockIssueService.updateIssue.mock.calls[0][3];
      expect(callArgs).toHaveProperty('title', 'New title');
      expect(callArgs).not.toHaveProperty('body');
      expect(callArgs).not.toHaveProperty('state');
    });
  });

  // ============================================================================
  // close_issue
  // ============================================================================

  describe('close_issue', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = createCloseIssueTool(mockOctokit, mockIssueService);
      expect(tool.tool.name).toBe('close_issue');
      handler = tool.handler;
    });

    it('should close an issue', async () => {
      const closed = { ...makeIssue(7), state: 'closed', closed_at: '2024-02-01T00:00:00Z' };
      mockIssueService.updateIssue.mockResolvedValue(closed);

      const result = (await handler({ owner: 'owner', repo: 'repo', issue_number: 7 })) as any;
      expect(mockIssueService.updateIssue).toHaveBeenCalledWith(
        'owner', 'repo', 7,
        expect.objectContaining({ state: 'closed' })
      );
      expect(result.state).toBe('closed');
    });

    it('should include state_reason when provided', async () => {
      const closed = { ...makeIssue(7), state: 'closed', closed_at: '2024-02-01T00:00:00Z' };
      mockIssueService.updateIssue.mockResolvedValue(closed);

      await handler({ owner: 'owner', repo: 'repo', issue_number: 7, state_reason: 'completed' });
      expect(mockIssueService.updateIssue).toHaveBeenCalledWith(
        'owner', 'repo', 7,
        expect.objectContaining({ state: 'closed', state_reason: 'completed' })
      );
    });

    it('should NOT include state_reason when not provided', async () => {
      mockIssueService.updateIssue.mockResolvedValue(makeIssue(1));

      await handler({ owner: 'owner', repo: 'repo', issue_number: 1 });
      const callArgs = mockIssueService.updateIssue.mock.calls[0][3];
      expect(callArgs).not.toHaveProperty('state_reason');
    });
  });
});
