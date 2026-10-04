import { HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ErrorCode } from '@contracts';
import { routes } from '@/App';
import {
  PAT,
  PROJECT_ID,
  TEAM_ID,
  TERRY,
  VIEWER,
  projectScenario,
  teamFixture,
  teamMember,
  teamScenario,
} from '@/modules/project/project.fixtures';
import { teamMemberSchema } from '@/modules/team/schemas/team.schema';
import { resolveTeamRoles } from '@/modules/team/utils/team.utils';
import { projectTeamsPath, teamPath } from '@/shared/routes/route.constants';
import { resetRefreshState } from '@/shared/services/auth.gateway';
import { clearAccessToken } from '@/shared/services/session.store';
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

const TEAM_ROUTE = teamPath(PROJECT_ID, TEAM_ID);

function mutationFails(name: string, code: ErrorCode) {
  return mockMutationError(name, code, SERVER_DETAIL);
}

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
  server.use(...signedIn());
});

describe('team list', () => {
  it('lists the project’s teams as links', async () => {
    // Arrange
    server.use(...projectScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: projectTeamsPath(PROJECT_ID) });

    // Assert
    const link = await screen.findByRole('link', { name: /Platform/ });
    expect(link).toHaveAttribute('href', TEAM_ROUTE);
    expect(link).toHaveTextContent('1 member');
  });

  it('shows an empty state, with a way to create one for an admin', async () => {
    // Arrange
    server.use(...projectScenario({ project: 'ADMIN', noTeams: true }));

    // Act
    renderRoutes(routes, { route: projectTeamsPath(PROJECT_ID) });

    // Assert
    expect(
      await screen.findByText('This project has no teams yet.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'New team' })).toBeVisible();
  });

  it('does not offer team creation to a plain member', async () => {
    // Arrange
    server.use(...projectScenario({ project: 'MEMBER', noTeams: true }));

    // Act
    renderRoutes(routes, { route: projectTeamsPath(PROJECT_ID) });

    // Assert
    await screen.findByText('This project has no teams yet.');
    expect(screen.queryByRole('button', { name: 'New team' })).toBeNull();
  });

  it('creates a team and opens it', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...teamScenario({ project: 'ADMIN' }),
      graphql.mutation('CreateTeam', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            createTeam: {
              __typename: 'Team',
              id: TEAM_ID,
              name: 'Platform',
              description: null,
              memberCount: 0,
            },
          },
        });
      }),
    );
    const { user, router } = renderRoutes(routes, {
      route: projectTeamsPath(PROJECT_ID),
    });

    // Act
    await user.click(await screen.findByRole('button', { name: 'New team' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create a team' });
    await user.type(within(dialog).getByLabelText('Name'), 'Platform');
    await user.click(
      within(dialog).getByRole('button', { name: 'Create team' }),
    );

    // Assert
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(TEAM_ROUTE),
    );
    expect(sent).toEqual({
      projectId: PROJECT_ID,
      input: { name: 'Platform', description: null },
    });
  });
});

describe('team page', () => {
  it('shows each member’s role, availability, workload and responsibilities', async () => {
    // Arrange
    server.use(...teamScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: TEAM_ROUTE });

    // Assert — these are the AI assignment inputs; they must be inspectable.
    const row = (
      await screen.findByRole('link', { name: 'Terry Teammate' })
    ).closest('tr') as HTMLElement;
    expect(within(row).getByText('Team member')).toBeVisible();
    expect(within(row).getByText('Busy')).toBeVisible();
    expect(within(row).getByText('7')).toBeVisible();
    expect(within(row).getByText('On-call rota')).toBeVisible();
  });

  it('names the team in the breadcrumb', async () => {
    // Arrange
    server.use(...teamScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: TEAM_ROUTE });

    // Assert
    const trail = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    await waitFor(() =>
      expect(
        within(trail)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual(['Home', 'Website', 'Teams', 'Platform']),
    );
  });

  it('hides every manage action from a plain project member', async () => {
    // Arrange
    server.use(...teamScenario({ project: 'MEMBER', team: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: TEAM_ROUTE });

    // Assert
    await screen.findByRole('link', { name: 'Terry Teammate' });
    expect(
      screen.queryByRole('button', { name: /Edit|Remove|Delete|Add/ }),
    ).toBeNull();
    expect(screen.queryByLabelText('Person')).toBeNull();
  });

  it('lets a team lead manage members and details, but not delete the team', async () => {
    // Arrange — lead of THIS team, and only a member of the project.
    server.use(...teamScenario({ project: 'MEMBER', team: 'LEAD' }));

    // Act
    renderRoutes(routes, { route: TEAM_ROUTE });

    // Assert
    expect(
      await screen.findByRole('button', { name: 'Edit team' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Edit Terry Teammate' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Person')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Delete team' })).toBeNull();
  });

  it.each<[ErrorCode, string]>([
    ['FORBIDDEN', 'You don’t have access'],
    ['NOT_FOUND', 'Page not found'],
  ])('renders the right screen for %s', async (code, heading) => {
    // Arrange
    server.use(
      mockQueryError('Team', code, SERVER_DETAIL),
      ...projectScenario({ project: 'MEMBER' }),
    );

    // Act
    renderRoutes(routes, { route: TEAM_ROUTE });

    // Assert
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });
});

describe('team members', () => {
  async function pickPerson(
    user: ReturnType<typeof renderRoutes>['user'],
    name: string,
  ) {
    await user.type(await screen.findByLabelText('Person'), name.slice(0, 3));
    await user.click(await screen.findByRole('option', { name }));
  }

  it('offers only project members who are not on the team yet', async () => {
    // Arrange
    server.use(...teamScenario({ project: 'ADMIN' }));
    const { user } = renderRoutes(routes, { route: TEAM_ROUTE });

    // Act
    await user.type(await screen.findByLabelText('Person'), 'a');

    // Assert — Pat and the viewer are on the project but not the team; Terry
    // is already on it, and Nora is not on the project at all.
    const options = (await screen.findAllByRole('option')).map(
      (option) => option.textContent,
    );
    expect(options).toEqual(expect.arrayContaining([PAT.name, VIEWER.name]));
    expect(options).not.toContain(TERRY.name);
    expect(options).not.toContain('Nora Newcomer');
  });

  it('adds a member with their attributes', async () => {
    // Arrange
    let sent: unknown;
    let added = false;
    server.use(
      // Listed first so it answers instead of the scenario's own handler, and
      // rebuilt per request so the refetch after adding sees the new member.
      graphql.query('Team', () => {
        const team = teamFixture();
        if (added) {
          team.members.push(
            teamMember(PAT, 'LEAD', { availability: 'AWAY', workload: 12 }),
          );
          team.memberCount += 1;
        }
        return HttpResponse.json({ data: { team } });
      }),
      ...teamScenario({ project: 'ADMIN' }),
      graphql.mutation('AddTeamMember', ({ variables }) => {
        sent = variables;
        added = true;
        return HttpResponse.json({
          data: {
            addTeamMember: {
              __typename: 'TeamMember',
              id: `tm-${PAT.id}`,
              role: 'LEAD',
              responsibilities: 'Reviews',
              availability: 'AWAY',
              workload: 12,
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: TEAM_ROUTE });

    // Act
    await pickPerson(user, PAT.name);
    await user.click(screen.getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Team lead' }));
    await user.click(screen.getByRole('combobox', { name: 'Availability' }));
    await user.click(await screen.findByRole('option', { name: 'Away' }));
    const workload = screen.getByLabelText('Workload');
    await user.clear(workload);
    await user.type(workload, '12');
    await user.type(screen.getByLabelText('Responsibilities'), ' Reviews ');
    await user.click(screen.getByRole('button', { name: 'Add to team' }));

    // Assert
    expect(
      await screen.findByText('Pat Project has been added to the team.'),
    ).toBeVisible();
    expect(
      await screen.findByRole('link', { name: 'Pat Project' }),
    ).toBeVisible();
    expect(sent).toEqual({
      teamId: TEAM_ID,
      userId: PAT.id,
      input: {
        role: 'LEAD',
        responsibilities: 'Reviews',
        availability: 'AWAY',
        workload: 12,
      },
    });
  });

  it.each(['1001', '-1', '2.5', ''])(
    'rejects a workload of "%s" before sending anything',
    async (value) => {
      // Arrange — no AddTeamMember handler: a request would fail the test.
      server.use(...teamScenario({ project: 'ADMIN' }));
      const { user } = renderRoutes(routes, { route: TEAM_ROUTE });

      // Act
      await pickPerson(user, PAT.name);
      const workload = screen.getByLabelText('Workload');
      await user.clear(workload);
      if (value) await user.type(workload, value);
      await user.click(screen.getByRole('button', { name: 'Add to team' }));

      // Assert
      expect(
        await screen.findByText('Enter a whole number from 0 to 1000.', {
          selector: '[role="alert"] *',
        }),
      ).toBeVisible();
    },
  );

  it('requires a person to be chosen', async () => {
    // Arrange — no AddTeamMember handler: a request would fail the test.
    server.use(...teamScenario({ project: 'ADMIN' }));
    const { user } = renderRoutes(routes, { route: TEAM_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Add to team' }),
    );

    // Assert
    expect(await screen.findByText('Choose a person.')).toBeVisible();
  });

  it.each<[ErrorCode, string]>([
    ['CONFLICT', 'That person is already on this team.'],
    ['FORBIDDEN', 'You don’t have permission to do that.'],
    ['BAD_USER_INPUT', 'Some of the details below need fixing.'],
  ])('explains a %s when adding', async (code, message) => {
    // Arrange
    server.use(
      ...teamScenario({ project: 'ADMIN' }),
      mutationFails('AddTeamMember', code),
    );
    const { user } = renderRoutes(routes, { route: TEAM_ROUTE });

    // Act
    await pickPerson(user, PAT.name);
    await user.click(screen.getByRole('button', { name: 'Add to team' }));

    // Assert
    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('edits a member’s attributes from the mutation result', async () => {
    // Arrange
    let teamRequests = 0;
    let sent: unknown;
    server.use(
      graphql.query('Team', () => {
        teamRequests += 1;
        return HttpResponse.json({ data: { team: teamFixture() } });
      }),
      ...teamScenario({ project: 'ADMIN' }),
      graphql.mutation('UpdateTeamMember', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            updateTeamMember: {
              __typename: 'TeamMember',
              id: `tm-${TERRY.id}`,
              role: 'MEMBER',
              responsibilities: 'On-call rota',
              availability: 'AVAILABLE',
              workload: 2,
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: TEAM_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Edit Terry Teammate' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Edit Terry Teammate',
    });
    // The form opens on the member's current values.
    expect(within(dialog).getByLabelText('Workload')).toHaveValue(7);
    await user.click(
      within(dialog).getByRole('combobox', { name: 'Availability' }),
    );
    await user.click(await screen.findByRole('option', { name: 'Available' }));
    const workload = within(dialog).getByLabelText('Workload');
    await user.clear(workload);
    await user.type(workload, '2');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    // Assert
    expect(
      await screen.findByText('Terry Teammate has been updated.'),
    ).toBeVisible();
    const row = screen
      .getByRole('link', { name: 'Terry Teammate' })
      .closest('tr') as HTMLElement;
    await waitFor(() =>
      expect(within(row).getByText('Available')).toBeVisible(),
    );
    expect(within(row).getByText('2')).toBeVisible();
    expect(sent).toEqual({
      teamId: TEAM_ID,
      userId: TERRY.id,
      input: {
        role: 'MEMBER',
        responsibilities: 'On-call rota',
        availability: 'AVAILABLE',
        workload: 2,
      },
    });
    expect(teamRequests).toBe(1);
  });

  it('removes a member only after a confirmation that names them', async () => {
    // Arrange
    let sent: unknown;
    let removed = false;
    server.use(
      graphql.query('Team', () => {
        const team = teamFixture();
        if (removed) {
          team.members = [];
          team.memberCount = 0;
        }
        return HttpResponse.json({ data: { team } });
      }),
      ...teamScenario({ project: 'ADMIN' }),
      graphql.mutation('RemoveTeamMember', ({ variables }) => {
        sent = variables;
        removed = true;
        return HttpResponse.json({ data: { removeTeamMember: true } });
      }),
    );
    const { user } = renderRoutes(routes, { route: TEAM_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Remove Terry Teammate' }),
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Remove Terry Teammate?',
    });
    expect(sent).toBeUndefined();
    expect(dialog).toHaveTextContent(
      'Terry Teammate will leave Platform but stay on the project.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    // Assert
    expect(
      await screen.findByText('This team has no members yet.'),
    ).toBeVisible();
    expect(sent).toEqual({ teamId: TEAM_ID, userId: TERRY.id });
  });

  it('keeps the member when removal fails', async () => {
    // Arrange
    server.use(
      ...teamScenario({ project: 'ADMIN' }),
      graphql.mutation('RemoveTeamMember', () => HttpResponse.error()),
    );
    const { user } = renderRoutes(routes, { route: TEAM_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Remove Terry Teammate' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    // Assert
    expect(await screen.findByText(/Can’t reach the server/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Terry Teammate' })).toBeVisible();
  });
});

describe('team details', () => {
  it('saves the name and description', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...teamScenario({ project: 'ADMIN' }),
      graphql.mutation('UpdateTeam', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            updateTeam: {
              __typename: 'Team',
              id: TEAM_ID,
              name: 'Platform & Infra',
              description: 'Keeps the lights on.',
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: TEAM_ROUTE });

    // Act
    await user.click(await screen.findByRole('button', { name: 'Edit team' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit team' });
    const name = within(dialog).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Platform & Infra');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Platform & Infra' }),
    ).toBeVisible();
    expect(sent).toEqual({
      id: TEAM_ID,
      input: { name: 'Platform & Infra', description: 'Keeps the lights on.' },
    });
  });

  it('deletes only after a confirmation that names the team', async () => {
    // Arrange
    let deleted: unknown;
    server.use(
      ...teamScenario({ project: 'ADMIN' }),
      graphql.mutation('DeleteTeam', ({ variables }) => {
        deleted = variables;
        return HttpResponse.json({ data: { deleteTeam: true } });
      }),
    );
    const { user, router } = renderRoutes(routes, { route: TEAM_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Delete team' }),
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Delete Platform?',
    });
    expect(deleted).toBeUndefined();
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete team' }),
    );

    // Assert
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(projectTeamsPath(PROJECT_ID)),
    );
    expect(deleted).toEqual({ id: TEAM_ID });
  });

  it('stays put and explains when deletion is refused', async () => {
    // Arrange
    server.use(
      ...teamScenario({ project: 'ADMIN' }),
      mutationFails('DeleteTeam', 'FORBIDDEN'),
    );
    const { user, router } = renderRoutes(routes, { route: TEAM_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Delete team' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete team' }),
    );

    // Assert
    expect(
      await screen.findByText('You don’t have permission to do that.'),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(TEAM_ROUTE);
  });
});

describe('team member validation', () => {
  // Mirrors apps/backend/src/modules/team/team.validation.ts.
  const base = {
    role: 'MEMBER',
    responsibilities: '',
    availability: 'AVAILABLE',
  };

  it.each<[number, boolean]>([
    [0, true],
    [1000, true],
    [1001, false],
    [-1, false],
    [1.5, false],
    [Number.NaN, false],
  ])('workload %s', (workload, valid) => {
    expect(teamMemberSchema.safeParse({ ...base, workload }).success).toBe(
      valid,
    );
  });

  it('sends blank responsibilities as null', () => {
    const parsed = teamMemberSchema.parse({
      ...base,
      responsibilities: '   ',
      workload: 0,
    });

    expect(parsed.responsibilities).toBeNull();
  });
});

describe('team role resolution', () => {
  const members = [
    { role: 'LEAD' as const, user: { id: 'lead' } },
    { role: 'MEMBER' as const, user: { id: 'member' } },
  ];

  it.each<[string, string, string[]]>([
    ['the lead', 'lead', ['PROJECT_MEMBER', 'TEAM_LEAD']],
    ['a member', 'member', ['PROJECT_MEMBER', 'TEAM_MEMBER']],
    ['someone not on the team', 'other', ['PROJECT_MEMBER']],
  ])('resolves %s', (_label, viewerId, expected) => {
    expect(resolveTeamRoles(viewerId, ['PROJECT_MEMBER'], members)).toEqual(
      expected,
    );
  });

  it('grants nothing without a signed-in viewer', () => {
    expect(resolveTeamRoles(undefined, ['PROJECT_ADMIN'], members)).toEqual([]);
  });
});
