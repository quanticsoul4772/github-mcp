/**
 * Test fixtures and data factories
 * Enhanced with dynamic data generation to prevent test flakiness
 */

// Utility functions for dynamic data generation
const generateId = () => Math.floor(Math.random() * 1000000) + 1000;
const generateTimestamp = (offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
};
const generateString = (prefix: string, length = 8) => `${prefix}-${Math.random().toString(36).substring(2, length + 2)}`;
const generateSha = () => Math.random().toString(36).substring(2, 42);

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
      content: Buffer.from('# Test Repository\n\nThis is a test repository.').toString('base64'),
      encoding: 'base64',
      type: 'file',
    },
    packageJson: {
      name: 'package.json',
      path: 'package.json',
      sha: 'file456',
      size: 512,
      content: Buffer.from('{"name": "test-package", "version": "1.0.0"}').toString('base64'),
      encoding: 'base64',
      type: 'file',
    },
  },
};

// Enhanced data factories for generating dynamic test data
export const createRepository = (overrides = {}) => {
  const id = generateId();
  const name = generateString('repo');
  const owner = generateString('user');
  
  return {
    id,
    name,
    full_name: `${owner}/${name}`,
    owner: { login: owner, id: generateId() },
    private: Math.random() > 0.5,
    description: `Test repository ${name}`,
    default_branch: 'main',
    created_at: generateTimestamp(-30),
    updated_at: generateTimestamp(-1),
    pushed_at: generateTimestamp(-1),
    stargazers_count: Math.floor(Math.random() * 100),
    watchers_count: Math.floor(Math.random() * 50),
    forks_count: Math.floor(Math.random() * 20),
    open_issues_count: Math.floor(Math.random() * 10),
    language: ['TypeScript', 'JavaScript', 'Python', 'Go'][Math.floor(Math.random() * 4)],
    topics: [`mcp`, `github`, `api`, `test-${generateId()}`],
    ...overrides,
  };
};

export const createUser = (overrides = {}) => {
  const login = generateString('user');
  return {
    id: generateId(),
    login,
    name: `Test User ${login}`,
    email: `${login}@example.com`,
    bio: `Test user for GitHub MCP - ${login}`,
    location: 'Test City',
    company: 'Test Company',
    blog: `https://${login}.example.com`,
    public_repos: Math.floor(Math.random() * 100),
    public_gists: Math.floor(Math.random() * 50),
    followers: Math.floor(Math.random() * 1000),
    following: Math.floor(Math.random() * 500),
    created_at: generateTimestamp(-365),
    updated_at: generateTimestamp(-1),
    ...overrides,
  };
};

export const createIssue = (overrides = {}) => {
  const id = generateId();
  const number = Math.floor(Math.random() * 1000) + 1;
  const user = createUser();
  
  return {
    id,
    number,
    title: `Test Issue ${number}`,
    body: `This is a test issue for testing purposes - ${generateId()}`,
    state: Math.random() > 0.7 ? 'closed' : 'open',
    user: { login: user.login, id: user.id },
    labels: [
      { name: 'bug', color: 'ff0000' },
      { name: `priority-${['low', 'medium', 'high'][Math.floor(Math.random() * 3)]}`, color: 'ff6600' },
    ].slice(0, Math.floor(Math.random() * 3)),
    assignees: Math.random() > 0.5 ? [{ login: user.login, id: user.id }] : [],
    milestone: Math.random() > 0.7 ? { title: `v${Math.floor(Math.random() * 5) + 1}.0.0`, number: 1 } : null,
    created_at: generateTimestamp(-7),
    updated_at: generateTimestamp(-1),
    closed_at: Math.random() > 0.7 ? generateTimestamp(-1) : null,
    comments: Math.floor(Math.random() * 10),
    ...overrides,
  };
};

export const createPullRequest = (overrides = {}) => {
  const id = generateId();
  const number = Math.floor(Math.random() * 1000) + 1;
  const user = createUser();
  const repo = createRepository();
  const state = ['open', 'closed'][Math.floor(Math.random() * 2)];
  const merged = state === 'closed' && Math.random() > 0.3;
  
  return {
    id,
    number,
    title: `${['Add', 'Fix', 'Update', 'Remove'][Math.floor(Math.random() * 4)]} feature ${number}`,
    body: `This PR implements feature ${number} - ${generateId()}`,
    state,
    user: { login: user.login, id: user.id },
    head: {
      ref: `feature-${generateString('branch')}`,
      sha: generateSha(),
      repo: { name: repo.name, owner: { login: repo.owner.login } },
    },
    base: {
      ref: 'main',
      sha: generateSha(),
      repo: { name: repo.name, owner: { login: repo.owner.login } },
    },
    mergeable: Math.random() > 0.1,
    merged,
    draft: Math.random() > 0.8,
    created_at: generateTimestamp(-7),
    updated_at: generateTimestamp(-1),
    closed_at: state === 'closed' ? generateTimestamp(-1) : null,
    merged_at: merged ? generateTimestamp(-1) : null,
    ...overrides,
  };
};

export const createWorkflow = (overrides = {}) => {
  const id = generateId();
  const name = generateString('workflow');
  
  return {
    id,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    path: `.github/workflows/${name}.yml`,
    state: ['active', 'disabled_manually'][Math.floor(Math.random() * 2)],
    created_at: generateTimestamp(-30),
    updated_at: generateTimestamp(-1),
    url: `https://api.github.com/repos/test-owner/test-repo/workflows/${id}`,
    html_url: `https://github.com/test-owner/test-repo/actions/workflows/${name}.yml`,
    badge_url: `https://github.com/test-owner/test-repo/workflows/${name}/badge.svg`,
    ...overrides,
  };
};

export const createCommit = (overrides = {}) => {
  const sha = generateSha();
  const user = createUser();
  
  return {
    sha,
    commit: {
      message: `${['Add', 'Fix', 'Update', 'Remove'][Math.floor(Math.random() * 4)]} implementation - ${generateId()}`,
      author: {
        name: user.name,
        email: user.email,
        date: generateTimestamp(-1),
      },
      committer: {
        name: user.name,
        email: user.email,
        date: generateTimestamp(-1),
      },
    },
    author: { login: user.login, id: user.id },
    committer: { login: user.login, id: user.id },
    parents: [{ sha: generateSha() }],
    ...overrides,
  };
};

export const createFile = (overrides = {}) => {
  const name = `${generateString('file')}.${['md', 'ts', 'js', 'json', 'yml'][Math.floor(Math.random() * 5)]}`;
  const content = `# ${name}\n\nThis is test content for ${name} - ${generateId()}`;
  
  return {
    name,
    path: name,
    sha: generateSha(),
    size: content.length,
    content: Buffer.from(content).toString('base64'),
    encoding: 'base64',
    type: 'file',
    ...overrides,
  };
};

// Random data generators for specific use cases
export const generateRandomApiError = () => {
  const codes = [400, 401, 403, 404, 422, 429, 500, 502, 503, 504];
  const statusCode = codes[Math.floor(Math.random() * codes.length)];
  
  return {
    response: {
      status: statusCode,
      data: {
        message: `API Error ${statusCode} - ${generateId()}`,
        errors: [
          {
            field: 'test_field',
            code: 'invalid',
            message: `Field validation failed - ${generateId()}`
          }
        ]
      },
      headers: statusCode === 429 ? {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': Math.floor(Date.now() / 1000) + 3600,
      } : {}
    }
  };
};

export const generateNetworkError = () => {
  const codes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'];
  const code = codes[Math.floor(Math.random() * codes.length)];
  
  return {
    code,
    message: `Network error: ${code} - ${generateId()}`,
    errno: -Math.floor(Math.random() * 100),
    syscall: 'connect',
  };
};