import { HttpResponse } from 'msw';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TASK_PRIORITIES, TASK_STATUSES } from '@contracts';
import { routes } from '@/App';
import {
  emptyProjectAnalytics,
  myAnalyticsScenario,
  noSavedStatistics,
  projectAnalytics,
  projectAnalyticsScenario,
  savedStatistics,
  userAnalytics,
} from '@/modules/analytics/analytics.fixtures';
import {
  formatElapsed,
  formatPoints,
  summarizeTrends,
  toPriorityDistribution,
  toStatusDistribution,
  toTrendRows,
} from '@/modules/analytics/utils/analytics.utils';
import {
  PROJECT_ID,
  projectScenario,
} from '@/modules/project/project.fixtures';
import {
  ROUTES,
  projectAnalyticsPath,
  projectPath,
  userPath,
} from '@/shared/routes/route.constants';
import { resetRefreshState } from '@/shared/services/auth.gateway';
import { announceRealtimeEvent } from '@/shared/services/realtime.events';
import { clearAccessToken } from '@/shared/services/session.store';
import { auditA11y } from '@/shared/tests/a11y';
import {
  graphql,
  mockMutationError,
  mockQueryError,
} from '@/shared/tests/graphql';
import {
  act,
  renderRoutes,
  screen,
  waitFor,
  within,
} from '@/shared/tests/renderWithProviders';
import { server } from '@/shared/tests/server';
import { TEST_USER, signedIn } from '@/shared/tests/session';

// The server's own wording, which must never reach the screen.
const SERVER_DETAIL = 'internal reason';

const ANALYTICS_ROUTE = projectAnalyticsPath(PROJECT_ID);
const OTHER_PROJECT_ID = '4a4a4a4a-4a4a-44a4-84a4-4a4a4a4a4a4a';
const OTHER_USER_ID = '33333333-3333-4333-8333-333333333333';

function myProfileIs() {
  return graphql.query('MyProfile', () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: 'User',
          id: TEST_USER.id,
          email: TEST_USER.email,
          name: TEST_USER.name,
          avatarUrl: null,
          seniority: null,
          skills: ['TypeScript'],
          expertise: [],
        },
      },
    }),
  );
}

function otherProfileIs(id: string = OTHER_USER_ID) {
  return graphql.query('UserProfile', () =>
    HttpResponse.json({
      data: {
        user: {
          __typename: 'User',
          id,
          name: 'Fox Mulder',
          avatarUrl: null,
          seniority: 'LEAD',
          skills: ['Profiling'],
          expertise: [],
          teamMemberships: [],
        },
      },
    }),
  );
}

/** The value beside a label in a list of figures. */
function figure(label: string) {
  const term = screen
    .getAllByRole('term')
    .find((candidate) => candidate.textContent === label);
  return term?.nextElementSibling ?? null;
}

/** A table row's cells, found by the text its first cell starts with. */
function cellsOf(row: HTMLElement) {
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
}

/*
 * The analytics page brings the charting library with it, and the first import
 * of that under a parallel run can outlast a query's timeout. Loading it once
 * up front keeps that cost out of whichever test opens the page first.
 */
beforeAll(async () => {
  await import('@/modules/analytics/ProjectAnalytics.page');
}, 60_000);

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
  server.use(...signedIn());
});

describe('analytics figures', () => {
  it.each([
    [0, '0m'],
    [59, '0m'],
    [1_500, '25m'],
    [5_400, '1h 30m'],
    [7_200, '2h'],
    [172_800, '2d'],
    [183_600, '2d 3h'],
    // Minutes are dropped once the length is counted in days.
    [90_000 + 1_800, '1d 1h'],
  ])('writes %i seconds as %s', (seconds, expected) => {
    // Act
    const text = formatElapsed(seconds, 'en');

    // Assert
    expect(text).toBe(expected);
  });

  it('never writes a negative length of time', () => {
    // Act
    const text = formatElapsed(-30, 'en');

    // Assert
    expect(text).toBe('0m');
  });

  it('writes a velocity to one decimal at most', () => {
    // Act
    const figures = [12.34, 5, 0, 9.96].map((value) =>
      formatPoints(value, 'en'),
    );

    // Assert
    expect(figures).toEqual(['12.3', '5', '0', '10']);
  });

  it('lists every status in workflow order, with zero for one that holds no task', () => {
    // Act
    const rows = toStatusDistribution([
      { status: 'DONE', count: 4 },
      { status: 'TODO', count: 3 },
    ]);

    // Assert
    expect(rows.map((row) => row.key)).toEqual([...TASK_STATUSES]);
    expect(rows.find((row) => row.key === 'DONE')?.count).toBe(4);
    expect(rows.find((row) => row.key === 'BLOCKED')?.count).toBe(0);
  });

  it('lists every priority, with zero for one that holds no task', () => {
    // Act
    const rows = toPriorityDistribution([{ priority: 'HIGH', count: 2 }]);

    // Assert
    expect(rows.map((row) => row.key)).toEqual([...TASK_PRIORITIES]);
    expect(rows.filter((row) => row.count > 0)).toEqual([
      { key: 'HIGH', count: 2 },
    ]);
  });

  it('shapes and totals the per-sprint series', () => {
    // Arrange
    const points = [
      { name: 'Sprint 1', committedStoryPoints: 20, completedStoryPoints: 16 },
      { name: 'Sprint 2', committedStoryPoints: 20, completedStoryPoints: 9 },
    ];

    // Act
    const rows = toTrendRows(points);
    const summary = summarizeTrends(points);

    // Assert
    expect(rows[1]).toEqual({
      sprint: 'Sprint 2',
      committed: 20,
      completed: 9,
    });
    expect(summary).toEqual({ sprints: 2, committed: 40, completed: 25 });
    expect(summarizeTrends([])).toEqual({
      sprints: 0,
      committed: 0,
      completed: 0,
    });
  });
});

describe('project analytics', () => {
  it('shows the headline figures with their units', async () => {
    // Arrange
    server.use(...projectAnalyticsScenario({ project: 'ADMIN' }));

    // Act
    renderRoutes(routes, { route: ANALYTICS_ROUTE });

    // Assert
    await screen.findByRole('heading', { name: 'Project figures', level: 3 });
    expect(figure('Tasks')).toHaveTextContent('10');
    expect(figure('Tasks done')).toHaveTextContent('4');
    expect(figure('Story points')).toHaveTextContent('40');
    expect(figure('Story points done')).toHaveTextContent('16');
    expect(figure('Team velocity')).toHaveTextContent('12.5 points per sprint');
    expect(
      screen.getByRole('progressbar', { name: 'Completion' }),
    ).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText('40%')).toBeVisible();
  });

  it('counts the tasks in every status and priority, including the empty ones', async () => {
    // Arrange
    server.use(...projectAnalyticsScenario({ project: 'ADMIN' }));

    // Act
    renderRoutes(routes, { route: ANALYTICS_ROUTE });

    // Assert
    expect(
      cellsOf(await screen.findByRole('row', { name: /^In progress/ })),
    ).toEqual(expect.arrayContaining(['In progress', '3']));
    expect(cellsOf(screen.getByRole('row', { name: /^Done/ }))).toEqual(
      expect.arrayContaining(['Done', '4']),
    );
    expect(cellsOf(screen.getByRole('row', { name: /^Blocked/ }))).toEqual(
      expect.arrayContaining(['Blocked', '0']),
    );
    expect(cellsOf(screen.getByRole('row', { name: /^Critical/ }))).toEqual(
      expect.arrayContaining(['Critical', '4']),
    );
    expect(cellsOf(screen.getByRole('row', { name: /^Lowest/ }))).toEqual(
      expect.arrayContaining(['Lowest', '0']),
    );
    expect(
      screen.getByRole('progressbar', { name: 'Done: 4 of 10 tasks' }),
    ).toBeInTheDocument();
  });

  it('gives the trend as a table of the figures the chart draws, and in a sentence', async () => {
    // Arrange
    server.use(...projectAnalyticsScenario({ project: 'ADMIN' }));

    // Act
    renderRoutes(routes, { route: ANALYTICS_ROUTE });

    // Assert
    const table = await screen.findByRole('table', {
      name: 'Story points per sprint, committed against completed',
    });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(expect.arrayContaining(['Committed', 'Completed']));
    const sprint = within(table).getByRole('rowheader', { name: 'Sprint 2' });
    expect(cellsOf(sprint.closest('tr') ?? table)).toEqual(['20', '9']);
    expect(
      screen.getByText(
        'Across 2 sprints, 25 of 40 committed story points were completed.',
      ),
    ).toBeVisible();
  });

  it('shows what each assignee carries, linked to their profile', async () => {
    // Arrange
    server.use(...projectAnalyticsScenario({ project: 'ADMIN' }));

    // Act
    renderRoutes(routes, { route: ANALYTICS_ROUTE });

    // Assert
    const row = await screen.findByRole('row', { name: /^Terry Teammate/ });
    expect(cellsOf(row)).toEqual(
      // The name cell also holds the avatar's initials; the link names it.
      expect.arrayContaining(['4', '18', '3']),
    );
    expect(
      within(row).getByRole('link', { name: 'Terry Teammate' }),
    ).toHaveAttribute('href', userPath('terry'));
    expect(
      screen.getByRole('progressbar', {
        name: 'Pat Project: 6 open points',
      }),
    ).toHaveAttribute('aria-valuenow', '6');
  });

  it('renders a brand-new project as zeros and explained absences, never a broken figure', async () => {
    // Arrange
    server.use(
      ...projectAnalyticsScenario(
        { project: 'ADMIN' },
        emptyProjectAnalytics(),
      ),
    );

    // Act
    renderRoutes(routes, { route: ANALYTICS_ROUTE });

    // Assert
    await screen.findByRole('heading', { name: 'Project figures', level: 3 });
    expect(figure('Tasks')).toHaveTextContent('0');
    expect(figure('Team velocity')).toHaveTextContent('0 points per sprint');
    expect(screen.getByText('0%')).toBeVisible();
    expect(
      screen.getAllByText('This project has no tasks to count yet.'),
    ).toHaveLength(2);
    expect(
      screen.getByText('This project has no sprints to chart yet.'),
    ).toBeVisible();
    expect(
      screen.getByText('No task in this project is assigned to anyone yet.'),
    ).toBeVisible();
    expect(
      screen.queryByRole('table', {
        name: 'Story points per sprint, committed against completed',
      }),
    ).toBeNull();
    expect(screen.queryByText(/Across \d+ sprint/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('says "1 sprint" for a single sprint', async () => {
    // Arrange
    const [first] = projectAnalytics().storyPointTrends;
    server.use(
      ...projectAnalyticsScenario(
        { project: 'ADMIN' },
        projectAnalytics({ storyPointTrends: [first] }),
      ),
    );

    // Act
    renderRoutes(routes, { route: ANALYTICS_ROUTE });

    // Assert
    expect(
      await screen.findByText(
        'Across 1 sprint, 16 of 20 committed story points were completed.',
      ),
    ).toBeVisible();
  });

  it.each<[string, 'ADMIN' | 'MEMBER' | 'VIEWER', boolean]>([
    ['a project admin', 'ADMIN', true],
    ['a project member', 'MEMBER', false],
    ['a viewer', 'VIEWER', false],
  ])(
    'offers the tab to %s only if they may view analytics',
    async (_label, role, offered) => {
      // Arrange
      server.use(...projectScenario({ project: role }));

      // Act
      renderRoutes(routes, { route: projectPath(PROJECT_ID) });

      // Assert
      const tabs = await screen.findByRole('navigation', {
        name: 'Project sections',
      });
      await within(tabs).findByRole('link', { name: 'Teams' });
      expect(
        within(tabs).queryByRole('link', { name: 'Analytics' }) !== null,
      ).toBe(offered);
    },
  );

  it('shows the Forbidden screen to someone who opens the address without the right', async () => {
    // Arrange
    server.use(
      mockQueryError('ProjectAnalytics', 'FORBIDDEN', SERVER_DETAIL),
      ...projectScenario({ project: 'MEMBER' }),
    );

    // Act
    renderRoutes(routes, { route: ANALYTICS_ROUTE });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'You don’t have access' }),
    ).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('resolves a network failure into an error with a retry', async () => {
    // Arrange
    let attempts = 0;
    server.use(
      graphql.query('ProjectAnalytics', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json({
              data: { projectAnalytics: projectAnalytics() },
            });
      }),
      ...projectScenario({ project: 'ADMIN' }),
    );
    const { user } = renderRoutes(routes, { route: ANALYTICS_ROUTE });

    // Act
    expect(
      await screen.findByText('The analytics could not be loaded'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Project figures', level: 3 }),
    ).toBeVisible();
  });

  it('keeps the server’s own wording off the screen when the load fails', async () => {
    // Arrange
    server.use(
      mockQueryError(
        'ProjectAnalytics',
        'INTERNAL_SERVER_ERROR',
        SERVER_DETAIL,
      ),
      ...projectScenario({ project: 'ADMIN' }),
    );

    // Act
    renderRoutes(routes, { route: ANALYTICS_ROUTE });

    // Assert
    expect(
      await screen.findByText('Something went wrong on our end.'),
    ).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('reads the figures again when a task in this project changes, and not for another project', async () => {
    // Arrange
    let reads = 0;
    const current = { totalTasks: 10 };
    server.use(
      graphql.query('ProjectAnalytics', () => {
        reads += 1;
        return HttpResponse.json({
          data: { projectAnalytics: projectAnalytics(current) },
        });
      }),
      ...projectScenario({ project: 'ADMIN' }),
    );
    renderRoutes(routes, { route: ANALYTICS_ROUTE });
    await screen.findByRole('heading', { name: 'Project figures', level: 3 });
    expect(reads).toBe(1);

    // Act
    current.totalTasks = 11;
    act(() => {
      announceRealtimeEvent('taskUpdated', {
        taskId: 'task-elsewhere',
        projectId: OTHER_PROJECT_ID,
      });
      announceRealtimeEvent('taskUpdated', {
        taskId: 'task-here',
        projectId: PROJECT_ID,
      });
    });

    // Assert
    await waitFor(() => expect(figure('Tasks')).toHaveTextContent('11'));
    expect(reads).toBe(2);
  });

  it('has no accessibility violations', async () => {
    // Arrange
    server.use(...projectAnalyticsScenario({ project: 'ADMIN' }));

    // Act
    const { container } = renderRoutes(routes, { route: ANALYTICS_ROUTE });
    await screen.findByRole('row', { name: /^Terry Teammate/ });

    // Assert
    expect(await auditA11y(container)).toHaveNoViolations();
  });
});

describe('my analytics', () => {
  it('shows the live figures beside the saved copy, and says why they can differ', async () => {
    // Arrange
    server.use(myProfileIs(), ...myAnalyticsScenario());

    // Act
    renderRoutes(routes, { route: ROUTES.accountProfile });

    // Assert
    expect(
      cellsOf(await screen.findByRole('row', { name: /^Tasks completed/ })),
    ).toEqual(['Tasks completed', '12', '10']);
    expect(
      cellsOf(screen.getByRole('row', { name: /^Story points delivered/ })),
    ).toEqual(['Story points delivered', '48', '40']);
    expect(
      cellsOf(screen.getByRole('row', { name: /^Average time to complete/ })),
    ).toEqual(['Average time to complete a task', '2d 3h', '2d']);
    expect(cellsOf(screen.getByRole('row', { name: /^Velocity/ }))).toEqual([
      'Velocity',
      '9.6 points per sprint',
      '8 points per sprint',
    ]);
    expect(
      cellsOf(screen.getByRole('row', { name: /^Open assignments/ })),
    ).toEqual(['Open assignments', '3', 'Not kept']);
    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual(['Figure', 'Live', 'Saved']);
    expect(
      screen.getByText(
        /change only when you save them — so the two can differ/,
      ),
    ).toBeVisible();
  });

  it('explains a figure that cannot be worked out, instead of leaving a blank', async () => {
    // Arrange
    server.use(
      myProfileIs(),
      ...myAnalyticsScenario(
        userAnalytics(TEST_USER.id, {
          completedTasks: 0,
          historicalStoryPoints: 0,
          avgCompletionSeconds: null,
          velocity: null,
          activeAssignments: 0,
        }),
        noSavedStatistics(),
      ),
    );

    // Act
    renderRoutes(routes, { route: ROUTES.accountProfile });

    // Assert
    expect(
      cellsOf(
        await screen.findByRole('row', { name: /^Average time to complete/ }),
      ),
    ).toEqual([
      'Average time to complete a task',
      'No completed task to measure yet',
      'Nothing saved',
    ]);
    expect(cellsOf(screen.getByRole('row', { name: /^Velocity/ }))).toEqual([
      'Velocity',
      'No completed task in a sprint yet',
      'Nothing saved',
    ]);
    for (const cell of screen.getAllByRole('cell')) {
      expect(cell.textContent).not.toBe('');
    }
  });

  it('saves the live figures for the signed-in user, and the saved column follows', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      myProfileIs(),
      ...myAnalyticsScenario(),
      graphql.mutation('RecomputeUserStatistics', ({ variables }) => {
        sent = variables['userId'];
        return HttpResponse.json({
          data: {
            recomputeUserStatistics: {
              __typename: 'User',
              id: TEST_USER.id,
              statistics: savedStatistics({
                completedTasks: 12,
                historicalStoryPoints: 48,
                avgCompletionSeconds: 183_600,
                velocity: 9.6,
              }),
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: ROUTES.accountProfile });
    await screen.findByRole('row', { name: /^Tasks completed/ });

    // Act
    await user.click(
      screen.getByRole('button', { name: 'Save the live figures' }),
    );

    // Assert
    expect(await screen.findByText('Your figures were saved')).toBeVisible();
    expect(sent).toBe(TEST_USER.id);
    expect(
      cellsOf(screen.getByRole('row', { name: /^Tasks completed/ })),
    ).toEqual(['Tasks completed', '12', '12']);
    expect(cellsOf(screen.getByRole('row', { name: /^Velocity/ }))).toEqual([
      'Velocity',
      '9.6 points per sprint',
      '9.6 points per sprint',
    ]);
  });

  it.each([
    ['FORBIDDEN', 'You don’t have permission to do that.'],
    ['BAD_USER_INPUT', 'Some of the details below need fixing.'],
  ] as const)(
    'reports a refused save (%s) and leaves the saved copy as it was',
    async (code, message) => {
      // Arrange
      server.use(
        myProfileIs(),
        ...myAnalyticsScenario(),
        mockMutationError('RecomputeUserStatistics', code, SERVER_DETAIL),
      );
      const { user } = renderRoutes(routes, { route: ROUTES.accountProfile });
      await screen.findByRole('row', { name: /^Tasks completed/ });

      // Act
      await user.click(
        screen.getByRole('button', { name: 'Save the live figures' }),
      );

      // Assert
      expect(await screen.findByText(message)).toBeVisible();
      expect(
        cellsOf(screen.getByRole('row', { name: /^Tasks completed/ })),
      ).toEqual(['Tasks completed', '12', '10']);
      expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
    },
  );

  it('keeps the profile usable when the figures cannot be loaded, with a retry', async () => {
    // Arrange
    let attempts = 0;
    const [, saved] = myAnalyticsScenario();
    server.use(
      myProfileIs(),
      graphql.query('UserAnalytics', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json({ data: { userAnalytics: userAnalytics() } });
      }),
      ...(saved ? [saved] : []),
    );
    const { user } = renderRoutes(routes, { route: ROUTES.accountProfile });

    // Act
    expect(
      await screen.findByText('The analytics could not be loaded'),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Skills' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(
      await screen.findByRole('row', { name: /^Tasks completed/ }),
    ).toBeVisible();
  });

  it('has no accessibility violations', async () => {
    // Arrange
    server.use(myProfileIs(), ...myAnalyticsScenario());

    // Act
    const { container } = renderRoutes(routes, {
      route: ROUTES.accountProfile,
    });
    await screen.findByRole('row', { name: /^Tasks completed/ });

    // Assert
    expect(await auditA11y(container)).toHaveNoViolations();
  });
});

describe('another person’s analytics', () => {
  it('asks for nothing until the viewer wants the figures, then shows them', async () => {
    // Arrange
    const asked: unknown[] = [];
    server.use(
      otherProfileIs(),
      graphql.query('UserAnalytics', ({ variables }) => {
        asked.push(variables['userId']);
        return HttpResponse.json({
          data: { userAnalytics: userAnalytics(OTHER_USER_ID) },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: userPath(OTHER_USER_ID) });
    const show = await screen.findByRole('button', { name: 'Show analytics' });
    expect(asked).toEqual([]);

    // Act
    await user.click(show);

    // Assert
    expect(
      cellsOf(await screen.findByRole('row', { name: /^Tasks completed/ })),
    ).toEqual(['Tasks completed', '12']);
    expect(asked).toEqual([OTHER_USER_ID]);
    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual(['Figure', 'Value']);
    // Saving is the person's own to do.
    expect(
      screen.queryByRole('button', { name: 'Save the live figures' }),
    ).toBeNull();
  });

  it('explains a refusal in place, naming who may see the figures', async () => {
    // Arrange
    server.use(
      otherProfileIs(),
      mockQueryError('UserAnalytics', 'FORBIDDEN', SERVER_DETAIL),
    );
    const { user } = renderRoutes(routes, { route: userPath(OTHER_USER_ID) });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Show analytics' }),
    );

    // Assert
    expect(
      await screen.findByText('These figures are not yours to see'),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Only Fox Mulder and the administrators of an organisation they belong to can see them.',
      ),
    ).toBeVisible();
    // The rest of the profile stays: a refusal here is not a failed page.
    expect(
      screen.getByRole('heading', { name: 'Fox Mulder', level: 1 }),
    ).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('resolves a network failure into an error with a retry', async () => {
    // Arrange
    let attempts = 0;
    server.use(
      otherProfileIs(),
      graphql.query('UserAnalytics', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json({
              data: { userAnalytics: userAnalytics(OTHER_USER_ID) },
            });
      }),
    );
    const { user } = renderRoutes(routes, { route: userPath(OTHER_USER_ID) });
    await user.click(
      await screen.findByRole('button', { name: 'Show analytics' }),
    );

    // Act
    expect(
      await screen.findByText('The analytics could not be loaded'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(
      await screen.findByRole('row', { name: /^Tasks completed/ }),
    ).toBeVisible();
  });

  it('shows the viewer their own figures with the saved copy when the profile opened is theirs', async () => {
    // Arrange
    const me = { ...TEST_USER, id: OTHER_USER_ID };
    server.use(
      ...signedIn(me),
      otherProfileIs(me.id),
      graphql.query('UserAnalytics', () =>
        HttpResponse.json({ data: { userAnalytics: userAnalytics(me.id) } }),
      ),
      graphql.query('MyStatistics', () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: 'User',
              id: me.id,
              statistics: savedStatistics(),
            },
          },
        }),
      ),
    );

    // Act
    renderRoutes(routes, { route: userPath(me.id) });

    // Assert
    expect(
      cellsOf(await screen.findByRole('row', { name: /^Tasks completed/ })),
    ).toEqual(['Tasks completed', '12', '10']);
    expect(
      screen.getByRole('button', { name: 'Save the live figures' }),
    ).toBeVisible();
  });
});
