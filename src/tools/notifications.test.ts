/**
 * Tests for GitHub Notifications tools
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNotificationTools } from './notifications.js';

// Minimal mock notification shape
const makeNotification = (id = '1') => ({
  id,
  unread: true,
  reason: 'mention',
  updated_at: '2024-01-01T12:00:00Z',
  last_read_at: null,
  subject: {
    title: 'Test issue',
    url: 'https://api.github.com/repos/owner/repo/issues/1',
    latest_comment_url: null,
    type: 'Issue',
  },
  repository: {
    id: 1,
    name: 'repo',
    full_name: 'owner/repo',
    owner: { login: 'owner' },
    private: false,
    html_url: 'https://github.com/owner/repo',
  },
  url: 'https://api.github.com/notifications/threads/1',
  subscription_url: 'https://api.github.com/notifications/threads/1/subscription',
});

const makeOctokit = () => ({
  activity: {
    listNotificationsForAuthenticatedUser: vi.fn(),
    listRepoNotificationsForAuthenticatedUser: vi.fn(),
    getThread: vi.fn(),
    getThreadSubscriptionForAuthenticatedUser: vi.fn(),
    getRepoSubscription: vi.fn(),
    markThreadAsRead: vi.fn(),
    markThreadAsDone: vi.fn(),
    markNotificationsAsRead: vi.fn(),
    markRepoNotificationsAsRead: vi.fn(),
    setThreadSubscription: vi.fn(),
    deleteThreadSubscription: vi.fn(),
    setRepoSubscription: vi.fn(),
    deleteRepoSubscription: vi.fn(),
  },
});

describe('Notification Tools', () => {
  let mockOctokit: ReturnType<typeof makeOctokit>;
  let tools: ReturnType<typeof createNotificationTools>;

  beforeEach(() => {
    mockOctokit = makeOctokit();
    tools = createNotificationTools(mockOctokit as any, false);
  });

  // ============================================================================
  // list_notifications
  // ============================================================================

  describe('list_notifications', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'list_notifications');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should be registered', () => {
      expect(tools.find(t => t.tool.name === 'list_notifications')).toBeDefined();
    });

    it('should list global notifications', async () => {
      mockOctokit.activity.listNotificationsForAuthenticatedUser.mockResolvedValue({
        data: [makeNotification('1'), makeNotification('2')],
      });

      const result = (await handler({})) as any[];
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[0].unread).toBe(true);
      expect(result[0].reason).toBe('mention');
      expect(result[0].subject.type).toBe('Issue');
      expect(result[0].repository.full_name).toBe('owner/repo');
    });

    it('should list repo-specific notifications when owner+repo provided', async () => {
      mockOctokit.activity.listRepoNotificationsForAuthenticatedUser.mockResolvedValue({
        data: [makeNotification('42')],
      });

      const result = (await handler({ owner: 'myorg', repo: 'myrepo', filter: 'all' })) as any[];
      expect(result).toHaveLength(1);
      expect(
        mockOctokit.activity.listRepoNotificationsForAuthenticatedUser
      ).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'myorg', repo: 'myrepo', all: true })
      );
    });

    it('should pass filter=participating correctly', async () => {
      mockOctokit.activity.listNotificationsForAuthenticatedUser.mockResolvedValue({ data: [] });
      await handler({ filter: 'participating' });
      expect(
        mockOctokit.activity.listNotificationsForAuthenticatedUser
      ).toHaveBeenCalledWith(
        expect.objectContaining({ participating: true, all: false })
      );
    });
  });

  // ============================================================================
  // get_notification_details
  // ============================================================================

  describe('get_notification_details', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'get_notification_details');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should be registered', () => {
      expect(tools.find(t => t.tool.name === 'get_notification_details')).toBeDefined();
    });

    it('should return notification details', async () => {
      mockOctokit.activity.getThread.mockResolvedValue({ data: makeNotification('99') });

      const result = (await handler({ notificationID: '99' })) as any;
      expect(mockOctokit.activity.getThread).toHaveBeenCalledWith({ thread_id: 99 });
      expect(result.id).toBe('99');
      expect(result.subject.title).toBe('Test issue');
      expect(result.repository.name).toBe('repo');
    });
  });

  // ============================================================================
  // get_thread_subscription
  // ============================================================================

  describe('get_thread_subscription', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'get_thread_subscription');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should return subscription status', async () => {
      mockOctokit.activity.getThreadSubscriptionForAuthenticatedUser.mockResolvedValue({
        data: {
          subscribed: true,
          ignored: false,
          reason: 'subscribed',
          created_at: '2024-01-01T00:00:00Z',
          url: 'https://api.github.com/notifications/threads/1/subscription',
          thread_url: 'https://api.github.com/notifications/threads/1',
        },
      });

      const result = (await handler({ notificationID: '1' })) as any;
      expect(result.subscribed).toBe(true);
      expect(result.ignored).toBe(false);
    });

    it('should handle 404 gracefully', async () => {
      const error = Object.assign(new Error('Not Found'), { status: 404 });
      mockOctokit.activity.getThreadSubscriptionForAuthenticatedUser.mockRejectedValue(error);

      const result = (await handler({ notificationID: '999' })) as any;
      expect(result.subscribed).toBe(false);
      expect(result.message).toContain('Not subscribed');
    });

    it('should rethrow non-404 errors', async () => {
      const error = Object.assign(new Error('Server error'), { status: 500 });
      mockOctokit.activity.getThreadSubscriptionForAuthenticatedUser.mockRejectedValue(error);

      await expect(handler({ notificationID: '1' })).rejects.toThrow('Server error');
    });
  });

  // ============================================================================
  // get_repo_subscription
  // ============================================================================

  describe('get_repo_subscription', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'get_repo_subscription');
      expect(tool).toBeDefined();
      handler = tool!.handler;
    });

    it('should return repo subscription status', async () => {
      mockOctokit.activity.getRepoSubscription.mockResolvedValue({
        data: {
          subscribed: true,
          ignored: false,
          reason: 'watching',
          created_at: '2024-01-01T00:00:00Z',
          url: 'https://api.github.com/repos/owner/repo/subscription',
          repository_url: 'https://api.github.com/repos/owner/repo',
        },
      });

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any;
      expect(result.subscribed).toBe(true);
      expect(result.reason).toBe('watching');
    });

    it('should handle 404 gracefully (not watching)', async () => {
      const error = Object.assign(new Error('Not Found'), { status: 404 });
      mockOctokit.activity.getRepoSubscription.mockRejectedValue(error);

      const result = (await handler({ owner: 'owner', repo: 'repo' })) as any;
      expect(result.subscribed).toBe(false);
      expect(result.message).toContain('Not watching');
    });
  });

  // ============================================================================
  // Write-mode tools (dismiss_notification, mark_all, manage_subscription)
  // ============================================================================

  describe('write-mode tools', () => {
    it('should register write tools when not read-only', () => {
      const writeTools = ['dismiss_notification', 'mark_all_notifications_read',
        'manage_notification_subscription', 'manage_repository_notification_subscription'];
      for (const name of writeTools) {
        expect(tools.find(t => t.tool.name === name)).toBeDefined();
      }
    });

    it('should NOT register write tools in read-only mode', () => {
      const readOnlyTools = createNotificationTools(mockOctokit as any, true);
      expect(readOnlyTools.find(t => t.tool.name === 'dismiss_notification')).toBeUndefined();
      expect(readOnlyTools.find(t => t.tool.name === 'mark_all_notifications_read')).toBeUndefined();
    });
  });

  describe('dismiss_notification', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'dismiss_notification');
      handler = tool!.handler;
    });

    it('should mark thread as read', async () => {
      mockOctokit.activity.markThreadAsRead.mockResolvedValue({});

      const result = (await handler({ threadID: '5' })) as any;
      expect(mockOctokit.activity.markThreadAsRead).toHaveBeenCalledWith({ thread_id: 5 });
      expect(result.success).toBe(true);
      expect(result.message).toContain('read');
    });

    it('should also call markThreadAsDone when state=done', async () => {
      mockOctokit.activity.markThreadAsRead.mockResolvedValue({});
      mockOctokit.activity.markThreadAsDone.mockResolvedValue({});

      const result = (await handler({ threadID: '5', state: 'done' })) as any;
      expect(mockOctokit.activity.markThreadAsDone).toHaveBeenCalledWith({ thread_id: 5 });
      expect(result.message).toContain('done');
    });
  });

  describe('mark_all_notifications_read', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'mark_all_notifications_read');
      handler = tool!.handler;
    });

    it('should mark all global notifications as read', async () => {
      mockOctokit.activity.markNotificationsAsRead.mockResolvedValue({});

      const result = (await handler({})) as any;
      expect(mockOctokit.activity.markNotificationsAsRead).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should mark repo notifications as read when owner+repo provided', async () => {
      mockOctokit.activity.markRepoNotificationsAsRead.mockResolvedValue({});

      const result = (await handler({ owner: 'myorg', repo: 'myrepo' })) as any;
      expect(mockOctokit.activity.markRepoNotificationsAsRead).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'myorg', repo: 'myrepo' })
      );
      expect(result.message).toContain('myorg/myrepo');
    });
  });

  describe('manage_notification_subscription', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'manage_notification_subscription');
      handler = tool!.handler;
    });

    it('should delete subscription when action=delete', async () => {
      mockOctokit.activity.deleteThreadSubscription.mockResolvedValue({});

      const result = (await handler({ notificationID: '10', action: 'delete' })) as any;
      expect(mockOctokit.activity.deleteThreadSubscription).toHaveBeenCalledWith({ thread_id: 10 });
      expect(result.success).toBe(true);
    });

    it('should set ignored when action=ignore', async () => {
      mockOctokit.activity.setThreadSubscription.mockResolvedValue({
        data: { subscribed: false, ignored: true, reason: null, created_at: null, url: '' },
      });

      const result = (await handler({ notificationID: '10', action: 'ignore' })) as any;
      expect(mockOctokit.activity.setThreadSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ thread_id: 10, ignored: true })
      );
      expect(result.ignored).toBe(true);
    });

    it('should set subscribed when action=watch', async () => {
      mockOctokit.activity.setThreadSubscription.mockResolvedValue({
        data: { subscribed: true, ignored: false, reason: 'subscribed', created_at: null, url: '' },
      });

      const result = (await handler({ notificationID: '10', action: 'watch' })) as any;
      expect(mockOctokit.activity.setThreadSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ ignored: false })
      );
      expect(result.subscribed).toBe(true);
    });
  });

  describe('manage_repository_notification_subscription', () => {
    let handler: (args: unknown) => Promise<unknown>;

    beforeEach(() => {
      const tool = tools.find(t => t.tool.name === 'manage_repository_notification_subscription');
      handler = tool!.handler;
    });

    it('should be registered', () => {
      expect(
        tools.find(t => t.tool.name === 'manage_repository_notification_subscription')
      ).toBeDefined();
    });
  });
});
