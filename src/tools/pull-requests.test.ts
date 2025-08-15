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
      mockOctokit.pulls.list.mockResolvedValue({ data: prs });

      const result = await listPRs.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
      });

      expect(mockOctokit.pulls.list).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
        head: undefined,
        base: undefined,
        sort: undefined,
        direction: undefined,
        page: undefined,
        per_page: undefined,
      });

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Add new feature');
      expect(result[1].title).toBe('Fix bug');
    });

    it('should handle filtering parameters', async () => {
      mockOctokit.pulls.list.mockResolvedValue({ data: [] });

      await listPRs.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'open',
        base: 'main',
        head: 'feature-branch',
      });

      expect(mockOctokit.pulls.list).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'open',
        head: 'feature-branch',
        base: 'main',
        sort: undefined,
        direction: undefined,
        page: undefined,
        per_page: undefined,
      });
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
      mockOctokit.pulls.get.mockResolvedValue({
        data: testFixtures.pullRequests.open,
      });

      const result = await getPR.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
      });

      expect(mockOctokit.pulls.get).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
      });

      expect(result.title).toBe('Add new feature');
      expect(result.state).toBe('open');
      expect(result.head.ref).toBe('feature-branch');
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
      const newPR = { ...testFixtures.pullRequests.open, number: 123, title: 'New Feature PR' };
      mockOctokit.pulls.create.mockResolvedValue({ data: newPR });

      const result = await createPR.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'New Feature PR',
        body: 'This adds a new feature',
        head: 'feature-branch',
        base: 'main',
      });

      expect(mockOctokit.pulls.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'New Feature PR',
        body: 'This adds a new feature',
        head: 'feature-branch',
        base: 'main',
        draft: undefined,
        maintainer_can_modify: undefined,
      });

      expect(result.number).toBe(123);
      expect(result.title).toBe('New Feature PR');
    });

    it('should create draft pull request', async () => {
      const newPR = { ...testFixtures.pullRequests.open, draft: true };
      mockOctokit.pulls.create.mockResolvedValue({ data: newPR });

      await createPR.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Draft PR',
        head: 'feature-branch',
        base: 'main',
        draft: true,
      });

      expect(mockOctokit.pulls.create).toHaveBeenCalledWith({
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
      const updatedPR = { ...testFixtures.pullRequests.open, title: 'Updated Title', state: 'closed' };
      mockOctokit.pulls.update.mockResolvedValue({ data: updatedPR });

      const result = await updatePR.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        title: 'Updated Title',
        state: 'closed',
      });

      expect(mockOctokit.pulls.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        title: 'Updated Title',
        body: undefined,
        state: 'closed',
        base: undefined,
        maintainer_can_modify: undefined,
      });

      expect(result.title).toBe('Updated Title');
      expect(result.state).toBe('closed');
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
      mockOctokit.pulls.merge.mockResolvedValue({ data: mergeResult });

      const result = await mergePR.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        commit_title: 'Merge feature',
        merge_method: 'merge',
      });

      expect(mockOctokit.pulls.merge).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        commit_title: 'Merge feature',
        commit_message: undefined,
        merge_method: 'merge',
        sha: undefined,
      });

      expect(result.merged).toBe(true);
      expect(result.sha).toBe('merged-sha-123');
      expect(result.message).toBe('Pull request merged successfully');
    });

    it('should handle different merge methods', async () => {
      const mergeResult = { merged: true, sha: 'squash-sha-123' };
      mockOctokit.pulls.merge.mockResolvedValue({ data: mergeResult });

      await mergePR.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        merge_method: 'squash',
      });

      expect(mockOctokit.pulls.merge).toHaveBeenCalledWith({
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

      mockOctokit.pulls.listFiles.mockResolvedValue({ data: files });

      const result = await listFiles.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
      });

      expect(mockOctokit.pulls.listFiles).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        per_page: undefined,
        page: undefined,
      });

      expect(result).toHaveLength(2);
      expect(result[0].filename).toBe('src/index.ts');
      expect(result[0].status).toBe('modified');
      expect(result[1].filename).toBe('README.md');
      expect(result[1].status).toBe('added');
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

      mockOctokit.pulls.createReview.mockResolvedValue({ data: review });

      const result = await createReview.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        body: 'Looks good!',
        event: 'APPROVE',
      });

      expect(mockOctokit.pulls.createReview).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        body: 'Looks good!',
        event: 'APPROVE',
        comments: undefined,
      });

      expect(result.state).toBe('APPROVED');
      expect(result.body).toBe('Looks good!');
    });

    it('should create review with comments', async () => {
      const review = { id: 123, state: 'COMMENTED' };
      mockOctokit.pulls.createReview.mockResolvedValue({ data: review });

      const result = await createReview.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        body: 'Review with inline comments',
        event: 'COMMENT',
      });

      expect(mockOctokit.pulls.createReview).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        body: 'Review with inline comments',
        event: 'COMMENT',
        commit_id: undefined,
      });
      
      expect(result.id).toBe(123);
      expect(result.state).toBe('COMMENTED');
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

      mockOctokit.pulls.listReviews.mockResolvedValue({ data: reviews });

      const result = await listReviews.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
      });

      expect(mockOctokit.pulls.listReviews).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
      });

      expect(result).toHaveLength(2);
      expect(result[0].state).toBe('APPROVED');
      expect(result[0].user.login).toBe('reviewer1');
      expect(result[1].state).toBe('CHANGES_REQUESTED');
      expect(result[1].user.login).toBe('reviewer2');
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

      mockOctokit.pulls.dismissReview.mockResolvedValue({ data: dismissedReview });

      const result = await dismissReview.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        review_id: 123,
        message: 'No longer relevant',
      });

      expect(mockOctokit.pulls.dismissReview).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        review_id: 123,
        message: 'No longer relevant',
      });

      expect(result.state).toBe('DISMISSED');
      expect(result.id).toBe(123);
      expect(result.body).toBe('Original review');
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

      mockOctokit.pulls.createReviewComment.mockResolvedValue({ data: comment });

      const result = await createReviewComment.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        body: 'This looks problematic',
        commit_id: 'abc123',
        path: 'src/index.ts',
        line: 25,
      });

      expect(mockOctokit.pulls.createReviewComment).toHaveBeenCalledWith({
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

      expect(result.body).toBe('This looks problematic');
      expect(result.path).toBe('src/index.ts');
      expect(result.line).toBe(25);
      expect(result.user.login).toBe('reviewer');
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

      mockOctokit.pulls.listReviewComments.mockResolvedValue({ data: comments });

      const result = await listComments.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
      });

      expect(mockOctokit.pulls.listReviewComments).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
      });

      expect(result).toHaveLength(2);
      expect(result[0].body).toBe('Good improvement');
      expect(result[0].path).toBe('src/index.ts');
      expect(result[0].line).toBe(10);
      expect(result[1].body).toBe('Consider using const here');
      expect(result[1].path).toBe('src/utils.ts');
      expect(result[1].line).toBe(5);
    });
  });
});