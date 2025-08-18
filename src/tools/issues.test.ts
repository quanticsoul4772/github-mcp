/**
 * Tests for issue tools
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createIssueTools } from './issues.js';
import { createMockOctokit, staticMockResponses } from '../__tests__/mocks/octokit.js';
import { testFixtures } from '../__tests__/fixtures/test-data.js';

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
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: issues });

      const result = await listIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
      });

      expect(mockOctokit.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
        labels: undefined,
        sort: undefined,
        direction: undefined,
        since: undefined,
        page: undefined,
        per_page: undefined,
      });

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Test Issue');
      expect(result[1].title).toBe('Closed Issue');
    });

    it('should handle filtering parameters', async () => {
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [] });

      await listIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'open',
        labels: ['bug', 'enhancement'],
      });

      expect(mockOctokit.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'open',
        labels: 'bug,enhancement',
        sort: undefined,
        direction: undefined,
        since: undefined,
        page: undefined,
        per_page: undefined,
      });
    });

    it('should handle pagination parameters', async () => {
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [] });

      await listIssues.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
        page: 2,
        perPage: 50,
      });

      expect(mockOctokit.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
        labels: undefined,
        sort: undefined,
        direction: undefined,
        since: undefined,
        page: 2,
        per_page: 50,
      });
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
      mockOctokit.issues.get.mockResolvedValue({
        data: testFixtures.issues.open,
      });

      const result = await getIssue.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
      });

      expect(mockOctokit.issues.get).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
      });

      expect(result.title).toBe('Test Issue');
      expect(result.body).toBe('This is a test issue for testing purposes.');
      expect(result.state).toBe('open');
    });

    it('should handle closed issue', async () => {
      mockOctokit.issues.get.mockResolvedValue({
        data: testFixtures.issues.closed,
      });

      const result = await getIssue.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 2,
      });

      expect(result.state).toBe('closed');
      expect(result.closed_at).toBeTruthy();
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
      const newIssue = { ...testFixtures.issues.open, number: 123, title: 'New Issue' };
      mockOctokit.issues.create.mockResolvedValue({ data: newIssue });

      const result = await createIssue.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'New Issue',
        body: 'Issue description',
      });

      expect(mockOctokit.issues.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'New Issue',
        body: 'Issue description',
        assignees: undefined,
        labels: undefined,
        milestone: undefined,
      });

      expect(result.number).toBe(123);
      expect(result.title).toBe('New Issue');
      expect(result.state).toBe('open');
    });

    it('should create issue with assignees and labels', async () => {
      const newIssue = testFixtures.issues.open;
      mockOctokit.issues.create.mockResolvedValue({ data: newIssue });

      await createIssue.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Assigned Issue',
        body: 'Issue with assignments',
        assignees: ['user1', 'user2'],
        labels: ['bug', 'priority-high'],
      });

      expect(mockOctokit.issues.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Assigned Issue',
        body: 'Issue with assignments',
        assignees: ['user1', 'user2'],
        labels: ['bug', 'priority-high'],
        milestone: undefined,
      });
    });

    it('should handle optional parameters', async () => {
      const newIssue = { ...testFixtures.issues.open, number: 456 };
      mockOctokit.issues.create.mockResolvedValue({ data: newIssue });

      const result = await createIssue.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Issue with milestone',
        body: 'Test',
        milestone: 1,
      });

      expect(mockOctokit.issues.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Issue with milestone',
        body: 'Test',
        assignees: undefined,
        labels: undefined,
        milestone: 1,
      });

      expect(result.number).toBe(456);
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
      const updatedIssue = { ...testFixtures.issues.open, title: 'Updated Title', state: 'closed' };
      mockOctokit.issues.update.mockResolvedValue({ data: updatedIssue });

      const result = await updateIssue.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        title: 'Updated Title',
        state: 'closed',
      });

      expect(mockOctokit.issues.update).toHaveBeenCalledWith({
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

      expect(result.title).toBe('Updated Title');
      expect(result.state).toBe('closed');
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

      mockOctokit.issues.listComments.mockResolvedValue({ data: comments });

      const result = await listComments.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
      });

      expect(mockOctokit.issues.listComments).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        page: undefined,
        per_page: undefined,
      });

      expect(result).toHaveLength(2);
      expect(result[0].body).toBe('First comment');
      expect(result[1].body).toBe('Second comment');
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

      mockOctokit.issues.createComment.mockResolvedValue({ data: newComment });

      const result = await createComment.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        body: 'New comment',
      });

      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        body: 'New comment',
      });

      expect(result.id).toBe(123);
      expect(result.body).toBe('New comment');
    });

    it('should handle comment with user info', async () => {
      const newComment = {
        id: 789,
        body: 'Comment with user',
        user: { login: 'test-user', type: 'User' },
        created_at: '2024-01-01T00:00:00Z',
      };

      mockOctokit.issues.createComment.mockResolvedValue({ data: newComment });

      const result = await createComment.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        body: 'Comment with user',
      });

      expect(result.user.login).toBe('test-user');
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

      mockOctokit.issues.updateComment.mockResolvedValue({ data: updatedComment });

      const result = await updateComment.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        comment_id: 123,
        body: 'Updated comment',
      });

      expect(mockOctokit.issues.updateComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        comment_id: 123,
        body: 'Updated comment',
      });

      expect(result.body).toBe('Updated comment');
      expect(result.id).toBe(123);
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
      mockOctokit.issues.deleteComment.mockResolvedValue({ status: 204 });

      const result = await deleteComment.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        comment_id: 123,
      });

      expect(mockOctokit.issues.deleteComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        comment_id: 123,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted');
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

      mockOctokit.issues.addLabels.mockResolvedValue({ data: labels });

      const result = await addLabels.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        labels: ['bug', 'enhancement'],
      });

      expect(mockOctokit.issues.addLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        labels: ['bug', 'enhancement'],
      });

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('bug');
      expect(result[1].name).toBe('enhancement');
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
      mockOctokit.issues.removeLabel.mockResolvedValue({ status: 200 });

      const result = await removeLabel.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        name: 'bug',
      });

      expect(mockOctokit.issues.removeLabel).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        name: 'bug',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('removed');
      expect(result.message).toContain('bug');
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
      mockOctokit.issues.lock.mockResolvedValue({ status: 204 });

      const result = await lockIssue.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        lock_reason: 'spam',
      });

      expect(mockOctokit.issues.lock).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
        lock_reason: 'spam',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('locked');
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
      mockOctokit.issues.unlock.mockResolvedValue({ status: 204 });

      const result = await unlockIssue.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
      });

      expect(mockOctokit.issues.unlock).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 1,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('unlocked');
    });
  });
});
