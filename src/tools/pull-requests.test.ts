/**
 * Tests for pull request tools
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPullRequestTools } from './pull-requests.js';
import { createMockOctokit } from '../__tests__/mocks/octokit.js';
import { testFixtures } from '../__tests__/fixtures/test-data.js';
import { ValidationError } from '../validation.js';

describe('Pull Request Tools', () => {
  let mockOctokit: any;
  let tools: any[];

  beforeEach(() => {
    mockOctokit = createMockOctokit();
    tools = createPullRequestTools(mockOctokit, false);
  });

  describe('list_pull_requests', () => {
    let listPRs: any;

    beforeEach(() => {
      listPRs = tools.find(tool => tool.tool.name === 'list_pull_requests');
    });

    it('should be registered', () => {
      expect(listPRs).toBeDefined();
      expect(listPRs.tool.name).toBe('list_pull_requests');
    });

    it('should list pull requests successfully', async () => {
      const prs = [testFixtures.pullRequests.open, testFixtures.pullRequests.merged];
      mockOctokit.rest.pulls.list.mockResolvedValue({ data: prs });

      const result = await listPRs.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
      });

      expect(mockOctokit.rest.pulls.list).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 30,
        page: 1,
      });

      expect(result).toContain('Add new feature');
      expect(result).toContain('Fix bug');
    });

    it('should handle filtering parameters', async () => {
      mockOctokit.rest.pulls.list.mockResolvedValue({ data: [] });

      await listPRs.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'open',
        base: 'main',
        head: 'feature-branch',
      });

      expect(mockOctokit.rest.pulls.list).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'open',
        base: 'main',
        head: 'feature-branch',
        sort: 'updated',
        direction: 'desc',
        per_page: 30,
        page: 1,
      });
    });

    it('should validate input parameters', async () => {
      await expect(
        listPRs.handler({ owner: '', repo: 'test-repo' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('get_pull_request', () => {
    let getPR: any;

    beforeEach(() => {
      getPR = tools.find(tool => tool.tool.name === 'get_pull_request');
    });

    it('should be registered', () => {
      expect(getPR).toBeDefined();
      expect(getPR.tool.name).toBe('get_pull_request');
    });

    it('should get pull request details successfully', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: testFixtures.pullRequests.open,
      });

      const result = await getPR.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
      });

      expect(mockOctokit.rest.pulls.get).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
      });

      expect(result).toContain('Add new feature');
      expect(result).toContain('feature-branch');
    });

    it('should validate input parameters', async () => {
      await expect(
        getPR.handler({ owner: '', repo: 'test-repo', pull_number: 1 })
      ).rejects.toThrow(ValidationError);

      await expect(
        getPR.handler({ owner: 'test-owner', repo: 'test-repo', pull_number: -1 })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('create_pull_request', () => {
    let createPR: any;

    beforeEach(() => {
      createPR = tools.find(tool => tool.tool.name === 'create_pull_request');
    });

    it('should be registered when not in read-only mode', () => {
      expect(createPR).toBeDefined();
      expect(createPR.tool.name).toBe('create_pull_request');
    });

    it('should not be registered in read-only mode', () => {
      const readOnlyTools = createPullRequestTools(mockOctokit, true);
      const readOnlyTool = readOnlyTools.find(tool => tool.tool.name === 'create_pull_request');
      expect(readOnlyTool).toBeUndefined();
    });

    it('should create pull request successfully', async () => {
      const newPR = { ...testFixtures.pullRequests.open, number: 123 };
      mockOctokit.rest.pulls.create.mockResolvedValue({ data: newPR });

      const result = await createPR.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'New Feature PR',
        body: 'This adds a new feature',
        head: 'feature-branch',
        base: 'main',
      });

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'New Feature PR',
        body: 'This adds a new feature',
        head: 'feature-branch',
        base: 'main',
        draft: undefined,
        maintainer_can_modify: undefined,
      });

      expect(result).toContain('123');
      expect(result).toContain('New Feature PR');
    });

    it('should create draft pull request', async () => {
      const newPR = { ...testFixtures.pullRequests.open, draft: true };
      mockOctokit.rest.pulls.create.mockResolvedValue({ data: newPR });

      await createPR.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Draft PR',
        head: 'feature-branch',
        base: 'main',
        draft: true,
      });

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Draft PR',
        body: undefined,
        head: 'feature-branch',
        base: 'main',
        draft: true,
        maintainer_can_modify: undefined,
      });
    });

    it('should validate input parameters', async () => {
      await expect(
        createPR.handler({
          owner: '',
          repo: 'test-repo',
          title: 'Test',
          head: 'feature',
          base: 'main',
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        createPR.handler({
          owner: 'owner',
          repo: 'test-repo',
          title: '',
          head: 'feature',
          base: 'main',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('update_pull_request', () => {
    let updatePR: any;

    beforeEach(() => {
      updatePR = tools.find(tool => tool.tool.name === 'update_pull_request');
    });

    it('should be registered when not in read-only mode', () => {
      expect(updatePR).toBeDefined();
      expect(updatePR.tool.name).toBe('update_pull_request');
    });

    it('should update pull request successfully', async () => {
      const updatedPR = { ...testFixtures.pullRequests.open, title: 'Updated Title' };
      mockOctokit.rest.pulls.update.mockResolvedValue({ data: updatedPR });

      const result = await updatePR.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        title: 'Updated Title',
        state: 'closed',
      });

      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        title: 'Updated Title',
        body: undefined,
        state: 'closed',
        base: undefined,
        maintainer_can_modify: undefined,
      });

      expect(result).toContain('Updated Title');
    });
  });

  describe('merge_pull_request', () => {
    let mergePR: any;

    beforeEach(() => {
      mergePR = tools.find(tool => tool.tool.name === 'merge_pull_request');
    });

    it('should be registered when not in read-only mode', () => {
      expect(mergePR).toBeDefined();
      expect(mergePR.tool.name).toBe('merge_pull_request');
    });

    it('should merge pull request successfully', async () => {
      const mergeResult = {
        merged: true,
        sha: 'merged-sha-123',
        message: 'Pull request merged successfully',
      };
      mockOctokit.rest.pulls.merge.mockResolvedValue({ data: mergeResult });

      const result = await mergePR.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        commit_title: 'Merge feature',
        merge_method: 'merge',
      });

      expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        commit_title: 'Merge feature',
        commit_message: undefined,
        merge_method: 'merge',
        sha: undefined,
      });

      expect(result).toContain('merged successfully');
      expect(result).toContain('merged-sha-123');
    });

    it('should handle different merge methods', async () => {
      const mergeResult = { merged: true, sha: 'squash-sha-123' };
      mockOctokit.rest.pulls.merge.mockResolvedValue({ data: mergeResult });

      await mergePR.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        merge_method: 'squash',
      });

      expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        commit_title: undefined,
        commit_message: undefined,
        merge_method: 'squash',
        sha: undefined,
      });
    });
  });

  describe('list_pull_request_files', () => {
    let listFiles: any;

    beforeEach(() => {
      listFiles = tools.find(tool => tool.tool.name === 'list_pull_request_files');
    });

    it('should be registered', () => {
      expect(listFiles).toBeDefined();
      expect(listFiles.tool.name).toBe('list_pull_request_files');
    });

    it('should list PR files successfully', async () => {
      const files = [
        {
          filename: 'src/index.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          changes: 15,
          patch: '@@ -1,3 +1,4 @@\n+import { test } from "./test";',
        },
        {
          filename: 'README.md',
          status: 'added',
          additions: 20,
          deletions: 0,
          changes: 20,
        },
      ];

      mockOctokit.rest.pulls.listFiles.mockResolvedValue({ data: files });

      const result = await listFiles.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
      });

      expect(mockOctokit.rest.pulls.listFiles).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        per_page: 30,
        page: 1,
      });

      expect(result).toContain('src/index.ts');
      expect(result).toContain('README.md');
      expect(result).toContain('modified');
      expect(result).toContain('added');
    });
  });

  describe('create_pull_request_review', () => {
    let createReview: any;

    beforeEach(() => {
      createReview = tools.find(tool => tool.tool.name === 'create_pull_request_review');
    });

    it('should be registered when not in read-only mode', () => {
      expect(createReview).toBeDefined();
      expect(createReview.tool.name).toBe('create_pull_request_review');
    });

    it('should create review successfully', async () => {
      const review = {
        id: 123,
        state: 'APPROVED',
        body: 'Looks good!',
        user: { login: 'reviewer' },
      };

      mockOctokit.rest.pulls.createReview.mockResolvedValue({ data: review });

      const result = await createReview.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        body: 'Looks good!',
        event: 'APPROVE',
      });

      expect(mockOctokit.rest.pulls.createReview).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        body: 'Looks good!',
        event: 'APPROVE',
        comments: undefined,
      });

      expect(result).toContain('APPROVED');
      expect(result).toContain('Looks good!');
    });

    it('should create review with comments', async () => {
      const review = { id: 123, state: 'COMMENTED' };
      mockOctokit.rest.pulls.createReview.mockResolvedValue({ data: review });

      const comments = [
        {
          path: 'src/index.ts',
          line: 10,
          body: 'Consider adding error handling here',
        },
      ];

      await createReview.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        event: 'COMMENT',
        comments,
      });

      expect(mockOctokit.rest.pulls.createReview).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        body: undefined,
        event: 'COMMENT',
        comments,
      });
    });
  });

  describe('list_pull_request_reviews', () => {
    let listReviews: any;

    beforeEach(() => {
      listReviews = tools.find(tool => tool.tool.name === 'list_pull_request_reviews');
    });

    it('should be registered', () => {
      expect(listReviews).toBeDefined();
      expect(listReviews.tool.name).toBe('list_pull_request_reviews');
    });

    it('should list reviews successfully', async () => {
      const reviews = [
        {
          id: 1,
          state: 'APPROVED',
          body: 'LGTM',
          user: { login: 'reviewer1' },
          submitted_at: '2024-01-01T12:00:00Z',
        },
        {
          id: 2,
          state: 'CHANGES_REQUESTED',
          body: 'Please fix the issues',
          user: { login: 'reviewer2' },
          submitted_at: '2024-01-02T12:00:00Z',
        },
      ];

      mockOctokit.rest.pulls.listReviews.mockResolvedValue({ data: reviews });

      const result = await listReviews.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
      });

      expect(mockOctokit.rest.pulls.listReviews).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        per_page: 30,
        page: 1,
      });

      expect(result).toContain('APPROVED');
      expect(result).toContain('CHANGES_REQUESTED');
      expect(result).toContain('reviewer1');
      expect(result).toContain('reviewer2');
    });
  });

  describe('dismiss_pull_request_review', () => {
    let dismissReview: any;

    beforeEach(() => {
      dismissReview = tools.find(tool => tool.tool.name === 'dismiss_pull_request_review');
    });

    it('should be registered when not in read-only mode', () => {
      expect(dismissReview).toBeDefined();
      expect(dismissReview.tool.name).toBe('dismiss_pull_request_review');
    });

    it('should dismiss review successfully', async () => {
      const dismissedReview = {
        id: 123,
        state: 'DISMISSED',
        body: 'Original review',
      };

      mockOctokit.rest.pulls.dismissReview.mockResolvedValue({ data: dismissedReview });

      const result = await dismissReview.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        review_id: 123,
        message: 'No longer relevant',
      });

      expect(mockOctokit.rest.pulls.dismissReview).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        review_id: 123,
        message: 'No longer relevant',
      });

      expect(result).toContain('DISMISSED');
    });
  });

  describe('create_pull_request_review_comment', () => {
    let createReviewComment: any;

    beforeEach(() => {
      createReviewComment = tools.find(tool => tool.tool.name === 'create_pull_request_review_comment');
    });

    it('should be registered when not in read-only mode', () => {
      expect(createReviewComment).toBeDefined();
      expect(createReviewComment.tool.name).toBe('create_pull_request_review_comment');
    });

    it('should create review comment successfully', async () => {
      const comment = {
        id: 456,
        body: 'This looks problematic',
        path: 'src/index.ts',
        line: 25,
        user: { login: 'reviewer' },
      };

      mockOctokit.rest.pulls.createReviewComment.mockResolvedValue({ data: comment });

      const result = await createReviewComment.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        body: 'This looks problematic',
        commit_id: 'abc123',
        path: 'src/index.ts',
        line: 25,
      });

      expect(mockOctokit.rest.pulls.createReviewComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        body: 'This looks problematic',
        commit_id: 'abc123',
        path: 'src/index.ts',
        line: 25,
        side: undefined,
        start_line: undefined,
        start_side: undefined,
      });

      expect(result).toContain('This looks problematic');
      expect(result).toContain('src/index.ts');
    });
  });

  describe('list_pull_request_comments', () => {
    let listComments: any;

    beforeEach(() => {
      listComments = tools.find(tool => tool.tool.name === 'list_pull_request_comments');
    });

    it('should be registered', () => {
      expect(listComments).toBeDefined();
      expect(listComments.tool.name).toBe('list_pull_request_comments');
    });

    it('should list review comments successfully', async () => {
      const comments = [
        {
          id: 1,
          body: 'Good improvement',
          path: 'src/index.ts',
          line: 10,
          user: { login: 'reviewer1' },
        },
        {
          id: 2,
          body: 'Consider using const here',
          path: 'src/utils.ts',
          line: 5,
          user: { login: 'reviewer2' },
        },
      ];

      mockOctokit.rest.pulls.listComments.mockResolvedValue({ data: comments });

      const result = await listComments.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
      });

      expect(mockOctokit.rest.pulls.listComments).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        sort: 'created',
        direction: 'asc',
        per_page: 30,
        page: 1,
      });

      expect(result).toContain('Good improvement');
      expect(result).toContain('Consider using const');
      expect(result).toContain('src/index.ts');
      expect(result).toContain('src/utils.ts');
    });
  });
});