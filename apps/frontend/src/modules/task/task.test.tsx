import { HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { TASK_STATUSES } from '@contracts';
import type { ErrorCode, TaskStatus } from '@contracts';
import { routes } from '@/App';
import {
  createTaskSchema,
  storyPointsSchema,
  timeLogSchema,
} from '@/modules/task/schemas/task.schema';
import {
  OTHER_TASK_ID,
  PAT,
  PROJECT_ID,
  SECOND_TASK,
  SPRINT_ID,
  TASK_ID,
  TERRY,
  VIEWER,
  activity,
  boardData,
  boardScenario,
  detailData,
  detailScenario,
  listData,
  listScenario,
  person,
  taskConnection,
  taskNode,
} from '@/modules/task/task.fixtures';
import type { TaskOverrides } from '@/modules/task/task.fixtures';
import {
  buildBoardColumns,
  canTransitionTask,
  formatDuration,
  nextTaskStatuses,
  taskCapabilities,
} from '@/modules/task/utils/task.utils';
import {
  projectBoardPath,
  projectTasksPath,
  taskPath,
} from '@/shared/routes/route.constants';
import { resetRefreshState } from '@/shared/services/auth.gateway';
import { clearAccessToken } from '@/shared/services/session.store';
import { auditA11y } from '@/shared/tests/a11y';
import {
  graphql,
  mockMutationError,
  mockQueryError,
} from '@/shared/tests/graphql';
import {
  renderRoutes,
  screen,
  waitFor,
  within,
} from '@/shared/tests/renderWithProviders';
import { server } from '@/shared/tests/server';
import { signedIn } from '@/shared/tests/session';
import {
  apiToDateInput,
  dateInputToApi,
  isApiDateTime,
} from '@/shared/utils/date.utils';

// The server's own wording, which must never reach the screen.
const SERVER_DETAIL = 'internal reason';

const BOARD_ROUTE = projectBoardPath(PROJECT_ID);
const LIST_ROUTE = projectTasksPath(PROJECT_ID);
const TASK_ROUTE = taskPath(PROJECT_ID, TASK_ID);

function mutationFails(name: string, code: ErrorCode) {
  return mockMutationError(name, code, SERVER_DETAIL);
}

/*
 * A select shows its value a render after it mounts. Until then its button has
 * no text, which an audit run too early would report as an unnamed button.
 */
function allSelectsNamed() {
  for (const select of screen.getAllByRole('combobox')) {
    if (select instanceof HTMLButtonElement) {
      expect(select.textContent).not.toBe('');
    }
  }
}

function column(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
  server.use(...signedIn());
});

describe('task workflow', () => {
  // Mirrors TASK_STATUS_TRANSITIONS in the backend's task.model.ts.
  const LEGAL: Record<TaskStatus, TaskStatus[]> = {
    BACKLOG: ['TODO', 'BLOCKED'],
    TODO: ['BACKLOG', 'IN_PROGRESS', 'BLOCKED'],
    IN_PROGRESS: ['TODO', 'IN_REVIEW', 'BLOCKED'],
    IN_REVIEW: ['IN_PROGRESS', 'TESTING', 'BLOCKED'],
    TESTING: ['IN_PROGRESS', 'DONE', 'BLOCKED'],
    DONE: ['IN_PROGRESS'],
    BLOCKED: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING'],
  };

  it.each(TASK_STATUSES)('allows only the legal moves from %s', (from) => {
    // Act
    const allowed = TASK_STATUSES.filter((to) => canTransitionTask(from, to));

    // Assert — every one of the seven targets, including the status itself.
    expect([...allowed].sort()).toEqual([...LEGAL[from]].sort());
    expect([...nextTaskStatuses(from)].sort()).toEqual([...LEGAL[from]].sort());
  });
});

describe('board arrangement', () => {
  it('places a card by its current status and corrects both counts', () => {
    // Arrange — fetched as "to do", but the task has since moved on.
    const moved = { id: 'a', status: 'IN_PROGRESS' as const };
    const staying = { id: 'b', status: 'TODO' as const };
    const page = (
      nodes: Array<{ id: string; status: TaskStatus }>,
      total: number,
    ) => ({
      edges: nodes.map((node) => ({ node })),
      pageInfo: { hasNextPage: false, endCursor: null },
      totalCount: total,
    });

    // Act
    const columns = buildBoardColumns({
      BACKLOG: page([], 0),
      TODO: page([moved, staying], 7),
      IN_PROGRESS: page([], 3),
      IN_REVIEW: null,
      TESTING: undefined,
      DONE: page([], 0),
      BLOCKED: page([], 0),
    });

    // Assert
    const byStatus = Object.fromEntries(
      columns.map((entry) => [entry.status, entry]),
    );
    expect(byStatus['TODO']?.tasks).toEqual([staying]);
    expect(byStatus['TODO']?.totalCount).toBe(6);
    expect(byStatus['IN_PROGRESS']?.tasks).toEqual([moved]);
    expect(byStatus['IN_PROGRESS']?.totalCount).toBe(4);
    expect(columns.map((entry) => entry.status)).toEqual([...TASK_STATUSES]);
  });
});

describe('task formatting and validation', () => {
  it.each([
    [12_000, '3h 20m'],
    [3600, '1h'],
    [2700, '45m'],
    [0, '0m'],
    [59, '0m'],
  ])('renders %i logged seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds, 'en')).toBe(expected);
  });

  it.each([
    [0, true],
    [1000, true],
    [null, true],
    [-1, false],
    [1001, false],
    [2.5, false],
    [Number.NaN, false],
  ])('story points %s valid: %s', (value, valid) => {
    expect(storyPointsSchema.safeParse(value).success).toBe(valid);
  });

  it('turns hours and minutes into seconds, and refuses nothing or nonsense', () => {
    expect(timeLogSchema.parse({ hours: 3, minutes: 20 })).toBe(12_000);
    expect(timeLogSchema.safeParse({ hours: 0, minutes: 0 }).success).toBe(
      false,
    );
    expect(timeLogSchema.safeParse({ hours: 1, minutes: 60 }).success).toBe(
      false,
    );
    expect(timeLogSchema.safeParse({ hours: -1, minutes: 0 }).success).toBe(
      false,
    );
    expect(
      timeLogSchema.safeParse({ hours: 300_000, minutes: 0 }).success,
    ).toBe(false);
  });

  it('bounds the title at 200 characters and refuses a bare date', () => {
    const base = {
      description: '',
      priority: 'MEDIUM',
      dueDate: null,
      storyPoints: null,
      assigneeId: null,
      sprintId: null,
      epicId: null,
    };

    expect(createTaskSchema.safeParse({ ...base, title: '  ' }).success).toBe(
      false,
    );
    expect(
      createTaskSchema.safeParse({ ...base, title: 'x'.repeat(200) }).success,
    ).toBe(true);
    expect(
      createTaskSchema.safeParse({ ...base, title: 'x'.repeat(201) }).success,
    ).toBe(false);
    expect(
      createTaskSchema.safeParse({ ...base, title: 'x', dueDate: '2026-03-15' })
        .success,
    ).toBe(false);
  });

  it('sends a picked day as a full RFC-3339 instant, never a bare date', () => {
    // Act
    const instant = dateInputToApi('2026-03-15');

    // Assert
    expect(instant).toBe('2026-03-15T00:00:00.000Z');
    expect(isApiDateTime(instant ?? '')).toBe(true);
    expect(apiToDateInput(instant)).toBe('2026-03-15');
    expect(dateInputToApi('2026-02-31')).toBeNull();
    expect(dateInputToApi('15/03/2026')).toBeNull();
    expect(dateInputToApi(null)).toBeNull();
  });

  it('lets a plain member change only a task they report or are assigned', () => {
    const mine = { assigneeId: VIEWER.id, reporterId: PAT.id };
    const theirs = { assigneeId: TERRY.id, reporterId: PAT.id };

    expect(
      taskCapabilities(['PROJECT_MEMBER'], VIEWER.id, mine).canUpdate,
    ).toBe(true);
    expect(
      taskCapabilities(['PROJECT_MEMBER'], VIEWER.id, theirs).canUpdate,
    ).toBe(false);
    expect(
      taskCapabilities(['PROJECT_MEMBER'], VIEWER.id, mine).canAssign,
    ).toBe(false);
    expect(taskCapabilities(['VIEWER'], VIEWER.id, theirs)).toEqual({
      canUpdate: false,
      canAssign: false,
      canDelete: false,
    });
    // A reporter may delete their own task whatever their role.
    expect(
      taskCapabilities(['PROJECT_MEMBER'], VIEWER.id, {
        assigneeId: null,
        reporterId: VIEWER.id,
      }).canDelete,
    ).toBe(true);
  });
});

describe('board', () => {
  it('shows one column per status, each card in its own', async () => {
    // Arrange
    server.use(...boardScenario({ project: 'ADMIN' }));

    // Act
    renderRoutes(routes, { route: BOARD_ROUTE });

    // Assert
    const todo = await screen.findByRole('region', { name: 'To do' });
    expect(
      within(todo).getByRole('link', { name: 'Build login' }),
    ).toHaveAttribute('href', TASK_ROUTE);
    expect(within(todo).getByText('High')).toBeVisible();
    expect(within(todo).getByText('5 points')).toBeVisible();
    expect(within(todo).getByText('auth')).toBeVisible();
    expect(within(todo).getByText('1 of 1')).toBeVisible();
    expect(
      within(column('In progress')).getByRole('link', {
        name: 'Design schema',
      }),
    ).toBeVisible();
    expect(
      [
        'Backlog',
        'To do',
        'In progress',
        'In review',
        'Testing',
        'Done',
        'Blocked',
      ].every((name) => column(name)),
    ).toBe(true);
  });

  it('gives an empty column its own message, distinct from an empty board', async () => {
    // Arrange
    server.use(...boardScenario({ project: 'ADMIN' }));

    // Act
    renderRoutes(routes, { route: BOARD_ROUTE });

    // Assert
    await screen.findByRole('region', { name: 'To do' });
    expect(within(column('Done')).getByText('Nothing is Done.')).toBeVisible();
    expect(screen.queryByText('This project has no tasks yet.')).toBeNull();
  });

  it('shows an empty board with a way to create a task, for someone who can', async () => {
    // Arrange
    server.use(...boardScenario({ project: 'MEMBER' }, []));

    // Act
    renderRoutes(routes, { route: BOARD_ROUTE });

    // Assert
    expect(
      await screen.findByText('This project has no tasks yet.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'New task' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'To do' })).toBeNull();
  });

  it('offers a viewer neither a move button nor task creation', async () => {
    // Arrange
    server.use(...boardScenario({ project: 'VIEWER' }));

    // Act
    renderRoutes(routes, { route: BOARD_ROUTE });

    // Assert
    await screen.findByRole('link', { name: 'Build login' });
    expect(screen.queryByRole('button', { name: /^Move/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New task' })).toBeNull();
  });

  it('moves a card with the keyboard alone: pick up, choose a column, drop', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...boardScenario({ project: 'ADMIN' }),
      graphql.mutation('ChangeTaskStatus', ({ variables }) => {
        sent = variables;
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
    );
    const { user } = renderRoutes(routes, { route: BOARD_ROUTE });
    const handle = await screen.findByRole('button', {
      name: 'Move “Build login”',
    });

    // Act — grab; the first legal column from "to do" is the backlog.
    handle.focus();
    await user.keyboard('{Enter}');

    // Assert
    expect(handle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Picked up “Build login”. It can move to Backlog.',
    );

    // Act — one column along, then drop.
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('status')).toHaveTextContent(
      'In progress, column 2 of 3 it can move to.',
    );
    await user.keyboard('{Enter}');

    // Assert — the card is in its new column, and focus went with it.
    await waitFor(() =>
      expect(
        within(column('In progress')).getByRole('link', {
          name: 'Build login',
        }),
      ).toBeVisible(),
    );
    expect(within(column('To do')).queryByRole('link')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(
      '“Build login” moved to In progress.',
    );
    await waitFor(() =>
      expect(sent).toEqual({ id: TASK_ID, status: 'IN_PROGRESS' }),
    );
    expect(
      screen.getByRole('button', { name: 'Move “Build login”' }),
    ).toHaveFocus();
    expect(within(column('To do')).getByText('0 of 0')).toBeVisible();
    expect(within(column('In progress')).getByText('2 of 2')).toBeVisible();
  });

  it('offers only the columns the workflow allows, and wraps around them', async () => {
    // Arrange
    server.use(...boardScenario({ project: 'ADMIN' }));
    const { user } = renderRoutes(routes, { route: BOARD_ROUTE });
    const handle = await screen.findByRole('button', {
      name: 'Move “Build login”',
    });

    // Act
    await user.click(handle);

    // Assert — from "to do": backlog, in progress, blocked. Nothing else.
    const targets = TASK_STATUSES.filter((status) =>
      within(
        column(
          {
            BACKLOG: 'Backlog',
            TODO: 'To do',
            IN_PROGRESS: 'In progress',
            IN_REVIEW: 'In review',
            TESTING: 'Testing',
            DONE: 'Done',
            BLOCKED: 'Blocked',
          }[status],
        ),
      ).queryByRole('button', { name: 'Move here' }),
    );
    expect(targets).toEqual(['BACKLOG', 'IN_PROGRESS', 'BLOCKED']);

    // Act — back from the first target wraps to the last.
    handle.focus();
    await user.keyboard('{ArrowLeft}');

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      'Blocked, column 3 of 3 it can move to.',
    );
  });

  it('moves a card by tapping the column, without the keyboard', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...boardScenario({ project: 'ADMIN' }),
      graphql.mutation('ChangeTaskStatus', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            changeTaskStatus: {
              __typename: 'Task',
              id: TASK_ID,
              status: 'BLOCKED',
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: BOARD_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Move “Build login”' }),
    );
    await user.click(
      within(column('Blocked')).getByRole('button', { name: 'Move here' }),
    );

    // Assert
    await waitFor(() =>
      expect(sent).toEqual({ id: TASK_ID, status: 'BLOCKED' }),
    );
    expect(
      within(column('Blocked')).getByRole('link', { name: 'Build login' }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Move here' })).toBeNull();
  });

  it('lets go on Escape and sends nothing', async () => {
    // Arrange — no mutation handler: a request would fail the test.
    server.use(...boardScenario({ project: 'ADMIN' }));
    const { user } = renderRoutes(routes, { route: BOARD_ROUTE });
    const handle = await screen.findByRole('button', {
      name: 'Move “Build login”',
    });

    // Act
    handle.focus();
    await user.keyboard('{Enter}{ArrowRight}{Escape}');

    // Assert
    expect(handle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Move cancelled. “Build login” is still To do.',
    );
    expect(
      within(column('To do')).getByRole('link', { name: 'Build login' }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Move here' })).toBeNull();
  });

  it.each([
    [
      'BAD_USER_INPUT',
      'That move isn’t allowed from the task’s current status',
    ],
    ['FORBIDDEN', 'You don’t have permission to do that.'],
  ] as const)(
    'puts the card back when the server answers %s',
    async (code, message) => {
      // Arrange
      server.use(
        ...boardScenario({ project: 'ADMIN' }),
        mutationFails('ChangeTaskStatus', code),
      );
      const { user } = renderRoutes(routes, { route: BOARD_ROUTE });

      // Act
      await user.click(
        await screen.findByRole('button', { name: 'Move “Build login”' }),
      );
      await user.click(
        within(column('In progress')).getByRole('button', {
          name: 'Move here',
        }),
      );

      // Assert — rolled back, and told why in our words, not the server's.
      expect(await screen.findByText(new RegExp(message))).toBeVisible();
      await waitFor(() =>
        expect(
          within(column('To do')).getByRole('link', { name: 'Build login' }),
        ).toBeVisible(),
      );
      expect(
        within(column('In progress')).queryByRole('link', {
          name: 'Build login',
        }),
      ).toBeNull();
      expect(within(column('To do')).getByText('1 of 1')).toBeVisible();
      expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
    },
  );

  it('loads the next page of one column, sending the cursor back untouched', async () => {
    // Arrange
    const first = taskNode({ id: 'task-1', title: 'First', status: 'DONE' });
    const second = taskNode({ id: 'task-2', title: 'Second', status: 'DONE' });
    let sent: Record<string, unknown> = {};
    server.use(
      graphql.query('ProjectBoard', () => {
        const data = boardData([]);
        data.project.done = taskConnection([first], {
          hasNextPage: true,
          endCursor: 'opaque-cursor',
          total: 2,
        });
        return HttpResponse.json({ data });
      }),
      ...boardScenario({ project: 'ADMIN' }),
      graphql.query('ProjectBoardColumn', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            project: {
              __typename: 'Project',
              id: PROJECT_ID,
              tasks: taskConnection([second], { total: 2 }),
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: BOARD_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Load more Done tasks' }),
    );

    // Assert — appended below the card already shown.
    expect(await screen.findByRole('link', { name: 'Second' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'First' })).toBeVisible();
    expect(sent).toMatchObject({
      projectId: PROJECT_ID,
      status: 'DONE',
      after: 'opaque-cursor',
    });
    expect(sent['first']).toBeLessThanOrEqual(100);
    expect(within(column('Done')).getByText('2 of 2')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Load more Done tasks' }),
    ).toBeNull();
  });

  it('resolves a failed load into an error with a retry', async () => {
    // Arrange
    let attempts = 0;
    server.use(
      graphql.query('ProjectBoard', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json({ data: boardData() });
      }),
      ...boardScenario({ project: 'ADMIN' }),
    );
    const { user } = renderRoutes(routes, { route: BOARD_ROUTE });

    // Act
    expect(await screen.findByText('Could not load the board.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(
      await screen.findByRole('link', { name: 'Build login' }),
    ).toBeVisible();
  });

  it('has no accessibility violations', async () => {
    // Arrange
    server.use(...boardScenario({ project: 'ADMIN' }));

    // Act
    const { container } = renderRoutes(routes, { route: BOARD_ROUTE });
    await screen.findByRole('link', { name: 'Build login' });

    // Assert
    expect(await auditA11y(container)).toHaveNoViolations();
  });
});

describe('task list', () => {
  it('names the sprint and epic a task only carries the ids of', async () => {
    // Arrange
    server.use(...listScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: LIST_ROUTE });

    // Assert
    const row = (
      await screen.findByRole('link', { name: 'Build login' })
    ).closest('tr') as HTMLElement;
    await waitFor(() =>
      expect(within(row).getByText('Sprint 1')).toBeVisible(),
    );
    expect(within(row).getByText('Onboarding')).toBeVisible();
    expect(within(row).getByText('To do')).toBeVisible();
    expect(within(row).getByText('Terry Teammate')).toBeVisible();
    expect(within(row).getByText('Mar 15, 2099')).toBeVisible();

    const bare = screen
      .getByRole('link', { name: 'Design schema' })
      .closest('tr') as HTMLElement;
    expect(within(bare).getByText('No sprint')).toBeVisible();
    expect(within(bare).getByText('No epic')).toBeVisible();
    expect(within(bare).getByText('Unassigned')).toBeVisible();
    expect(within(bare).getByText('Not estimated')).toBeVisible();
  });

  it('sends each chosen filter, combined, and shows what comes back', async () => {
    // Arrange
    const requests: Array<Record<string, unknown>> = [];
    server.use(
      graphql.query('ProjectTasks', ({ variables }) => {
        requests.push(variables);
        const filter = variables['filter'] as Record<string, unknown>;
        return HttpResponse.json({
          data: listData(
            filter['priority'] === 'LOW'
              ? [taskNode({ ...SECOND_TASK, priority: 'LOW' })]
              : undefined,
          ),
        });
      }),
      ...listScenario({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: LIST_ROUTE });
    await screen.findByRole('link', { name: 'Build login' });

    // Act
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(
      await screen.findByRole('option', { name: 'In progress' }),
    );
    await user.click(screen.getByRole('combobox', { name: 'Priority' }));
    await user.click(await screen.findByRole('option', { name: 'Low' }));

    // Assert
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Build login' })).toBeNull(),
    );
    expect(screen.getByRole('link', { name: 'Design schema' })).toBeVisible();
    expect(requests.map((request) => request['filter'])).toEqual([
      {},
      { status: 'IN_PROGRESS' },
      { status: 'IN_PROGRESS', priority: 'LOW' },
    ]);
    expect(requests.at(-1)).toMatchObject({
      sortField: 'CREATED_AT',
      sortDirection: 'DESC',
    });
  });

  it('filters by assignee, sprint, epic and label, and sorts', async () => {
    // Arrange
    const requests: Array<Record<string, unknown>> = [];
    server.use(
      graphql.query('ProjectTasks', ({ variables }) => {
        requests.push(variables);
        return HttpResponse.json({ data: listData() });
      }),
      ...listScenario({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: LIST_ROUTE });
    await screen.findByRole('link', { name: 'Build login' });

    async function choose(field: string, option: string) {
      await user.click(screen.getByRole('combobox', { name: field }));
      await user.click(await screen.findByRole('option', { name: option }));
    }

    // Act
    await choose('Assignee', 'Terry Teammate');
    await choose('Sprint', 'Sprint 1');
    await choose('Epic', 'Onboarding');
    await choose('Label', 'auth');
    await choose('Sort by', 'Due date');
    await choose('Order', 'Ascending');

    // Assert
    await waitFor(() =>
      expect(requests.at(-1)).toMatchObject({
        filter: {
          assigneeId: TERRY.id,
          sprintId: SPRINT_ID,
          epicId: expect.any(String) as string,
          labelId: 'label-auth',
        },
        sortField: 'DUE_DATE',
        sortDirection: 'ASC',
      }),
    );
  });

  it('keeps the previous rows on screen while a new filter loads', async () => {
    // Arrange — the filtered request never answers within the test.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      graphql.query('ProjectTasks', async ({ variables }) => {
        const filter = variables['filter'] as Record<string, unknown>;
        if (filter['status']) await held;
        return HttpResponse.json({ data: listData() });
      }),
      ...listScenario({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: LIST_ROUTE });
    await screen.findByRole('link', { name: 'Build login' });

    // Act
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Done' }));

    // Assert
    await waitFor(() =>
      expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true'),
    );
    expect(screen.getByRole('link', { name: 'Build login' })).toBeVisible();
    release();
    await waitFor(() =>
      expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'false'),
    );
  });

  it('tells "nothing matches" apart from "nothing here yet"', async () => {
    // Arrange
    server.use(...listScenario({ project: 'MEMBER' }, []));
    const { user } = renderRoutes(routes, { route: LIST_ROUTE });

    // Assert — nothing at all.
    expect(
      await screen.findByText('This project has no tasks yet.'),
    ).toBeVisible();

    // Act
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Blocked' }));

    // Assert — nothing in this filter, and a way out of it.
    expect(
      await screen.findByText('No tasks match these filters.'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(
      await screen.findByText('This project has no tasks yet.'),
    ).toBeVisible();
  });

  it('creates a task, sending a full instant for the due date', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...listScenario({ project: 'MEMBER' }),
      graphql.mutation('CreateTask', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: { createTask: taskNode({ id: 'new-task', title: 'Ship it' }) },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: LIST_ROUTE });

    // Act
    await user.click(await screen.findByRole('button', { name: 'New task' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create a task' });
    await user.type(within(dialog).getByLabelText('Title'), '  Ship it ');
    await user.type(within(dialog).getByLabelText('Story points'), '8');
    await user.type(within(dialog).getByLabelText('Due date'), '2026/03/15');
    await user.click(within(dialog).getByRole('combobox', { name: 'Sprint' }));
    await user.click(await screen.findByRole('option', { name: 'Sprint 1' }));
    await user.click(
      within(dialog).getByRole('button', { name: 'Create task' }),
    );

    // Assert
    expect(
      await screen.findByText('“Ship it” has been created.'),
    ).toBeVisible();
    expect(sent).toEqual({
      projectId: PROJECT_ID,
      input: {
        title: 'Ship it',
        description: null,
        priority: 'MEDIUM',
        dueDate: '2026-03-15T00:00:00.000Z',
        storyPoints: 8,
        assigneeId: null,
        sprintId: SPRINT_ID,
        epicId: null,
      },
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('points at the field when the title is missing, and sends nothing', async () => {
    // Arrange — no mutation handler: a request would fail the test.
    server.use(...listScenario({ project: 'MEMBER' }));
    const { user } = renderRoutes(routes, { route: LIST_ROUTE });

    // Act
    await user.click(await screen.findByRole('button', { name: 'New task' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create a task' });
    await user.type(within(dialog).getByLabelText('Story points'), '1001');
    await user.click(
      within(dialog).getByRole('button', { name: 'Create task' }),
    );

    // Assert
    expect(within(dialog).getByLabelText('Title')).toHaveAccessibleDescription(
      'Enter a title.',
    );
    expect(
      within(dialog).getByText('Enter a whole number from 0 to 1000.', {
        selector: '[role="alert"], [role="alert"] *, p, span',
      }),
    ).toBeVisible();
  });

  it.each([
    ['BAD_USER_INPUT', 'Some of the details below need fixing.'],
    ['FORBIDDEN', 'You don’t have permission to do that.'],
  ] as const)('shows a form-level error on %s', async (code, message) => {
    // Arrange
    server.use(
      ...listScenario({ project: 'MEMBER' }),
      mutationFails('CreateTask', code),
    );
    const { user } = renderRoutes(routes, { route: LIST_ROUTE });

    // Act
    await user.click(await screen.findByRole('button', { name: 'New task' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create a task' });
    await user.type(within(dialog).getByLabelText('Title'), 'Ship it');
    await user.click(
      within(dialog).getByRole('button', { name: 'Create task' }),
    );

    // Assert
    expect(await within(dialog).findByText(message)).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('does not offer task creation to a viewer', async () => {
    // Arrange
    server.use(...listScenario({ project: 'VIEWER' }));

    // Act
    renderRoutes(routes, { route: LIST_ROUTE });

    // Assert
    await screen.findByRole('link', { name: 'Build login' });
    expect(screen.queryByRole('button', { name: 'New task' })).toBeNull();
  });

  it('has no accessibility violations', async () => {
    // Arrange
    server.use(...listScenario({ project: 'MEMBER' }));

    // Act
    const { container } = renderRoutes(routes, { route: LIST_ROUTE });
    await screen.findByRole('link', { name: 'Build login' });
    await waitFor(allSelectsNamed);

    // Assert
    expect(await auditA11y(container)).toHaveNoViolations();
  });
});

describe('task detail', () => {
  it('shows the record, with time as a duration and ids as names', async () => {
    // Arrange
    server.use(...detailScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: TASK_ROUTE });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Build login' }),
    ).toBeVisible();
    expect(screen.getByText('Email and password.')).toBeVisible();
    expect(screen.getByText('3h 20m')).toBeVisible();
    expect(screen.queryByText('12000')).toBeNull();
    await waitFor(() => expect(screen.getByText('Onboarding')).toBeVisible());
    expect(screen.getByText('Sprint 1')).toBeVisible();
    expect(screen.getByText('Mar 15, 2099')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Pat Project' })).toBeVisible();
  });

  it('names the task in the breadcrumb', async () => {
    // Arrange
    server.use(...detailScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: TASK_ROUTE });

    // Assert
    const trail = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    await waitFor(() =>
      expect(
        within(trail)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual(['Home', 'Website', 'Tasks', 'Build login']),
    );
  });

  it('hides every control from a viewer', async () => {
    // Arrange
    server.use(...detailScenario({ project: 'VIEWER' }));

    // Act
    renderRoutes(routes, { route: TASK_ROUTE });

    // Assert — watching is open to anyone who can read the task.
    await screen.findByRole('heading', { name: 'Build login' });
    expect(screen.getByRole('button', { name: 'Watch' })).toBeVisible();
    expect(
      screen.queryByRole('button', {
        name: /Edit|Delete|Move to|Assign|Unassign|Save|Log time|Add/,
      }),
    ).toBeNull();
    expect(screen.queryByLabelText('Story points')).toBeNull();
  });

  it('lets a plain member change a task assigned to them, but not reassign it', async () => {
    // Arrange
    server.use(...detailScenario({ project: 'MEMBER' }, { assignee: VIEWER }));

    // Act
    renderRoutes(routes, { route: TASK_ROUTE });

    // Assert
    expect(
      await screen.findByRole('button', { name: 'Edit task' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Move to In progress' }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Unassign' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete task' })).toBeNull();
  });

  it('offers only legal status moves and applies one at once', async () => {
    // Arrange
    let sent: unknown;
    const current: { overrides: TaskOverrides } = { overrides: {} };
    server.use(
      ...detailScenario({ project: 'ADMIN' }, {}, undefined, current),
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
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });
    const group = await screen.findByRole('group', { name: 'Change status' });

    // Assert — from "to do".
    expect(
      within(group)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Move to Backlog', 'Move to In progress', 'Move to Blocked']);

    // Act
    await user.click(
      within(group).getByRole('button', { name: 'Move to In progress' }),
    );

    // Assert
    await waitFor(() =>
      expect(sent).toEqual({ id: TASK_ID, status: 'IN_PROGRESS' }),
    );
    expect(
      await within(
        screen.getByRole('group', { name: 'Change status' }),
      ).findByRole('button', { name: 'Move to In review' }),
    ).toBeVisible();
  });

  it('rolls an illegal status move back and says so', async () => {
    // Arrange
    server.use(
      ...detailScenario({ project: 'ADMIN' }),
      mutationFails('ChangeTaskStatus', 'BAD_USER_INPUT'),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Move to In progress' }),
    );

    // Assert
    expect(
      await screen.findByText(
        /That move isn’t allowed from the task’s current status/,
      ),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Move to In progress' }),
      ).toBeVisible(),
    );
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('unassigns by sending null, and shows it at once', async () => {
    // Arrange
    let sent: unknown;
    const current: { overrides: TaskOverrides } = { overrides: {} };
    server.use(
      ...detailScenario({ project: 'ADMIN' }, {}, undefined, current),
      graphql.mutation('AssignTask', ({ variables }) => {
        sent = variables;
        current.overrides = { assignee: null };
        return HttpResponse.json({
          data: {
            assignTask: {
              __typename: 'Task',
              id: TASK_ID,
              assigneeId: null,
              assignee: null,
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(await screen.findByRole('button', { name: 'Unassign' }));

    // Assert
    expect(
      await screen.findByText('The task is now unassigned.'),
    ).toBeVisible();
    expect(sent).toEqual({ id: TASK_ID, assigneeId: null });
    expect(screen.queryByRole('button', { name: 'Unassign' })).toBeNull();
  });

  it('assigns to a project member picked by name', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...detailScenario({ project: 'ADMIN' }, { assignee: null }),
      graphql.mutation('AssignTask', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            assignTask: {
              __typename: 'Task',
              id: TASK_ID,
              assigneeId: PAT.id,
              assignee: person(PAT),
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(await screen.findByRole('combobox', { name: 'Assign' }));
    await user.click(await screen.findByRole('option', { name: PAT.name }));
    await user.click(screen.getByRole('button', { name: 'Assign' }));

    // Assert
    expect(await screen.findByText('Assigned to Pat Project.')).toBeVisible();
    expect(sent).toEqual({ id: TASK_ID, assigneeId: PAT.id });
  });

  it('puts the assignee back when the server refuses', async () => {
    // Arrange
    server.use(
      ...detailScenario({ project: 'ADMIN' }),
      mutationFails('AssignTask', 'FORBIDDEN'),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(await screen.findByRole('button', { name: 'Unassign' }));

    // Assert
    expect(
      await screen.findByText('You don’t have permission to do that.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Unassign' })).toBeVisible(),
    );
    expect(screen.getByRole('link', { name: 'Terry Teammate' })).toBeVisible();
  });

  it('clears the estimate by sending null', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...detailScenario({ project: 'ADMIN' }),
      graphql.mutation('SetTaskStoryPoints', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            setTaskStoryPoints: {
              __typename: 'Task',
              id: TASK_ID,
              storyPoints: null,
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.clear(await screen.findByLabelText('Story points'));
    await user.click(screen.getByRole('button', { name: 'Save estimate' }));

    // Assert
    expect(await screen.findByText('Estimate cleared.')).toBeVisible();
    expect(sent).toEqual({ id: TASK_ID, storyPoints: null });
  });

  it('restores the estimate when saving it fails, and refuses 1001 unsent', async () => {
    // Arrange
    let requests = 0;
    server.use(
      ...detailScenario({ project: 'ADMIN' }),
      graphql.mutation('SetTaskStoryPoints', () => {
        requests += 1;
        return HttpResponse.error();
      }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });
    const field = await screen.findByLabelText('Story points');

    // Act — out of range: stopped before any request.
    await user.clear(field);
    await user.type(field, '1001');
    await user.click(screen.getByRole('button', { name: 'Save estimate' }));

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a whole number from 0 to 1000.',
    );
    expect(screen.getByLabelText('Story points')).toBeInvalid();
    expect(requests).toBe(0);

    // Act — in range, and the network fails.
    await user.clear(screen.getByLabelText('Story points'));
    await user.type(screen.getByLabelText('Story points'), '8');
    await user.click(screen.getByRole('button', { name: 'Save estimate' }));

    // Assert — back to the 5 the server last confirmed.
    expect(await screen.findByText(/Can’t reach the server/)).toBeVisible();
    await waitFor(() =>
      expect(screen.getByLabelText('Story points')).toHaveValue(5),
    );
  });

  it('moves the task out of its sprint by sending null', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...detailScenario({ project: 'ADMIN' }),
      graphql.mutation('MoveTaskToSprint', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            moveTaskToSprint: {
              __typename: 'Task',
              id: TASK_ID,
              sprintId: null,
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });
    const select = await screen.findByRole('combobox', { name: 'Sprint' });
    await waitFor(() => expect(select).toHaveTextContent('Sprint 1'));

    // Act
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: 'No sprint' }));

    // Assert
    expect(await screen.findByText('Taken out of its sprint.')).toBeVisible();
    expect(sent).toEqual({ id: TASK_ID, sprintId: null });
  });

  it('edits the details in place', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...detailScenario({ project: 'ADMIN' }),
      graphql.mutation('UpdateTask', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            updateTask: {
              __typename: 'Task',
              id: TASK_ID,
              title: 'Build sign-in',
              description: null,
              priority: 'HIGH',
              dueDate: '2099-03-15T00:00:00.000Z',
              updatedAt: '2026-09-07T10:00:00.000Z',
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(await screen.findByRole('button', { name: 'Edit task' }));
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Build sign-in');
    await user.clear(screen.getByLabelText('Description'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Build sign-in' }),
    ).toBeVisible();
    expect(sent).toEqual({
      id: TASK_ID,
      input: {
        title: 'Build sign-in',
        description: null,
        priority: 'HIGH',
        dueDate: '2099-03-15T00:00:00.000Z',
      },
    });
    expect(screen.getByText('No description.')).toBeVisible();
  });

  it('explains a dependency loop instead of a generic failure', async () => {
    // Arrange
    server.use(
      ...detailScenario({ project: 'ADMIN' }),
      mutationFails('AddTaskDependency', 'BAD_USER_INPUT'),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('combobox', { name: 'Task it depends on' }),
    );
    await user.click(
      await screen.findByRole('option', { name: 'Design schema' }),
    );
    await user.click(screen.getByRole('button', { name: 'Add dependency' }));

    // Assert
    expect(await screen.findByText(/That would create a loop/)).toBeVisible();
    expect(
      screen.queryByText('Some of the details below need fixing.'),
    ).toBeNull();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('adds and removes a dependency, never offering the task itself', async () => {
    // Arrange
    const sent: unknown[] = [];
    const dependency = { __typename: 'Task', ...SECOND_TASK };
    server.use(
      ...detailScenario({ project: 'ADMIN' }),
      graphql.mutation('AddTaskDependency', ({ variables }) => {
        sent.push(variables);
        return HttpResponse.json({
          data: {
            addTaskDependency: {
              __typename: 'Task',
              id: TASK_ID,
              dependencies: [dependency],
            },
          },
        });
      }),
      graphql.mutation('RemoveTaskDependency', ({ variables }) => {
        sent.push(variables);
        return HttpResponse.json({
          data: {
            removeTaskDependency: {
              __typename: 'Task',
              id: TASK_ID,
              dependencies: [],
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('combobox', { name: 'Task it depends on' }),
    );
    expect(screen.queryByRole('option', { name: 'Build login' })).toBeNull();
    await user.click(
      await screen.findByRole('option', { name: 'Design schema' }),
    );
    await user.click(screen.getByRole('button', { name: 'Add dependency' }));

    // Assert
    expect(
      await screen.findByRole('link', { name: 'Design schema' }),
    ).toHaveAttribute('href', taskPath(PROJECT_ID, OTHER_TASK_ID));
    expect(
      screen.getByText('There is no other task it could depend on.'),
    ).toBeVisible();

    // Act
    await user.click(
      screen.getByRole('button', {
        name: 'Remove dependency on “Design schema”',
      }),
    );

    // Assert
    expect(
      await screen.findByText('This task does not depend on any other.'),
    ).toBeVisible();
    expect(sent).toEqual([
      { taskId: TASK_ID, dependsOnTaskId: OTHER_TASK_ID },
      { taskId: TASK_ID, dependsOnTaskId: OTHER_TASK_ID },
    ]);
  });

  it('logs time in seconds and shows the new total as a duration', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...detailScenario({ project: 'ADMIN' }),
      graphql.mutation('LogTaskTime', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            logTaskTime: {
              __typename: 'Task',
              id: TASK_ID,
              loggedSeconds: 17_400,
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.type(await screen.findByLabelText('Hours'), '1');
    await user.type(screen.getByLabelText('Minutes'), '30');
    await user.click(screen.getByRole('button', { name: 'Log time' }));

    // Assert
    expect(await screen.findByText('1h 30m logged.')).toBeVisible();
    expect(sent).toEqual({ id: TASK_ID, seconds: 5400 });
    expect(screen.getByText('4h 50m')).toBeVisible();
  });

  it('refuses to log no time at all', async () => {
    // Arrange — no mutation handler: a request would fail the test.
    server.use(...detailScenario({ project: 'ADMIN' }));
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(await screen.findByRole('button', { name: 'Log time' }));

    // Assert
    expect(screen.getByLabelText('Hours')).toHaveAccessibleDescription(
      'Enter some time to log.',
    );
  });

  it('toggles watching', async () => {
    // Arrange
    server.use(
      ...detailScenario({ project: 'VIEWER' }),
      graphql.mutation('WatchTask', () =>
        HttpResponse.json({
          data: {
            watchTask: {
              __typename: 'Task',
              id: TASK_ID,
              watchers: [person(VIEWER)],
            },
          },
        }),
      ),
      graphql.mutation('UnwatchTask', () =>
        HttpResponse.json({
          data: {
            unwatchTask: { __typename: 'Task', id: TASK_ID, watchers: [] },
          },
        }),
      ),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });
    expect(
      await screen.findByText('No one is watching this task.'),
    ).toBeVisible();

    // Act
    await user.click(screen.getByRole('button', { name: 'Watch' }));

    // Assert
    const toggle = await screen.findByRole('button', { name: 'Stop watching' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(VIEWER.name, { selector: 'li' })).toBeVisible();

    // Act
    await user.click(toggle);

    // Assert
    expect(await screen.findByRole('button', { name: 'Watch' })).toBeVisible();
    expect(screen.getByText('No one is watching this task.')).toBeVisible();
  });

  it('adds and removes a label by name', async () => {
    // Arrange
    const sent: unknown[] = [];
    server.use(
      ...detailScenario({ project: 'ADMIN' }),
      graphql.mutation('AddTaskLabel', ({ variables }) => {
        sent.push(variables);
        return HttpResponse.json({
          data: {
            addTaskLabel: {
              __typename: 'Task',
              id: TASK_ID,
              labels: [
                { __typename: 'Label', id: 'label-auth', name: 'auth' },
                { __typename: 'Label', id: 'label-ui', name: 'ui' },
              ],
            },
          },
        });
      }),
      graphql.mutation('RemoveTaskLabel', ({ variables }) => {
        sent.push(variables);
        return HttpResponse.json({
          data: {
            removeTaskLabel: {
              __typename: 'Task',
              id: TASK_ID,
              labels: [{ __typename: 'Label', id: 'label-ui', name: 'ui' }],
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.type(await screen.findByLabelText('Add a label'), ' ui ');
    await user.click(screen.getByRole('button', { name: 'Add label' }));
    await user.click(
      await screen.findByRole('button', { name: 'Remove label auth' }),
    );

    // Assert
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Remove label auth' }),
      ).toBeNull(),
    );
    expect(
      screen.getByRole('button', { name: 'Remove label ui' }),
    ).toBeVisible();
    expect(sent).toEqual([
      { taskId: TASK_ID, name: 'ui' },
      { taskId: TASK_ID, name: 'auth' },
    ]);
  });

  it('writes each kind of activity as a sentence, naming ids where it can', async () => {
    // Arrange
    server.use(
      ...detailScenario({ project: 'MEMBER' }, {}, [
        activity('a1', 'TASK_CREATED', { title: 'Build login' }),
        activity('a2', 'STATUS_CHANGED', { from: 'BACKLOG', to: 'TODO' }),
        activity('a3', 'ASSIGNED', { from: null, to: TERRY.id }),
        activity('a4', 'STORY_POINTS_UPDATED', { from: null, to: 5 }),
        activity('a5', 'SPRINT_MOVED', { from: null, to: SPRINT_ID }),
        activity('a6', 'AI_RECOMMENDATION', { recommendationId: 'r1' }),
        activity('a7', 'USER_APPROVAL', { decision: 'approved' }),
        activity('a8', 'COMMENT_ADDED', { commentId: 'c1' }, null),
        activity('a9', 'ASSIGNED', { from: TERRY.id, to: 'someone-gone' }),
      ]),
    );

    // Act
    renderRoutes(routes, { route: TASK_ROUTE });

    // Assert
    expect(
      await screen.findByText('Pat Project created this task.'),
    ).toBeVisible();
    expect(
      screen.getByText('Pat Project moved it from Backlog to To do.'),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Pat Project changed the assignee from no one to Terry Teammate.',
      ),
    ).toBeVisible();
    expect(
      screen.getByText('Pat Project changed the estimate from none to 5.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByText('Pat Project moved it from no sprint to Sprint 1.'),
      ).toBeVisible(),
    );
    expect(
      screen.getByText('Pat Project requested an AI recommendation.'),
    ).toBeVisible();
    expect(
      screen.getByText('Pat Project decided on an AI recommendation.'),
    ).toBeVisible();
    expect(screen.getByText('Someone commented.')).toBeVisible();
    // An id that cannot be named is described, never printed.
    expect(
      screen.getByText(
        'Pat Project changed the assignee from Terry Teammate to Someone.',
      ),
    ).toBeVisible();
    expect(screen.queryByText(/someone-gone/)).toBeNull();
  });

  it('asks before deleting, then leaves for the task list', async () => {
    // Arrange
    let deleted = false;
    server.use(
      ...detailScenario({ project: 'ADMIN' }),
      ...listScenario({ project: 'ADMIN' }, []),
      graphql.mutation('DeleteTask', () => {
        deleted = true;
        return HttpResponse.json({ data: { deleteTask: true } });
      }),
    );
    const { user, router } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Delete task' }),
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Delete “Build login”?',
    });

    // Assert — nothing is sent before the confirmation.
    expect(deleted).toBe(false);

    // Act
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete task' }),
    );

    // Assert
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(LIST_ROUTE),
    );
    expect(deleted).toBe(true);
  });

  it('shows the Forbidden screen for a task the viewer may not read', async () => {
    // Arrange
    server.use(
      mockQueryError('Task', 'FORBIDDEN', SERVER_DETAIL),
      ...detailScenario({ project: 'MEMBER' }),
    );

    // Act
    renderRoutes(routes, { route: TASK_ROUTE });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'You don’t have access' }),
    ).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('treats a malformed task id as not found, without asking the server', async () => {
    // Arrange — no Task handler: a request would fail the test.
    server.use(...detailScenario({ project: 'MEMBER' }).slice(0, 3));

    // Act
    renderRoutes(routes, { route: `${LIST_ROUTE}/not-an-id` });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
  });

  it('resolves a network failure into an error with a retry', async () => {
    // Arrange
    let attempts = 0;
    server.use(
      graphql.query('Task', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json({ data: detailData() });
      }),
      ...detailScenario({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    expect(await screen.findByText('Could not load this task.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Build login' }),
    ).toBeVisible();
  });

  it('has no accessibility violations', async () => {
    // Arrange
    server.use(...detailScenario({ project: 'ADMIN' }));

    // Act
    const { container } = renderRoutes(routes, { route: TASK_ROUTE });
    await screen.findByRole('heading', { name: 'Build login' });
    await waitFor(allSelectsNamed);

    // Assert
    expect(await auditA11y(container)).toHaveNoViolations();
  });
});

describe('task operations', () => {
  it('never page past the API’s limit of 100', async () => {
    // Arrange
    const sizes: unknown[] = [];
    server.use(
      graphql.query('ProjectBoard', ({ variables }) => {
        sizes.push(variables['first']);
        return HttpResponse.json({ data: boardData() });
      }),
      graphql.query('ProjectPlanning', ({ variables }) => {
        sizes.push(variables['first']);
        return HttpResponse.json({ data: null, errors: [] });
      }),
      ...boardScenario({ project: 'ADMIN' }),
    );

    // Act
    renderRoutes(routes, { route: BOARD_ROUTE });
    await screen.findByRole('link', { name: 'Build login' });

    // Assert
    await waitFor(() => expect(sizes.length).toBeGreaterThanOrEqual(2));
    expect(sizes.every((size) => typeof size === 'number' && size <= 100)).toBe(
      true,
    );
  });
});
