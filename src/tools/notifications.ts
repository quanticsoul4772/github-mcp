import { Octokit } from '@octokit/rest';
import { ToolConfig } from '../types.js';

interface ListNotificationsParams {
  filter?: string;
  since?: string;
  before?: string;
  owner?: string;
  repo?: string;
  page?: number;
  perPage?: number;
}

interface GetNotificationDetailsParams {
  notificationID: string;
}

interface GetThreadSubscriptionParams {
  notificationID: string;
}

interface GetRepoSubscriptionParams {
  owner: string;
  repo: string;
}

interface DismissNotificationParams {
  threadID: string;
  state?: string;
}

interface MarkAllNotificationsReadParams {
  lastReadAt?: string;
  owner?: string;
  repo?: string;
}

interface ManageNotificationSubscriptionParams {
  notificationID: string;
  action: string;
}

interface ManageRepositoryNotificationSubscriptionParams {
  owner: string;
  repo: string;
  action: string;
}

export function createNotificationTools(octokit: Octokit, readOnly: boolean): ToolConfig[] {
  const tools: ToolConfig[] = [];

  // List notifications tool
  tools.push({
    tool: {
      name: 'list_notifications',
      description: 'List notifications for the authenticated user',
      inputSchema: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            description: 'Filter notifications',
            enum: ['all', 'participating'],
          },
          since: {
            type: 'string',
            description: 'Only show notifications updated after the given time (ISO 8601 format)',
          },
          before: {
            type: 'string',
            description: 'Only show notifications updated before the given time (ISO 8601 format)',
          },
          owner: {
            type: 'string',
            description: 'Optional repository owner',
          },
          repo: {
            type: 'string',
            description: 'Optional repository name',
          },
          page: {
            type: 'number',
            description: 'Page number for pagination (min 1)',
            minimum: 1,
          },
          perPage: {
            type: 'number',
            description: 'Results per page for pagination (min 1, max 100)',
            minimum: 1,
            maximum: 100,
          },
        },
      },
    },
    handler: async (args: ListNotificationsParams) => {
      let data;
      
      if (args.owner && args.repo) {
        const response = await octokit.activity.listRepoNotificationsForAuthenticatedUser({
          owner: args.owner,
          repo: args.repo,
          all: args.filter === 'all',
          participating: args.filter === 'participating',
          since: args.since,
          before: args.before,
          page: args.page,
          per_page: args.perPage,
        });
        data = response.data;
      } else {
        const response = await octokit.activity.listNotificationsForAuthenticatedUser({
          all: args.filter === 'all',
          participating: args.filter === 'participating',
          since: args.since,
          before: args.before,
          page: args.page,
          per_page: args.perPage,
        });
        data = response.data;
      }

      return data.map((notification) => ({
        id: notification.id,
        unread: notification.unread,
        reason: notification.reason,
        updated_at: notification.updated_at,
        last_read_at: notification.last_read_at,
        subject: {
          title: notification.subject.title,
          url: notification.subject.url,
          latest_comment_url: notification.subject.latest_comment_url,
          type: notification.subject.type,
        },
        repository: {
          id: notification.repository.id,
          name: notification.repository.name,
          full_name: notification.repository.full_name,
          owner: {
            login: notification.repository.owner.login,
          },
          private: notification.repository.private,
          html_url: notification.repository.html_url,
        },
        url: notification.url,
        subscription_url: notification.subscription_url,
      }));
    },
  });

  // Get notification thread tool
  tools.push({
    tool: {
      name: 'get_notification_details',
      description: 'Get details of a specific notification thread',
      inputSchema: {
        type: 'object',
        properties: {
          notificationID: {
            type: 'string',
            description: 'The ID of the notification',
          },
        },
        required: ['notificationID'],
      },
    },
    handler: async (args: GetNotificationDetailsParams) => {
      const { data } = await octokit.activity.getThread({
        thread_id: parseInt(args.notificationID),
      });

      return {
        id: data.id,
        unread: data.unread,
        reason: data.reason,
        updated_at: data.updated_at,
        last_read_at: data.last_read_at,
        subject: {
          title: data.subject.title,
          url: data.subject.url,
          latest_comment_url: data.subject.latest_comment_url,
          type: data.subject.type,
        },
        repository: {
          id: data.repository.id,
          name: data.repository.name,
          full_name: data.repository.full_name,
          owner: {
            login: data.repository.owner.login,
          },
          private: data.repository.private,
          html_url: data.repository.html_url,
        },
        url: data.url,
        subscription_url: data.subscription_url,
      };
    },
  });

  // Get thread subscription tool
  tools.push({
    tool: {
      name: 'get_thread_subscription',
      description: 'Get subscription status for a notification thread',
      inputSchema: {
        type: 'object',
        properties: {
          notificationID: {
            type: 'string',
            description: 'The ID of the notification thread',
          },
        },
        required: ['notificationID'],
      },
    },
    handler: async (args: GetThreadSubscriptionParams) => {
      try {
        const { data } = await octokit.activity.getThreadSubscriptionForAuthenticatedUser({
          thread_id: parseInt(args.notificationID),
        });

        return {
          subscribed: data.subscribed,
          ignored: data.ignored,
          reason: data.reason,
          created_at: data.created_at,
          url: data.url,
          thread_url: data.thread_url,
        };
      } catch (error: any) {
        if (error.status === 404) {
          return {
            subscribed: false,
            message: 'Not subscribed to this thread',
          };
        }
        throw error;
      }
    },
  });

  // Get repository subscription tool
  tools.push({
    tool: {
      name: 'get_repo_subscription',
      description: 'Get subscription status for a repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'The owner of the repository',
          },
          repo: {
            type: 'string',
            description: 'The name of the repository',
          },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (args: GetRepoSubscriptionParams) => {
      try {
        const { data } = await octokit.activity.getRepoSubscription({
          owner: args.owner,
          repo: args.repo,
        });

        return {
          subscribed: data.subscribed,
          ignored: data.ignored,
          reason: data.reason,
          created_at: data.created_at,
          url: data.url,
          repository_url: data.repository_url,
        };
      } catch (error: any) {
        if (error.status === 404) {
          return {
            subscribed: false,
            message: 'Not watching this repository',
          };
        }
        throw error;
      }
    },
  });

  // Add write operations if not in read-only mode
  if (!readOnly) {
    // Mark notification as read tool
    tools.push({
      tool: {
        name: 'dismiss_notification',
        description: 'Mark a notification as read',
        inputSchema: {
          type: 'object',
          properties: {
            threadID: {
              type: 'string',
              description: 'The ID of the notification thread',
            },
            state: {
              type: 'string',
              description: 'The new state of the notification',
              enum: ['read', 'done'],
            },
          },
          required: ['threadID'],
        },
      },
      handler: async (args: DismissNotificationParams) => {
        await octokit.activity.markThreadAsRead({
          thread_id: parseInt(args.threadID),
        });

        // If state is 'done', also mark as done
        if (args.state === 'done') {
          await octokit.activity.markThreadAsDone({
            thread_id: parseInt(args.threadID),
          });
        }

        return {
          success: true,
          message: `Notification ${args.threadID} marked as ${args.state || 'read'}`,
        };
      },
    });

    // Mark all notifications as read tool
    tools.push({
      tool: {
        name: 'mark_all_notifications_read',
        description: 'Mark all notifications as read',
        inputSchema: {
          type: 'object',
          properties: {
            lastReadAt: {
              type: 'string',
              description: 'Describes the last point that notifications were checked',
            },
            owner: {
              type: 'string',
              description: 'Optional repository owner',
            },
            repo: {
              type: 'string',
              description: 'Optional repository name',
            },
          },
        },
      },
      handler: async (args: MarkAllNotificationsReadParams) => {
        if (args.owner && args.repo) {
          await octokit.activity.markRepoNotificationsAsRead({
            owner: args.owner,
            repo: args.repo,
            last_read_at: args.lastReadAt,
          });

          return {
            success: true,
            message: `All notifications for ${args.owner}/${args.repo} marked as read`,
          };
        } else {
          await octokit.activity.markNotificationsAsRead({
            last_read_at: args.lastReadAt,
          });

          return {
            success: true,
            message: 'All notifications marked as read',
          };
        }
      },
    });

    // Manage notification subscription tool
    tools.push({
      tool: {
        name: 'manage_notification_subscription',
        description: 'Manage subscription for a notification thread',
        inputSchema: {
          type: 'object',
          properties: {
            notificationID: {
              type: 'string',
              description: 'The ID of the notification thread',
            },
            action: {
              type: 'string',
              description: 'Action to perform',
              enum: ['ignore', 'watch', 'delete'],
            },
          },
          required: ['notificationID', 'action'],
        },
      },
      handler: async (args: ManageNotificationSubscriptionParams) => {
        const threadId = parseInt(args.notificationID);

        if (args.action === 'delete') {
          await octokit.activity.deleteThreadSubscription({
            thread_id: threadId,
          });

          return {
            success: true,
            message: `Unsubscribed from notification thread ${args.notificationID}`,
          };
        } else {
          const { data } = await octokit.activity.setThreadSubscription({
            thread_id: threadId,
            ignored: args.action === 'ignore',
          });

          return {
            subscribed: data.subscribed,
            ignored: data.ignored,
            reason: data.reason,
            created_at: data.created_at,
            url: data.url,
            message: `Notification thread ${args.notificationID} ${args.action === 'ignore' ? 'ignored' : 'watched'}`,
          };
        }
      },
    });

    // Manage repository notification subscription tool
    tools.push({
      tool: {
        name: 'manage_repository_notification_subscription',
        description: 'Manage notification subscription for a repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'The account owner of the repository',
            },
            repo: {
              type: 'string',
              description: 'The name of the repository',
            },
            action: {
              type: 'string',
              description: 'Action to perform',
              enum: ['ignore', 'watch', 'delete'],
            },
          },
          required: ['owner', 'repo', 'action'],
        },
      },
      handler: async (args: ManageRepositoryNotificationSubscriptionParams) => {
        if (args.action === 'delete') {
          await octokit.activity.deleteRepoSubscription({
            owner: args.owner,
            repo: args.repo,
          });

          return {
            success: true,
            message: `Unsubscribed from repository ${args.owner}/${args.repo}`,
          };
        } else {
          const { data } = await octokit.activity.setRepoSubscription({
            owner: args.owner,
            repo: args.repo,
            subscribed: args.action === 'watch',
            ignored: args.action === 'ignore',
          });

          return {
            subscribed: data.subscribed,
            ignored: data.ignored,
            reason: data.reason,
            created_at: data.created_at,
            url: data.url,
            message: `Repository ${args.owner}/${args.repo} ${args.action === 'ignore' ? 'ignored' : 'watched'}`,
          };
        }
      },
    });
  }

  return tools;
}
