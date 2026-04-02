/**
 * Tests for repository tools
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRepositoryTools } from './repositories.js';
import { createMockOctokit, staticMockResponses } from '../__tests__/mocks/octokit.js';
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
        data: staticMockResponses.fileContent,
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

      expect(result.content).toBe('Test file content');
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

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('file1.txt');
      expect(result[1].name).toBe('subdir');
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.repos.getContent.mockRejectedValue(new Error('File not found'));

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
      const repositories = [staticMockResponses.repo];
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

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test-repo');
    });

    it('should handle pagination parameters', async () => {
      mockOctokit.rest.repos.listForAuthenticatedUser.mockResolvedValue({
        data: [staticMockResponses.repo],
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
        data: staticMockResponses.repo,
      });

      const result = await getRepo.handler({
        owner: 'test-owner',
        repo: 'test-repo',
      });

      expect(mockOctokit.rest.repos.get).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
      });

      expect(result.name).toBe('test-repo');
      expect(result.description).toBe('Test repository');
    });

    it('should validate input parameters', async () => {
      await expect(getRepo.handler({ owner: '', repo: 'test-repo' })).rejects.toThrow(
        ValidationError
      );

      await expect(getRepo.handler({ owner: 'test-owner', repo: '' })).rejects.toThrow(
        ValidationError
      );
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

      expect(result.commit.sha).toBe('abc123');
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
        content: Buffer.from('Updated content', 'utf8').toString('base64'),
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
      // Mock getContent to return file with SHA
      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: { type: 'file', sha: 'file-sha-123' },
      });

      mockOctokit.rest.repos.deleteFile.mockResolvedValue({
        data: {
          commit: { sha: 'delete123', message: 'Delete file', html_url: 'https://github.com' },
        },
      });

      const result = await deleteFile.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'file-to-delete.txt',
        message: 'Delete file',
        branch: 'main',
      });

      expect(mockOctokit.rest.repos.deleteFile).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'file-to-delete.txt',
        message: 'Delete file',
        sha: 'file-sha-123',
        branch: 'main',
      });

      expect(result.commit.sha).toBe('delete123');
    });

    it('should validate inputs', async () => {
      await expect(
        deleteFile.handler({
          owner: '',
          repo: 'test-repo',
          path: 'file.txt',
          message: 'message',
          branch: 'main',
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        deleteFile.handler({
          owner: 'owner',
          repo: 'test-repo',
          path: '../../../etc/passwd',
          message: 'message',
          branch: 'main',
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

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('main');
      expect(result[1].name).toBe('feature-branch');
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
        data: { ...staticMockResponses.repo, name: 'forked-repo' },
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

      expect(result.name).toBe('forked-repo');
    });

    it('should fork to organization', async () => {
      mockOctokit.rest.repos.createFork.mockResolvedValue({
        data: staticMockResponses.repo,
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

  describe('push_files', () => {
    let pushFiles: any;

    beforeEach(() => {
      pushFiles = tools.find(tool => tool.tool.name === 'push_files');
    });

    it('should be registered', () => {
      expect(pushFiles).toBeDefined();
    });

    it('should push a new file (no existing sha)', async () => {
      // Simulate file not existing (getContent throws)
      mockOctokit.rest.repos.getContent.mockRejectedValue({ status: 404 });
      mockOctokit.rest.repos.createOrUpdateFileContents.mockResolvedValue({
        data: { content: { sha: 'newsha123' } },
      });

      const result = await pushFiles.handler({
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
        message: 'Add file',
        files: [{ path: 'src/new.ts', content: 'export const x = 1;' }],
      });

      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(true);
      expect(result[0].path).toBe('src/new.ts');
    });

    it('should push an existing file with its sha', async () => {
      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: { type: 'file', sha: 'existingsha' },
      });
      mockOctokit.rest.repos.createOrUpdateFileContents.mockResolvedValue({
        data: { content: { sha: 'updatedsha' } },
      });

      const result = await pushFiles.handler({
        owner: 'owner',
        repo: 'repo',
        branch: 'feature',
        message: 'Update file',
        files: [{ path: 'README.md', content: '# Updated' }],
      });

      expect(result[0].success).toBe(true);
      expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({ sha: 'existingsha' })
      );
    });

    it('should handle multiple files', async () => {
      mockOctokit.rest.repos.getContent.mockRejectedValue({ status: 404 });
      mockOctokit.rest.repos.createOrUpdateFileContents.mockResolvedValue({
        data: { content: { sha: 'sha1' } },
      });

      const result = await pushFiles.handler({
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
        message: 'Add files',
        files: [
          { path: 'a.ts', content: 'a' },
          { path: 'b.ts', content: 'b' },
        ],
      });

      expect(result).toHaveLength(2);
      expect(result[0].success).toBe(true);
      expect(result[1].success).toBe(true);
    });

    it('should report failure when createOrUpdateFileContents fails', async () => {
      mockOctokit.rest.repos.getContent.mockRejectedValue({ status: 404 });
      mockOctokit.rest.repos.createOrUpdateFileContents.mockRejectedValue(new Error('API error'));

      const result = await pushFiles.handler({
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
        message: 'Add file',
        files: [{ path: 'fail.ts', content: 'x' }],
      });

      expect(result[0].success).toBe(false);
      expect(result[0].error).toBeDefined();
    });

    it('should not include sha when getContent returns a directory', async () => {
      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: [{ type: 'dir', name: 'src' }], // array = directory
      });
      mockOctokit.rest.repos.createOrUpdateFileContents.mockResolvedValue({
        data: { content: { sha: 'newsha' } },
      });

      const result = await pushFiles.handler({
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
        message: 'Add file',
        files: [{ path: 'src/new.ts', content: 'x' }],
      });

      expect(result[0].success).toBe(true);
      // sha should be undefined (not passed) since getContent returned a directory
      expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({ sha: undefined })
      );
    });
  });

  describe('create_repository', () => {
    let createRepo: any;

    beforeEach(() => {
      const writeTools = createRepositoryTools(mockOctokit, false);
      createRepo = writeTools.find((t: any) => t.tool.name === 'create_repository');
      mockOctokit.rest.repos.createForAuthenticatedUser = vi.fn().mockResolvedValue({
        data: {
          id: 1,
          name: 'new-repo',
          full_name: 'owner/new-repo',
          html_url: 'https://github.com/owner/new-repo',
          ssh_url: 'git@github.com:owner/new-repo.git',
          clone_url: 'https://github.com/owner/new-repo.git',
          created_at: '2024-01-01T00:00:00Z',
        },
      });
    });

    it('should be registered when not read-only', () => {
      expect(createRepo).toBeDefined();
    });

    it('should not be registered in read-only mode', () => {
      const readOnlyTools = createRepositoryTools(mockOctokit, true);
      expect(readOnlyTools.find((t: any) => t.tool.name === 'create_repository')).toBeUndefined();
    });

    it('should create a repository and return details', async () => {
      const result = await createRepo.handler({
        name: 'new-repo', description: 'desc', private: true, autoInit: true,
      });
      expect(result.name).toBe('new-repo');
      expect(result.html_url).toBe('https://github.com/owner/new-repo');
    });
  });

  describe('create_or_update_file (branch validation)', () => {
    it('should reject invalid branch name', async () => {
      const writeTools = createRepositoryTools(mockOctokit, false);
      const createUpdateFile = writeTools.find((t: any) => t.tool.name === 'create_or_update_file');
      await expect(
        createUpdateFile.handler({
          owner: 'owner',
          repo: 'test-repo',
          path: 'file.txt',
          message: 'msg',
          content: 'data',
          branch: '..invalid-branch',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('delete_file (directory path)', () => {
    it('should throw when path points to a directory', async () => {
      const writeTools = createRepositoryTools(mockOctokit, false);
      const deleteFile = writeTools.find((t: any) => t.tool.name === 'delete_file');
      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: [{ type: 'dir', name: 'src' }],
      });
      await expect(
        deleteFile.handler({
          owner: 'owner',
          repo: 'test-repo',
          path: 'src',
          message: 'delete dir',
          branch: 'main',
        })
      ).rejects.toThrow('Path does not point to a file');
    });
  });

  describe('create_branch', () => {
    let createBranch: any;

    beforeEach(() => {
      // Add git namespace mock if missing
      if (!mockOctokit.rest.git) {
        mockOctokit.rest.git = {
          getRef: vi.fn(),
          createRef: vi.fn(),
        };
      }
      const writeTools = createRepositoryTools(mockOctokit, false);
      createBranch = writeTools.find((t: any) => t.tool.name === 'create_branch');
    });

    it('should be registered when not read-only', () => {
      expect(createBranch).toBeDefined();
    });

    it('should not be registered in read-only mode', () => {
      const readOnlyTools = createRepositoryTools(mockOctokit, true);
      expect(readOnlyTools.find((t: any) => t.tool.name === 'create_branch')).toBeUndefined();
    });

    it('should create a branch from a specified from_branch', async () => {
      mockOctokit.rest.git.getRef.mockResolvedValue({
        data: { object: { sha: 'from-sha-abc' } },
      });
      mockOctokit.rest.git.createRef.mockResolvedValue({
        data: {
          ref: 'refs/heads/new-feature',
          node_id: 'node1',
          url: 'https://api.github.com/repos/owner/repo/git/refs/heads/new-feature',
          object: { sha: 'from-sha-abc', type: 'commit', url: 'https://...' },
        },
      });

      const result = await createBranch.handler({
        owner: 'owner', repo: 'repo',
        branch: 'new-feature', from_branch: 'main',
      });

      expect(mockOctokit.rest.git.getRef).toHaveBeenCalledWith({
        owner: 'owner', repo: 'repo', ref: 'heads/main',
      });
      expect(mockOctokit.rest.git.createRef).toHaveBeenCalledWith({
        owner: 'owner', repo: 'repo',
        ref: 'refs/heads/new-feature', sha: 'from-sha-abc',
      });
      expect(result.ref).toBe('refs/heads/new-feature');
    });

    it('should create a branch from default branch when from_branch not specified', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: { default_branch: 'main' },
      });
      mockOctokit.rest.git.getRef.mockResolvedValue({
        data: { object: { sha: 'default-sha' } },
      });
      mockOctokit.rest.git.createRef.mockResolvedValue({
        data: {
          ref: 'refs/heads/new-branch',
          node_id: 'node2',
          url: 'https://...',
          object: { sha: 'default-sha', type: 'commit', url: 'https://...' },
        },
      });

      const result = await createBranch.handler({
        owner: 'owner', repo: 'repo', branch: 'new-branch',
      });

      expect(mockOctokit.rest.repos.get).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo' });
      expect(result.ref).toBe('refs/heads/new-branch');
    });
  });

  describe('search_repositories', () => {
    let searchRepos: any;

    beforeEach(() => {
      searchRepos = tools.find(tool => tool.tool.name === 'search_repositories');
    });

    it('should be registered', () => {
      expect(searchRepos).toBeDefined();
    });

    it('should return search results', async () => {
      mockOctokit.rest.search.repos.mockResolvedValue({
        data: {
          total_count: 1,
          incomplete_results: false,
          items: [{
            name: 'my-repo',
            full_name: 'owner/my-repo',
            owner: { login: 'owner', type: 'User' },
            description: 'Test repo',
            html_url: 'https://github.com/owner/my-repo',
            stargazers_count: 5,
            forks_count: 2,
            language: 'TypeScript',
            updated_at: '2024-01-01T00:00:00Z',
            open_issues_count: 0,
            private: false,
          }],
        },
      });

      const result = await searchRepos.handler({ query: 'test' }) as any;
      expect(result.total_count).toBe(1);
      expect(result.items[0].name).toBe('my-repo');
    });

    it('should throw when query is missing', async () => {
      await expect(searchRepos.handler({})).rejects.toThrow('Search query is required');
    });
  });

  describe('create_or_update_file validation errors', () => {
    let createOrUpdateFile: any;

    beforeEach(() => {
      createOrUpdateFile = tools.find(tool => tool.tool.name === 'create_or_update_file');
    });

    it('should throw ValidationError for invalid repo name', async () => {
      await expect(
        createOrUpdateFile.handler({
          owner: 'valid-owner',
          repo: '',
          path: 'file.txt',
          content: 'hello',
          message: 'test',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('delete_file validation errors', () => {
    let deleteFile: any;

    beforeEach(() => {
      deleteFile = tools.find(tool => tool.tool.name === 'delete_file');
    });

    it('should throw ValidationError for invalid repo name', async () => {
      await expect(
        deleteFile.handler({
          owner: 'valid-owner',
          repo: '',
          path: 'file.txt',
          message: 'delete',
          sha: 'abc123',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('get_commit', () => {
    let getCommit: any;

    beforeEach(() => {
      getCommit = tools.find(tool => tool.tool.name === 'get_commit');
    });

    it('should be registered', () => {
      expect(getCommit).toBeDefined();
    });

    it('should return commit details', async () => {
      mockOctokit.rest.repos.getCommit.mockResolvedValue({
        data: {
          sha: 'abc123',
          commit: {
            message: 'Fix bug',
            author: { name: 'user', date: '2024-01-01T00:00:00Z' },
            committer: { name: 'user', date: '2024-01-01T00:00:00Z' },
          },
          stats: { additions: 10, deletions: 5 },
          files: [
            { filename: 'src/a.ts', status: 'modified', additions: 10, deletions: 5, changes: 15, patch: '@@ ...' },
          ],
        },
      });
      const result = await getCommit.handler({ owner: 'owner', repo: 'repo', sha: 'abc123' }) as any;
      expect(result.sha).toBe('abc123');
      expect(result.message).toBe('Fix bug');
      expect(result.files).toHaveLength(1);
    });
  });

  describe('list_tags', () => {
    let listTags: any;

    beforeEach(() => {
      mockOctokit.rest.repos.listTags = vi.fn().mockResolvedValue({
        data: [
          { name: 'v1.0.0', commit: { sha: 'tag-sha-1', url: 'https://...' }, zipball_url: 'https://...', tarball_url: 'https://...' },
        ],
      });
      listTags = tools.find(tool => tool.tool.name === 'list_tags');
    });

    it('should be registered', () => {
      expect(listTags).toBeDefined();
    });

    it('should return list of tags', async () => {
      const result = await listTags.handler({ owner: 'owner', repo: 'repo' }) as any[];
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('v1.0.0');
    });
  });
});
