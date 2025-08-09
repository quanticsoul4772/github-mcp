/**
 * Tests for repository tools
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRepositoryTools } from './repositories.js';
import { createMockOctokit, mockResponses } from '../__tests__/mocks/octokit.js';
import { ValidationError } from '../validation.js';

describe('Repository Tools', () => {
  let mockOctokit: any;
  let tools: any[];

  beforeEach(() => {
    mockOctokit = createMockOctokit();
    tools = createRepositoryTools(mockOctokit, false);
  });

  describe('get_file_contents', () => {
    let getFileContents: any;

    beforeEach(() => {
      getFileContents = tools.find(tool => tool.tool.name === 'get_file_contents');
    });

    it('should be registered', () => {
      expect(getFileContents).toBeDefined();
      expect(getFileContents.tool.name).toBe('get_file_contents');
      expect(getFileContents.tool.description).toContain('Get file or directory contents');
    });

    it('should validate input parameters', async () => {
      await expect(
        getFileContents.handler({ owner: '', repo: 'test-repo', path: 'README.md' })
      ).rejects.toThrow(ValidationError);

      await expect(
        getFileContents.handler({ owner: 'test-owner', repo: '', path: 'README.md' })
      ).rejects.toThrow(ValidationError);
    });

    it('should get file contents successfully', async () => {
      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: mockResponses.fileContent,
      });

      const result = await getFileContents.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'README.md',
      });

      expect(mockOctokit.rest.repos.getContent).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'README.md',
        ref: undefined,
      });

      expect(result).toContain('Test file content');
    });

    it('should handle directory contents', async () => {
      const directoryContent = [
        { name: 'file1.txt', type: 'file' },
        { name: 'subdir', type: 'dir' },
      ];

      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: directoryContent,
      });

      const result = await getFileContents.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'src/',
      });

      expect(result).toContain('file1.txt');
      expect(result).toContain('subdir');
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.repos.getContent.mockRejectedValue(
        new Error('File not found')
      );

      await expect(
        getFileContents.handler({
          owner: 'test-owner',
          repo: 'test-repo',
          path: 'nonexistent.txt',
        })
      ).rejects.toThrow('File not found');
    });
  });

  describe('list_repositories', () => {
    let listRepos: any;

    beforeEach(() => {
      listRepos = tools.find(tool => tool.tool.name === 'list_repositories');
    });

    it('should be registered', () => {
      expect(listRepos).toBeDefined();
      expect(listRepos.tool.name).toBe('list_repositories');
    });

    it('should list repositories successfully', async () => {
      const repositories = [mockResponses.repo];
      mockOctokit.rest.repos.listForAuthenticatedUser.mockResolvedValue({
        data: repositories,
      });

      const result = await listRepos.handler({ visibility: 'all' });

      expect(mockOctokit.rest.repos.listForAuthenticatedUser).toHaveBeenCalledWith({
        visibility: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 30,
        page: 1,
      });

      expect(result).toContain('test-repo');
    });

    it('should handle pagination parameters', async () => {
      mockOctokit.rest.repos.listForAuthenticatedUser.mockResolvedValue({
        data: [mockResponses.repo],
      });

      await listRepos.handler({ page: 2, perPage: 50 });

      expect(mockOctokit.rest.repos.listForAuthenticatedUser).toHaveBeenCalledWith({
        visibility: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 50,
        page: 2,
      });
    });
  });

  describe('get_repository', () => {
    let getRepo: any;

    beforeEach(() => {
      getRepo = tools.find(tool => tool.tool.name === 'get_repository');
    });

    it('should be registered', () => {
      expect(getRepo).toBeDefined();
      expect(getRepo.tool.name).toBe('get_repository');
    });

    it('should get repository details successfully', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: mockResponses.repo,
      });

      const result = await getRepo.handler({
        owner: 'test-owner',
        repo: 'test-repo',
      });

      expect(mockOctokit.rest.repos.get).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
      });

      expect(result).toContain('test-repo');
      expect(result).toContain('Test repository');
    });

    it('should validate input parameters', async () => {
      await expect(
        getRepo.handler({ owner: '', repo: 'test-repo' })
      ).rejects.toThrow(ValidationError);

      await expect(
        getRepo.handler({ owner: 'test-owner', repo: '' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('create_or_update_file', () => {
    let createUpdateFile: any;

    beforeEach(() => {
      createUpdateFile = tools.find(tool => tool.tool.name === 'create_or_update_file');
    });

    it('should be registered when not in read-only mode', () => {
      expect(createUpdateFile).toBeDefined();
      expect(createUpdateFile.tool.name).toBe('create_or_update_file');
    });

    it('should not be registered in read-only mode', () => {
      const readOnlyTools = createRepositoryTools(mockOctokit, true);
      const readOnlyTool = readOnlyTools.find(tool => tool.tool.name === 'create_or_update_file');
      expect(readOnlyTool).toBeUndefined();
    });

    it('should create file successfully', async () => {
      mockOctokit.rest.repos.createOrUpdateFileContents.mockResolvedValue({
        data: { commit: { sha: 'abc123' } },
      });

      const result = await createUpdateFile.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'new-file.txt',
        message: 'Add new file',
        content: 'Hello World',
      });

      expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'new-file.txt',
        message: 'Add new file',
        content: Buffer.from('Hello World', 'utf8').toString('base64'),
        branch: undefined,
      });

      expect(result).toContain('abc123');
    });

    it('should update existing file with SHA', async () => {
      mockOctokit.rest.repos.createOrUpdateFileContents.mockResolvedValue({
        data: { commit: { sha: 'def456' } },
      });

      await createUpdateFile.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'existing-file.txt',
        message: 'Update file',
        content: 'Updated content',
        sha: 'existing-sha',
      });

      expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'existing-file.txt',
        message: 'Update file',
        content: btoa('Updated content'),
        sha: 'existing-sha',
        branch: undefined,
      });
    });

    it('should validate inputs', async () => {
      await expect(
        createUpdateFile.handler({
          owner: '',
          repo: 'test-repo',
          path: 'file.txt',
          message: 'message',
          content: 'content',
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        createUpdateFile.handler({
          owner: 'owner',
          repo: 'test-repo',
          path: '../../../etc/passwd',
          message: 'message',
          content: 'content',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('delete_file', () => {
    let deleteFile: any;

    beforeEach(() => {
      deleteFile = tools.find(tool => tool.tool.name === 'delete_file');
    });

    it('should be registered when not in read-only mode', () => {
      expect(deleteFile).toBeDefined();
      expect(deleteFile.tool.name).toBe('delete_file');
    });

    it('should not be registered in read-only mode', () => {
      const readOnlyTools = createRepositoryTools(mockOctokit, true);
      const readOnlyTool = readOnlyTools.find(tool => tool.tool.name === 'delete_file');
      expect(readOnlyTool).toBeUndefined();
    });

    it('should delete file successfully', async () => {
      mockOctokit.rest.repos.deleteFile.mockResolvedValue({
        data: { commit: { sha: 'delete123' } },
      });

      const result = await deleteFile.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'file-to-delete.txt',
        message: 'Delete file',
        sha: 'file-sha',
      });

      expect(mockOctokit.rest.repos.deleteFile).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'file-to-delete.txt',
        message: 'Delete file',
        sha: 'file-sha',
        branch: undefined,
      });

      expect(result).toContain('delete123');
    });

    it('should validate inputs', async () => {
      await expect(
        deleteFile.handler({
          owner: '',
          repo: 'test-repo',
          path: 'file.txt',
          message: 'message',
          sha: 'sha123',
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        deleteFile.handler({
          owner: 'owner',
          repo: 'test-repo',
          path: '../../../etc/passwd',
          message: 'message',
          sha: 'sha123',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('list_branches', () => {
    let listBranches: any;

    beforeEach(() => {
      listBranches = tools.find(tool => tool.tool.name === 'list_branches');
    });

    it('should be registered', () => {
      expect(listBranches).toBeDefined();
      expect(listBranches.tool.name).toBe('list_branches');
    });

    it('should list branches successfully', async () => {
      const branches = [
        { name: 'main', commit: { sha: 'abc123' } },
        { name: 'feature-branch', commit: { sha: 'def456' } },
      ];

      mockOctokit.rest.repos.listBranches.mockResolvedValue({
        data: branches,
      });

      const result = await listBranches.handler({
        owner: 'test-owner',
        repo: 'test-repo',
      });

      expect(mockOctokit.rest.repos.listBranches).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        per_page: 30,
        page: 1,
      });

      expect(result).toContain('main');
      expect(result).toContain('feature-branch');
    });
  });

  describe('fork_repository', () => {
    let forkRepo: any;

    beforeEach(() => {
      forkRepo = tools.find(tool => tool.tool.name === 'fork_repository');
    });

    it('should be registered when not in read-only mode', () => {
      expect(forkRepo).toBeDefined();
      expect(forkRepo.tool.name).toBe('fork_repository');
    });

    it('should not be registered in read-only mode', () => {
      const readOnlyTools = createRepositoryTools(mockOctokit, true);
      const readOnlyTool = readOnlyTools.find(tool => tool.tool.name === 'fork_repository');
      expect(readOnlyTool).toBeUndefined();
    });

    it('should fork repository successfully', async () => {
      mockOctokit.rest.repos.createFork.mockResolvedValue({
        data: { ...mockResponses.repo, name: 'forked-repo' },
      });

      const result = await forkRepo.handler({
        owner: 'original-owner',
        repo: 'original-repo',
      });

      expect(mockOctokit.rest.repos.createFork).toHaveBeenCalledWith({
        owner: 'original-owner',
        repo: 'original-repo',
        organization: undefined,
        name: undefined,
        default_branch_only: undefined,
      });

      expect(result).toContain('forked');
    });

    it('should fork to organization', async () => {
      mockOctokit.rest.repos.createFork.mockResolvedValue({
        data: mockResponses.repo,
      });

      await forkRepo.handler({
        owner: 'original-owner',
        repo: 'original-repo',
        organization: 'my-org',
      });

      expect(mockOctokit.rest.repos.createFork).toHaveBeenCalledWith({
        owner: 'original-owner',
        repo: 'original-repo',
        organization: 'my-org',
        name: undefined,
        default_branch_only: undefined,
      });
    });
  });
});