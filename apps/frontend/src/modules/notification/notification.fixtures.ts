import { HttpResponse } from 'msw';
import { graphql } from '@/shared/tests/graphql';

/**
 * Test fixtures for the notification feed: notifications of each kind, and
 * handlers for the count and the feed that answer from one list a test can
 * change as it goes, the way the server's answers change.
 */

export const PROJECT_ID = '44444444-4444-4444-8444-444444444444';
export const TASK_ID = '66666666-6666-4666-8666-666666666666';
export const COMMENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

export type NotificationOverrides = Partial<{
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
}>;

/** A notification with every field the feed selects. An assignment, unread. */
export function notificationNode(
  id: string,
  overrides: NotificationOverrides = {},
) {
  const read = overrides.read ?? false;

  return {
    __typename: 'Notification',
    id,
    type: overrides.type ?? 'TASK_ASSIGNED',
    title: overrides.title ?? 'You were assigned a task',
    body:
      overrides.body === undefined
        ? 'You were assigned “Build login”.'
        : overrides.body,
    entityType:
      overrides.entityType === undefined ? 'task' : overrides.entityType,
    entityId: overrides.entityId === undefined ? TASK_ID : overrides.entityId,
    metadata: overrides.metadata ?? { projectId: PROJECT_ID },
    read,
    readAt: read ? '2026-09-10T10:00:00.000Z' : null,
    createdAt: '2026-09-09T10:00:00.000Z',
  };
}

export type NotificationNode = ReturnType<typeof notificationNode>;

/** A mention: it leads to the comment, on its task. */
export function mentionNode(id: string, overrides: NotificationOverrides = {}) {
  return notificationNode(id, {
    type: 'MENTION',
    title: 'You were mentioned in a comment',
    body: null,
    entityType: 'comment',
    entityId: COMMENT_ID,
    metadata: { taskId: TASK_ID, projectId: PROJECT_ID },
    ...overrides,
  });
}

export function feedData(
  nodes: NotificationNode[],
  page: {
    hasNextPage?: boolean;
    endCursor?: string | null;
    total?: number;
  } = {},
) {
  return {
    myNotifications: {
      __typename: 'NotificationConnection',
      edges: nodes.map((node) => ({
        __typename: 'NotificationEdge',
        cursor: `cursor-${node.id}`,
        node,
      })),
      pageInfo: {
        __typename: 'PageInfo',
        hasNextPage: page.hasNextPage ?? false,
        endCursor: page.endCursor ?? null,
      },
      totalCount: page.total ?? nodes.length,
    },
  };
}

/**
 * Handlers for the count and the feed. `inbox.notifications` is read on every
 * request, so a mutation handler in a test can change it and the next read
 * sees the change. `requests` records each feed request's variables.
 */
export function inboxScenario(notifications: NotificationNode[] = []) {
  const inbox = { notifications };
  const requests: Array<Record<string, unknown>> = [];

  const handlers = [
    graphql.query('UnreadNotificationCount', () =>
      HttpResponse.json({
        data: {
          unreadNotificationCount: inbox.notifications.filter(
            (notification) => !notification.read,
          ).length,
        },
      }),
    ),
    graphql.query('MyNotifications', ({ variables }) => {
      requests.push(variables);
      return HttpResponse.json({
        data: feedData(
          inbox.notifications.filter(
            (notification) =>
              variables['unreadOnly'] !== true || !notification.read,
          ),
        ),
      });
    }),
  ];

  return { inbox, requests, handlers };
}
