/**
 * Test fixtures and data factories
 */

export const testFixtures = {
  // Repository fixtures
  repositories: {
    public: {
      id: 1,
      name: 'public-repo',
      full_name: 'test-owner/public-repo',
      owner: { login: 'test-owner', id: 1 },
      private: false,
      description: 'A public test repository',
      default_branch: 'main',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T12:00:00Z',
      pushed_at: '2024-01-01T12:00:00Z',
      stargazers_count: 10,
      watchers_count: 5,
      forks_count: 2,
      open_issues_count: 3,
      language: 'TypeScript',
      topics: ['mcp', 'github', 'api'],
    },
    private: {
      id: 2,
      name: 'private-repo',
      full_name: 'test-owner/private-repo',
      owner: { login: 'test-owner', id: 1 },
      private: true,
      description: 'A private test repository',
      default_branch: 'main',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T12:00:00Z',
      pushed_at: '2024-01-01T12:00:00Z',
      stargazers_count: 0,
      watchers_count: 1,
      forks_count: 0,
      open_issues_count: 1,
      language: 'JavaScript',
      topics: ['private'],
    },
  },

  // User fixtures
  users: {
    authenticated: {
      id: 1,
      login: 'test-user',
      name: 'Test User',
      email: 'test@example.com',
      bio: 'Test user for GitHub MCP',
      location: 'Test City',
      company: 'Test Company',
      blog: 'https://test.example.com',
      public_repos: 10,
      public_gists: 5,
      followers: 100,
      following: 50,
      created_at: '2020-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    other: {
      id: 2,
      login: 'other-user',
      name: 'Other User',
      email: 'other@example.com',
      bio: 'Another test user',
      public_repos: 5,
      followers: 20,
      following: 30,
      created_at: '2021-01-01T00:00:00Z',
    },
  },

  // Issue fixtures
  issues: {
    open: {
      id: 1,
      number: 1,
      title: 'Test Issue',
      body: 'This is a test issue for testing purposes.',
      state: 'open',
      user: { login: 'test-user', id: 1 },
      labels: [
        { name: 'bug', color: 'ff0000' },
        { name: 'priority-high', color: 'ff6600' },
      ],
      assignees: [{ login: 'test-user', id: 1 }],
      milestone: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T12:00:00Z',
      closed_at: null,
      comments: 2,
    },
    closed: {
      id: 2,
      number: 2,
      title: 'Closed Issue',
      body: 'This issue has been resolved.',
      state: 'closed',
      user: { login: 'test-user', id: 1 },
      labels: [{ name: 'enhancement', color: '00ff00' }],
      assignees: [],
      milestone: { title: 'v1.0.0', number: 1 },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      closed_at: '2024-01-02T00:00:00Z',
      comments: 1,
    },
  },

  // Pull Request fixtures
  pullRequests: {
    open: {
      id: 1,
      number: 1,
      title: 'Add new feature',
      body: 'This PR adds a new feature to the application.',
      state: 'open',
      user: { login: 'test-user', id: 1 },
      head: {
        ref: 'feature-branch',
        sha: 'abc123def456',
        repo: { name: 'public-repo', owner: { login: 'test-owner' } },
      },
      base: {
        ref: 'main',
        sha: 'def456abc123',
        repo: { name: 'public-repo', owner: { login: 'test-owner' } },
      },
      mergeable: true,
      merged: false,
      draft: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T12:00:00Z',
      closed_at: null,
      merged_at: null,
    },
    merged: {
      id: 2,
      number: 2,
      title: 'Fix bug',
      body: 'This PR fixes a critical bug.',
      state: 'closed',
      user: { login: 'other-user', id: 2 },
      head: {
        ref: 'bugfix-branch',
        sha: 'xyz789uvw123',
        repo: { name: 'public-repo', owner: { login: 'test-owner' } },
      },
      base: {
        ref: 'main',
        sha: 'uvw123xyz789',
        repo: { name: 'public-repo', owner: { login: 'test-owner' } },
      },
      mergeable: null,
      merged: true,
      draft: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      closed_at: '2024-01-02T00:00:00Z',
      merged_at: '2024-01-02T00:00:00Z',
    },
  },

  // Workflow fixtures
  workflows: {
    active: {
      id: 1,
      name: 'CI',
      path: '.github/workflows/ci.yml',
      state: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      url: 'https://api.github.com/repos/test-owner/public-repo/workflows/1',
      html_url: 'https://github.com/test-owner/public-repo/actions/workflows/ci.yml',
      badge_url: 'https://github.com/test-owner/public-repo/workflows/CI/badge.svg',
    },
    disabled: {
      id: 2,
      name: 'Deploy',
      path: '.github/workflows/deploy.yml',
      state: 'disabled_manually',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      url: 'https://api.github.com/repos/test-owner/public-repo/workflows/2',
      html_url: 'https://github.com/test-owner/public-repo/actions/workflows/deploy.yml',
      badge_url: 'https://github.com/test-owner/public-repo/workflows/Deploy/badge.svg',
    },
  },

  // Commit fixtures
  commits: {
    recent: {
      sha: 'abc123def456',
      commit: {
        message: 'Add new feature implementation',
        author: {
          name: 'Test User',
          email: 'test@example.com',
          date: '2024-01-01T12:00:00Z',
        },
        committer: {
          name: 'Test User',
          email: 'test@example.com',
          date: '2024-01-01T12:00:00Z',
        },
      },
      author: { login: 'test-user', id: 1 },
      committer: { login: 'test-user', id: 1 },
      parents: [{ sha: 'def456abc123' }],
    },
  },

  // File content fixtures
  files: {
    readme: {
      name: 'README.md',
      path: 'README.md',
      sha: 'file123',
      size: 1024,
      content: btoa('# Test Repository\n\nThis is a test repository.'),
      encoding: 'base64',
      type: 'file',
    },
    packageJson: {
      name: 'package.json',
      path: 'package.json',
      sha: 'file456',
      size: 512,
      content: btoa('{"name": "test-package", "version": "1.0.0"}'),
      encoding: 'base64',
      type: 'file',
    },
  },
};

// Data factories for generating test data
export const createRepository = (overrides = {}) => ({
  ...testFixtures.repositories.public,
  ...overrides,
});

export const createUser = (overrides = {}) => ({
  ...testFixtures.users.authenticated,
  ...overrides,
});

export const createIssue = (overrides = {}) => ({
  ...testFixtures.issues.open,
  ...overrides,
});

export const createPullRequest = (overrides = {}) => ({
  ...testFixtures.pullRequests.open,
  ...overrides,
});

export const createWorkflow = (overrides = {}) => ({
  ...testFixtures.workflows.active,
  ...overrides,
});

export const createCommit = (overrides = {}) => ({
  ...testFixtures.commits.recent,
  ...overrides,
});

export const createFile = (overrides = {}) => ({
  ...testFixtures.files.readme,
  ...overrides,
});