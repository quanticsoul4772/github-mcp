/**
 * Tests for GitHub Organizations tools
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createOrganizationTools } from './organizations.js';

const makeOrgItem = (login = 'myorg') => ({
  login,
  id: 1,
  node_id: 'O_1',
  avatar_url: `https://avatars.githubusercontent.com/u/1`,
  gravatar_id: '',
  url: `https://api.github.com/orgs/${login}`,
  html_url: `https://github.com/${login}`,
  type: 'Organization',
  site_admin: false,
  score: 1.0,
});

const makeOrgDetail = (login = 'myorg') => ({
  login,
  id: 1,
  node_id: 'O_1',
  url: `https://api.github.com/orgs/${login}`,
  html_url: `https://github.com/${login}`,
  name: 'My Org',
  company: null,
  blog: 'https://example.com',
  location: 'SF',
  email: 'admin@example.com',
  twitter_username: null,
  description: 'Test org',
  public_repos: 10,
  public_gists: 0,
  followers: 100,
  following: 0,
  created_at: '2020-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  type: 'Organization',
  total_private_repos: 5,
  owned_private_repos: 5,
  private_gists: 0,
  disk_usage: 1000,
  collaborators: 10,
  billing_email: 'billing@example.com',
  plan: null,
  default_repository_permission: 'read',
  members_can_create_repositories: true,
  two_factor_requirement_enabled: false,
  members_allowed_repository_creation_type: null,
  members_can_create_public_repositories: true,
  members_can_create_private_repositories: true,
  members_can_create_internal_repositories: false,
  members_can_create_pages: true,
  members_can_fork_private_repositories: false,
});

const makeMember = (login = 'user1') => ({
  login,
  id: 42,
  node_id: 'U_42',
  avatar_url: `https://avatars.githubusercontent.com/u/42`,
  gravatar_id: '',
  url: `https://api.github.com/users/${login}`,
  html_url: `https://github.com/${login}`,
  type: 'User',
  site_admin: false,
});

const makeRepo = (name = 'my-repo') => ({
  id: 123,
  name,
  full_name: `myorg/${name}`,
  owner: { login: 'myorg', type: 'Organization' },
  private: false,
  html_url: `https://github.com/myorg/${name}`,
  description: 'A repo',
  fork: false,
  created_at: '2022-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  pushed_at: '2024-01-15T00:00:00Z',
  language: 'TypeScript',
  stargazers_count: 50,
  watchers_count: 50,
  forks_count: 5,
  open_issues_count: 3,
  default_branch: 'main',
  archived: false,
  disabled: false,
  visibility: 'public',
});

const makeTeam = (name = 'backend') => ({
  id: 10,
  node_id: 'T_10',
  url: 'https://api.github.com/teams/10',
  html_url: 'https://github.com/orgs/myorg/teams/backend',
  name,
  slug: name,
  description: 'Backend team',
  privacy: 'closed',
  permission: 'push',
  members_url: 'https://api.github.com/teams/10/members{/member}',
  repositories_url: 'https://api.github.com/teams/10/repos',
  parent: null,
});

const makeOctokit = () => ({
  search: {
    users: vi.fn(),
  },
  orgs: {
    get: vi.fn(),
    listMembers: vi.fn(),
    checkMembershipForUser: vi.fn(),
    listForUser: vi.fn(),
    listForAuthenticatedUser: vi.fn(),
    update: vi.fn(),
  },
  repos: {
    listForOrg: vi.fn(),
  },
  teams: {
    list: vi.fn(),
  },
});

describe('Organization Tools', () => {
  let mockOctokit: ReturnType<typeof makeOctokit>;
  let tools: ReturnType<typeof createOrganizationTools>;

  beforeEach(() => {
    mockOctokit = makeOctokit();
    tools = createOrganizationTools(mockOctokit as any, false);
  });

  // ============================================================================
  // search_orgs
  // ============================================================================

  describe('search_orgs', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'search_orgs');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should be registered', () => {
      expect(tools.find(t => t.tool.name === 'search_orgs')).toBeDefined();
    });

    it('should search organizations', async () => {
      mockOctokit.search.users.mockResolvedValue({
        data: {
          total_count: 1,
          incomplete_results: false,
          items: [makeOrgItem('myorg')],
        },
      });

      const result = (await handler({ query: 'myorg' })) as any;
      expect(result.total_count).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].login).toBe('myorg');
      expect(result.items[0].type).toBe('Organization');
    });

    it('should append type:org to query', async () => {
      mockOctokit.search.users.mockResolvedValue({
        data: { total_count: 0, incomplete_results: false, items: [] },
      });

      await handler({ query: 'acme' });
      expect(mockOctokit.search.users).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'acme type:org' })
      );
    });

    it('should pass sort/order/pagination', async () => {
      mockOctokit.search.users.mockResolvedValue({
        data: { total_count: 0, incomplete_results: false, items: [] },
      });

      await handler({ query: 'acme', sort: 'followers', order: 'desc', page: 2, perPage: 20 });
      expect(mockOctokit.search.users).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'followers', order: 'desc', page: 2, per_page: 20 })
      );
    });
  });

  // ============================================================================
  // get_org
  // ============================================================================

  describe('get_org', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'get_org');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should return org details', async () => {
      mockOctokit.orgs.get.mockResolvedValue({ data: makeOrgDetail('myorg') });

      const result = (await handler({ org: 'myorg' })) as any;
      expect(mockOctokit.orgs.get).toHaveBeenCalledWith({ org: 'myorg' });
      expect(result.login).toBe('myorg');
      expect(result.public_repos).toBe(10);
      expect(result.billing_email).toBe('billing@example.com');
    });
  });

  // ============================================================================
  // list_org_members
  // ============================================================================

  describe('list_org_members', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'list_org_members');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should list org members', async () => {
      mockOctokit.orgs.listMembers.mockResolvedValue({
        data: [makeMember('user1'), makeMember('user2')],
      });

      const result = (await handler({ org: 'myorg' })) as any[];
      expect(result).toHaveLength(2);
      expect(result[0].login).toBe('user1');
      expect(result[0].type).toBe('User');
    });

    it('should pass filters', async () => {
      mockOctokit.orgs.listMembers.mockResolvedValue({ data: [] });

      await handler({ org: 'myorg', filter: '2fa_disabled', role: 'admin', page: 1, perPage: 50 });
      expect(mockOctokit.orgs.listMembers).toHaveBeenCalledWith(
        expect.objectContaining({ filter: '2fa_disabled', role: 'admin', per_page: 50 })
      );
    });
  });

  // ============================================================================
  // list_org_repos
  // ============================================================================

  describe('list_org_repos', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'list_org_repos');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should list org repos', async () => {
      mockOctokit.repos.listForOrg.mockResolvedValue({
        data: [makeRepo('repo-a'), makeRepo('repo-b')],
      });

      const result = (await handler({ org: 'myorg' })) as any[];
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('repo-a');
      expect(result[0].owner.login).toBe('myorg');
      expect(result[0].language).toBe('TypeScript');
    });

    it('should pass type/sort/direction/pagination', async () => {
      mockOctokit.repos.listForOrg.mockResolvedValue({ data: [] });

      await handler({ org: 'myorg', type: 'public', sort: 'updated', direction: 'desc' });
      expect(mockOctokit.repos.listForOrg).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'public', sort: 'updated', direction: 'desc' })
      );
    });
  });

  // ============================================================================
  // list_org_teams
  // ============================================================================

  describe('list_org_teams', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'list_org_teams');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should list org teams', async () => {
      mockOctokit.teams.list.mockResolvedValue({
        data: [makeTeam('backend'), makeTeam('frontend')],
      });

      const result = (await handler({ org: 'myorg' })) as any[];
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('backend');
      expect(result[0].privacy).toBe('closed');
      expect(result[0].parent).toBeNull();
    });
  });

  // ============================================================================
  // check_org_membership
  // ============================================================================

  describe('check_org_membership', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'check_org_membership');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should return is_member=true when user is a member', async () => {
      mockOctokit.orgs.checkMembershipForUser.mockResolvedValue({});

      const result = (await handler({ org: 'myorg', username: 'user1' })) as any;
      expect(result.is_member).toBe(true);
      expect(result.message).toContain('user1');
    });

    it('should return is_member=false on 404', async () => {
      const error = Object.assign(new Error('Not Found'), { status: 404 });
      mockOctokit.orgs.checkMembershipForUser.mockRejectedValue(error);

      const result = (await handler({ org: 'myorg', username: 'outsider' })) as any;
      expect(result.is_member).toBe(false);
      expect(result.message).toContain('outsider');
    });

    it('should rethrow non-404 errors', async () => {
      const error = Object.assign(new Error('Server error'), { status: 500 });
      mockOctokit.orgs.checkMembershipForUser.mockRejectedValue(error);

      await expect(handler({ org: 'myorg', username: 'user1' })).rejects.toThrow('Server error');
    });
  });

  // ============================================================================
  // list_user_orgs
  // ============================================================================

  describe('list_user_orgs', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'list_user_orgs');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    const makeSimpleOrg = (login = 'myorg') => ({
      login,
      id: 1,
      node_id: 'O_1',
      url: `https://api.github.com/orgs/${login}`,
      avatar_url: `https://avatars.githubusercontent.com/u/1`,
      description: 'Test org',
    });

    it('should list orgs for a specific user', async () => {
      mockOctokit.orgs.listForUser.mockResolvedValue({ data: [makeSimpleOrg('myorg')] });

      const result = (await handler({ username: 'someuser' })) as any[];
      expect(result).toHaveLength(1);
      expect(result[0].login).toBe('myorg');
      expect(mockOctokit.orgs.listForUser).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'someuser' })
      );
    });

    it('should list orgs for authenticated user when no username given', async () => {
      mockOctokit.orgs.listForAuthenticatedUser.mockResolvedValue({ data: [makeSimpleOrg('authorg')] });

      const result = (await handler({})) as any[];
      expect(result).toHaveLength(1);
      expect(result[0].login).toBe('authorg');
      expect(mockOctokit.orgs.listForAuthenticatedUser).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Write-mode tools
  // ============================================================================

  describe('write-mode registration', () => {
    it('should register update_org when not read-only', () => {
      expect(tools.find(t => t.tool.name === 'update_org')).toBeDefined();
    });

    it('should NOT register update_org in read-only mode', () => {
      const readOnlyTools = createOrganizationTools(mockOctokit as any, true);
      expect(readOnlyTools.find(t => t.tool.name === 'update_org')).toBeUndefined();
    });
  });

  describe('update_org', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'update_org');
      handler = tool!.handler;
    });

    it('should update an org and return updated data', async () => {
      const updated = {
        ...makeOrgDetail('myorg'),
        name: 'Updated Org',
        description: 'New description',
        billing_email: 'new@example.com',
      };
      mockOctokit.orgs.update.mockResolvedValue({ data: updated });

      const result = (await handler({
        org: 'myorg',
        name: 'Updated Org',
        description: 'New description',
        billing_email: 'new@example.com',
      })) as any;

      expect(mockOctokit.orgs.update).toHaveBeenCalledWith(
        expect.objectContaining({ org: 'myorg', name: 'Updated Org' })
      );
      expect(result.name).toBe('Updated Org');
      expect(result.description).toBe('New description');
    });
  });
});
