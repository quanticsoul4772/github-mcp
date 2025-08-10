import { IGitHubClient, IIssueRepository } from '../foundation/interfaces.js';

/**
 * Repository for issue-related data access
 * Implements the Repository pattern to separate data access from business logic
 */
export class IssueRepository implements IIssueRepository {
  constructor(private readonly githubClient: IGitHubClient) {}

  async list(owner: string, repo: string, options: any = {}): Promise<any> {
    return this.githubClient.listIssues(owner, repo, options);
  }

  async get(owner: string, repo: string, issueNumber: number): Promise<any> {
    return this.githubClient.getIssue(owner, repo, issueNumber);
  }

  async create(owner: string, repo: string, data: any): Promise<any> {
    return this.githubClient.createIssue(owner, repo, data);
  }

  async update(owner: string, repo: string, issueNumber: number, data: any): Promise<any> {
    return this.githubClient.updateIssue(owner, repo, issueNumber, data);
  }
}