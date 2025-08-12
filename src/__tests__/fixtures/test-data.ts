/**
 * Test fixtures and data factories
 * Enhanced with deterministic data generation for stable tests
 */

// Seeded random number generator for deterministic tests
class SeededRandom {
  private seed: number;

  constructor(seed: number = 12345) {
    this.seed = seed;
  }

  // Linear congruential generator for deterministic random numbers
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) % 2147483648;
    return this.seed / 2147483648;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextString(prefix: string, length = 8): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = prefix + '-';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(this.next() * chars.length)];
    }
    return result;
  }

  nextSha(): string {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < 40; i++) {
      result += chars[Math.floor(this.next() * chars.length)];
    }
    return result;
  }

  nextBoolean(): boolean {
    return this.next() > 0.5;
  }

  nextFromArray<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }
}

// Factory configuration for deterministic vs random data
export interface FactoryConfig {
  seed?: number;
  deterministic?: boolean;
}

// Global configuration for test data generation
let globalConfig: FactoryConfig = {
  deterministic: true,
  seed: 12345,
};

export const setFactoryConfig = (config: FactoryConfig) => {
  globalConfig = { ...globalConfig, ...config };
};

export const resetFactoryConfig = () => {
  globalConfig = {
    deterministic: true,
    seed: 12345,
  };
};

// Utility functions for data generation (deterministic by default)
const getRandom = (seed?: number): SeededRandom | null => {
  if (globalConfig.deterministic) {
    return new SeededRandom(seed ?? globalConfig.seed);
  }
  return null; // Use Math.random() fallback
};

const generateId = (seed?: number) => {
  const random = getRandom(seed);
  return random 
    ? random.nextInt(1000, 999999)
    : Math.floor(Math.random() * 999000) + 1000;
};

const generateTimestamp = (offsetDays = 0) => {
  const date = new Date('2024-01-01T12:00:00Z'); // Fixed base date for tests
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
};

const generateString = (prefix: string, length = 8, seed?: number) => {
  const random = getRandom(seed);
  if (random) {
    return random.nextString(prefix, length);
  }
  return `${prefix}-${Math.random().toString(36).substring(2, length + 2)}`;
};

const generateSha = (seed?: number) => {
  const random = getRandom(seed);
  if (random) {
    return random.nextSha();
  }
  return Math.random().toString(36).substring(2, 42).padEnd(40, '0');
};

export const testFixtures = {
  // Repository fixtures (static for consistent testing)
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

  // User fixtures (static for consistent testing)
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

  // Issue fixtures (static for consistent testing)
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

  // Pull Request fixtures (static for consistent testing)
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
        sha: 'abc123def456789012345678901234567890abcd',
        repo: { name: 'public-repo', owner: { login: 'test-owner' } },
      },
      base: {
        ref: 'main',
        sha: 'def456abc123789012345678901234567890efgh',
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
        sha: 'xyz789uvw123456789012345678901234567890ijkl',
        repo: { name: 'public-repo', owner: { login: 'test-owner' } },
      },
      base: {
        ref: 'main',
        sha: 'uvw123xyz789012345678901234567890mnop',
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

  // Workflow fixtures (static for consistent testing)
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

  // Commit fixtures (static for consistent testing)
  commits: {
    recent: {
      sha: 'abc123def456789012345678901234567890abcd',
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
      parents: [{ sha: 'def456abc123789012345678901234567890efgh' }],
    },
  },

  // File content fixtures (static for consistent testing)
  files: {
    readme: {
      name: 'README.md',
      path: 'README.md',
      sha: 'file123sha456789012345678901234567890abc',
      size: 1024,
      content: Buffer.from('# Test Repository\n\nThis is a test repository.').toString('base64'),
      encoding: 'base64',
      type: 'file',
    },
    packageJson: {
      name: 'package.json',
      path: 'package.json',
      sha: 'file456sha789012345678901234567890def',
      size: 512,
      content: Buffer.from('{"name": "test-package", "version": "1.0.0"}').toString('base64'),
      encoding: 'base64',
      type: 'file',
    },
  },
};

// Enhanced data factories with deterministic generation
export const createRepository = (overrides: any = {}, seed?: number) => {
  const random = getRandom(seed);
  const id = overrides.id ?? generateId(seed);
  const name = overrides.name ?? generateString('repo', 8, seed);
  const owner = overrides.owner?.login ?? generateString('user', 6, seed);
  
  return {
    id,
    name,
    full_name: `${owner}/${name}`,
    owner: { 
      login: owner, 
      id: overrides.owner?.id ?? generateId((seed ?? 0) + 1) 
    },
    private: overrides.private ?? (random ? random.nextBoolean() : false),
    description: overrides.description ?? `Test repository ${name}`,
    default_branch: overrides.default_branch ?? 'main',
    created_at: overrides.created_at ?? generateTimestamp(-30),
    updated_at: overrides.updated_at ?? generateTimestamp(-1),
    pushed_at: overrides.pushed_at ?? generateTimestamp(-1),
    stargazers_count: overrides.stargazers_count ?? (random ? random.nextInt(0, 100) : 10),
    watchers_count: overrides.watchers_count ?? (random ? random.nextInt(0, 50) : 5),
    forks_count: overrides.forks_count ?? (random ? random.nextInt(0, 20) : 2),
    open_issues_count: overrides.open_issues_count ?? (random ? random.nextInt(0, 10) : 3),
    language: overrides.language ?? (random ? random.nextFromArray(['TypeScript', 'JavaScript', 'Python', 'Go']) : 'TypeScript'),
    topics: overrides.topics ?? [`mcp`, `github`, `api`, `test-${id}`],
    ...overrides,
  };
};

export const createUser = (overrides: any = {}, seed?: number) => {
  const random = getRandom(seed);
  const login = overrides.login ?? generateString('user', 8, seed);
  const id = overrides.id ?? generateId(seed);
  
  return {
    id,
    login,
    name: overrides.name ?? `Test User ${login}`,
    email: overrides.email ?? `${login}@example.com`,
    bio: overrides.bio ?? `Test user for GitHub MCP - ${login}`,
    location: overrides.location ?? 'Test City',
    company: overrides.company ?? 'Test Company',
    blog: overrides.blog ?? `https://${login}.example.com`,
    public_repos: overrides.public_repos ?? (random ? random.nextInt(0, 100) : 10),
    public_gists: overrides.public_gists ?? (random ? random.nextInt(0, 50) : 5),
    followers: overrides.followers ?? (random ? random.nextInt(0, 1000) : 100),
    following: overrides.following ?? (random ? random.nextInt(0, 500) : 50),
    created_at: overrides.created_at ?? generateTimestamp(-365),
    updated_at: overrides.updated_at ?? generateTimestamp(-1),
    ...overrides,
  };
};

export const createIssue = (overrides: any = {}, seed?: number) => {
  const random = getRandom(seed);
  const id = overrides.id ?? generateId(seed);
  const number = overrides.number ?? (random ? random.nextInt(1, 1000) : id);
  const title = overrides.title ?? generateString('issue', 12, seed);
  
  return {
    id,
    number,
    title,
    body: overrides.body ?? `This is test issue ${title} for testing purposes.`,
    state: overrides.state ?? (random ? random.nextFromArray(['open', 'closed']) : 'open'),
    user: overrides.user ?? { login: 'test-user', id: 1 },
    labels: overrides.labels ?? [{ name: 'test', color: '0000ff' }],
    assignees: overrides.assignees ?? [],
    milestone: overrides.milestone ?? null,
    created_at: overrides.created_at ?? generateTimestamp(-10),
    updated_at: overrides.updated_at ?? generateTimestamp(-1),
    closed_at: overrides.closed_at ?? null,
    comments: overrides.comments ?? (random ? random.nextInt(0, 20) : 0),
    ...overrides,
  };
};

export const createPullRequest = (overrides: any = {}, seed?: number) => {
  const random = getRandom(seed);
  const id = overrides.id ?? generateId(seed);
  const number = overrides.number ?? (random ? random.nextInt(1, 1000) : id);
  const title = overrides.title ?? generateString('pr', 12, seed);
  
  return {
    id,
    number,
    title,
    body: overrides.body ?? `This PR ${title} implements new functionality.`,
    state: overrides.state ?? (random ? random.nextFromArray(['open', 'closed']) : 'open'),
    user: overrides.user ?? { login: 'test-user', id: 1 },
    head: overrides.head ?? {
      ref: 'feature-branch',
      sha: generateSha(seed),
      repo: { name: 'test-repo', owner: { login: 'test-owner' } },
    },
    base: overrides.base ?? {
      ref: 'main',
      sha: generateSha((seed ?? 0) + 1),
      repo: { name: 'test-repo', owner: { login: 'test-owner' } },
    },
    mergeable: overrides.mergeable ?? true,
    merged: overrides.merged ?? false,
    draft: overrides.draft ?? false,
    created_at: overrides.created_at ?? generateTimestamp(-5),
    updated_at: overrides.updated_at ?? generateTimestamp(-1),
    closed_at: overrides.closed_at ?? null,
    merged_at: overrides.merged_at ?? null,
    ...overrides,
  };
};

export const createWorkflow = (overrides: any = {}, seed?: number) => {
  const id = overrides.id ?? generateId(seed);
  const name = overrides.name ?? generateString('workflow', 8, seed);
  
  return {
    id,
    name,
    path: overrides.path ?? `.github/workflows/${name}.yml`,
    state: overrides.state ?? 'active',
    created_at: overrides.created_at ?? generateTimestamp(-30),
    updated_at: overrides.updated_at ?? generateTimestamp(-1),
    url: overrides.url ?? `https://api.github.com/repos/test-owner/test-repo/workflows/${id}`,
    html_url: overrides.html_url ?? `https://github.com/test-owner/test-repo/actions/workflows/${name}.yml`,
    badge_url: overrides.badge_url ?? `https://github.com/test-owner/test-repo/workflows/${name}/badge.svg`,
    ...overrides,
  };
};

export const createCommit = (overrides: any = {}, seed?: number) => {
  const sha = overrides.sha ?? generateSha(seed);
  const message = overrides.message ?? generateString('commit', 20, seed);
  
  return {
    sha,
    commit: {
      message,
      author: overrides.commit?.author ?? {
        name: 'Test User',
        email: 'test@example.com',
        date: generateTimestamp(-1),
      },
      committer: overrides.commit?.committer ?? {
        name: 'Test User',
        email: 'test@example.com',
        date: generateTimestamp(-1),
      },
    },
    author: overrides.author ?? { login: 'test-user', id: 1 },
    committer: overrides.committer ?? { login: 'test-user', id: 1 },
    parents: overrides.parents ?? [{ sha: generateSha((seed ?? 0) + 1) }],
    ...overrides,
  };
};

export const createFile = (overrides: any = {}, seed?: number) => {
  const name = overrides.name ?? generateString('file', 8, seed) + '.txt';
  const path = overrides.path ?? name;
  const content = overrides.content ?? `Test content for ${name}`;
  
  return {
    name,
    path,
    sha: overrides.sha ?? generateSha(seed),
    size: overrides.size ?? content.length,
    content: Buffer.from(content).toString('base64'),
    encoding: 'base64',
    type: 'file',
    ...overrides,
  };
};

// Error generator functions for testing error scenarios
export const generateNetworkError = (overrides: any = {}) => {
  const errorTypes = [
    { code: 'ECONNREFUSED', message: 'Connection refused', errno: -61 },
    { code: 'ETIMEDOUT', message: 'Request timeout', errno: -60 },
    { code: 'ENOTFOUND', message: 'DNS lookup failed', errno: -3008 },
    { code: 'ENETUNREACH', message: 'Network unreachable', errno: -51 },
    { code: 'ECONNRESET', message: 'Connection reset by peer', errno: -54 },
  ];
  
  const random = getRandom();
  const errorType = random 
    ? errorTypes[random.nextInt(0, errorTypes.length - 1)]
    : errorTypes[0];
  
  return {
    code: overrides.code ?? errorType.code,
    message: overrides.message ?? errorType.message,
    errno: overrides.errno ?? errorType.errno,
    syscall: overrides.syscall ?? 'connect',
    hostname: overrides.hostname ?? 'api.github.com',
    port: overrides.port ?? 443,
    ...overrides,
  };
};

export const generateRandomApiError = (overrides: any = {}, seed?: number) => {
  const random = getRandom(seed);
  const statusCodes = [400, 401, 403, 404, 409, 422, 429, 500, 502, 503];
  const status = overrides.status ?? (random 
    ? statusCodes[random.nextInt(0, statusCodes.length - 1)]
    : 404);
  
  const errorMessages: Record<number, string> = {
    400: 'Bad Request',
    401: 'Requires authentication',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Validation Failed',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  
  const message = overrides.message ?? errorMessages[status] ?? 'Unknown Error';
  
  return {
    name: 'HttpError',
    status,
    message,
    response: {
      status,
      headers: overrides.headers ?? {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': status === 429 ? '0' : '4999',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
      },
      data: {
        message,
        documentation_url: `https://docs.github.com/rest/reference/${status}`,
        ...(status === 422 && {
          errors: [
            {
              resource: 'Issue',
              field: 'title',
              code: 'missing_field',
            },
          ],
        }),
        ...(status === 429 && {
          message: 'API rate limit exceeded',
        }),
      },
    },
    request: {
      method: overrides.method ?? 'GET',
      url: overrides.url ?? 'https://api.github.com/repos/test-owner/test-repo',
      headers: {
        authorization: 'token test-token-fixed-12345',
      },
    },
    ...overrides,
  };
};
