/**
 * Tests for GitHub Users tools
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createUserTools } from './users.js';

const makeUser = (login = 'user1') => ({
  login,
  id: 42,
  node_id: 'U_42',
  avatar_url: `https://avatars.githubusercontent.com/u/42`,
  gravatar_id: '',
  url: `https://api.github.com/users/${login}`,
  html_url: `https://github.com/${login}`,
  type: 'User',
  site_admin: false,
  name: 'User One',
  company: 'ACME',
  blog: 'https://example.com',
  location: 'SF',
  email: 'user@example.com',
  hireable: true,
  bio: 'Developer',
  twitter_username: null,
  public_repos: 20,
  public_gists: 3,
  followers: 100,
  following: 50,
  created_at: '2018-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
});

const makeAuthUser = (login = 'me') => ({
  ...makeUser(login),
  private_gists: 5,
  total_private_repos: 10,
  owned_private_repos: 8,
  disk_usage: 2048,
  collaborators: 3,
  two_factor_authentication: true,
  plan: { name: 'pro', space: 1000000, collaborators: 0, private_repos: 9999 },
});

const makeRepo = (name = 'repo1', owner = 'user1') => ({
  id: 123,
  name,
  full_name: `${owner}/${name}`,
  owner: { login: owner, type: 'User' },
  private: false,
  html_url: `https://github.com/${owner}/${name}`,
  description: 'A repo',
  fork: false,
  created_at: '2022-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  pushed_at: '2024-01-15T00:00:00Z',
  language: 'TypeScript',
  stargazers_count: 10,
  watchers_count: 10,
  forks_count: 2,
  open_issues_count: 1,
  default_branch: 'main',
  archived: false,
  disabled: false,
  visibility: 'public',
});

const makeSimpleUser = (login = 'user1') => ({
  login,
  id: 42,
  node_id: 'U_42',
  avatar_url: `https://avatars.githubusercontent.com/u/42`,
  gravatar_id: '',
  url: `https://api.github.com/users/${login}`,
  html_url: `https://github.com/${login}`,
  type: 'User',
  site_admin: false,
  score: 1.0,
});

const makeOctokit = () => ({
  users: {
    getAuthenticated: vi.fn(),
    getByUsername: vi.fn(),
    listFollowersForUser: vi.fn(),
    listFollowersForAuthenticatedUser: vi.fn(),
    listFollowingForUser: vi.fn(),
    listFollowedByAuthenticatedUser: vi.fn(),
    checkFollowingForUser: vi.fn(),
    checkPersonIsFollowedByAuthenticated: vi.fn(),
    follow: vi.fn(),
    unfollow: vi.fn(),
    updateAuthenticated: vi.fn(),
  },
  search: {
    users: vi.fn(),
  },
  repos: {
    listForUser: vi.fn(),
    listForAuthenticatedUser: vi.fn(),
  },
});

describe('User Tools', () => {
  let mockOctokit: ReturnType<typeof makeOctokit>;
  let tools: ReturnType<typeof createUserTools>;

  beforeEach(() => {
    mockOctokit = makeOctokit();
    tools = createUserTools(mockOctokit as any, false);
  });

  // ============================================================================
  // get_me
  // ============================================================================

  describe('get_me', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'get_me');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should be registered', () => {
      expect(tools.find(t => t.tool.name === 'get_me')).toBeDefined();
    });

    it('should return authenticated user profile', async () => {
      mockOctokit.users.getAuthenticated.mockResolvedValue({ data: makeAuthUser('mylogin') });

      const result = (await handler({})) as any;
      expect(mockOctokit.users.getAuthenticated).toHaveBeenCalled();
      expect(result.login).toBe('mylogin');
      expect(result.public_repos).toBe(20);
      expect(result.two_factor_authentication).toBe(true);
    });
  });

  // ============================================================================
  // get_user
  // ============================================================================

  describe('get_user', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'get_user');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should return user by username', async () => {
      mockOctokit.users.getByUsername.mockResolvedValue({ data: makeUser('octocat') });

      const result = (await handler({ username: 'octocat' })) as any;
      expect(mockOctokit.users.getByUsername).toHaveBeenCalledWith({ username: 'octocat' });
      expect(result.login).toBe('octocat');
      expect(result.public_repos).toBe(20);
    });

    it('should throw when username is missing', async () => {
      await expect(handler({})).rejects.toThrow('Username is required');
    });
  });

  // ============================================================================
  // search_users
  // ============================================================================

  describe('search_users', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'search_users');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should search users', async () => {
      mockOctokit.search.users.mockResolvedValue({
        data: {
          total_count: 1,
          incomplete_results: false,
          items: [makeSimpleUser('octocat')],
        },
      });

      const result = (await handler({ query: 'octocat' })) as any;
      expect(result.total_count).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].login).toBe('octocat');
    });

    it('should pass query directly without modification', async () => {
      mockOctokit.search.users.mockResolvedValue({
        data: { total_count: 0, incomplete_results: false, items: [] },
      });

      await handler({ query: 'location:SF language:TypeScript' });
      expect(mockOctokit.search.users).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'location:SF language:TypeScript' })
      );
    });

    it('should pass sort/order/pagination', async () => {
      mockOctokit.search.users.mockResolvedValue({
        data: { total_count: 0, incomplete_results: false, items: [] },
      });

      await handler({ query: 'octocat', sort: 'followers', order: 'desc', page: 2, perPage: 25 });
      expect(mockOctokit.search.users).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'followers', order: 'desc', page: 2, per_page: 25 })
      );
    });
  });

  // ============================================================================
  // list_user_repos
  // ============================================================================

  describe('list_user_repos', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'list_user_repos');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should list repos for a specific user', async () => {
      mockOctokit.repos.listForUser.mockResolvedValue({
        data: [makeRepo('repo1', 'octocat')],
      });

      const result = (await handler({ username: 'octocat' })) as any[];
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('repo1');
      expect(result[0].owner.login).toBe('octocat');
      expect(mockOctokit.repos.listForUser).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'octocat' })
      );
    });

    it('should list repos for authenticated user when no username given', async () => {
      mockOctokit.repos.listForAuthenticatedUser.mockResolvedValue({
        data: [makeRepo('my-repo', 'me')],
      });

      const result = (await handler({})) as any[];
      expect(result).toHaveLength(1);
      expect(mockOctokit.repos.listForAuthenticatedUser).toHaveBeenCalled();
    });

    it('should pass type/sort/direction', async () => {
      mockOctokit.repos.listForUser.mockResolvedValue({ data: [] });

      await handler({ username: 'octocat', type: 'public', sort: 'updated', direction: 'desc' });
      expect(mockOctokit.repos.listForUser).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'public', sort: 'updated', direction: 'desc' })
      );
    });
  });

  // ============================================================================
  // list_followers
  // ============================================================================

  describe('list_followers', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'list_followers');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should list followers for a specific user', async () => {
      mockOctokit.users.listFollowersForUser.mockResolvedValue({
        data: [makeSimpleUser('follower1')],
      });

      const result = (await handler({ username: 'octocat' })) as any[];
      expect(result).toHaveLength(1);
      expect(result[0].login).toBe('follower1');
      expect(mockOctokit.users.listFollowersForUser).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'octocat' })
      );
    });

    it('should list followers for authenticated user when no username given', async () => {
      mockOctokit.users.listFollowersForAuthenticatedUser.mockResolvedValue({
        data: [makeSimpleUser('fan1')],
      });

      const result = (await handler({})) as any[];
      expect(result).toHaveLength(1);
      expect(mockOctokit.users.listFollowersForAuthenticatedUser).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // list_following
  // ============================================================================

  describe('list_following', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'list_following');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should list users a specific user follows', async () => {
      mockOctokit.users.listFollowingForUser.mockResolvedValue({
        data: [makeSimpleUser('target1')],
      });

      const result = (await handler({ username: 'octocat' })) as any[];
      expect(result).toHaveLength(1);
      expect(result[0].login).toBe('target1');
      expect(mockOctokit.users.listFollowingForUser).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'octocat' })
      );
    });

    it('should list who authenticated user follows when no username given', async () => {
      mockOctokit.users.listFollowedByAuthenticatedUser.mockResolvedValue({
        data: [makeSimpleUser('followed1')],
      });

      const result = (await handler({})) as any[];
      expect(result).toHaveLength(1);
      expect(mockOctokit.users.listFollowedByAuthenticatedUser).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // check_following
  // ============================================================================

  describe('check_following', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'check_following');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should return following=true for specific user', async () => {
      mockOctokit.users.checkFollowingForUser.mockResolvedValue({});

      const result = (await handler({ username: 'octocat', target_user: 'torvalds' })) as any;
      expect(result.following).toBe(true);
      expect(result.message).toContain('octocat');
      expect(result.message).toContain('torvalds');
    });

    it('should return following=true for authenticated user', async () => {
      mockOctokit.users.checkPersonIsFollowedByAuthenticated.mockResolvedValue({});

      const result = (await handler({ target_user: 'torvalds' })) as any;
      expect(result.following).toBe(true);
      expect(result.message).toContain('torvalds');
      expect(mockOctokit.users.checkPersonIsFollowedByAuthenticated).toHaveBeenCalledWith(
        { username: 'torvalds' }
      );
    });

    it('should return following=false on 404 for specific user', async () => {
      const error = Object.assign(new Error('Not Found'), { status: 404 });
      mockOctokit.users.checkFollowingForUser.mockRejectedValue(error);

      const result = (await handler({ username: 'octocat', target_user: 'torvalds' })) as any;
      expect(result.following).toBe(false);
      expect(result.message).toContain('octocat');
    });

    it('should return following=false on 404 for authenticated user', async () => {
      const error = Object.assign(new Error('Not Found'), { status: 404 });
      mockOctokit.users.checkPersonIsFollowedByAuthenticated.mockRejectedValue(error);

      const result = (await handler({ target_user: 'torvalds' })) as any;
      expect(result.following).toBe(false);
    });

    it('should rethrow non-404 errors', async () => {
      const error = Object.assign(new Error('Server error'), { status: 500 });
      mockOctokit.users.checkPersonIsFollowedByAuthenticated.mockRejectedValue(error);

      await expect(handler({ target_user: 'torvalds' })).rejects.toThrow('Server error');
    });
  });

  // ============================================================================
  // Write-mode tools
  // ============================================================================

  describe('write-mode registration', () => {
    it('should register write tools when not read-only', () => {
      const writeTools = ['follow_user', 'unfollow_user', 'update_me'];
      for (const name of writeTools) {
        expect(tools.find(t => t.tool.name === name)).toBeDefined();
      }
    });

    it('should NOT register write tools in read-only mode', () => {
      const readOnlyTools = createUserTools(mockOctokit as any, true);
      expect(readOnlyTools.find(t => t.tool.name === 'follow_user')).toBeUndefined();
      expect(readOnlyTools.find(t => t.tool.name === 'unfollow_user')).toBeUndefined();
      expect(readOnlyTools.find(t => t.tool.name === 'update_me')).toBeUndefined();
    });
  });

  describe('follow_user', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'follow_user');
      handler = tool!.handler;
    });

    it('should follow a user', async () => {
      mockOctokit.users.follow.mockResolvedValue({});

      const result = (await handler({ username: 'octocat' })) as any;
      expect(mockOctokit.users.follow).toHaveBeenCalledWith({ username: 'octocat' });
      expect(result.success).toBe(true);
      expect(result.message).toContain('octocat');
    });
  });

  describe('unfollow_user', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'unfollow_user');
      handler = tool!.handler;
    });

    it('should unfollow a user', async () => {
      mockOctokit.users.unfollow.mockResolvedValue({});

      const result = (await handler({ username: 'octocat' })) as any;
      expect(mockOctokit.users.unfollow).toHaveBeenCalledWith({ username: 'octocat' });
      expect(result.success).toBe(true);
    });
  });

  describe('update_me', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'update_me');
      handler = tool!.handler;
    });

    it('should update the authenticated user profile', async () => {
      const updated = {
        ...makeAuthUser('mylogin'),
        name: 'New Name',
        bio: 'Updated bio',
      };
      mockOctokit.users.updateAuthenticated.mockResolvedValue({ data: updated });

      const result = (await handler({ name: 'New Name', bio: 'Updated bio' })) as any;
      expect(mockOctokit.users.updateAuthenticated).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Name', bio: 'Updated bio' })
      );
      expect(result.name).toBe('New Name');
      expect(result.bio).toBe('Updated bio');
    });
  });
});
