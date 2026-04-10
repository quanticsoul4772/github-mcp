/**
 * GitHub API client abstraction interface
 */
export interface IGitHubClient {
  // Repository operations
  getRepository(owner: string, repo: string): Promise<unknown>;
  getFileContents(owner: string, repo: string, path: string, ref?: string): Promise<unknown>;
  createFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch?: string
  ): Promise<unknown>;
  updateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha: string,
    branch?: string
  ): Promise<unknown>;
  deleteFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha: string,
    branch?: string
  ): Promise<unknown>;

  // Issue operations
  listIssues(owner: string, repo: string, options?: Record<string, unknown>): Promise<unknown>;
  getIssue(owner: string, repo: string, issueNumber: number): Promise<unknown>;
  createIssue(owner: string, repo: string, data: Record<string, unknown>): Promise<unknown>;
  updateIssue(owner: string, repo: string, issueNumber: number, data: Record<string, unknown>): Promise<unknown>;

  // Pull request operations
  listPullRequests(owner: string, repo: string, options?: Record<string, unknown>): Promise<unknown>;
  getPullRequest(owner: string, repo: string, pullNumber: number): Promise<unknown>;
  createPullRequest(owner: string, repo: string, data: Record<string, unknown>): Promise<unknown>;
  updatePullRequest(owner: string, repo: string, pullNumber: number, data: Record<string, unknown>): Promise<unknown>;
}

/**
 * Repository pattern interfaces
 */
export interface IRepositoryRepository {
  get(owner: string, repo: string): Promise<unknown>;
  getFileContents(owner: string, repo: string, path: string, ref?: string): Promise<unknown>;
  createFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch?: string
  ): Promise<unknown>;
  updateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha: string,
    branch?: string
  ): Promise<unknown>;
  deleteFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha: string,
    branch?: string
  ): Promise<unknown>;
}

export interface IIssueRepository {
  list(owner: string, repo: string, options?: Record<string, unknown>): Promise<unknown>;
  get(owner: string, repo: string, issueNumber: number): Promise<unknown>;
  create(owner: string, repo: string, data: Record<string, unknown>): Promise<unknown>;
  update(owner: string, repo: string, issueNumber: number, data: Record<string, unknown>): Promise<unknown>;
}

export interface IPullRequestRepository {
  list(owner: string, repo: string, options?: Record<string, unknown>): Promise<unknown>;
  get(owner: string, repo: string, pullNumber: number): Promise<unknown>;
  create(owner: string, repo: string, data: Record<string, unknown>): Promise<unknown>;
  update(owner: string, repo: string, pullNumber: number, data: Record<string, unknown>): Promise<unknown>;
}

/**
 * Service layer interfaces — return any since GitHub API response shapes are not yet fully typed
 */
export interface IRepositoryService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getRepository(owner: string, repo: string): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getFileContents(owner: string, repo: string, path: string, ref?: string): Promise<any>;
  createFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any>;
  updateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha: string,
    branch?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any>;
  deleteFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha: string,
    branch?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any>;
}

export interface IIssueService {
  // Return types remain `any` — narrowing requires a GitHubIssue interface (future refactor)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listIssues(owner: string, repo: string, options?: Record<string, unknown>): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getIssue(owner: string, repo: string, issueNumber: number): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createIssue(owner: string, repo: string, data: Record<string, unknown>): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateIssue(owner: string, repo: string, issueNumber: number, data: Record<string, unknown>): Promise<any>;
}

export interface IPullRequestService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listPullRequests(owner: string, repo: string, options?: Record<string, unknown>): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPullRequest(owner: string, repo: string, pullNumber: number): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createPullRequest(owner: string, repo: string, data: Record<string, unknown>): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatePullRequest(owner: string, repo: string, pullNumber: number, data: Record<string, unknown>): Promise<any>;
}

/**
 * Dependency injection container interface
 */
export interface IContainer {
  register<T>(token: symbol | string, implementation: T): void;
  resolve<T>(token: symbol | string): T;
}

/**
 * Dependency injection tokens
 */
export const DI_TOKENS = {
  GitHubClient: Symbol('GitHubClient'),
  RepositoryRepository: Symbol('RepositoryRepository'),
  IssueRepository: Symbol('IssueRepository'),
  PullRequestRepository: Symbol('PullRequestRepository'),
  RepositoryService: Symbol('RepositoryService'),
  IssueService: Symbol('IssueService'),
  PullRequestService: Symbol('PullRequestService'),
  Octokit: Symbol('Octokit'),
} as const;
