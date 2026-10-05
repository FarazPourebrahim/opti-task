import { HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NOTIFICATION_TYPES } from '@contracts';
import type { ErrorCode } from '@contracts';
import { routes } from '@/App';
import {
  COMMENT_ID,
  PROJECT_ID,
  TASK_ID,
  feedData,
  inboxScenario,
  mentionNode,
  notificationNode,
} from '@/modules/notification/notification.fixtures';
import type { NotificationNode } from '@/modules/notification/notification.fixtures';
import { notificationTarget } from '@/modules/notification/utils/notification.utils';
import { detailScenario } from '@/modules/task/task.fixtures';
import {
  ROUTES,
  taskCommentPath,
  taskPath,
} from '@/shared/routes/route.constants';
import { resetRefreshState } from '@/shared/services/auth.gateway';
import {
  clearAccessToken,
  setAccessToken,
} from '@/shared/services/session.store';
import { auditA11y } from '@/shared/tests/a11y';
import { graphql, mockMutationError } from '@/shared/tests/graphql';
import {
  createRealtimeServer,
  createRealtimeTestClient,
} from '@/shared/tests/realtime';
import {
  renderRoutes,
  screen,
  waitFor,
  within,
} from '@/shared/tests/renderWithProviders';
import { server } from '@/shared/tests/server';
import { signedIn } from '@/shared/tests/session';

// The server's own wording, which must never reach the screen.
const SERVER_DETAIL = 'internal reason';

function mutationFails(name: string, code: ErrorCode) {
  return mockMutationError(name, code, SERVER_DETAIL);
}

/** Answers `markNotificationRead` and marks the notification in the inbox. */
function markReadSucceeds(inbox: { notifications: NotificationNode[] }) {
  const sent: unknown[] = [];
  const handler = graphql.mutation('MarkNotificationRead', ({ variables }) => {
    sent.push(variables);
    inbox.notifications = inbox.notifications.map((notification) =>
      notification.id === variables['id']
        ? { ...notification, read: true, readAt: '2026-09-10T10:00:00.000Z' }
        : notification,
    );
    return HttpResponse.json({
      data: {
        markNotificationRead: {
          __typename: 'Notification',
          id: variables['id'],
          read: true,
          readAt: '2026-09-10T10:00:00.000Z',
        },
      },
    });
  });
  return { sent, handler };
}

function bell(name: string | RegExp = /^Notifications/) {
  return screen.findByRole('button', { name });
}

async function openBell(user: { click: (element: Element) => Promise<void> }) {
  await user.click(await bell());
  return screen.findByRole('dialog');
}

function rows(container: HTMLElement) {
  return within(container)
    .getAllByRole('article')
    .map((row) => within(row));
}

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
  server.use(...signedIn());
});

afterEach(() => {
  clearAccessToken();
});

describe('where a notification leads', () => {
  it('opens the task for an assignment and the comment for a mention', () => {
    // Arrange
    const assignment = notificationNode('n1');
    const mention = mentionNode('n2');

    // Act
    const toTask = notificationTarget(assignment);
    const toComment = notificationTarget(mention);

    // Assert
    expect(toTask).toBe(taskPath(PROJECT_ID, TASK_ID));
    expect(toComment).toBe(taskCommentPath(PROJECT_ID, TASK_ID, COMMENT_ID));
  });

  it('leads nowhere when the record does not say where, or says nonsense', () => {
    // Arrange
    const cases = [
      notificationNode('n1', { entityType: null, entityId: null }),
      notificationNode('n2', { metadata: {} }),
      notificationNode('n3', { metadata: { projectId: 'not-an-id' } }),
      notificationNode('n4', { entityId: '../../admin' }),
      notificationNode('n5', { entityType: 'sprint' }),
      mentionNode('n6', { metadata: { projectId: PROJECT_ID } }),
      mentionNode('n7', { metadata: { projectId: PROJECT_ID, taskId: 7 } }),
    ];

    // Act
    const targets = cases.map(notificationTarget);

    // Assert
    expect(targets).toEqual(cases.map(() => null));
  });
});

describe('notification bell', () => {
  it('says how many are unread in its name, and nothing when none are', async () => {
    // Arrange
    const { handlers } = inboxScenario([
      notificationNode('n1'),
      notificationNode('n2'),
      notificationNode('n3', { read: true }),
    ]);
    server.use(...handlers);

    // Act
    const unread = renderRoutes(routes, { route: ROUTES.home });

    // Assert
    expect(await bell('Notifications, 2 unread')).toBeVisible();

    // Arrange
    unread.unmount();
    server.use(...inboxScenario([]).handlers);

    // Act
    renderRoutes(routes, { route: ROUTES.home });

    // Assert
    expect(await bell('Notifications')).toBeVisible();
  });

  it('stops counting at 99 on the badge, but not in its name', async () => {
    // Arrange
    server.use(
      graphql.query('UnreadNotificationCount', () =>
        HttpResponse.json({ data: { unreadNotificationCount: 140 } }),
      ),
    );

    // Act
    renderRoutes(routes, { route: ROUTES.home });

    // Assert
    expect(await bell('Notifications, 140 unread')).toBeVisible();
    expect(screen.getByText('99+')).toBeVisible();
  });

  it('asks for the feed only once opened, and shows the newest five', async () => {
    // Arrange
    const { handlers, requests } = inboxScenario(
      ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'].map((id, index) =>
        notificationNode(id, { title: `Notification ${index + 1}` }),
      ),
    );
    server.use(...handlers);
    const { user } = renderRoutes(routes, { route: ROUTES.home });
    await bell('Notifications, 6 unread');

    // Assert — nothing fetched for a popover nobody has opened.
    expect(requests).toEqual([]);

    // Act
    const popover = await openBell(user);

    // Assert
    await within(popover).findByText('Notification 1');
    expect(
      rows(popover).map(
        (row) => row.getByText(/^Notification \d$/).textContent,
      ),
    ).toEqual([
      'Notification 1',
      'Notification 2',
      'Notification 3',
      'Notification 4',
      'Notification 5',
    ]);
    expect(
      within(popover).getByRole('link', {
        name: 'See all notifications (6)',
      }),
    ).toHaveAttribute('href', ROUTES.notifications);
    expect(requests).toEqual([{ first: 20, unreadOnly: false }]);
  });

  it('says so when there are none', async () => {
    // Arrange
    server.use(...inboxScenario([]).handlers);
    const { user } = renderRoutes(routes, { route: ROUTES.home });

    // Act
    const popover = await openBell(user);

    // Assert
    expect(
      await within(popover).findByText('You have no notifications yet.'),
    ).toBeVisible();
    expect(
      within(popover).queryByRole('button', { name: 'Mark all as read' }),
    ).toBeNull();
  });

  it('resolves a failed load into an error with a retry', async () => {
    // Arrange
    let attempts = 0;
    server.use(
      graphql.query('MyNotifications', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json({ data: feedData([notificationNode('n1')]) });
      }),
    );
    const { user } = renderRoutes(routes, { route: ROUTES.home });

    // Act
    const popover = await openBell(user);
    expect(
      await within(popover).findByText('Could not load your notifications.'),
    ).toBeVisible();
    await user.click(
      within(popover).getByRole('button', { name: 'Try again' }),
    );

    // Assert
    expect(
      await within(popover).findByText('You were assigned a task'),
    ).toBeVisible();
  });

  it('marks one read: one fewer unread, and the row says so', async () => {
    // Arrange
    const { inbox, handlers } = inboxScenario([
      notificationNode('n1', { title: 'First' }),
      notificationNode('n2', { title: 'Second' }),
    ]);
    const marked = markReadSucceeds(inbox);
    server.use(marked.handler, ...handlers);
    const { user } = renderRoutes(routes, { route: ROUTES.home });
    const popover = await openBell(user);

    // Act
    await user.click(
      await within(popover).findByRole('button', {
        name: 'Mark “First” as read',
      }),
    );

    // Assert
    expect(await bell('Notifications, 1 unread')).toBeVisible();
    await waitFor(() =>
      expect(
        within(popover).queryByRole('button', { name: 'Mark “First” as read' }),
      ).toBeNull(),
    );
    expect(
      within(popover).getByRole('button', { name: 'Mark “Second” as read' }),
    ).toBeVisible();
    expect(marked.sent).toEqual([{ id: 'n1' }]);
  });

  it('leaves a notification unread when marking it is refused', async () => {
    // Arrange
    server.use(
      mutationFails('MarkNotificationRead', 'FORBIDDEN'),
      ...inboxScenario([notificationNode('n1', { title: 'First' })]).handlers,
    );
    const { user } = renderRoutes(routes, { route: ROUTES.home });
    const popover = await openBell(user);

    // Act
    await user.click(
      await within(popover).findByRole('button', {
        name: 'Mark “First” as read',
      }),
    );

    // Assert
    expect(
      await screen.findByText('You don’t have permission to do that.'),
    ).toBeVisible();
    expect(await bell('Notifications, 1 unread')).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('opens what a notification is about, and counts it as read', async () => {
    // Arrange
    const { inbox, handlers } = inboxScenario([notificationNode('n1')]);
    const marked = markReadSucceeds(inbox);
    server.use(
      marked.handler,
      ...handlers,
      ...detailScenario({ project: 'MEMBER' }),
    );
    const { user, router } = renderRoutes(routes, { route: ROUTES.home });
    const popover = await openBell(user);

    // Act
    await user.click(
      await within(popover).findByRole('link', {
        name: 'You were assigned a task',
      }),
    );

    // Assert
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        taskPath(PROJECT_ID, TASK_ID),
      ),
    );
    expect(
      await screen.findByRole('heading', { name: 'Build login' }),
    ).toBeVisible();
    expect(await bell('Notifications')).toBeVisible();
    expect(marked.sent).toEqual([{ id: 'n1' }]);
  });

  it('marks all read, says how many, and re-reads the feed', async () => {
    // Arrange
    const { inbox, handlers, requests } = inboxScenario([
      notificationNode('n1', { title: 'First' }),
      notificationNode('n2', { title: 'Second' }),
    ]);
    server.use(
      graphql.mutation('MarkAllNotificationsRead', () => {
        const unread = inbox.notifications.filter((item) => !item.read).length;
        inbox.notifications = inbox.notifications.map((item) => ({
          ...item,
          read: true,
          readAt: '2026-09-10T10:00:00.000Z',
        }));
        return HttpResponse.json({
          data: { markAllNotificationsRead: unread },
        });
      }),
      ...handlers,
    );
    const { user } = renderRoutes(routes, { route: ROUTES.home });
    const popover = await openBell(user);
    await within(popover).findByText('First');

    // Act
    await user.click(
      within(popover).getByRole('button', { name: 'Mark all as read' }),
    );

    // Assert
    expect(
      await screen.findByText('2 notifications marked as read.'),
    ).toBeVisible();
    expect(await bell('Notifications')).toBeVisible();
    await waitFor(() => expect(requests).toHaveLength(2));
    await waitFor(() =>
      expect(
        within(popover).queryByRole('button', { name: /Mark “/ }),
      ).toBeNull(),
    );
    expect(within(popover).getByText('First')).toBeVisible();
  });
});

describe('notifications page', () => {
  it('is reached from the sidebar and names each kind of notification', async () => {
    // Arrange
    const kinds: Record<string, string> = {
      TASK_ASSIGNED: 'Assignment',
      MENTION: 'Mention',
      SPRINT_UPDATE: 'Sprint',
      DEADLINE_REMINDER: 'Deadline',
      AI_RECOMMENDATION: 'AI recommendation',
      APPROVAL_REQUEST: 'Approval request',
    };
    server.use(
      ...inboxScenario(
        NOTIFICATION_TYPES.map((type) =>
          notificationNode(`n-${type}`, {
            type,
            title: `About ${type}`,
            body: null,
            // Only an assignment says where it leads.
            ...(type === 'TASK_ASSIGNED'
              ? {}
              : { entityType: null, entityId: null }),
          }),
        ),
      ).handlers,
    );
    const { user } = renderRoutes(routes, { route: ROUTES.home });

    // Act
    await user.click(
      within(await screen.findByRole('navigation', { name: 'Main' })).getByRole(
        'link',
        { name: 'Notifications' },
      ),
    );

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Notifications', level: 1 }),
    ).toBeVisible();
    for (const type of NOTIFICATION_TYPES) {
      const row = (await screen.findByText(`About ${type}`)).closest('article');
      expect(row).not.toBeNull();
      expect(
        within(row as HTMLElement).getByText(kinds[type] ?? ''),
      ).toBeVisible();
    }
    // One that leads somewhere is a link; one that does not is plain text.
    expect(
      screen.getByRole('link', { name: 'About TASK_ASSIGNED' }),
    ).toHaveAttribute('href', taskPath(PROJECT_ID, TASK_ID));
    expect(screen.queryByRole('link', { name: 'About MENTION' })).toBeNull();
  });

  it('filters to unread, asking the server, and tells its two empty states apart', async () => {
    // Arrange
    const { handlers, requests } = inboxScenario([
      notificationNode('n1', { title: 'Already seen', read: true }),
    ]);
    server.use(...handlers);
    const { user } = renderRoutes(routes, { route: ROUTES.notifications });
    expect(await screen.findByText('Already seen')).toBeVisible();

    // Act
    await user.click(screen.getByRole('radio', { name: 'Unread' }));

    // Assert
    expect(await screen.findByText('You have read everything.')).toBeVisible();
    expect(screen.queryByText('You have no notifications yet.')).toBeNull();
    expect(requests.at(-1)).toEqual({ first: 20, unreadOnly: true });

    // Arrange
    server.use(...inboxScenario([]).handlers);

    // Act
    renderRoutes(routes, { route: ROUTES.notifications });

    // Assert
    expect(
      await screen.findByText('You have no notifications yet.'),
    ).toBeVisible();
  });

  it('takes a notification out of the unread list once it is read', async () => {
    // Arrange
    const { inbox, handlers } = inboxScenario([
      notificationNode('n1', { title: 'First' }),
      notificationNode('n2', { title: 'Second' }),
    ]);
    const marked = markReadSucceeds(inbox);
    server.use(marked.handler, ...handlers);
    const { user } = renderRoutes(routes, { route: ROUTES.notifications });
    await screen.findByText('First');
    await user.click(screen.getByRole('radio', { name: 'Unread' }));
    await screen.findByText('Showing 2 of 2');

    // Act
    await user.click(
      screen.getByRole('button', { name: 'Mark “First” as read' }),
    );

    // Assert
    await waitFor(() => expect(screen.queryByText('First')).toBeNull());
    expect(screen.getByText('Second')).toBeVisible();
    expect(screen.getByText('Showing 1 of 1')).toBeVisible();

    // Act — under "All" it is still listed, as read.
    await user.click(screen.getByRole('radio', { name: 'All' }));

    // Assert
    expect(await screen.findByText('First')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Mark “First” as read' }),
    ).toBeNull();
  });

  it('pages forward, sending the cursor back untouched', async () => {
    // Arrange
    const cursor = 'b3BhcXVlK2N1cnNvci89PQ==';
    const requests: Array<Record<string, unknown>> = [];
    server.use(
      graphql.query('MyNotifications', ({ variables }) => {
        requests.push(variables);
        return HttpResponse.json({
          data: variables['after']
            ? feedData([notificationNode('n2', { title: 'Older' })], {
                total: 2,
              })
            : feedData([notificationNode('n1', { title: 'Newer' })], {
                hasNextPage: true,
                endCursor: cursor,
                total: 2,
              }),
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: ROUTES.notifications });
    await screen.findByText('Newer');

    // Act
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    // Assert
    expect(await screen.findByText('Older')).toBeVisible();
    expect(screen.getByText('Newer')).toBeVisible();
    expect(requests.at(-1)?.['after']).toBe(cursor);
    expect(
      requests.every(
        (request) =>
          typeof request['first'] === 'number' && request['first'] <= 100,
      ),
    ).toBe(true);
  });

  it('resolves a network failure into an error with a retry', async () => {
    // Arrange
    let attempts = 0;
    server.use(
      graphql.query('MyNotifications', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json({ data: feedData([notificationNode('n1')]) });
      }),
    );
    const { user } = renderRoutes(routes, { route: ROUTES.notifications });

    // Act
    expect(
      await screen.findByText('Could not load your notifications.'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(await screen.findByText('You were assigned a task')).toBeVisible();
  });

  it('has no accessibility violations, with the bell open too', async () => {
    // Arrange
    server.use(
      ...inboxScenario([
        notificationNode('n1'),
        mentionNode('n2', { read: true }),
      ]).handlers,
    );
    const { container, user } = renderRoutes(routes, {
      route: ROUTES.notifications,
    });
    await screen.findByText('You were mentioned in a comment');

    // Assert
    expect(await auditA11y(container)).toHaveNoViolations();

    // Act
    const popover = await openBell(user);
    await within(popover).findByText('You were mentioned in a comment');

    // Assert
    expect(await auditA11y(popover)).toHaveNoViolations();
  });
});

describe('notifications as they arrive', () => {
  function received(notification: NotificationNode) {
    return {
      notificationReceived: {
        __typename: 'NotificationEvent',
        notificationId: notification.id,
        notification,
      },
    };
  }

  it('counts a new notification, announces it, and puts it first in the feed', async () => {
    // Arrange
    setAccessToken('token-1');
    const socket = createRealtimeServer();
    server.use(
      ...inboxScenario([notificationNode('n1', { title: 'Earlier' })]).handlers,
    );
    renderRoutes(routes, {
      route: ROUTES.notifications,
      apolloClient: createRealtimeTestClient(socket),
    });
    await screen.findByText('Earlier');
    await waitFor(() =>
      expect(socket.subscribed('NotificationReceived')).toEqual([{}]),
    );
    const arrival = mentionNode('n2', { title: 'Pat mentioned you' });

    // Act
    socket.push('NotificationReceived', received(arrival));

    // Assert
    expect(await bell('Notifications, 2 unread')).toBeVisible();
    const feed = screen.getByRole('main');
    await waitFor(() =>
      expect(
        rows(feed).map(
          (row) => row.getByText(/Earlier|Pat mentioned you/).textContent,
        ),
      ).toEqual(['Pat mentioned you', 'Earlier']),
    );
    expect(screen.getByText('Showing 2 of 2')).toBeVisible();
    // Said aloud as well: once in the feed, once in the toast.
    expect(screen.getAllByText('Pat mentioned you')).toHaveLength(2);

    // Act — the same event again changes nothing.
    socket.push('NotificationReceived', received(arrival));
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert
    expect(await bell('Notifications, 2 unread')).toBeVisible();
    expect(rows(feed)).toHaveLength(2);
  });

  it('counts a new notification even when the feed has never been opened', async () => {
    // Arrange
    setAccessToken('token-1');
    const socket = createRealtimeServer();
    const { handlers, requests } = inboxScenario([]);
    server.use(...handlers);
    const client = createRealtimeTestClient(socket);
    renderRoutes(routes, { route: ROUTES.home, apolloClient: client });
    await bell('Notifications');
    await waitFor(() =>
      expect(socket.subscribed('NotificationReceived')).toHaveLength(1),
    );

    // Act
    socket.push('NotificationReceived', received(notificationNode('n9')));

    // Assert
    expect(await bell('Notifications, 1 unread')).toBeVisible();
    expect(requests).toEqual([]);
  });
});
