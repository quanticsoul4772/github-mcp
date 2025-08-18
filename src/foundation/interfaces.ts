import { Octokit } from '@octokit/rest';

/**
 * GitHub API client abstraction interface
 */
export interface IGitHubClient {
  // Repository operations
  getRepository(owner: string, repo: string): Promise<any>;
  getFileContents(owner: string, repo: string, path: string, ref?: string): Promise<any>;
  createFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch?: string
  ): Promise<any>;
  updateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha: string,
    branch?: string
  ): Promise<any>;
  deleteFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha: string,
    branch?: string
  ): Promise<any>;

  // Issue operations
  listIssues(owner: string, repo: string, options?: any): Promise<any>;
  getIssue(owner: string, repo: string, issueNumber: number): Promise<any>;
  createIssue(owner: string, repo: string, data: any): Promise<any>;
  updateIssue(owner: string, repo: string, issueNumber: number, data: any): Promise<any>;

  // Pull request operations
  listPullRequests(owner: string, repo: string, options?: any): Promise<any>;
  getPullRequest(owner: string, repo: string, pullNumber: number): Promise<any>;
  createPullRequest(owner: string, repo: string, data: any): Promise<any>;
  updatePullRequest(owner: string, repo: string, pullNumber: number, data: any): Promise<any>;
}

/**
 * Repository pattern interfaces
 */
export interface IRepositoryRepository {
  get(owner: string, repo: string): Promise<any>;
  getFileContents(owner: string, repo: string, path: string, ref?: string): Promise<any>;
  createFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch?: string
  ): Promise<any>;
  updateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha: string,
    branch?: string
  ): Promise<any>;
  deleteFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha: string,
    branch?: string
  ): Promise<any>;
}

export interface IIssueRepository {
  list(owner: string, repo: string, options?: any): Promise<any>;
  get(owner: string, repo: string, issueNumber: number): Promise<any>;
  create(owner: string, repo: string, data: any): Promise<any>;
  update(owner: string, repo: string, issueNumber: number, data: any): Promise<any>;
}

export interface IPullRequestRepository {
  list(owner: string, repo: string, options?: any): Promise<any>;
  get(owner: string, repo: string, pullNumber: number): Promise<any>;
  create(owner: string, repo: string, data: any): Promise<any>;
  update(owner: string, repo: string, pullNumber: number, data: any): Promise<any>;
}

/**
 * Service layer interfaces
 */
export interface IRepositoryService {
  getRepository(owner: string, repo: string): Promise<any>;
  getFileContents(owner: string, repo: string, path: string, ref?: string): Promise<any>;
  createFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch?: string
  ): Promise<any>;
  updateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha: string,
    branch?: string
  ): Promise<any>;
  deleteFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha: string,
    branch?: string
  ): Promise<any>;
}

export interface IIssueService {
  listIssues(owner: string, repo: string, options?: any): Promise<any>;
  getIssue(owner: string, repo: string, issueNumber: number): Promise<any>;
  createIssue(owner: string, repo: string, data: any): Promise<any>;
  updateIssue(owner: string, repo: string, issueNumber: number, data: any): Promise<any>;
}

export interface IPullRequestService {
  listPullRequests(owner: string, repo: string, options?: any): Promise<any>;
  getPullRequest(owner: string, repo: string, pullNumber: number): Promise<any>;
  createPullRequest(owner: string, repo: string, data: any): Promise<any>;
  updatePullRequest(owner: string, repo: string, pullNumber: number, data: any): Promise<any>;
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
