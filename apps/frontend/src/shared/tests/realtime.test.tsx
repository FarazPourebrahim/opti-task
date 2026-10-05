import { HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ApolloClient } from '@apollo/client';
import { routes } from '@/App';
import { AiRecommendationItemFragment } from '@/modules/ai/graphql/ai.operations';
import {
  COMMENT_ID,
  NEW_COMMENT_ID,
  REPLY_ID,
  commentNode,
  discussionScenario,
  threadNode,
} from '@/modules/comment/comment.fixtures';
import { EPIC_ID, epicDetailScenario } from '@/modules/epic/epic.fixtures';
import {
  SPRINT_ID,
  SPRINT_TASKS,
  sprintDetail,
  sprintDetailScenario,
  sprintSummary,
} from '@/modules/sprint/sprint.fixtures';
import {
  OTHER_TASK_ID,
  PAT,
  PROJECT_ID,
  TASK_ID,
  TERRY,
  VIEWER,
  boardData,
  boardScenario,
  detailScenario,
  taskNode,
} from '@/modules/task/task.fixtures';
import type { TaskOverrides } from '@/modules/task/task.fixtures';
import {
  ROUTES,
  epicPath,
  projectBoardPath,
  sprintPath,
  taskPath,
} from '@/shared/routes/route.constants';
import { resetRefreshState } from '@/shared/services/auth.gateway';
import {
  clearAccessToken,
  setAccessToken,
} from '@/shared/services/session.store';
import { graphql } from '@/shared/tests/graphql';
import {
  createRealtimeServer,
  createRealtimeTestClient,
} from '@/shared/tests/realtime';
import type { RealtimeServer } from '@/shared/tests/realtime';
import {
  renderRoutes,
  screen,
  waitFor,
  within,
} from '@/shared/tests/renderWithProviders';
import { server } from '@/shared/tests/server';
import { signedIn } from '@/shared/tests/session';

/**
 * Realtime, end to end: the screens on one side, a fake socket on the other,
 * and everything between them running for real.
 *
 * In each case the write source of truth is a mutation made by someone else;
 * what is tested is that this client's cache — and only what it already holds
 * — is brought up to date.
 */

const BOARD_ROUTE = projectBoardPath(PROJECT_ID);
const TASK_ROUTE = taskPath(PROJECT_ID, TASK_ID);
const AI_ID = '12121212-1212-4121-8121-121212121212';

let socket: RealtimeServer;
let client: ApolloClient;

function column(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

/** The board is on screen once its columns are. */
async function boardShown() {
  await screen.findByRole('region', { name: 'To do' });
  return within(column('To do')).findByRole('link', { name: 'Build login' });
}

/** What the cache holds, by id. */
function cachedIds(apollo: ApolloClient): string[] {
  return Object.keys(apollo.cache.extract() as Record<string, unknown>);
}

function taskUpdated(task: ReturnType<typeof taskNode>) {
  return {
    taskUpdated: {
      __typename: 'TaskEvent',
      taskId: task.id,
      projectId: PROJECT_ID,
      task,
    },
  };
}

function commentAdded(comment: ReturnType<typeof threadNode>) {
  return {
    commentAdded: {
      __typename: 'CommentEvent',
      commentId: comment.id,
      taskId: TASK_ID,
      comment,
    },
  };
}

function recommendation(approvalStatus: string) {
  return {
    __typename: 'AiRecommendation' as const,
    id: AI_ID,
    type: 'STORY_POINT_ESTIMATION' as const,
    text: 'Five points.',
    confidenceScore: 0.8,
    provider: 'stub',
    approvalStatus: approvalStatus as 'PENDING' | 'APPROVED',
    resolutionStatus: 'OPEN' as const,
    metadata: {},
    projectId: PROJECT_ID,
    taskId: TASK_ID,
    sprintId: null,
    createdAt: '2026-09-09T10:00:00.000Z',
    updatedAt: '2026-09-09T10:00:00.000Z',
    requestedBy: { __typename: 'User' as const, id: PAT.id, name: PAT.name },
    approvedBy: null,
  };
}

/** Counts requests for one operation without answering them differently. */
function countRequests(operationName: string) {
  let count = 0;
  const marker = `query ${operationName}(`;
  server.events.on('request:start', ({ request }) => {
    void request
      .clone()
      .text()
      .then((body) => {
        if (body.includes(marker)) count += 1;
      });
  });
  return () => count;
}

function taskPage(discussion: Parameters<typeof discussionScenario>[1] = {}) {
  return [
    ...discussionScenario(TASK_ID, discussion),
    ...detailScenario({ project: 'MEMBER' }),
  ];
}

/*
 * The sprint page brings the charting library with it. Its first import under
 * a parallel run can outlast a query's timeout, so it is loaded once up front.
 */
beforeAll(async () => {
  await import('@/modules/sprint/SprintDetail.page');
}, 60_000);

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
  // In memory, as after signing in: the socket needs no refresh to start.
  setAccessToken('token-1');
  server.use(...signedIn());
  socket = createRealtimeServer();
  client = createRealtimeTestClient(socket);
});

afterEach(() => {
  server.events.removeAllListeners();
  clearAccessToken();
});

describe('what is subscribed to', () => {
  it('holds one subscription per topic for the project, and one for the open task', async () => {
    // Arrange
    server.use(...taskPage());

    // Act
    renderRoutes(routes, { route: TASK_ROUTE, apolloClient: client });
    await screen.findByRole('heading', { name: 'Build login' });

    // Assert
    await waitFor(() =>
      expect(socket.subscribed('CommentAdded')).toEqual([{ taskId: TASK_ID }]),
    );
    expect(socket.subscribed('TaskUpdated')).toEqual([
      { projectId: PROJECT_ID },
    ]);
    expect(socket.subscribed('SprintUpdated')).toEqual([
      { projectId: PROJECT_ID },
    ]);
    expect(socket.subscribed('AiRecommendationUpdated')).toEqual([
      { projectId: PROJECT_ID },
    ]);
    expect(socket.subscribed('NotificationReceived')).toEqual([{}]);
    // All of it over one socket.
    expect(socket.sockets).toHaveLength(1);
  });
});

describe('tasks, as others change them', () => {
  it('moves a card on the board when someone else changes its status', async () => {
    // Arrange
    server.use(...boardScenario({ project: 'MEMBER' }));
    renderRoutes(routes, { route: BOARD_ROUTE, apolloClient: client });
    await boardShown();
    await waitFor(() =>
      expect(socket.subscribed('TaskUpdated')).toHaveLength(1),
    );
    const boardReads = countRequests('ProjectBoard');

    // Act
    socket.push('TaskUpdated', taskUpdated(taskNode({ status: 'IN_REVIEW' })));

    // Assert — the card moves, from the event alone: nothing is re-read.
    expect(
      await within(column('In review')).findByRole('link', {
        name: 'Build login',
      }),
    ).toBeVisible();
    expect(
      within(column('To do')).queryByRole('link', { name: 'Build login' }),
    ).toBeNull();
    expect(boardReads()).toBe(0);
  });

  it('writes nothing for a task this client has never loaded', async () => {
    // Arrange
    const unknownId = '0f0f0f0f-0f0f-40f0-80f0-0f0f0f0f0f0f';
    server.use(...boardScenario({ project: 'MEMBER' }));
    renderRoutes(routes, { route: BOARD_ROUTE, apolloClient: client });
    await boardShown();
    await waitFor(() =>
      expect(socket.subscribed('TaskUpdated')).toHaveLength(1),
    );

    // Act
    socket.push(
      'TaskUpdated',
      taskUpdated(taskNode({ id: unknownId, title: 'Never loaded' })),
    );
    // Something that is processed, to know the first event has been too.
    socket.push('TaskUpdated', taskUpdated(taskNode({ title: 'Renamed' })));
    await screen.findByRole('link', { name: 'Renamed' });

    // Assert
    expect(cachedIds(client)).not.toContain(`Task:${unknownId}`);
    expect(screen.queryByText('Never loaded')).toBeNull();
  });

  it('shows a mutation’s result and its echo over the socket as one change', async () => {
    // Arrange
    const moved = taskNode({ status: 'IN_PROGRESS' });
    const current: { overrides: TaskOverrides } = { overrides: {} };
    server.use(
      graphql.mutation('ChangeTaskStatus', () => {
        current.overrides = { status: 'IN_PROGRESS' };
        // The event leaves the server before the mutation's own answer does.
        socket.push('TaskUpdated', taskUpdated(moved));
        return HttpResponse.json({
          data: {
            changeTaskStatus: {
              __typename: 'Task',
              id: TASK_ID,
              status: 'IN_PROGRESS',
            },
          },
        });
      }),
      ...detailScenario({ project: 'ADMIN' }, {}, undefined, current),
    );
    const { user } = renderRoutes(routes, {
      route: TASK_ROUTE,
      apolloClient: client,
    });
    await waitFor(() =>
      expect(socket.subscribed('TaskUpdated')).toHaveLength(1),
    );

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Move to In progress' }),
    );

    // Assert — the new status, once, and the moves that follow from it.
    expect(
      await screen.findByRole('button', { name: 'Move to In review' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Move to In progress' }),
    ).toBeNull();
  });

  it('re-reads an open task, for its audit trail, when someone else changes it', async () => {
    // Arrange
    const current: { overrides: TaskOverrides } = { overrides: {} };
    server.use(
      ...discussionScenario(TASK_ID),
      ...detailScenario({ project: 'MEMBER' }, {}, undefined, current),
    );
    const taskReads = countRequests('Task');
    renderRoutes(routes, { route: TASK_ROUTE, apolloClient: client });
    await screen.findByRole('heading', { name: 'Build login' });
    await waitFor(() =>
      expect(socket.subscribed('TaskUpdated')).toHaveLength(1),
    );
    await waitFor(() => expect(taskReads()).toBe(1));

    // Act
    current.overrides = { title: 'Build sign-in' };
    socket.push('TaskUpdated', taskUpdated(taskNode(current.overrides)));

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Build sign-in' }),
    ).toBeVisible();
    await waitFor(() => expect(taskReads()).toBe(2));

    // Act — another task in the project is not this page's business.
    socket.push(
      'TaskUpdated',
      taskUpdated(taskNode({ id: OTHER_TASK_ID, title: 'Design schema' })),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert
    expect(taskReads()).toBe(2);
  });
});

describe('sprints and epics, as work moves', () => {
  it('re-reads a sprint’s figures alone when a task in the project changes', async () => {
    // Arrange
    const finished = sprintDetail({
      tasks: SPRINT_TASKS.map((task) => ({ ...task, status: 'DONE' })),
    });
    let figureReads = 0;
    server.use(
      graphql.query('SprintFigures', () => {
        figureReads += 1;
        return HttpResponse.json({
          data: {
            sprint: {
              __typename: 'Sprint',
              id: SPRINT_ID,
              state: finished.state,
              taskCount: finished.taskCount,
              metrics: finished.metrics,
              burndown: finished.burndown,
            },
          },
        });
      }),
      ...sprintDetailScenario({ project: 'MEMBER' }),
    );
    const sprintReads = countRequests('Sprint');
    renderRoutes(routes, {
      route: sprintPath(PROJECT_ID, SPRINT_ID),
      apolloClient: client,
    });
    expect(await screen.findByText('50%')).toBeVisible();
    await waitFor(() =>
      expect(socket.subscribed('TaskUpdated')).toHaveLength(1),
    );

    // Act
    socket.push(
      'TaskUpdated',
      taskUpdated(taskNode({ id: OTHER_TASK_ID, status: 'DONE' })),
    );

    // Assert
    expect(await screen.findByText('100%')).toBeVisible();
    expect(figureReads).toBe(1);
    // The sprint itself, with its pages of tasks, is not fetched again.
    expect(sprintReads()).toBe(1);
  });

  it('shows a sprint’s new state when someone else changes it', async () => {
    // Arrange
    const completed = sprintDetail({ state: 'COMPLETED' });
    server.use(
      graphql.query('SprintFigures', () =>
        HttpResponse.json({
          data: {
            sprint: {
              __typename: 'Sprint',
              id: SPRINT_ID,
              state: 'COMPLETED',
              taskCount: completed.taskCount,
              metrics: completed.metrics,
              burndown: completed.burndown,
            },
          },
        }),
      ),
      ...sprintDetailScenario({ project: 'ADMIN' }),
    );
    renderRoutes(routes, {
      route: sprintPath(PROJECT_ID, SPRINT_ID),
      apolloClient: client,
    });
    expect(
      await screen.findByRole('button', { name: 'Complete sprint' }),
    ).toBeVisible();
    await waitFor(() =>
      expect(socket.subscribed('SprintUpdated')).toHaveLength(1),
    );

    // Act
    socket.push('SprintUpdated', {
      sprintUpdated: {
        __typename: 'SprintEvent',
        sprintId: SPRINT_ID,
        projectId: PROJECT_ID,
        sprint: sprintSummary({ state: 'COMPLETED' }),
      },
    });

    // Assert — a completed sprint offers no further move.
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Complete sprint' }),
      ).toBeNull(),
    );
  });

  it('re-reads an epic’s progress alone when a task in the project changes', async () => {
    // Arrange
    let progressReads = 0;
    server.use(
      graphql.query('EpicProgress', () => {
        progressReads += 1;
        return HttpResponse.json({
          data: {
            epic: {
              __typename: 'Epic',
              id: EPIC_ID,
              progress: 100,
              completedTasks: 2,
              totalTasks: 2,
            },
          },
        });
      }),
      ...epicDetailScenario({ project: 'MEMBER' }),
    );
    renderRoutes(routes, {
      route: epicPath(PROJECT_ID, EPIC_ID),
      apolloClient: client,
    });
    expect(await screen.findByText('50%')).toBeVisible();
    await waitFor(() =>
      expect(socket.subscribed('TaskUpdated')).toHaveLength(1),
    );

    // Act
    socket.push(
      'TaskUpdated',
      taskUpdated(taskNode({ id: OTHER_TASK_ID, status: 'DONE' })),
    );

    // Assert
    expect(await screen.findByText('100%')).toBeVisible();
    expect(screen.getByText('2 of 2 tasks done')).toBeVisible();
    expect(progressReads).toBe(1);
  });
});

describe('comments, as others write them', () => {
  it('adds someone else’s comment to the end of the thread, once', async () => {
    // Arrange
    server.use(...taskPage({ threads: [threadNode(TASK_ID, PAT)] }));
    renderRoutes(routes, { route: TASK_ROUTE, apolloClient: client });
    await screen.findByText('Is the copy final?');
    await waitFor(() =>
      expect(socket.subscribed('CommentAdded')).toHaveLength(1),
    );
    const arrival = threadNode(TASK_ID, TERRY, {
      id: NEW_COMMENT_ID,
      body: 'Yes, signed off.',
    });

    // Act — and again: an event that repeats must not add it twice.
    socket.push('CommentAdded', commentAdded(arrival));
    socket.push('CommentAdded', commentAdded(arrival));

    // Assert
    expect(await screen.findByText('Yes, signed off.')).toBeVisible();
    expect(
      screen
        .getAllByRole('article')
        .map((article) => article.getAttribute('aria-label')),
    ).toEqual(['Comment by Pat Project', 'Comment by Terry Teammate']);
    expect(screen.getByText('Showing 2 of 2')).toBeVisible();
  });

  it('files someone else’s reply under its thread', async () => {
    // Arrange
    server.use(...taskPage({ threads: [threadNode(TASK_ID, PAT)] }));
    renderRoutes(routes, { route: TASK_ROUTE, apolloClient: client });
    await screen.findByText('Is the copy final?');
    await waitFor(() =>
      expect(socket.subscribed('CommentAdded')).toHaveLength(1),
    );

    // Act
    socket.push(
      'CommentAdded',
      commentAdded({
        ...commentNode(TASK_ID, TERRY, {
          id: REPLY_ID,
          body: 'On it.',
          parentCommentId: COMMENT_ID,
        }),
        replies: [],
      }),
    );

    // Assert
    const replies = await screen.findByRole('list', {
      name: 'Replies to Pat Project',
    });
    expect(within(replies).getByText('On it.')).toBeVisible();
    // A reply is not a thread: the count of threads stands.
    expect(screen.getByText('Showing 1 of 1')).toBeVisible();
  });

  it('shows the viewer’s own comment once when its echo arrives before the answer', async () => {
    // Arrange
    const created = threadNode(TASK_ID, VIEWER, {
      id: NEW_COMMENT_ID,
      body: 'Looks good',
    });
    let seenWhileSending: number | null = null;
    server.use(
      graphql.mutation('CreateComment', async () => {
        socket.push('CommentAdded', commentAdded(created));
        await new Promise((resolve) => setTimeout(resolve, 30));
        seenWhileSending = screen.getAllByRole('article').length;
        return HttpResponse.json({ data: { createComment: created } });
      }),
      ...taskPage(),
    );
    const { user } = renderRoutes(routes, {
      route: TASK_ROUTE,
      apolloClient: client,
    });
    await waitFor(() =>
      expect(socket.subscribed('CommentAdded')).toHaveLength(1),
    );

    // Act
    await user.type(
      await screen.findByLabelText('Add a comment'),
      'Looks good',
    );
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    // Assert — never two on screen: not while sending, not after.
    await waitFor(() => expect(screen.queryByText('Sending…')).toBeNull());
    expect(seenWhileSending).toBe(1);
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });
});

describe('AI recommendations, as they are decided', () => {
  it('updates one this client holds, and writes nothing for one it does not', async () => {
    // Arrange
    server.use(...boardScenario({ project: 'MEMBER' }));
    renderRoutes(routes, { route: BOARD_ROUTE, apolloClient: client });
    await waitFor(() =>
      expect(socket.subscribed('AiRecommendationUpdated')).toHaveLength(1),
    );
    const cacheId = `AiRecommendation:${AI_ID}`;
    const event = (approvalStatus: string) => ({
      aiRecommendationUpdated: {
        __typename: 'AiRecommendationEvent',
        recommendationId: AI_ID,
        projectId: PROJECT_ID,
        approvalStatus,
        recommendation: recommendation(approvalStatus),
      },
    });

    // Act — not loaded yet: the event is dropped.
    socket.push('AiRecommendationUpdated', event('APPROVED'));
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert
    expect(cachedIds(client)).not.toContain(cacheId);

    // Arrange — now it is loaded, as Phase 12's queue will load it.
    client.cache.writeFragment({
      id: cacheId,
      fragment: AiRecommendationItemFragment,
      data: recommendation('PENDING'),
    });

    // Act
    socket.push('AiRecommendationUpdated', event('APPROVED'));

    // Assert
    await waitFor(() =>
      expect(
        client.cache.readFragment({
          id: cacheId,
          fragment: AiRecommendationItemFragment,
        })?.approvalStatus,
      ).toBe('APPROVED'),
    );
  });
});

describe('connection status', () => {
  it('says Live when connected, and nothing is needed from the reader', async () => {
    // Arrange
    server.use(...boardScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: BOARD_ROUTE, apolloClient: client });

    // Assert
    const status = await screen.findByText('Live');
    expect(status.closest('[role="status"]')).toHaveTextContent(
      'Live updates: Live',
    );
    await boardShown();
  });

  it('says Offline when the server cannot be reached, and the app works all the same', async () => {
    // Arrange — the socket is down from the start.
    socket.goDown();
    let sent: unknown;
    const current: { overrides: TaskOverrides } = { overrides: {} };
    server.use(
      graphql.mutation('ChangeTaskStatus', ({ variables }) => {
        sent = variables;
        current.overrides = { status: 'IN_PROGRESS' };
        return HttpResponse.json({
          data: {
            changeTaskStatus: {
              __typename: 'Task',
              id: TASK_ID,
              status: 'IN_PROGRESS',
            },
          },
        });
      }),
      ...detailScenario({ project: 'ADMIN' }, {}, undefined, current),
    );

    // Act
    const { user } = renderRoutes(routes, {
      route: TASK_ROUTE,
      apolloClient: client,
    });

    // Assert
    expect(await screen.findByText('Offline')).toBeVisible();
    expect(
      await screen.findByRole('heading', { name: 'Build login' }),
    ).toBeVisible();

    // Act — reading worked; so does writing.
    await user.click(
      await screen.findByRole('button', { name: 'Move to In progress' }),
    );

    // Assert
    expect(
      await screen.findByRole('button', { name: 'Move to In review' }),
    ).toBeVisible();
    expect(sent).toEqual({ id: TASK_ID, status: 'IN_PROGRESS' });
  });

  it('says Reconnecting when the line drops, then catches up on what it missed', async () => {
    // Arrange
    let boardReads = 0;
    let tasks = [taskNode()];
    server.use(
      graphql.query('ProjectBoard', () => {
        boardReads += 1;
        return HttpResponse.json({ data: boardData(tasks) });
      }),
      ...boardScenario({ project: 'MEMBER' }),
    );
    // Slow enough to see the state between the drop and the return.
    client = createRealtimeTestClient(socket, () => 150);
    renderRoutes(routes, { route: BOARD_ROUTE, apolloClient: client });
    await boardShown();
    await screen.findByText('Live');
    expect(boardReads).toBe(1);

    // Act — the line drops, and a change is made while it is down.
    tasks = [taskNode({ status: 'DONE' })];
    socket.drop();

    // Assert
    expect(await screen.findByText('Reconnecting…')).toBeVisible();
    expect(await screen.findByText('Live')).toBeVisible();
    // No event said so; the board was read again because there was a gap.
    expect(
      await within(column('Done')).findByRole('link', { name: 'Build login' }),
    ).toBeVisible();
    expect(boardReads).toBe(2);
  });

  it('closes the socket on sign-out and leaves it closed', async () => {
    // Arrange
    server.use(
      graphql.mutation('Logout', () =>
        HttpResponse.json({ data: { logout: true } }),
      ),
    );
    const { user } = renderRoutes(routes, {
      route: ROUTES.home,
      apolloClient: client,
    });
    await screen.findByText('Live');

    // Act
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    // Assert
    expect(
      await screen.findByRole('button', { name: 'Sign in' }),
    ).toBeVisible();
    await waitFor(() => expect(socket.current()).toBeUndefined());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(socket.sockets).toHaveLength(1);
  });
});
