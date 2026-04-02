/**
 * Tests for GitHubClient — octokit wrapper
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubClient } from './github-client.js';

const makeOctokit = () => ({
  repos: {
    get: vi.fn(),
    getContent: vi.fn(),
    createOrUpdateFileContents: vi.fn(),
    deleteFile: vi.fn(),
  },
  issues: {
    listForRepo: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  pulls: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
});

describe('GitHubClient', () => {
  let mockOctokit: ReturnType<typeof makeOctokit>;
  let client: GitHubClient;

  beforeEach(() => {
    mockOctokit = makeOctokit();
    client = new GitHubClient(mockOctokit as any);
  });

  describe('getRepository', () => {
    it('should return repository data', async () => {
      mockOctokit.repos.get.mockResolvedValue({ data: { name: 'my-repo' } });
      const result = await client.getRepository('owner', 'my-repo');
      expect(mockOctokit.repos.get).toHaveBeenCalledWith({ owner: 'owner', repo: 'my-repo' });
      expect(result.name).toBe('my-repo');
    });
  });

  describe('getFileContents', () => {
    it('should get file contents', async () => {
      mockOctokit.repos.getContent.mockResolvedValue({ data: { content: 'base64==' } });
      const result = await client.getFileContents('owner', 'repo', 'src/index.ts');
      expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', path: 'src/index.ts' });
      expect(result.content).toBe('base64==');
    });

    it('should pass ref when provided', async () => {
      mockOctokit.repos.getContent.mockResolvedValue({ data: {} });
      await client.getFileContents('owner', 'repo', 'file.ts', 'main');
      expect(mockOctokit.repos.getContent).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'main' })
      );
    });
  });

  describe('createFile', () => {
    it('should create a file with base64 content', async () => {
      mockOctokit.repos.createOrUpdateFileContents.mockResolvedValue({ data: { commit: { sha: 'abc' } } });
      const result = await client.createFile('owner', 'repo', 'new.ts', 'hello', 'Add file');
      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({
          content: Buffer.from('hello').toString('base64'),
          message: 'Add file',
        })
      );
      expect(result.commit.sha).toBe('abc');
    });
  });

  describe('updateFile', () => {
    it('should update file with base64 content and sha', async () => {
      mockOctokit.repos.createOrUpdateFileContents.mockResolvedValue({ data: { commit: { sha: 'new-sha' } } });
      const result = await client.updateFile('owner', 'repo', 'file.ts', 'content', 'Update', 'old-sha');
      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({
          sha: 'old-sha',
          content: Buffer.from('content').toString('base64'),
        })
      );
      expect(result.commit.sha).toBe('new-sha');
    });

    it('should pass branch when provided', async () => {
      mockOctokit.repos.createOrUpdateFileContents.mockResolvedValue({ data: {} });
      await client.updateFile('owner', 'repo', 'file.ts', 'content', 'Update', 'sha', 'main');
      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'main' })
      );
    });
  });

  describe('deleteFile', () => {
    it('should delete file with sha', async () => {
      mockOctokit.repos.deleteFile.mockResolvedValue({ data: { commit: { sha: 'del-sha' } } });
      const result = await client.deleteFile('owner', 'repo', 'file.ts', 'Remove file', 'file-sha');
      expect(mockOctokit.repos.deleteFile).toHaveBeenCalledWith(
        expect.objectContaining({ sha: 'file-sha', message: 'Remove file' })
      );
      expect(result.commit.sha).toBe('del-sha');
    });

    it('should pass branch when provided', async () => {
      mockOctokit.repos.deleteFile.mockResolvedValue({ data: {} });
      await client.deleteFile('owner', 'repo', 'file.ts', 'Delete', 'sha', 'feature-branch');
      expect(mockOctokit.repos.deleteFile).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'feature-branch' })
      );
    });
  });

  describe('listIssues', () => {
    it('should list issues with options', async () => {
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [{ number: 1 }] });
      const result = await client.listIssues('owner', 'repo', { state: 'open' });
      expect(mockOctokit.issues.listForRepo).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', state: 'open' });
      expect(result).toHaveLength(1);
    });
  });

  describe('getIssue', () => {
    it('should get an issue by number', async () => {
      mockOctokit.issues.get.mockResolvedValue({ data: { number: 5 } });
      const result = await client.getIssue('owner', 'repo', 5);
      expect(mockOctokit.issues.get).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', issue_number: 5 });
      expect(result.number).toBe(5);
    });
  });

  describe('createIssue', () => {
    it('should create an issue', async () => {
      mockOctokit.issues.create.mockResolvedValue({ data: { number: 10, title: 'New' } });
      const result = await client.createIssue('owner', 'repo', { title: 'New' });
      expect(result.number).toBe(10);
    });
  });

  describe('updateIssue', () => {
    it('should update an issue', async () => {
      mockOctokit.issues.update.mockResolvedValue({ data: { number: 3, state: 'closed' } });
      const result = await client.updateIssue('owner', 'repo', 3, { state: 'closed' });
      expect(mockOctokit.issues.update).toHaveBeenCalledWith(
        expect.objectContaining({ issue_number: 3, state: 'closed' })
      );
      expect(result.state).toBe('closed');
    });
  });

  describe('listPullRequests', () => {
    it('should list pull requests', async () => {
      mockOctokit.pulls.list.mockResolvedValue({ data: [{ number: 1 }, { number: 2 }] });
      const result = await client.listPullRequests('owner', 'repo', { state: 'open' });
      expect(result).toHaveLength(2);
    });
  });

  describe('getPullRequest', () => {
    it('should get a pull request by number', async () => {
      mockOctokit.pulls.get.mockResolvedValue({ data: { number: 7 } });
      const result = await client.getPullRequest('owner', 'repo', 7);
      expect(mockOctokit.pulls.get).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', pull_number: 7 });
      expect(result.number).toBe(7);
    });
  });

  describe('createPullRequest', () => {
    it('should create a pull request', async () => {
      mockOctokit.pulls.create.mockResolvedValue({ data: { number: 20 } });
      const result = await client.createPullRequest('owner', 'repo', { title: 'PR' });
      expect(result.number).toBe(20);
    });
  });

  describe('updatePullRequest', () => {
    it('should update a pull request', async () => {
      mockOctokit.pulls.update.mockResolvedValue({ data: { number: 5, state: 'closed' } });
      const result = await client.updatePullRequest('owner', 'repo', 5, { state: 'closed' });
      expect(mockOctokit.pulls.update).toHaveBeenCalledWith(
        expect.objectContaining({ pull_number: 5, state: 'closed' })
      );
      expect(result.state).toBe('closed');
    });
  });
});
