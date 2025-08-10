/**
 * Tests for issue tools
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createIssueTools } from './issues.js';
import { createMockOctokit, mockResponses } from '../__tests__/mocks/octokit.js';
import { testFixtures } from '../__tests__/fixtures/test-data.js';
import { ValidationError } from '../validation.js';

describe('Issue Tools', () => {
  let mockOctokit: any;
  let tools: any[];

  beforeEach(() => {
    mockOctokit = createMockOctokit();
    tools = createIssueTools(mockOctokit, false);
  });

  describe('list_issues', () => {
    let listIssues: any;

    beforeEach(() => {
      listIssues = tools.find(tool => tool.tool.name === 'list_issues');
    });

    it('should be registered', () => {
      expect(listIssues).toBeDefined();
      expect(listIssues.tool.name).toBe('list_issues');
      expect(listIssues.tool.description).toContain('List issues');
    });

    it('should list repository issues successfully', async () => {
      const issues = [testFixtures.issues.open, testFixtures.issues.closed];
      mockOctokit.rest.issues.list.mockResolvedValue({ data: issues });

      const result = await listIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
      });

      expect(mockOctokit.rest.issues.list).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 30,
        page: 1,
      });

      expect(result).toContain('Test Issue');
      expect(result).toContain('Closed Issue');
    });

    it('should handle filtering parameters', async () => {
      mockOctokit.rest.issues.list.mockResolvedValue({ data: [] });

      await listIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'open',
        labels: 'bug,enhancement',
        assignee: 'test-user',
      });

      expect(mockOctokit.rest.issues.list).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'open',
        labels: 'bug,enhancement',
        assignee: 'test-user',
        sort: 'updated',
        direction: 'desc',
        per_page: 30,
        page: 1,
      });
    });

    it('should validate input parameters', async () => {
      await expect(
        listIssues.handler({ owner: '', repo: 'test-repo' })
      ).rejects.toThrow(ValidationError);

      await expect(
        listIssues.handler({ owner: 'test-owner', repo: '' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('get_issue', () => {
    let getIssue: any;

    beforeEach(() => {
      getIssue = tools.find(tool => tool.tool.name === 'get_issue');
    });

    it('should be registered', () => {
      expect(getIssue).toBeDefined();
      expect(getIssue.tool.name).toBe('get_issue');
    });

    it('should get issue details successfully', async () => {
      mockOctokit.rest.issues.get.mockResolvedValue({
        data: testFixtures.issues.open,
      });

      const result = await getIssue.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
      });

      expect(mockOctokit.rest.issues.get).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
      });

      expect(result).toContain('Test Issue');
      expect(result).toContain('This is a test issue');
    });

    it('should validate input parameters', async () => {
      await expect(
        getIssue.handler({ owner: '', repo: 'test-repo', issue_number: 1 })
      ).rejects.toThrow(ValidationError);

      await expect(
        getIssue.handler({ owner: 'test-owner', repo: 'test-repo', issue_number: -1 })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('create_issue', () => {
    let createIssue: any;

    beforeEach(() => {
      createIssue = tools.find(tool => tool.tool.name === 'create_issue');
    });

    it('should be registered when not in read-only mode', () => {
      expect(createIssue).toBeDefined();
      expect(createIssue.tool.name).toBe('create_issue');
    });

    it('should not be registered in read-only mode', () => {
      const readOnlyTools = createIssueTools(mockOctokit, true);
      const readOnlyTool = readOnlyTools.find(tool => tool.tool.name === 'create_issue');
      expect(readOnlyTool).toBeUndefined();
    });

    it('should create issue successfully', async () => {
      const newIssue = { ...testFixtures.issues.open, number: 123 };
      mockOctokit.rest.issues.create.mockResolvedValue({ data: newIssue });

      const result = await createIssue.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'New Issue',
        body: 'Issue description',
      });

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'New Issue',
        body: 'Issue description',
        assignees: undefined,
        labels: undefined,
        milestone: undefined,
      });

      expect(result).toContain('123');
      expect(result).toContain('New Issue');
    });

    it('should create issue with assignees and labels', async () => {
      const newIssue = testFixtures.issues.open;
      mockOctokit.rest.issues.create.mockResolvedValue({ data: newIssue });

      await createIssue.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Assigned Issue',
        body: 'Issue with assignments',
        assignees: ['user1', 'user2'],
        labels: ['bug', 'priority-high'],
      });

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Assigned Issue',
        body: 'Issue with assignments',
        assignees: ['user1', 'user2'],
        labels: ['bug', 'priority-high'],
        milestone: undefined,
      });
    });

    it('should validate input parameters', async () => {
      await expect(
        createIssue.handler({
          owner: '',
          repo: 'test-repo',
          title: 'Test',
          body: 'Test body',
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        createIssue.handler({
          owner: 'test-owner',
          repo: 'test-repo',
          title: '',
          body: 'Test body',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('update_issue', () => {
    let updateIssue: any;

    beforeEach(() => {
      updateIssue = tools.find(tool => tool.tool.name === 'update_issue');
    });

    it('should be registered when not in read-only mode', () => {
      expect(updateIssue).toBeDefined();
      expect(updateIssue.tool.name).toBe('update_issue');
    });

    it('should update issue successfully', async () => {
      const updatedIssue = { ...testFixtures.issues.open, title: 'Updated Title' };
      mockOctokit.rest.issues.update.mockResolvedValue({ data: updatedIssue });

      const result = await updateIssue.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        title: 'Updated Title',
        state: 'closed',
      });

      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        title: 'Updated Title',
        body: undefined,
        state: 'closed',
        assignees: undefined,
        labels: undefined,
        milestone: undefined,
      });

      expect(result).toContain('Updated Title');
    });
  });

  describe('list_issue_comments', () => {
    let listComments: any;

    beforeEach(() => {
      listComments = tools.find(tool => tool.tool.name === 'list_issue_comments');
    });

    it('should be registered', () => {
      expect(listComments).toBeDefined();
      expect(listComments.tool.name).toBe('list_issue_comments');
    });

    it('should list comments successfully', async () => {
      const comments = [
        {
          id: 1,
          body: 'First comment',
          user: { login: 'user1' },
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          body: 'Second comment',
          user: { login: 'user2' },
          created_at: '2024-01-01T12:00:00Z',
        },
      ];

      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: comments });

      const result = await listComments.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
      });

      expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        per_page: 30,
        page: 1,
      });

      expect(result).toContain('First comment');
      expect(result).toContain('Second comment');
    });
  });

  describe('create_issue_comment', () => {
    let createComment: any;

    beforeEach(() => {
      createComment = tools.find(tool => tool.tool.name === 'create_issue_comment');
    });

    it('should be registered when not in read-only mode', () => {
      expect(createComment).toBeDefined();
      expect(createComment.tool.name).toBe('create_issue_comment');
    });

    it('should create comment successfully', async () => {
      const newComment = {
        id: 123,
        body: 'New comment',
        user: { login: 'test-user' },
        created_at: '2024-01-01T00:00:00Z',
      };

      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: newComment });

      const result = await createComment.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        body: 'New comment',
      });

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        body: 'New comment',
      });

      expect(result).toContain('123');
      expect(result).toContain('New comment');
    });

    it('should validate input parameters', async () => {
      await expect(
        createComment.handler({
          owner: '',
          repo: 'test-repo',
          issue_number: 1,
          body: 'Comment',
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        createComment.handler({
          owner: 'test-owner',
          repo: 'test-repo',
          issue_number: 1,
          body: '',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('update_issue_comment', () => {
    let updateComment: any;

    beforeEach(() => {
      updateComment = tools.find(tool => tool.tool.name === 'update_issue_comment');
    });

    it('should be registered when not in read-only mode', () => {
      expect(updateComment).toBeDefined();
      expect(updateComment.tool.name).toBe('update_issue_comment');
    });

    it('should update comment successfully', async () => {
      const updatedComment = {
        id: 123,
        body: 'Updated comment',
        user: { login: 'test-user' },
        updated_at: '2024-01-01T12:00:00Z',
      };

      mockOctokit.rest.issues.updateComment.mockResolvedValue({ data: updatedComment });

      const result = await updateComment.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        comment_id: 123,
        body: 'Updated comment',
      });

      expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        comment_id: 123,
        body: 'Updated comment',
      });

      expect(result).toContain('Updated comment');
    });
  });

  describe('delete_issue_comment', () => {
    let deleteComment: any;

    beforeEach(() => {
      deleteComment = tools.find(tool => tool.tool.name === 'delete_issue_comment');
    });

    it('should be registered when not in read-only mode', () => {
      expect(deleteComment).toBeDefined();
      expect(deleteComment.tool.name).toBe('delete_issue_comment');
    });

    it('should delete comment successfully', async () => {
      mockOctokit.rest.issues.deleteComment.mockResolvedValue({ status: 204 });

      const result = await deleteComment.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        comment_id: 123,
      });

      expect(mockOctokit.rest.issues.deleteComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        comment_id: 123,
      });

      expect(result).toContain('deleted');
    });
  });

  describe('add_issue_labels', () => {
    let addLabels: any;

    beforeEach(() => {
      addLabels = tools.find(tool => tool.tool.name === 'add_issue_labels');
    });

    it('should be registered when not in read-only mode', () => {
      expect(addLabels).toBeDefined();
      expect(addLabels.tool.name).toBe('add_issue_labels');
    });

    it('should add labels successfully', async () => {
      const labels = [
        { name: 'bug', color: 'ff0000' },
        { name: 'enhancement', color: '00ff00' },
      ];

      mockOctokit.rest.issues.addLabels.mockResolvedValue({ data: labels });

      const result = await addLabels.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        labels: ['bug', 'enhancement'],
      });

      expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        labels: ['bug', 'enhancement'],
      });

      expect(result).toContain('bug');
      expect(result).toContain('enhancement');
    });
  });

  describe('remove_issue_label', () => {
    let removeLabel: any;

    beforeEach(() => {
      removeLabel = tools.find(tool => tool.tool.name === 'remove_issue_label');
    });

    it('should be registered when not in read-only mode', () => {
      expect(removeLabel).toBeDefined();
      expect(removeLabel.tool.name).toBe('remove_issue_label');
    });

    it('should remove label successfully', async () => {
      mockOctokit.rest.issues.removeLabel.mockResolvedValue({ status: 200 });

      const result = await removeLabel.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        name: 'bug',
      });

      expect(mockOctokit.rest.issues.removeLabel).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        name: 'bug',
      });

      expect(result).toContain('removed');
      expect(result).toContain('bug');
    });
  });

  describe('lock_issue', () => {
    let lockIssue: any;

    beforeEach(() => {
      lockIssue = tools.find(tool => tool.tool.name === 'lock_issue');
    });

    it('should be registered when not in read-only mode', () => {
      expect(lockIssue).toBeDefined();
      expect(lockIssue.tool.name).toBe('lock_issue');
    });

    it('should lock issue successfully', async () => {
      mockOctokit.rest.issues.lock.mockResolvedValue({ status: 204 });

      const result = await lockIssue.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        lock_reason: 'spam',
      });

      expect(mockOctokit.rest.issues.lock).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        lock_reason: 'spam',
      });

      expect(result).toContain('locked');
    });
  });

  describe('unlock_issue', () => {
    let unlockIssue: any;

    beforeEach(() => {
      unlockIssue = tools.find(tool => tool.tool.name === 'unlock_issue');
    });

    it('should be registered when not in read-only mode', () => {
      expect(unlockIssue).toBeDefined();
      expect(unlockIssue.tool.name).toBe('unlock_issue');
    });

    it('should unlock issue successfully', async () => {
      mockOctokit.rest.issues.unlock.mockResolvedValue({ status: 204 });

      const result = await unlockIssue.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
      });

      expect(mockOctokit.rest.issues.unlock).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
      });

      expect(result).toContain('unlocked');
    });
  });
});