/**
 * Tests for search tools
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSearchTools } from './search.js';

const makeOctokit = () => ({
  search: {
    code: vi.fn(),
    commits: vi.fn(),
    topics: vi.fn(),
    labels: vi.fn(),
  },
});

const makeCodeItem = (overrides = {}) => ({
  name: 'index.ts',
  path: 'src/index.ts',
  sha: 'abc123',
  url: 'https://api.github.com/repos/owner/repo/contents/src/index.ts',
  git_url: 'https://api.github.com/repos/owner/repo/git/blobs/abc123',
  html_url: 'https://github.com/owner/repo/blob/main/src/index.ts',
  repository: {
    name: 'repo',
    full_name: 'owner/repo',
    owner: { login: 'owner' },
    private: false,
    html_url: 'https://github.com/owner/repo',
    description: 'A repo',
  },
  score: 1.0,
  ...overrides,
});

const makeCommitItem = (overrides = {}) => ({
  sha: 'def456',
  commit: {
    message: 'fix: something',
    author: { name: 'Alice', email: 'alice@example.com', date: '2024-01-01T00:00:00Z' },
    committer: { name: 'Bob', email: 'bob@example.com', date: '2024-01-01T00:00:00Z' },
    comment_count: 0,
  },
  author: { login: 'alice', type: 'User' },
  committer: { login: 'bob', type: 'User' },
  repository: {
    name: 'repo',
    full_name: 'owner/repo',
    owner: { login: 'owner' },
    private: false,
    html_url: 'https://github.com/owner/repo',
  },
  score: 1.0,
  html_url: 'https://github.com/owner/repo/commit/def456',
  ...overrides,
});

describe('search tools', () => {
  let mockOctokit: ReturnType<typeof makeOctokit>;
  let tools: ReturnType<typeof createSearchTools>;

  beforeEach(() => {
    mockOctokit = makeOctokit();
    tools = createSearchTools(mockOctokit as any);
  });

  const getHandler = (name: string) => tools.find(t => t.tool.name === name)!.handler as (args: any) => Promise<any>;

  // ============================================================================
  // search_code
  // ============================================================================

  describe('search_code', () => {
    it('should return mapped code search results', async () => {
      mockOctokit.search.code.mockResolvedValue({
        data: {
          total_count: 1,
          incomplete_results: false,
          items: [makeCodeItem()],
        },
      });
      const result = await getHandler('search_code')({ q: 'function createServer' });
      expect(mockOctokit.search.code).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'function createServer' })
      );
      expect(result.total_count).toBe(1);
      expect(result.incomplete_results).toBe(false);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('index.ts');
      expect(result.items[0].repository.full_name).toBe('owner/repo');
    });

    it('should pass sort/order/page/perPage', async () => {
      mockOctokit.search.code.mockResolvedValue({
        data: { total_count: 0, incomplete_results: false, items: [] },
      });
      await getHandler('search_code')({ q: 'x', sort: 'indexed', order: 'desc', page: 2, perPage: 30 });
      expect(mockOctokit.search.code).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'indexed', order: 'desc', page: 2, per_page: 30 })
      );
    });

    it('should return empty items array when no results', async () => {
      mockOctokit.search.code.mockResolvedValue({
        data: { total_count: 0, incomplete_results: false, items: [] },
      });
      const result = await getHandler('search_code')({ q: 'nothing' });
      expect(result.items).toEqual([]);
    });
  });

  // ============================================================================
  // search_commits
  // ============================================================================

  describe('search_commits', () => {
    it('should return mapped commit search results', async () => {
      mockOctokit.search.commits.mockResolvedValue({
        data: {
          total_count: 1,
          incomplete_results: false,
          items: [makeCommitItem()],
        },
      });
      const result = await getHandler('search_commits')({ q: 'fix: something' });
      expect(mockOctokit.search.commits).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'fix: something' })
      );
      expect(result.total_count).toBe(1);
      expect(result.items[0].sha).toBe('def456');
      expect(result.items[0].commit.message).toBe('fix: something');
      expect(result.items[0].author).toEqual({ login: 'alice', type: 'User' });
      expect(result.items[0].repository.full_name).toBe('owner/repo');
    });

    it('should handle null author and committer', async () => {
      mockOctokit.search.commits.mockResolvedValue({
        data: {
          total_count: 1,
          incomplete_results: false,
          items: [makeCommitItem({ author: null, committer: null })],
        },
      });
      const result = await getHandler('search_commits')({ q: 'test' });
      expect(result.items[0].author).toBeNull();
      expect(result.items[0].committer).toBeNull();
    });

    it('should handle missing commit author fields', async () => {
      const item = makeCommitItem();
      item.commit.author = undefined as any;
      item.commit.committer = undefined as any;
      mockOctokit.search.commits.mockResolvedValue({
        data: { total_count: 1, incomplete_results: false, items: [item] },
      });
      const result = await getHandler('search_commits')({ q: 'test' });
      expect(result.items[0].commit.author.name).toBe('');
      expect(result.items[0].commit.committer.email).toBe('');
    });
  });

  // ============================================================================
  // search_topics
  // ============================================================================

  describe('search_topics', () => {
    it('should return mapped topic results', async () => {
      mockOctokit.search.topics.mockResolvedValue({
        data: {
          total_count: 1,
          incomplete_results: false,
          items: [
            {
              name: 'typescript',
              display_name: 'TypeScript',
              short_description: 'A typed JS',
              description: 'TypeScript is a typed superset of JavaScript',
              created_by: 'microsoft',
              released: '2012-10-01',
              created_at: '2020-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
              featured: true,
              curated: true,
              score: 1.0,
            },
          ],
        },
      });
      const result = await getHandler('search_topics')({ q: 'typescript' });
      expect(mockOctokit.search.topics).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'typescript' })
      );
      expect(result.items[0].name).toBe('typescript');
      expect(result.items[0].featured).toBe(true);
      expect(result.items[0].curated).toBe(true);
    });

    it('should pass page and perPage', async () => {
      mockOctokit.search.topics.mockResolvedValue({
        data: { total_count: 0, incomplete_results: false, items: [] },
      });
      await getHandler('search_topics')({ q: 'rust', page: 3, perPage: 10 });
      expect(mockOctokit.search.topics).toHaveBeenCalledWith(
        expect.objectContaining({ page: 3, per_page: 10 })
      );
    });
  });

  // ============================================================================
  // search_labels
  // ============================================================================

  describe('search_labels', () => {
    it('should return mapped label results', async () => {
      mockOctokit.search.labels.mockResolvedValue({
        data: {
          total_count: 2,
          incomplete_results: false,
          items: [
            {
              id: 1,
              node_id: 'LA_1',
              url: 'https://api.github.com/repos/owner/repo/labels/bug',
              name: 'bug',
              color: 'd73a4a',
              default: true,
              description: "Something isn't working",
              score: 1.0,
            },
            {
              id: 2,
              node_id: 'LA_2',
              url: 'https://api.github.com/repos/owner/repo/labels/enhancement',
              name: 'enhancement',
              color: 'a2eeef',
              default: true,
              description: 'New feature or request',
              score: 0.9,
            },
          ],
        },
      });
      const result = await getHandler('search_labels')({ repository_id: 123, q: 'bug' });
      expect(mockOctokit.search.labels).toHaveBeenCalledWith(
        expect.objectContaining({ repository_id: 123, q: 'bug' })
      );
      expect(result.total_count).toBe(2);
      expect(result.items[0].name).toBe('bug');
      expect(result.items[0].color).toBe('d73a4a');
      expect(result.items[1].name).toBe('enhancement');
    });

    it('should pass sort/order/page/perPage', async () => {
      mockOctokit.search.labels.mockResolvedValue({
        data: { total_count: 0, incomplete_results: false, items: [] },
      });
      await getHandler('search_labels')({
        repository_id: 1,
        q: 'x',
        sort: 'created',
        order: 'asc',
        page: 1,
        perPage: 50,
      });
      expect(mockOctokit.search.labels).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'created', order: 'asc', page: 1, per_page: 50 })
      );
    });
  });
});
