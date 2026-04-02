/**
 * Tests for IssueRepository
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IssueRepository } from './issue-repository.js';

const makeGitHubClient = () => ({
  listIssues: vi.fn(),
  getIssue: vi.fn(),
  createIssue: vi.fn(),
  updateIssue: vi.fn(),
});

describe('IssueRepository', () => {
  let mockClient: ReturnType<typeof makeGitHubClient>;
  let repo: IssueRepository;

  beforeEach(() => {
    mockClient = makeGitHubClient();
    repo = new IssueRepository(mockClient as any);
  });

  it('should delegate list to githubClient.listIssues', async () => {
    mockClient.listIssues.mockResolvedValue([{ number: 1 }]);
    const result = await repo.list('owner', 'repo', { state: 'open' });
    expect(mockClient.listIssues).toHaveBeenCalledWith('owner', 'repo', { state: 'open' });
    expect(result).toHaveLength(1);
  });

  it('should delegate get to githubClient.getIssue', async () => {
    mockClient.getIssue.mockResolvedValue({ number: 5 });
    const result = await repo.get('owner', 'repo', 5);
    expect(mockClient.getIssue).toHaveBeenCalledWith('owner', 'repo', 5);
    expect(result.number).toBe(5);
  });

  it('should delegate create to githubClient.createIssue', async () => {
    mockClient.createIssue.mockResolvedValue({ number: 10, title: 'New issue' });
    const result = await repo.create('owner', 'repo', { title: 'New issue' });
    expect(mockClient.createIssue).toHaveBeenCalledWith('owner', 'repo', { title: 'New issue' });
    expect(result.number).toBe(10);
  });

  it('should delegate update to githubClient.updateIssue', async () => {
    mockClient.updateIssue.mockResolvedValue({ number: 3, state: 'closed' });
    const result = await repo.update('owner', 'repo', 3, { state: 'closed' });
    expect(mockClient.updateIssue).toHaveBeenCalledWith('owner', 'repo', 3, { state: 'closed' });
    expect(result.state).toBe('closed');
  });
});
