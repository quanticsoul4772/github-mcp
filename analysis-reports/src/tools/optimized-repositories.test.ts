/**
 * Tests for optimized repository tools
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createOptimizedRepositoryTools } from './optimized-repositories.js';
import { OptimizedAPIClient } from '../optimized-api-client.js';
import { ValidationError } from '../validation.js';

function makeClient() {
  const mockOctokit = {
    repos: {
      getContent: vi.fn(),
      get: vi.fn(),
      listBranches: vi.fn(),
    },
    users: { getAuthenticated: vi.fn(), getByUsername: vi.fn() },
    issues: { listForRepo: vi.fn() },
    pulls: { list: vi.fn() },
    actions: { listWorkflowRuns: vi.fn() },
    graphql: vi.fn(),
  };

  const client = new OptimizedAPIClient({
    octokit: mockOctokit as any,
    enableCache: false,
    enableDeduplication: false,
    enablePerformanceMonitoring: false,
    enableGraphQLCache: false,
  });

  return { client, mockOctokit };
}

describe('optimized repository tools', () => {
  let tools: any[];
  let client: OptimizedAPIClient;
  let mockOctokit: ReturnType<typeof makeClient>['mockOctokit'];

  beforeEach(() => {
    const result = makeClient();
    client = result.client;
    mockOctokit = result.mockOctokit;
    tools = createOptimizedRepositoryTools(client, false);
  });

  function getTool(name: string) {
    const t = tools.find(t => t.tool.name === name);
    if (!t) throw new Error(`Tool ${name} not found`);
    return t;
  }

  // ============================================================================
  // get_file_contents_optimized
  // ============================================================================

  describe('get_file_contents_optimized', () => {
    let tool: any;

    beforeEach(() => {
      tool = getTool('get_file_contents_optimized');
    });

    it('should be registered', () => {
      expect(tool).toBeDefined();
      expect(tool.tool.name).toBe('get_file_contents_optimized');
    });

    it('should throw ValidationError for invalid owner (too short)', async () => {
      // Single char owner fails validateOwnerName (min 2 chars) but passes Zod min(1)
      await expect(tool.handler({ owner: 'x', repo: 'repo' })).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid repo (too short)', async () => {
      await expect(tool.handler({ owner: 'owner', repo: 'x' })).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid path', async () => {
      await expect(tool.handler({ owner: 'owner', repo: 'repo', path: '../etc/passwd' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid ref', async () => {
      await expect(tool.handler({ owner: 'owner', repo: 'repo', ref: 'invalid ref!@#' }))
        .rejects.toThrow(ValidationError);
    });

    it('should return directory listing for array data', async () => {
      mockOctokit.repos.getContent.mockResolvedValue({
        data: [
          { name: 'file.txt', path: 'file.txt', type: 'file', size: 100, sha: 'abc' },
          { name: 'dir', path: 'dir', type: 'dir', size: 0, sha: 'def' },
        ],
      });
      const result = await tool.handler({ owner: 'owner', repo: 'repo', path: '/' });
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].name).toBe('file.txt');
    });

    it('should decode base64 file content', async () => {
      const content = Buffer.from('hello world').toString('base64');
      mockOctokit.repos.getContent.mockResolvedValue({
        data: { type: 'file', name: 'test.txt', path: 'test.txt', size: 11, sha: 'abc', content, encoding: 'base64' },
      });
      const result = await tool.handler({ owner: 'owner', repo: 'repo', path: 'test.txt' });
      expect(result.content).toBe('hello world');
      expect(result.is_decoded).toBe(true);
    });

    it('should return raw content for non-base64 encoding', async () => {
      mockOctokit.repos.getContent.mockResolvedValue({
        data: { type: 'file', name: 'f', path: 'f', size: 5, sha: 'abc', content: 'rawdata', encoding: 'utf-8' },
      });
      const result = await tool.handler({ owner: 'owner', repo: 'repo', path: 'f' });
      expect(result.content_raw).toBe('rawdata');
      expect(result.is_decoded).toBe(false);
    });

    it('should return raw data for non-file non-array response', async () => {
      const symlink = { type: 'symlink', target: '/other/path' };
      mockOctokit.repos.getContent.mockResolvedValue({ data: symlink });
      const result = await tool.handler({ owner: 'owner', repo: 'repo', path: 'link' });
      expect(result).toEqual(symlink);
    });
  });

  // ============================================================================
  // get_repository_optimized
  // ============================================================================

  describe('get_repository_optimized', () => {
    let tool: any;

    beforeEach(() => {
      tool = getTool('get_repository_optimized');
    });

    it('should be registered', () => {
      expect(tool).toBeDefined();
    });

    it('should throw ValidationError for invalid owner (too short)', async () => {
      await expect(tool.handler({ owner: 'x', repo: 'repo' })).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid repo (too short)', async () => {
      await expect(tool.handler({ owner: 'owner', repo: 'x' })).rejects.toThrow(ValidationError);
    });

    it('should return repository data', async () => {
      mockOctokit.repos.get.mockResolvedValue({ data: { id: 1, name: 'myrepo' } });
      const result = await tool.handler({ owner: 'owner', repo: 'myrepo' });
      expect(result).toEqual({ id: 1, name: 'myrepo' });
    });
  });

  // ============================================================================
  // list_branches_optimized
  // ============================================================================

  describe('list_branches_optimized', () => {
    let tool: any;

    beforeEach(() => {
      tool = getTool('list_branches_optimized');
    });

    it('should be registered', () => {
      expect(tool).toBeDefined();
    });

    it('should throw ValidationError for invalid owner (too short)', async () => {
      await expect(tool.handler({ owner: 'x', repo: 'repo' })).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid repo (too short)', async () => {
      await expect(tool.handler({ owner: 'owner', repo: 'x' })).rejects.toThrow(ValidationError);
    });

    it('should return branches', async () => {
      mockOctokit.repos.listBranches.mockResolvedValue({ data: [{ name: 'main' }], headers: {} });
      const result = await tool.handler({ owner: 'owner', repo: 'repo' });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should pass maxPages option', async () => {
      mockOctokit.repos.listBranches.mockResolvedValue({ data: [{ name: 'main' }], headers: {} });
      const result = await tool.handler({ owner: 'owner', repo: 'repo', maxPages: 1 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================================================
  // list_issues_optimized
  // ============================================================================

  describe('list_issues_optimized', () => {
    let tool: any;

    beforeEach(() => {
      tool = getTool('list_issues_optimized');
    });

    it('should be registered', () => {
      expect(tool).toBeDefined();
    });

    it('should throw ValidationError for invalid owner (too short)', async () => {
      await expect(tool.handler({ owner: 'x', repo: 'repo' })).rejects.toThrow(ValidationError);
    });

    it('should return issues', async () => {
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [{ id: 1, number: 1 }], headers: {} });
      const result = await tool.handler({ owner: 'owner', repo: 'repo' });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should pass state option', async () => {
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [], headers: {} });
      const result = await tool.handler({ owner: 'owner', repo: 'repo', state: 'closed' });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================================================
  // list_pull_requests_optimized
  // ============================================================================

  describe('list_pull_requests_optimized', () => {
    let tool: any;

    beforeEach(() => {
      tool = getTool('list_pull_requests_optimized');
    });

    it('should be registered', () => {
      expect(tool).toBeDefined();
    });

    it('should throw ValidationError for invalid owner (too short)', async () => {
      await expect(tool.handler({ owner: 'x', repo: 'repo' })).rejects.toThrow(ValidationError);
    });

    it('should return pull requests', async () => {
      mockOctokit.pulls.list.mockResolvedValue({ data: [{ number: 1 }], headers: {} });
      const result = await tool.handler({ owner: 'owner', repo: 'repo' });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should pass state and sort options', async () => {
      mockOctokit.pulls.list.mockResolvedValue({ data: [], headers: {} });
      const result = await tool.handler({ owner: 'owner', repo: 'repo', state: 'all', sort: 'updated' });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================================================
  // tool count
  // ============================================================================

  it('should create 5 tools', () => {
    expect(tools).toHaveLength(5);
  });
});
