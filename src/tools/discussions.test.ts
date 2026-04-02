/**
 * Tests for GitHub Discussions tools (GraphQL-based)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDiscussionTools } from './discussions.js';

const makeDiscussion = (number = 1) => ({
  id: `D_${number}`,
  number,
  title: `Discussion ${number}`,
  body: 'Discussion body',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  author: { login: 'user1' },
  category: { id: 'CAT_1', name: 'General', slug: 'general' },
  comments: { totalCount: 2 },
  upvoteCount: 5,
  url: `https://github.com/owner/repo/discussions/${number}`,
});

const makeOctokit = () => ({
  graphql: vi.fn(),
});

describe('Discussion Tools', () => {
  let mockOctokit: ReturnType<typeof makeOctokit>;
  let tools: ReturnType<typeof createDiscussionTools>;

  beforeEach(() => {
    mockOctokit = makeOctokit();
    tools = createDiscussionTools(mockOctokit as any, false);
  });

  // ============================================================================
  // list_discussions
  // ============================================================================

  describe('list_discussions', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'list_discussions');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should be registered', () => {
      expect(tools.find(t => t.tool.name === 'list_discussions')).toBeDefined();
    });

    it('should list discussions', async () => {
      mockOctokit.graphql.mockResolvedValue({
        repository: {
          discussions: {
            totalCount: 2,
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [makeDiscussion(1), makeDiscussion(2)],
          },
        },
      });

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any;
      expect(result.total_count).toBe(2);
      expect(result.discussions).toHaveLength(2);
      expect(result.discussions[0].number).toBe(1);
      expect(result.page_info.hasNextPage).toBe(false);
    });

    it('should pass category filter', async () => {
      mockOctokit.graphql.mockResolvedValue({
        repository: {
          discussions: {
            totalCount: 1,
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [makeDiscussion(1)],
          },
        },
      });

      await handler({ owner: 'owner', repo: 'repo', category: 'CAT_1', perPage: 10 });
      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ categoryId: 'CAT_1', first: 10 })
      );
    });
  });

  // ============================================================================
  // get_discussion
  // ============================================================================

  describe('get_discussion', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'get_discussion');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should return discussion details', async () => {
      const discussion = { ...makeDiscussion(5), bodyHTML: '<p>body</p>', viewerCanDelete: true };
      mockOctokit.graphql.mockResolvedValue({
        repository: { discussion },
      });

      const result = (await handler({ owner: 'owner', repo: 'repo', discussionNumber: 5 })) as any;
      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ owner: 'owner', repo: 'repo', number: 5 })
      );
      expect(result.number).toBe(5);
    });
  });

  // ============================================================================
  // get_discussion_comments
  // ============================================================================

  describe('get_discussion_comments', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'get_discussion_comments');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should return discussion comments', async () => {
      mockOctokit.graphql.mockResolvedValue({
        repository: {
          discussion: {
            comments: {
              totalCount: 1,
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [{ id: 'C_1', body: 'Nice!', author: { login: 'user2' }, createdAt: '2024-01-02T00:00:00Z', replies: { totalCount: 0, nodes: [] } }],
            },
          },
        },
      });

      const result = (await handler({ owner: 'owner', repo: 'repo', discussionNumber: 1 })) as any;
      expect(result.total_count).toBe(1);
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].body).toBe('Nice!');
    });
  });

  // ============================================================================
  // list_discussion_categories
  // ============================================================================

  describe('list_discussion_categories', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'list_discussion_categories');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should list categories', async () => {
      mockOctokit.graphql.mockResolvedValue({
        repository: {
          discussionCategories: {
            totalCount: 2,
            nodes: [
              { id: 'CAT_1', name: 'General', slug: 'general', description: '', emoji: '💬', isAnswerable: false },
              { id: 'CAT_2', name: 'Q&A', slug: 'q-a', description: '', emoji: '❓', isAnswerable: true },
            ],
          },
        },
      });

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any;
      expect(result.total_count).toBe(2);
      expect(result.categories[0].name).toBe('General');
      expect(result.categories[1].isAnswerable).toBe(true);
    });
  });

  // ============================================================================
  // search_discussions
  // ============================================================================

  describe('search_discussions', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'search_discussions');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should search discussions', async () => {
      mockOctokit.graphql.mockResolvedValue({
        search: {
          discussionCount: 1,
          nodes: [makeDiscussion(3)],
        },
      });

      const result = (await handler({ query: 'help wanted' })) as any;
      expect(result.total_count).toBe(1);
      expect(result.discussions[0].number).toBe(3);
    });

    it('should scope search to owner/repo when provided', async () => {
      mockOctokit.graphql.mockResolvedValue({ search: { discussionCount: 0, nodes: [] } });

      await handler({ query: 'bug', owner: 'myorg', repo: 'myrepo' });
      expect(mockOctokit.graphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ searchQuery: 'repo:myorg/myrepo bug' })
      );
    });
  });

  // ============================================================================
  // Write-mode tools
  // ============================================================================

  describe('write-mode registration', () => {
    it('should register write tools when not read-only', () => {
      const writeTools = ['create_discussion', 'add_discussion_comment', 'update_discussion', 'delete_discussion'];
      for (const name of writeTools) {
        expect(tools.find(t => t.tool.name === name)).toBeDefined();
      }
    });

    it('should NOT register write tools in read-only mode', () => {
      const readOnlyTools = createDiscussionTools(mockOctokit as any, true);
      expect(readOnlyTools.find(t => t.tool.name === 'create_discussion')).toBeUndefined();
      expect(readOnlyTools.find(t => t.tool.name === 'delete_discussion')).toBeUndefined();
    });
  });

  describe('create_discussion', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'create_discussion');
      handler = tool!.handler;
    });

    it('should create a discussion via two GraphQL calls', async () => {
      const created = { ...makeDiscussion(10), url: 'https://github.com/owner/repo/discussions/10' };
      // First call: get repo ID; second call: create discussion
      mockOctokit.graphql
        .mockResolvedValueOnce({ repository: { id: 'REPO_ID_123' } })
        .mockResolvedValueOnce({ createDiscussion: { discussion: created } });

      const result = (await handler({
        owner: 'owner',
        repo: 'repo',
        title: 'My discussion',
        body: 'Discussion body',
        categoryId: 'CAT_1',
      })) as any;

      expect(mockOctokit.graphql).toHaveBeenCalledTimes(2);
      expect(result.number).toBe(10);
      expect(result.title).toBe(`Discussion 10`);
    });
  });

  describe('add_discussion_comment', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'add_discussion_comment');
      handler = tool!.handler;
    });

    it('should add a comment', async () => {
      const comment = { id: 'C_10', body: 'Great point!', createdAt: '2024-01-05T00:00:00Z', author: { login: 'user3' } };
      mockOctokit.graphql.mockResolvedValue({ addDiscussionComment: { comment } });

      const result = (await handler({ discussionId: 'D_1', body: 'Great point!' })) as any;
      expect(result.body).toBe('Great point!');
    });
  });

  describe('update_discussion', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'update_discussion');
      handler = tool!.handler;
    });

    it('should update a discussion', async () => {
      const updated = { ...makeDiscussion(5), title: 'Updated title' };
      mockOctokit.graphql.mockResolvedValue({ updateDiscussion: { discussion: updated } });

      const result = (await handler({ discussionId: 'D_5', title: 'Updated title' })) as any;
      expect(result.title).toBe('Updated title');
    });
  });

  describe('delete_discussion', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'delete_discussion');
      handler = tool!.handler;
    });

    it('should delete a discussion and return success', async () => {
      mockOctokit.graphql.mockResolvedValue({ deleteDiscussion: { clientMutationId: null } });

      const result = (await handler({ discussionId: 'D_5' })) as any;
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });
  });
});
