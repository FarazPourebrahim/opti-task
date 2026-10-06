import { HttpResponse } from 'msw';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SPRINT_STATES } from '@contracts';
import type { ErrorCode, SprintState } from '@contracts';
import { routes } from '@/App';
import { PROJECT_ID } from '@/modules/project/project.fixtures';
import { sprintSchema } from '@/modules/sprint/schemas/sprint.schema';
import {
  LOOSE_TASK_ID,
  OTHER_SPRINT_ID,
  SPRINT_ID,
  SPRINT_TASKS,
  TASK_ID,
  sprintDetail,
  sprintDetailScenario,
  sprintListScenario,
  sprintSummary,
  sprintsData,
} from '@/modules/sprint/sprint.fixtures';
import {
  canTransitionSprint,
  nextSprintStates,
  toBurndownRows,
  toPercent,
} from '@/modules/sprint/utils/sprint.utils';
import {
  projectSprintsPath,
  sprintPath,
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

// The server's own wording, which must never reach the screen.
const SERVER_DETAIL = 'internal reason';

const LIST_ROUTE = projectSprintsPath(PROJECT_ID);
const SPRINT_ROUTE = sprintPath(PROJECT_ID, SPRINT_ID);

function mutationFails(name: string, code: ErrorCode) {
  return mockMutationError(name, code, SERVER_DETAIL);
}

const VALID_INPUT = {
  name: 'Sprint 2',
  goal: '',
  startDate: '2026-03-01T00:00:00.000Z',
  endDate: '2026-03-14T00:00:00.000Z',
  capacity: 20,
};

/*
 * The sprint page brings the charting library with it, and the first import
 * of that under a parallel run can outlast a query's timeout. Loading it once
 * up front keeps that cost out of whichever test happens to open the page
 * first.
 */
beforeAll(async () => {
  await import('@/modules/sprint/SprintDetail.page');
  await import('@/modules/sprint/components/SprintBurndown');
}, 60_000);

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
  server.use(...signedIn());
});

describe('sprint lifecycle', () => {
  // Mirrors SPRINT_STATE_TRANSITIONS in the backend's sprint.model.ts.
  const LEGAL: Record<SprintState, SprintState[]> = {
    PLANNED: ['ACTIVE', 'CANCELLED'],
    ACTIVE: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  it('allows exactly the moves the server allows, across all 16 pairs', () => {
    for (const from of SPRINT_STATES) {
      // Act
      const offered = nextSprintStates(from);

      // Assert
      expect([...offered]).toEqual(LEGAL[from]);
      for (const to of SPRINT_STATES) {
        expect(canTransitionSprint(from, to)).toBe(LEGAL[from].includes(to));
      }
    }
  });
});

describe('sprint validation and figures', () => {
  it('accepts a named sprint and turns a blank goal into null', () => {
    // Act
    const parsed = sprintSchema.safeParse(VALID_INPUT);

    // Assert
    expect(parsed.success && parsed.data.goal).toBeNull();
  });

  it('refuses an end date before the start date, pointing at the end date', () => {
    // Act
    const parsed = sprintSchema.safeParse({
      ...VALID_INPUT,
      startDate: '2026-03-14T00:00:00.000Z',
      endDate: '2026-03-01T00:00:00.000Z',
    });

    // Assert
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(['endDate']);
    expect(parsed.error?.issues[0]?.message).toBe(
      'sprint.validation.endBeforeStart',
    );
  });

  it('accepts a one-day sprint and a sprint with no dates', () => {
    // Act
    const oneDay = sprintSchema.safeParse({
      ...VALID_INPUT,
      endDate: VALID_INPUT.startDate,
    });
    const undated = sprintSchema.safeParse({
      ...VALID_INPUT,
      startDate: null,
      endDate: null,
    });

    // Assert
    expect(oneDay.success).toBe(true);
    expect(undated.success).toBe(true);
  });

  it.each([
    ['a blank name', { name: '   ' }, false],
    ['a 120-character name', { name: 'a'.repeat(120) }, true],
    ['a 121-character name', { name: 'a'.repeat(121) }, false],
    ['a bare date', { startDate: '2026-03-01' }, false],
    ['no capacity', { capacity: null }, true],
    ['a capacity of 0', { capacity: 0 }, true],
    ['a capacity of 100,000', { capacity: 100_000 }, true],
    ['a capacity of 100,001', { capacity: 100_001 }, false],
    ['a negative capacity', { capacity: -1 }, false],
    ['a fractional capacity', { capacity: 2.5 }, false],
    ['a capacity that is not a number', { capacity: Number.NaN }, false],
  ])('judges %s', (_label, change, valid) => {
    // Act
    const parsed = sprintSchema.safeParse({ ...VALID_INPUT, ...change });

    // Assert
    expect(parsed.success).toBe(valid);
  });

  it('shapes the burndown for the chart: a named day and rounded points', () => {
    // Act
    const rows = toBurndownRows(
      [
        {
          date: '2026-03-02T00:00:00.000Z',
          idealRemaining: 12.04,
          actualRemaining: 8,
        },
      ],
      'en',
    );

    // Assert
    expect(rows).toEqual([{ day: 'Mar 2, 2026', ideal: 12, actual: 8 }]);
    expect(toPercent(0.5)).toBe(50);
    expect(toPercent(1 / 3)).toBe(33);
  });
});

describe('sprint list', () => {
  it('lists the sprints as links, each with its state, dates and task count', async () => {
    // Arrange
    server.use(
      ...sprintListScenario({ project: 'MEMBER' }, [
        sprintSummary(),
        sprintSummary({
          id: OTHER_SPRINT_ID,
          name: 'Sprint 2',
          state: 'PLANNED',
          startDate: null,
          endDate: null,
          taskCount: 1,
        }),
      ]),
    );

    // Act
    renderRoutes(routes, { route: LIST_ROUTE });

    // Assert
    const first = await screen.findByRole('link', { name: /Sprint 1/ });
    expect(first).toHaveAttribute('href', SPRINT_ROUTE);
    expect(within(first).getByText('Active')).toBeVisible();
    expect(within(first).getByText('Mar 1, 2026 – Mar 14, 2026')).toBeVisible();
    expect(within(first).getByText('2 tasks')).toBeVisible();
    const second = screen.getByRole('link', { name: /Sprint 2/ });
    expect(within(second).getByText('Planned')).toBeVisible();
    expect(within(second).getByText('No dates set')).toBeVisible();
    expect(within(second).getByText('1 task')).toBeVisible();
  });

  it('shows an empty list with a way to create a sprint, for someone who can', async () => {
    // Arrange
    server.use(...sprintListScenario({ project: 'ADMIN' }, []));

    // Act
    renderRoutes(routes, { route: LIST_ROUTE });

    // Assert
    expect(
      await screen.findByText('This project has no sprints yet.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'New sprint' })).toBeVisible();
  });

  it('does not offer sprint creation to a plain member', async () => {
    // Arrange
    server.use(...sprintListScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: LIST_ROUTE });

    // Assert
    await screen.findByRole('link', { name: /Sprint 1/ });
    expect(screen.queryByRole('button', { name: 'New sprint' })).toBeNull();
  });

  it('loads the next page, sending the cursor back untouched', async () => {
    // Arrange
    let sent: Record<string, unknown> = {};
    server.use(
      graphql.query('ProjectSprints', ({ variables }) => {
        if (variables['after']) {
          sent = variables;
          return HttpResponse.json({
            data: sprintsData(
              [sprintSummary({ id: OTHER_SPRINT_ID, name: 'Sprint 2' })],
              { total: 2 },
            ),
          });
        }
        return HttpResponse.json({
          data: sprintsData([sprintSummary()], {
            hasNextPage: true,
            endCursor: 'opaque-cursor',
            total: 2,
          }),
        });
      }),
      ...sprintListScenario({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: LIST_ROUTE });

    // Act
    await user.click(await screen.findByRole('button', { name: 'Load more' }));

    // Assert — appended below the sprint already shown.
    expect(await screen.findByRole('link', { name: /Sprint 2/ })).toBeVisible();
    expect(screen.getByRole('link', { name: /Sprint 1/ })).toBeVisible();
    expect(sent['after']).toBe('opaque-cursor');
    expect(sent['first']).toBeLessThanOrEqual(100);
    expect(screen.getByText('Showing 2 of 2')).toBeVisible();
  });

  it('creates a sprint, sending full instants for its dates, and opens it', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...sprintListScenario({ project: 'ADMIN' }),
      ...sprintDetailScenario({ project: 'ADMIN' }, { name: 'Sprint 2' }),
      graphql.mutation('CreateSprint', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: { createSprint: sprintSummary({ name: 'Sprint 2' }) },
        });
      }),
    );
    const { user, router } = renderRoutes(routes, { route: LIST_ROUTE });

    // Act
    await user.click(await screen.findByRole('button', { name: 'New sprint' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), '  Sprint 2 ');
    await user.type(within(dialog).getByLabelText('Start date'), '2026/03/01');
    await user.type(within(dialog).getByLabelText('End date'), '2026/03/14');
    await user.type(within(dialog).getByLabelText('Capacity'), '20');
    await user.click(
      within(dialog).getByRole('button', { name: 'Create sprint' }),
    );

    // Assert — trimmed, a blank goal as null, never a bare date.
    await waitFor(() =>
      expect(sent).toEqual({
        projectId: PROJECT_ID,
        input: {
          name: 'Sprint 2',
          goal: null,
          startDate: '2026-03-01T00:00:00.000Z',
          endDate: '2026-03-14T00:00:00.000Z',
          capacity: 20,
        },
      }),
    );
    expect(await screen.findByText('Sprint 2 has been created.')).toBeVisible();
    expect(
      await screen.findByRole('heading', { name: 'Sprint 2', level: 2 }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(SPRINT_ROUTE);
  });

  it('points at the end date when it precedes the start, and sends nothing', async () => {
    // Arrange — no mutation handler: a request would fail the test.
    server.use(...sprintListScenario({ project: 'ADMIN' }));
    const { user } = renderRoutes(routes, { route: LIST_ROUTE });

    // Act
    await user.click(await screen.findByRole('button', { name: 'New sprint' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Start date'), '2026/03/14');
    await user.type(within(dialog).getByLabelText('End date'), '2026/03/01');
    await user.click(
      within(dialog).getByRole('button', { name: 'Create sprint' }),
    );

    // Assert
    expect(await within(dialog).findByText('Enter a name.')).toBeVisible();
    expect(
      within(dialog).getByText('The end date cannot be before the start date.'),
    ).toBeVisible();
    expect(within(dialog).getByLabelText('End date')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it.each([
    ['BAD_USER_INPUT', 'Some of the details below need fixing.'],
    ['FORBIDDEN', 'You don’t have permission to do that.'],
  ] as const)(
    'explains a %s on create in the form, in our words',
    async (code, message) => {
      // Arrange
      server.use(
        ...sprintListScenario({ project: 'ADMIN' }),
        mutationFails('CreateSprint', code),
      );
      const { user } = renderRoutes(routes, { route: LIST_ROUTE });

      // Act
      await user.click(
        await screen.findByRole('button', { name: 'New sprint' }),
      );
      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText('Name'), 'Sprint 2');
      await user.click(
        within(dialog).getByRole('button', { name: 'Create sprint' }),
      );

      // Assert
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        message,
      );
      expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
    },
  );

  it('resolves a network failure into an error with a retry', async () => {
    // Arrange
    let attempts = 0;
    server.use(
      graphql.query('ProjectSprints', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json({ data: sprintsData() });
      }),
      ...sprintListScenario({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: LIST_ROUTE });

    // Act
    expect(
      await screen.findByText('Could not load the sprints.'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(await screen.findByRole('link', { name: /Sprint 1/ })).toBeVisible();
  });

  it('has no accessibility violations', async () => {
    // Arrange
    server.use(...sprintListScenario({ project: 'ADMIN' }));

    // Act
    const { container } = renderRoutes(routes, { route: LIST_ROUTE });
    await screen.findByRole('link', { name: /Sprint 1/ });

    // Assert
    expect(await auditA11y(container)).toHaveNoViolations();
  });
});

describe('sprint detail', () => {
  it('shows the plan and the figures the server computed', async () => {
    // Arrange
    server.use(...sprintDetailScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: SPRINT_ROUTE });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Sprint 1', level: 2 }),
    ).toBeVisible();
    expect(screen.getByText('Ship sign-in.')).toBeVisible();

    const figure = (label: string) =>
      screen.getByText(label).nextElementSibling;
    expect(figure('Start date')).toHaveTextContent('Mar 1, 2026');
    expect(figure('End date')).toHaveTextContent('Mar 14, 2026');
    expect(figure('Committed points')).toHaveTextContent('13');
    expect(figure('Completed points')).toHaveTextContent('5');
    expect(figure('Remaining points')).toHaveTextContent('8');
    expect(figure('Tasks done')).toHaveTextContent('1 of 2');
    expect(figure('Velocity')).toHaveTextContent('5');
    expect(screen.getByText('50%')).toBeVisible();
    expect(screen.getByText('13 of 20 points')).toBeVisible();
    expect(screen.queryByText('This sprint is over capacity')).toBeNull();
  });

  it('names the sprint in the breadcrumb', async () => {
    // Arrange
    server.use(...sprintDetailScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: SPRINT_ROUTE });

    // Assert
    const trail = await screen.findByRole('navigation', {
      name: 'Breadcrumb',
    });
    await waitFor(() =>
      expect(within(trail).getByText('Sprint 1')).toBeVisible(),
    );
    expect(within(trail).getByRole('link', { name: 'Sprints' })).toBeVisible();
  });

  it('says a sprint is over capacity in words, with by how much', async () => {
    // Arrange
    server.use(
      ...sprintDetailScenario(
        { project: 'MEMBER' },
        { capacity: 10, overCapacity: true },
      ),
    );

    // Act
    renderRoutes(routes, { route: SPRINT_ROUTE });

    // Assert
    expect(
      await screen.findByText('This sprint is over capacity'),
    ).toBeVisible();
    expect(
      screen.getByText(
        '13 points are committed against a capacity of 10 — 3 too many.',
      ),
    ).toBeVisible();
  });

  it('shows no capacity bar and no warning for a sprint without a capacity', async () => {
    // Arrange
    server.use(
      ...sprintDetailScenario({ project: 'MEMBER' }, { capacity: null }),
    );

    // Act
    renderRoutes(routes, { route: SPRINT_ROUTE });

    // Assert
    await screen.findByRole('heading', { name: 'Sprint 1', level: 2 });
    expect(screen.getByText('Capacity').nextElementSibling).toHaveTextContent(
      'Not set',
    );
    expect(screen.queryByText('Capacity used')).toBeNull();
  });

  it('gives the burndown as a table of the same figures the chart draws', async () => {
    // Arrange
    server.use(...sprintDetailScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: SPRINT_ROUTE });

    // Assert
    const table = await screen.findByRole('table', {
      name: 'Remaining story points per day, ideal against actual',
    });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(expect.arrayContaining(['Ideal', 'Actual']));
    const day = within(table).getByRole('rowheader', { name: 'Mar 2, 2026' });
    const cells = within(day.closest('tr') ?? table).getAllByRole('cell');
    expect(cells.map((cell) => cell.textContent)).toEqual(['12', '8']);
  });

  it('explains that a burndown needs dates, instead of an empty chart', async () => {
    // Arrange
    server.use(
      ...sprintDetailScenario(
        { project: 'MEMBER' },
        { startDate: null, endDate: null },
      ),
    );

    // Act
    renderRoutes(routes, { route: SPRINT_ROUTE });

    // Assert
    expect(
      await screen.findByText(
        'A burndown needs a start date and an end date. Edit the sprint to set them.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('table', {
        name: 'Remaining story points per day, ideal against actual',
      }),
    ).toBeNull();
    expect(screen.getAllByText('Not set')).toHaveLength(2);
  });

  it('shows who carries what, counting unassigned work as its own row', async () => {
    // Arrange
    const [first, second] = SPRINT_TASKS;
    if (!first || !second) throw new Error('fixture tasks missing');
    server.use(
      ...sprintDetailScenario(
        { project: 'MEMBER' },
        { tasks: [first, { ...second, assignee: null }] },
      ),
    );

    // Act
    renderRoutes(routes, { route: SPRINT_ROUTE });

    // Assert
    expect(
      await screen.findByRole('progressbar', {
        name: 'Terry Teammate: 5 points',
      }),
    ).toBeVisible();
    const unassigned = screen
      .getByRole('progressbar', { name: 'Unassigned: 8 points' })
      .closest('tr');
    expect(unassigned).toHaveTextContent('Unassigned18');
  });

  it('has its own empty states for a sprint with no tasks', async () => {
    // Arrange
    server.use(...sprintDetailScenario({ project: 'MEMBER' }, { tasks: [] }));

    // Act
    renderRoutes(routes, { route: SPRINT_ROUTE });

    // Assert
    expect(
      await screen.findByText('This sprint has no tasks yet.'),
    ).toBeVisible();
    expect(
      screen.getByText('No one carries any work in this sprint yet.'),
    ).toBeVisible();
    expect(screen.getByText('0%')).toBeVisible();
  });

  it.each([
    ['PLANNED', ['Start sprint', 'Cancel sprint']],
    ['ACTIVE', ['Complete sprint', 'Cancel sprint']],
  ] as const)('offers only the legal moves from %s', async (state, moves) => {
    // Arrange
    server.use(...sprintDetailScenario({ project: 'ADMIN' }, { state }));

    // Act
    renderRoutes(routes, { route: SPRINT_ROUTE });

    // Assert
    const group = await screen.findByRole('group', {
      name: 'Change sprint state',
    });
    expect(
      within(group)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(moves);
  });

  it.each(['COMPLETED', 'CANCELLED'] as const)(
    'offers no move at all from %s, and says why',
    async (state) => {
      // Arrange
      server.use(...sprintDetailScenario({ project: 'ADMIN' }, { state }));

      // Act
      renderRoutes(routes, { route: SPRINT_ROUTE });

      // Assert
      expect(
        await screen.findByText(
          'This sprint is closed and cannot be reopened.',
        ),
      ).toBeVisible();
      expect(
        screen.queryByRole('group', { name: 'Change sprint state' }),
      ).toBeNull();
    },
  );

  it('starts a planned sprint and shows the new state from the result', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...sprintDetailScenario({ project: 'ADMIN' }, { state: 'PLANNED' }),
      graphql.mutation('ChangeSprintState', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            changeSprintState: {
              __typename: 'Sprint',
              id: SPRINT_ID,
              state: 'ACTIVE',
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: SPRINT_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Start sprint' }),
    );

    // Assert
    expect(await screen.findByText('The sprint is now Active.')).toBeVisible();
    expect(sent).toEqual({ id: SPRINT_ID, state: 'ACTIVE' });
    expect(
      await screen.findByRole('button', { name: 'Complete sprint' }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Start sprint' })).toBeNull();
  });

  it.each([
    ['BAD_USER_INPUT', 'That change isn’t allowed from the sprint’s current'],
    ['FORBIDDEN', 'You don’t have permission to do that.'],
  ] as const)(
    'leaves the state alone when the server answers %s',
    async (code, message) => {
      // Arrange
      server.use(
        ...sprintDetailScenario({ project: 'ADMIN' }, { state: 'PLANNED' }),
        mutationFails('ChangeSprintState', code),
      );
      const { user } = renderRoutes(routes, { route: SPRINT_ROUTE });

      // Act
      await user.click(
        await screen.findByRole('button', { name: 'Start sprint' }),
      );

      // Assert
      expect(await screen.findByText(new RegExp(message))).toBeVisible();
      expect(
        screen.getByRole('button', { name: 'Start sprint' }),
      ).toBeVisible();
      expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
    },
  );

  it('hides every control from someone who may only read', async () => {
    // Arrange
    server.use(...sprintDetailScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: SPRINT_ROUTE });

    // Assert
    await screen.findByRole('link', { name: 'Build login' });
    for (const name of [
      'Edit sprint',
      'Delete sprint',
      'Complete sprint',
      'Add to sprint',
      'Remove “Build login” from the sprint',
    ]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });

  it('edits the sprint, clearing the capacity by sending null', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...sprintDetailScenario({ project: 'ADMIN' }),
      graphql.mutation('UpdateSprint', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: { updateSprint: sprintSummary({ capacity: null }) },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: SPRINT_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Edit sprint' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Sprint 1');
    await user.clear(within(dialog).getByLabelText('Capacity'));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    // Assert
    await waitFor(() =>
      expect(sent).toEqual({
        id: SPRINT_ID,
        input: {
          name: 'Sprint 1',
          goal: 'Ship sign-in.',
          startDate: '2026-03-01T00:00:00.000Z',
          endDate: '2026-03-14T00:00:00.000Z',
          capacity: null,
        },
      }),
    );
    expect(await screen.findByText('Sprint details saved.')).toBeVisible();
  });

  it('offers only tasks outside the sprint, adds one and re-reads the sprint', async () => {
    // Arrange
    let sent: unknown;
    let reads = 0;
    server.use(
      graphql.query('Sprint', () => {
        reads += 1;
        return HttpResponse.json({
          data: {
            sprint: sprintDetail(
              reads === 1
                ? {}
                : {
                    tasks: [
                      ...SPRINT_TASKS,
                      {
                        id: LOOSE_TASK_ID,
                        title: 'Write docs',
                        status: 'TODO',
                        storyPoints: 2,
                        assignee: null,
                      },
                    ],
                  },
            ),
          },
        });
      }),
      ...sprintDetailScenario({ project: 'ADMIN' }),
      graphql.mutation('AddTaskToSprint', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: { addTaskToSprint: { __typename: 'Sprint', id: SPRINT_ID } },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: SPRINT_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('combobox', { name: 'Add a task' }),
    );
    const options = (await screen.findAllByRole('option')).map(
      (option) => option.textContent,
    );
    await user.click(screen.getByRole('option', { name: 'Write docs' }));
    await user.click(screen.getByRole('button', { name: 'Add to sprint' }));

    // Assert — the two already in the sprint were never offered.
    expect(options).toEqual(['Choose a task', 'Write docs']);
    expect(
      await screen.findByText('“Write docs” has been added to the sprint.'),
    ).toBeVisible();
    expect(sent).toEqual({ sprintId: SPRINT_ID, taskId: LOOSE_TASK_ID });
    expect(
      await screen.findByRole('link', { name: 'Write docs' }),
    ).toBeVisible();
    // The figures came from the server again, not from arithmetic here.
    expect(
      screen.getByText('Committed points').nextElementSibling,
    ).toHaveTextContent('15');
  });

  it('takes a task out of the sprint', async () => {
    // Arrange
    let sent: unknown;
    let reads = 0;
    const [, second] = SPRINT_TASKS;
    if (!second) throw new Error('fixture tasks missing');
    server.use(
      graphql.query('Sprint', () => {
        reads += 1;
        return HttpResponse.json({
          data: {
            sprint: sprintDetail(reads === 1 ? {} : { tasks: [second] }),
          },
        });
      }),
      ...sprintDetailScenario({ project: 'ADMIN' }),
      graphql.mutation('RemoveTaskFromSprint', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            removeTaskFromSprint: { __typename: 'Sprint', id: SPRINT_ID },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: SPRINT_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', {
        name: 'Remove “Build login” from the sprint',
      }),
    );

    // Assert
    expect(
      await screen.findByText(
        '“Build login” has been removed from the sprint.',
      ),
    ).toBeVisible();
    expect(sent).toEqual({ sprintId: SPRINT_ID, taskId: TASK_ID });
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Build login' })).toBeNull(),
    );
  });

  it('keeps the task when removing it is refused', async () => {
    // Arrange
    server.use(
      ...sprintDetailScenario({ project: 'ADMIN' }),
      mutationFails('RemoveTaskFromSprint', 'FORBIDDEN'),
    );
    const { user } = renderRoutes(routes, { route: SPRINT_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', {
        name: 'Remove “Build login” from the sprint',
      }),
    );

    // Assert
    expect(
      await screen.findByText('You don’t have permission to do that.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Build login' })).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('asks before deleting, then leaves for the sprint list', async () => {
    // Arrange
    let deleted = false;
    server.use(
      ...sprintDetailScenario({ project: 'ADMIN' }),
      graphql.query('ProjectSprints', () =>
        HttpResponse.json({ data: sprintsData(deleted ? [] : undefined) }),
      ),
      graphql.mutation('DeleteSprint', () => {
        deleted = true;
        return HttpResponse.json({ data: { deleteSprint: true } });
      }),
    );
    const { user, router } = renderRoutes(routes, { route: SPRINT_ROUTE });

    // Act — nothing is sent until the dialog is confirmed.
    await user.click(
      await screen.findByRole('button', { name: 'Delete sprint' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Delete Sprint 1?')).toBeVisible();
    expect(deleted).toBe(false);
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete sprint' }),
    );

    // Assert
    expect(await screen.findByText('Sprint 1 has been deleted.')).toBeVisible();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(LIST_ROUTE),
    );
    expect(
      await screen.findByText('This project has no sprints yet.'),
    ).toBeVisible();
  });

  it.each([
    ['FORBIDDEN', 'You don’t have access'],
    ['NOT_FOUND', 'Page not found'],
  ] as const)('renders the right screen for %s', async (code, heading) => {
    // Arrange
    server.use(
      mockQueryError('Sprint', code, SERVER_DETAIL),
      ...sprintDetailScenario({ project: 'MEMBER' }),
    );

    // Act
    renderRoutes(routes, { route: SPRINT_ROUTE });

    // Assert
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('treats a malformed sprint id as not found, without asking the server', async () => {
    // Arrange — no Sprint handler: a request would fail the test.
    server.use(...sprintListScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: sprintPath(PROJECT_ID, 'not-an-id') });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
  });

  it('resolves a network failure into an error with a retry', async () => {
    // Arrange
    let attempts = 0;
    server.use(
      graphql.query('Sprint', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json({ data: { sprint: sprintDetail() } });
      }),
      ...sprintDetailScenario({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: SPRINT_ROUTE });

    // Act
    expect(
      await screen.findByText('Could not load this sprint.'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Sprint 1', level: 2 }),
    ).toBeVisible();
  });

  it('has no accessibility violations', async () => {
    // Arrange
    server.use(...sprintDetailScenario({ project: 'ADMIN' }));

    // Act
    const { container } = renderRoutes(routes, { route: SPRINT_ROUTE });
    await screen.findByRole('link', { name: 'Build login' });
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Add a task' }).textContent,
      ).not.toBe(''),
    );

    // Assert
    expect(await auditA11y(container)).toHaveNoViolations();
  });
});
