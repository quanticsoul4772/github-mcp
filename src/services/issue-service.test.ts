/**
 * Tests for IssueService — service layer with business logic and validation
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IssueService } from './issue-service.js';

const makeRepo = () => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
});

const makeIssueData = (overrides = {}) => ({
  number: 1,
  title: 'Test issue',
  state: 'open',
  body: 'Body text',
  ...overrides,
});

describe('IssueService', () => {
  let mockRepo: ReturnType<typeof makeRepo>;
  let service: IssueService;

  beforeEach(() => {
    mockRepo = makeRepo();
    service = new IssueService(mockRepo);
  });

  // ============================================================================
  // listIssues
  // ============================================================================

  describe('listIssues', () => {
    it('should list issues with defaults', async () => {
      mockRepo.list.mockResolvedValue([makeIssueData()]);

      const result = await service.listIssues('owner', 'repo');
      expect(mockRepo.list).toHaveBeenCalledWith('owner', 'repo', {});
      expect(result).toHaveLength(1);
    });

    it('should process state filter', async () => {
      mockRepo.list.mockResolvedValue([]);

      await service.listIssues('owner', 'repo', { state: 'closed' });
      expect(mockRepo.list).toHaveBeenCalledWith('owner', 'repo', expect.objectContaining({ state: 'closed' }));
    });

    it('should ignore invalid state filter', async () => {
      mockRepo.list.mockResolvedValue([]);

      await service.listIssues('owner', 'repo', { state: 'invalid' });
      const callArgs = mockRepo.list.mock.calls[0][2];
      expect(callArgs).not.toHaveProperty('state');
    });

    it('should join labels array into comma string', async () => {
      mockRepo.list.mockResolvedValue([]);

      await service.listIssues('owner', 'repo', { labels: ['bug', 'help wanted'] });
      expect(mockRepo.list).toHaveBeenCalledWith(
        'owner', 'repo',
        expect.objectContaining({ labels: 'bug,help wanted' })
      );
    });

    it('should pass assignee filter', async () => {
      mockRepo.list.mockResolvedValue([]);
      await service.listIssues('owner', 'repo', { assignee: 'user1' });
      expect(mockRepo.list).toHaveBeenCalledWith('owner', 'repo', expect.objectContaining({ assignee: 'user1' }));
    });

    it('should pass milestone filter', async () => {
      mockRepo.list.mockResolvedValue([]);
      await service.listIssues('owner', 'repo', { milestone: 5 });
      expect(mockRepo.list).toHaveBeenCalledWith('owner', 'repo', expect.objectContaining({ milestone: 5 }));
    });

    it('should pass valid sort/direction/pagination', async () => {
      mockRepo.list.mockResolvedValue([]);
      await service.listIssues('owner', 'repo', { sort: 'updated', direction: 'desc', per_page: 50, page: 2 });
      expect(mockRepo.list).toHaveBeenCalledWith(
        'owner', 'repo',
        expect.objectContaining({ sort: 'updated', direction: 'desc', per_page: 50, page: 2 })
      );
    });

    it('should ignore invalid sort/direction', async () => {
      mockRepo.list.mockResolvedValue([]);
      await service.listIssues('owner', 'repo', { sort: 'invalid', direction: 'sideways' });
      const callArgs = mockRepo.list.mock.calls[0][2];
      expect(callArgs).not.toHaveProperty('sort');
      expect(callArgs).not.toHaveProperty('direction');
    });

    it('should ignore per_page > 100 or <= 0', async () => {
      mockRepo.list.mockResolvedValue([]);
      await service.listIssues('owner', 'repo', { per_page: 101 });
      const callArgs = mockRepo.list.mock.calls[0][2];
      expect(callArgs).not.toHaveProperty('per_page');
    });

    it('should throw ValidationError for invalid owner', async () => {
      await expect(service.listIssues('invalid owner!', 'repo')).rejects.toThrow();
    });

    it('should throw ValidationError for invalid repo', async () => {
      await expect(service.listIssues('owner', '')).rejects.toThrow();
    });
  });

  // ============================================================================
  // getIssue
  // ============================================================================

  describe('getIssue', () => {
    it('should get an issue', async () => {
      mockRepo.get.mockResolvedValue(makeIssueData({ number: 5 }));

      const result = await service.getIssue('owner', 'repo', 5);
      expect(mockRepo.get).toHaveBeenCalledWith('owner', 'repo', 5);
      expect(result.number).toBe(5);
    });

    it('should throw for non-integer issue number', async () => {
      await expect(service.getIssue('owner', 'repo', 0)).rejects.toThrow();
    });

    it('should throw for negative issue number', async () => {
      await expect(service.getIssue('owner', 'repo', -1)).rejects.toThrow();
    });

    it('should throw for invalid owner', async () => {
      await expect(service.getIssue('bad owner', 'repo', 1)).rejects.toThrow();
    });

    it('should throw for invalid repo', async () => {
      await expect(service.getIssue('owner', '', 1)).rejects.toThrow();
    });
  });

  // ============================================================================
  // createIssue
  // ============================================================================

  describe('createIssue', () => {
    it('should create an issue', async () => {
      mockRepo.create.mockResolvedValue(makeIssueData());

      await service.createIssue('owner', 'repo', { title: 'Bug found', body: 'Details here' });
      expect(mockRepo.create).toHaveBeenCalledWith(
        'owner', 'repo',
        expect.objectContaining({ title: 'Bug found', body: 'Details here' })
      );
    });

    it('should trim title and body', async () => {
      mockRepo.create.mockResolvedValue(makeIssueData());

      await service.createIssue('owner', 'repo', { title: '  spaces  ', body: '  body  ' });
      expect(mockRepo.create).toHaveBeenCalledWith(
        'owner', 'repo',
        expect.objectContaining({ title: 'spaces', body: 'body' })
      );
    });

    it('should filter empty assignees and labels', async () => {
      mockRepo.create.mockResolvedValue(makeIssueData());

      await service.createIssue('owner', 'repo', {
        title: 'Test',
        assignees: ['user1', '', '  '],
        labels: ['bug', '', '  '],
      });
      const callArgs = mockRepo.create.mock.calls[0][2];
      expect(callArgs.assignees).toEqual(['user1']);
      expect(callArgs.labels).toEqual(['bug']);
    });

    it('should throw for invalid repo', async () => {
      await expect(service.createIssue('owner', '', { title: 'Test' })).rejects.toThrow();
    });

    it('should throw for empty title', async () => {
      await expect(service.createIssue('owner', 'repo', { title: '' })).rejects.toThrow();
    });

    it('should throw for missing title', async () => {
      await expect(service.createIssue('owner', 'repo', {})).rejects.toThrow();
    });

    it('should process milestone', async () => {
      mockRepo.create.mockResolvedValue(makeIssueData());
      await service.createIssue('owner', 'repo', { title: 'Test', milestone: 3 });
      expect(mockRepo.create).toHaveBeenCalledWith(
        'owner', 'repo',
        expect.objectContaining({ milestone: 3 })
      );
    });
  });

  // ============================================================================
  // updateIssue
  // ============================================================================

  describe('updateIssue', () => {
    it('should update an issue', async () => {
      mockRepo.update.mockResolvedValue(makeIssueData());

      await service.updateIssue('owner', 'repo', 1, { title: 'Updated', state: 'closed' });
      expect(mockRepo.update).toHaveBeenCalledWith(
        'owner', 'repo', 1,
        expect.objectContaining({ title: 'Updated', state: 'closed' })
      );
    });

    it('should ignore invalid state', async () => {
      mockRepo.update.mockResolvedValue(makeIssueData());

      await service.updateIssue('owner', 'repo', 1, { title: 'Test', state: 'deleted' });
      const callArgs = mockRepo.update.mock.calls[0][3];
      expect(callArgs).not.toHaveProperty('state');
    });

    it('should throw for non-integer issue number', async () => {
      await expect(service.updateIssue('owner', 'repo', 0, {})).rejects.toThrow();
    });

    it('should throw for invalid owner', async () => {
      await expect(service.updateIssue('bad owner', 'repo', 1, {})).rejects.toThrow();
    });

    it('should throw for invalid repo', async () => {
      await expect(service.updateIssue('owner', '', 1, {})).rejects.toThrow();
    });
  });
});
