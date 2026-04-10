import { Octokit } from '@octokit/rest';
import { IGitHubClient } from './interfaces.js';

/**
 * GitHub API client implementation that wraps Octokit
 * This abstraction allows us to:
 * 1. Add common error handling
 * 2. Standardize response formats
 * 3. Make testing easier with mocks
 * 4. Add caching, retries, etc. in the future
 */
export class GitHubClient implements IGitHubClient {
  constructor(private readonly octokit: Octokit) {}

  // Repository operations
  async getRepository(owner: string, repo: string): Promise<unknown> {
    const { data } = await this.octokit.repos.get({ owner, repo });
    return data;
  }

  async getFileContents(owner: string, repo: string, path: string, ref?: string): Promise<unknown> {
    const params = ref ? { owner, repo, path, ref } : { owner, repo, path };
    const { data } = await this.octokit.repos.getContent(params);
    return data;
  }

  async createFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch?: string
  ): Promise<unknown> {
    const params = {
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content).toString('base64'),
      ...(branch ? { branch } : {}),
    };
    const { data } = await this.octokit.repos.createOrUpdateFileContents(params);
    return data;
  }

  async updateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha: string,
    branch?: string
  ): Promise<unknown> {
    const params = {
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content).toString('base64'),
      sha,
      ...(branch ? { branch } : {}),
    };
    const { data } = await this.octokit.repos.createOrUpdateFileContents(params);
    return data;
  }

  async deleteFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha: string,
    branch?: string
  ): Promise<unknown> {
    const params = {
      owner,
      repo,
      path,
      message,
      sha,
      ...(branch ? { branch } : {}),
    };
    const { data } = await this.octokit.repos.deleteFile(params);
    return data;
  }

  // Issue operations
  async listIssues(owner: string, repo: string, options: Record<string, unknown> = {}): Promise<unknown> {
    const { data } = await this.octokit.issues.listForRepo({
      owner,
      repo,
      ...options,
    });
    return data;
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<unknown> {
    const { data } = await this.octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });
    return data;
  }

  async createIssue(owner: string, repo: string, issueData: Record<string, unknown>): Promise<unknown> {
     
    const { data: result } = await this.octokit.issues.create({ owner, repo, ...issueData } as never);
    return result;
  }

  async updateIssue(owner: string, repo: string, issueNumber: number, issueData: Record<string, unknown>): Promise<unknown> {
     
    const { data: result } = await this.octokit.issues.update({ owner, repo, issue_number: issueNumber, ...issueData } as never);
    return result;
  }

  // Pull request operations
  async listPullRequests(owner: string, repo: string, options: Record<string, unknown> = {}): Promise<unknown> {
    const { data } = await this.octokit.pulls.list({
      owner,
      repo,
      ...options,
    });
    return data;
  }

  async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<unknown> {
    const { data } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });
    return data;
  }

  async createPullRequest(owner: string, repo: string, prData: Record<string, unknown>): Promise<unknown> {
     
    const { data: result } = await this.octokit.pulls.create({ owner, repo, ...prData } as never);
    return result;
  }

  async updatePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    prData: Record<string, unknown>
  ): Promise<unknown> {
     
    const { data: result } = await this.octokit.pulls.update({ owner, repo, pull_number: pullNumber, ...prData } as never);
    return result;
  }
}
