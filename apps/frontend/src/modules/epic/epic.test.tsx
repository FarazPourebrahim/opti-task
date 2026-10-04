import { HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ErrorCode } from '@contracts';
import { routes } from '@/App';
import {
  EPIC_ID,
  MILESTONE,
  MILESTONE_ID,
  OTHER_EPIC_ID,
  TASK_ID,
  epicDetail,
  epicDetailScenario,
  epicListScenario,
  epicSummary,
  epicsData,
} from '@/modules/epic/epic.fixtures';
import {
  epicSchema,
  milestoneSchema,
} from '@/modules/epic/schemas/epic.schema';
import { PROJECT_ID } from '@/modules/project/project.fixtures';
import {
  epicPath,
  projectEpicsPath,
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

// The server's own wording, which must never reach the screen.
const SERVER_DETAIL = 'internal reason';

const LIST_ROUTE = projectEpicsPath(PROJECT_ID);
const EPIC_ROUTE = epicPath(PROJECT_ID, EPIC_ID);

function mutationFails(name: string, code: ErrorCode) {
  return mockMutationError(name, code, SERVER_DETAIL);
}

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
  server.use(...signedIn());
});

describe('epic and milestone validation', () => {
  it.each([
    ['a blank name', { name: '  ' }, false],
    ['a 150-character name', { name: 'a'.repeat(150) }, true],
    ['a 151-character name', { name: 'a'.repeat(151) }, false],
    ['a 5,000-character description', { description: 'a'.repeat(5000) }, true],
    ['a 5,001-character description', { description: 'a'.repeat(5001) }, false],
  ])('judges an epic with %s', (_label, change, valid) => {
    // Act
    const parsed = epicSchema.safeParse({
      name: 'Onboarding',
      description: '',
      ...change,
    });

    // Assert
    expect(parsed.success).toBe(valid);
  });

  it('trims the name and turns a blank description into null', () => {
    // Act
    const parsed = epicSchema.safeParse({
      name: ' Onboarding ',
      description: ' ',
    });

    // Assert
    expect(parsed.success && parsed.data).toEqual({
      name: 'Onboarding',
      description: null,
    });
  });

  it('takes a milestone with no date or a full instant, never a bare date', () => {
    // Arrange
    const base = { name: 'Beta', description: '' };

    // Act
    const undated = milestoneSchema.safeParse({ ...base, dueDate: null });
    const dated = milestoneSchema.safeParse({
      ...base,
      dueDate: '2026-04-01T00:00:00.000Z',
    });
    const bare = milestoneSchema.safeParse({ ...base, dueDate: '2026-04-01' });

    // Assert
    expect(undated.success).toBe(true);
    expect(dated.success).toBe(true);
    expect(bare.success).toBe(false);
  });
});

describe('epic list', () => {
  it('lists the epics as links, each with its progress', async () => {
    // Arrange
    server.use(
      ...epicListScenario({ project: 'MEMBER' }, [
        epicSummary(),
        epicSummary({
          id: OTHER_EPIC_ID,
          name: 'Billing',
          description: null,
          progress: 0,
          completedTasks: 0,
          totalTasks: 0,
        }),
      ]),
    );

    // Act
    renderRoutes(routes, { route: LIST_ROUTE });

    // Assert
    const first = await screen.findByRole('link', { name: /Onboarding/ });
    expect(first).toHaveAttribute('href', EPIC_ROUTE);
    expect(within(first).getByText('1 of 2 tasks done')).toBeVisible();
    expect(within(first).getByText('50%')).toBeVisible();
    expect(
      within(first).getByRole('progressbar', {
        name: 'Progress of Onboarding',
      }),
    ).toHaveAttribute('aria-valuenow', '50');
    // An epic with no tasks is 0%, not a blank or NaN.
    const second = screen.getByRole('link', { name: /Billing/ });
    expect(within(second).getByText('0 of 0 tasks done')).toBeVisible();
    expect(within(second).getByText('0%')).toBeVisible();
  });

  it('shows an empty list with a way to create an epic, for someone who can', async () => {
    // Arrange
    server.use(...epicListScenario({ project: 'ADMIN' }, []));

    // Act
    renderRoutes(routes, { route: LIST_ROUTE });

    // Assert
    expect(
      await screen.findByText('This project has no epics yet.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'New epic' })).toBeVisible();
  });

  it('does not offer epic creation to a plain member', async () => {
    // Arrange
    server.use(...epicListScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: LIST_ROUTE });

    // Assert
    await screen.findByRole('link', { name: /Onboarding/ });
    expect(screen.queryByRole('button', { name: 'New epic' })).toBeNull();
  });

  it('loads the next page, sending the cursor back untouched', async () => {
    // Arrange
    let sent: Record<string, unknown> = {};
    server.use(
      graphql.query('ProjectEpics', ({ variables }) => {
        if (variables['after']) {
          sent = variables;
          return HttpResponse.json({
            data: epicsData(
              [epicSummary({ id: OTHER_EPIC_ID, name: 'Billing' })],
              { total: 2 },
            ),
          });
        }
        return HttpResponse.json({
          data: epicsData([epicSummary()], {
            hasNextPage: true,
            endCursor: 'opaque-cursor',
            total: 2,
          }),
        });
      }),
      ...epicListScenario({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: LIST_ROUTE });

    // Act
    await user.click(await screen.findByRole('button', { name: 'Load more' }));

    // Assert
    expect(await screen.findByRole('link', { name: /Billing/ })).toBeVisible();
    expect(screen.getByRole('link', { name: /Onboarding/ })).toBeVisible();
    expect(sent['after']).toBe('opaque-cursor');
    expect(sent['first']).toBeLessThanOrEqual(100);
  });

  it('creates an epic and opens it', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...epicListScenario({ project: 'ADMIN' }),
      ...epicDetailScenario({ project: 'ADMIN' }, { name: 'Billing' }),
      graphql.mutation('CreateEpic', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: { createEpic: epicSummary({ name: 'Billing' }) },
        });
      }),
    );
    const { user, router } = renderRoutes(routes, { route: LIST_ROUTE });

    // Act
    await user.click(await screen.findByRole('button', { name: 'New epic' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), ' Billing ');
    await user.click(
      within(dialog).getByRole('button', { name: 'Create epic' }),
    );

    // Assert
    await waitFor(() =>
      expect(sent).toEqual({
        projectId: PROJECT_ID,
        input: { name: 'Billing', description: null },
      }),
    );
    expect(await screen.findByText('Billing has been created.')).toBeVisible();
    expect(
      await screen.findByRole('heading', { name: 'Billing', level: 2 }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(EPIC_ROUTE);
  });

  it('points at the name when it is missing, and sends nothing', async () => {
    // Arrange — no mutation handler: a request would fail the test.
    server.use(...epicListScenario({ project: 'ADMIN' }));
    const { user } = renderRoutes(routes, { route: LIST_ROUTE });

    // Act
    await user.click(await screen.findByRole('button', { name: 'New epic' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Create epic' }),
    );

    // Assert
    expect(await within(dialog).findByText('Enter a name.')).toBeVisible();
    expect(within(dialog).getByLabelText('Name')).toHaveAttribute(
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
        ...epicListScenario({ project: 'ADMIN' }),
        mutationFails('CreateEpic', code),
      );
      const { user } = renderRoutes(routes, { route: LIST_ROUTE });

      // Act
      await user.click(await screen.findByRole('button', { name: 'New epic' }));
      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText('Name'), 'Billing');
      await user.click(
        within(dialog).getByRole('button', { name: 'Create epic' }),
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
      graphql.query('ProjectEpics', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json({ data: epicsData() });
      }),
      ...epicListScenario({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: LIST_ROUTE });

    // Act
    expect(await screen.findByText('Could not load the epics.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(
      await screen.findByRole('link', { name: /Onboarding/ }),
    ).toBeVisible();
  });

  it('has no accessibility violations', async () => {
    // Arrange
    server.use(...epicListScenario({ project: 'ADMIN' }));

    // Act
    const { container } = renderRoutes(routes, { route: LIST_ROUTE });
    await screen.findByRole('link', { name: /Onboarding/ });

    // Assert
    expect(await auditA11y(container)).toHaveNoViolations();
  });
});

describe('epic detail', () => {
  it('shows the progress, the tasks and the milestones', async () => {
    // Arrange
    server.use(...epicDetailScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: EPIC_ROUTE });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Onboarding', level: 2 }),
    ).toBeVisible();
    expect(screen.getByText('Everything a new user meets.')).toBeVisible();
    expect(screen.getByText('50%')).toBeVisible();
    expect(
      screen.getByRole('progressbar', { name: '1 of 2 tasks done' }),
    ).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByRole('link', { name: 'Build login' })).toHaveAttribute(
      'href',
      taskPath(PROJECT_ID, TASK_ID),
    );
    expect(screen.getByText('5 points')).toBeVisible();
    expect(screen.getByText('Not estimated')).toBeVisible();
    expect(screen.getByText('Beta')).toBeVisible();
    expect(screen.getByText('First outside users.')).toBeVisible();
    expect(screen.getByText('Due Apr 1, 2026')).toBeVisible();
  });

  it('names the epic in the breadcrumb', async () => {
    // Arrange
    server.use(...epicDetailScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: EPIC_ROUTE });

    // Assert
    const trail = await screen.findByRole('navigation', {
      name: 'Breadcrumb',
    });
    await waitFor(() =>
      expect(within(trail).getByText('Onboarding')).toBeVisible(),
    );
    expect(within(trail).getByRole('link', { name: 'Epics' })).toBeVisible();
  });

  it('has its own empty states for no tasks and no milestones', async () => {
    // Arrange
    server.use(
      ...epicDetailScenario(
        { project: 'MEMBER' },
        {
          tasks: [],
          milestones: [],
          progress: 0,
          completedTasks: 0,
          totalTasks: 0,
        },
      ),
    );

    // Act
    renderRoutes(routes, { route: EPIC_ROUTE });

    // Assert
    expect(
      await screen.findByText(/This epic has no tasks yet\./),
    ).toBeVisible();
    expect(screen.getByText('This epic has no milestones yet.')).toBeVisible();
    expect(screen.getByText('0%')).toBeVisible();
  });

  it('hides every control from someone who may only read', async () => {
    // Arrange
    server.use(...epicDetailScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: EPIC_ROUTE });

    // Assert
    await screen.findByRole('link', { name: 'Build login' });
    for (const name of [
      'Edit epic',
      'Delete epic',
      'Save progress',
      'New milestone',
      'Delete Beta',
    ]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    // Nothing to explain to someone who was offered no milestone action.
    expect(screen.queryByText(/cannot be edited once created/)).toBeNull();
  });

  it('explains live against stored progress, and saves the current figure', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...epicDetailScenario({ project: 'ADMIN' }),
      graphql.mutation('RefreshEpicProgress', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            refreshEpicProgress: {
              __typename: 'Epic',
              id: EPIC_ID,
              progress: 66.7,
              completedTasks: 2,
              totalTasks: 3,
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: EPIC_ROUTE });

    // Act
    expect(
      await screen.findByText(/it does not change what you see here/),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save progress' }));

    // Assert — the bar follows the value the server returned.
    expect(await screen.findByText('Progress saved at 67%.')).toBeVisible();
    expect(sent).toEqual({ id: EPIC_ID });
    expect(
      screen.getByRole('progressbar', { name: '2 of 3 tasks done' }),
    ).toHaveAttribute('aria-valuenow', '67');
  });

  it('edits the epic in place', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...epicDetailScenario({ project: 'ADMIN' }),
      graphql.mutation('UpdateEpic', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            updateEpic: {
              __typename: 'Epic',
              id: EPIC_ID,
              name: 'Welcome',
              description: null,
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: EPIC_ROUTE });

    // Act
    await user.click(await screen.findByRole('button', { name: 'Edit epic' }));
    const dialog = await screen.findByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'Welcome');
    await user.clear(within(dialog).getByLabelText('Description'));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    // Assert — shown from the mutation's result, with no second read.
    expect(await screen.findByText('Epic details saved.')).toBeVisible();
    expect(sent).toEqual({
      id: EPIC_ID,
      input: { name: 'Welcome', description: null },
    });
    expect(
      screen.getByRole('heading', { name: 'Welcome', level: 2 }),
    ).toBeVisible();
    expect(screen.getByText('No description.')).toBeVisible();
  });

  it('creates a milestone on this epic, with a full instant for its date', async () => {
    // Arrange
    let sent: unknown;
    let reads = 0;
    const created = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'Launch',
      description: null,
      dueDate: '2026-05-01T00:00:00.000Z',
    };
    server.use(
      graphql.query('Epic', () => {
        reads += 1;
        return HttpResponse.json({
          data: {
            epic: epicDetail(
              reads === 1 ? {} : { milestones: [MILESTONE, created] },
            ),
          },
        });
      }),
      ...epicDetailScenario({ project: 'ADMIN' }),
      graphql.mutation('CreateMilestone', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            createMilestone: {
              __typename: 'Milestone',
              ...created,
              epicId: EPIC_ID,
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: EPIC_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'New milestone' }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Launch');
    await user.type(within(dialog).getByLabelText('Due date'), '2026/05/01');
    await user.click(
      within(dialog).getByRole('button', { name: 'Create milestone' }),
    );

    // Assert — tied to this epic, or no query could ever list it.
    await waitFor(() =>
      expect(sent).toEqual({
        projectId: PROJECT_ID,
        input: {
          name: 'Launch',
          description: null,
          dueDate: '2026-05-01T00:00:00.000Z',
          epicId: EPIC_ID,
        },
      }),
    );
    expect(await screen.findByText('Launch has been created.')).toBeVisible();
    expect(await screen.findByText('Due May 1, 2026')).toBeVisible();
  });

  it('offers no way to edit a milestone, and says so', async () => {
    // Arrange
    server.use(...epicDetailScenario({ project: 'ADMIN' }));

    // Act
    renderRoutes(routes, { route: EPIC_ROUTE });

    // Assert
    expect(
      await screen.findByText(
        'A milestone cannot be edited once created. To change one, delete it and create it again.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: /Edit Beta/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete Beta' })).toBeVisible();
  });

  it('asks before deleting a milestone, then drops it from the list', async () => {
    // Arrange
    let sent: unknown;
    let reads = 0;
    server.use(
      graphql.query('Epic', () => {
        reads += 1;
        return HttpResponse.json({
          data: { epic: epicDetail(reads === 1 ? {} : { milestones: [] }) },
        });
      }),
      ...epicDetailScenario({ project: 'ADMIN' }),
      graphql.mutation('DeleteMilestone', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({ data: { deleteMilestone: true } });
      }),
    );
    const { user } = renderRoutes(routes, { route: EPIC_ROUTE });

    // Act — nothing is sent until the dialog is confirmed.
    await user.click(
      await screen.findByRole('button', { name: 'Delete Beta' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Delete Beta?')).toBeVisible();
    expect(sent).toBeUndefined();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    // Assert
    expect(await screen.findByText('Beta has been deleted.')).toBeVisible();
    expect(sent).toEqual({ id: MILESTONE_ID });
    expect(
      await screen.findByText('This epic has no milestones yet.'),
    ).toBeVisible();
  });

  it('keeps the milestone when deleting it is refused', async () => {
    // Arrange
    server.use(
      ...epicDetailScenario({ project: 'ADMIN' }),
      mutationFails('DeleteMilestone', 'FORBIDDEN'),
    );
    const { user } = renderRoutes(routes, { route: EPIC_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Delete Beta' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    // Assert
    expect(
      await screen.findByText('You don’t have permission to do that.'),
    ).toBeVisible();
    expect(screen.getByText('Beta')).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('asks before deleting the epic, then leaves for the epic list', async () => {
    // Arrange
    let deleted = false;
    server.use(
      ...epicDetailScenario({ project: 'ADMIN' }),
      graphql.query('ProjectEpics', () =>
        HttpResponse.json({ data: epicsData(deleted ? [] : undefined) }),
      ),
      graphql.mutation('DeleteEpic', () => {
        deleted = true;
        return HttpResponse.json({ data: { deleteEpic: true } });
      }),
    );
    const { user, router } = renderRoutes(routes, { route: EPIC_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Delete epic' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Delete Onboarding?')).toBeVisible();
    expect(deleted).toBe(false);
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete epic' }),
    );

    // Assert
    expect(
      await screen.findByText('Onboarding has been deleted.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(LIST_ROUTE),
    );
    expect(
      await screen.findByText('This project has no epics yet.'),
    ).toBeVisible();
  });

  it.each([
    ['FORBIDDEN', 'You don’t have access'],
    ['NOT_FOUND', 'Page not found'],
  ] as const)('renders the right screen for %s', async (code, heading) => {
    // Arrange
    server.use(
      mockQueryError('Epic', code, SERVER_DETAIL),
      ...epicDetailScenario({ project: 'MEMBER' }),
    );

    // Act
    renderRoutes(routes, { route: EPIC_ROUTE });

    // Assert
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('resolves a network failure into an error with a retry', async () => {
    // Arrange
    let attempts = 0;
    server.use(
      graphql.query('Epic', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json({ data: { epic: epicDetail() } });
      }),
      ...epicDetailScenario({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: EPIC_ROUTE });

    // Act
    expect(await screen.findByText('Could not load this epic.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Onboarding', level: 2 }),
    ).toBeVisible();
  });

  it('has no accessibility violations', async () => {
    // Arrange
    server.use(...epicDetailScenario({ project: 'ADMIN' }));

    // Act
    const { container } = renderRoutes(routes, { route: EPIC_ROUTE });
    await screen.findByRole('link', { name: 'Build login' });

    // Assert
    expect(await auditA11y(container)).toHaveNoViolations();
  });
});
