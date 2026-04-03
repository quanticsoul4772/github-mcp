import { IIssueRepository, IIssueService } from '../foundation/interfaces.js';
import { validateOwnerName, validateRepoName, ValidationError } from '../validation.js';

/**
 * Service layer for issue operations
 * Contains business logic and validation, delegates data access to repository
 */
export class IssueService implements IIssueService {
  constructor(private readonly issueRepository: IIssueRepository) {}

  async listIssues(owner: string, repo: string, options: any = {}): Promise<any> {
    // Validation
    if (!validateOwnerName(owner)) {
      throw new ValidationError('owner', 'Invalid repository owner name');
    }
    if (!validateRepoName(repo)) {
      throw new ValidationError('repo', 'Invalid repository name');
    }

    // Business logic (if any)
    const processedOptions = this.processListOptions(options);

    // Delegate to repository
    return this.issueRepository.list(owner, repo, processedOptions);
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<any> {
    // Validation
    if (!validateOwnerName(owner)) {
      throw new ValidationError('owner', 'Invalid repository owner name');
    }
    if (!validateRepoName(repo)) {
      throw new ValidationError('repo', 'Invalid repository name');
    }
    if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
      throw new ValidationError('issueNumber', 'Issue number must be a positive integer');
    }

    // Delegate to repository
    return this.issueRepository.get(owner, repo, issueNumber);
  }

  async createIssue(owner: string, repo: string, data: any): Promise<any> {
    // Validation
    if (!validateOwnerName(owner)) {
      throw new ValidationError('owner', 'Invalid repository owner name');
    }
    if (!validateRepoName(repo)) {
      throw new ValidationError('repo', 'Invalid repository name');
    }
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new ValidationError('title', 'Issue title is required and must be a non-empty string');
    }

    // Business logic - sanitize and process data
    const processedData = this.processIssueData(data);

    // Delegate to repository
    return this.issueRepository.create(owner, repo, processedData);
  }

  async updateIssue(owner: string, repo: string, issueNumber: number, data: any): Promise<any> {
    // Validation
    if (!validateOwnerName(owner)) {
      throw new ValidationError('owner', 'Invalid repository owner name');
    }
    if (!validateRepoName(repo)) {
      throw new ValidationError('repo', 'Invalid repository name');
    }
    if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
      throw new ValidationError('issueNumber', 'Issue number must be a positive integer');
    }

    // Business logic - sanitize and process data
    const processedData = this.processIssueData(data);

    // Delegate to repository
    return this.issueRepository.update(owner, repo, issueNumber, processedData);
  }

  private static isValidEnum(value: unknown, allowed: readonly string[]): boolean {
    return typeof value === 'string' && allowed.includes(value);
  }

  private static isValidPageSize(value: unknown): boolean {
    return Number.isInteger(value) && (value as number) > 0 && (value as number) <= 100;
  }

  private static isValidMilestone(value: unknown): boolean {
    return value != null && (typeof value === 'string' || typeof value === 'number');
  }

  /**
   * Process and validate list options
   */
  private processListOptions(options: any): any {
    const processed: any = {};

    if (IssueService.isValidEnum(options.state, ['open', 'closed', 'all'])) {
      processed.state = options.state;
    }
    if (Array.isArray(options.labels)) {
      processed.labels = options.labels.join(',');
    }
    if (typeof options.assignee === 'string') {
      processed.assignee = options.assignee;
    }
    if (IssueService.isValidMilestone(options.milestone)) {
      processed.milestone = options.milestone;
    }
    if (IssueService.isValidEnum(options.sort, ['created', 'updated', 'comments'])) {
      processed.sort = options.sort;
    }
    if (IssueService.isValidEnum(options.direction, ['asc', 'desc'])) {
      processed.direction = options.direction;
    }
    if (IssueService.isValidPageSize(options.per_page)) {
      processed.per_page = options.per_page;
    }
    if (Number.isInteger(options.page) && options.page > 0) {
      processed.page = options.page;
    }

    return processed;
  }

  /**
   * Process and sanitize issue data
   */
  private processIssueData(data: any): any {
    const processed: any = {};

    if (data.title && typeof data.title === 'string') {
      processed.title = data.title.trim();
    }

    if (data.body && typeof data.body === 'string') {
      processed.body = data.body.trim();
    }

    if (data.assignees && Array.isArray(data.assignees)) {
      processed.assignees = data.assignees.filter(
        (assignee: any) => typeof assignee === 'string' && assignee.trim().length > 0
      );
    }

    if (data.labels && Array.isArray(data.labels)) {
      processed.labels = data.labels.filter(
        (label: any) => typeof label === 'string' && label.trim().length > 0
      );
    }

    if (
      data.milestone &&
      (typeof data.milestone === 'string' || typeof data.milestone === 'number')
    ) {
      processed.milestone = data.milestone;
    }

    if (data.state && ['open', 'closed'].includes(data.state)) {
      processed.state = data.state;
    }

    return processed;
  }
}
