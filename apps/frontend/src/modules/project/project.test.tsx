import { HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { PROJECT_STATES } from '@contracts';
import type { ErrorCode, ProjectState } from '@contracts';
import { routes } from '@/App';
import {
  NORA,
  ORG_ID,
  PROJECT_ID,
  TERRY,
  VIEWER,
  projectFixture,
  projectMember,
  projectScenario,
} from '@/modules/project/project.fixtures';
import {
  canTransitionProject,
  nextProjectStates,
  parseWorkflow,
  resolveProjectRoles,
} from '@/modules/project/utils/project.utils';
import {
  organizationPath,
  projectMembersPath,
  projectPath,
  projectSettingsPath,
} from '@/shared/routes/route.constants';
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

function mutationFails(name: string, code: ErrorCode) {
  return mockMutationError(name, code, SERVER_DETAIL);
}

function projectsList(nodes: Array<{ id: string; name: string }>) {
  return graphql.query('OrganizationProjects', () =>
    HttpResponse.json({
      data: {
        organization: {
          __typename: 'Organization',
          id: ORG_ID,
          projects: {
            __typename: 'ProjectConnection',
            edges: nodes.map((node) => ({
              __typename: 'ProjectEdge',
              cursor: `cursor-${node.id}`,
              node: {
                __typename: 'Project',
                ...node,
                description: null,
                status: 'ACTIVE',
                memberCount: 1,
              },
            })),
            pageInfo: {
              __typename: 'PageInfo',
              hasNextPage: false,
              endCursor: null,
            },
            totalCount: nodes.length,
          },
        },
      },
    }),
  );
}

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
  server.use(...signedIn());
});

describe('project lifecycle rules', () => {
  // Mirrors PROJECT_STATE_TRANSITIONS in the backend's project.model.ts.
  const legal: Record<ProjectState, ProjectState[]> = {
    PLANNING: ['ACTIVE', 'ARCHIVED'],
    ACTIVE: ['COMPLETED', 'ARCHIVED'],
    COMPLETED: ['ACTIVE', 'ARCHIVED'],
    ARCHIVED: [],
  };

  const cases = PROJECT_STATES.flatMap((from) =>
    PROJECT_STATES.map((to) => [from, to, legal[from].includes(to)] as const),
  );

  it.each(cases)('%s → %s is %s', (from, to, allowed) => {
    expect(canTransitionProject(from, to)).toBe(allowed);
  });

  it('offers nothing from an archived project', () => {
    expect(nextProjectStates('ARCHIVED')).toEqual([]);
  });
});

describe('project status control', () => {
  async function statusButtons() {
    const group = await screen.findByRole('group', { name: 'Change status' });
    return within(group)
      .getAllByRole('button')
      .map((button) => button.textContent);
  }

  it.each<[ProjectState, string[]]>([
    ['PLANNING', ['Mark as active', 'Archive']],
    ['ACTIVE', ['Mark as completed', 'Archive']],
    ['COMPLETED', ['Mark as active', 'Archive']],
  ])('offers only the legal moves from %s', async (status, expected) => {
    // Arrange
    server.use(...projectScenario({ project: 'ADMIN', status }));

    // Act
    renderRoutes(routes, { route: projectPath(PROJECT_ID) });

    // Assert
    expect(await statusButtons()).toEqual(expected);
  });

  it('offers no move at all from an archived project', async () => {
    // Arrange
    server.use(...projectScenario({ project: 'ADMIN', status: 'ARCHIVED' }));

    // Act
    renderRoutes(routes, { route: projectPath(PROJECT_ID) });

    // Assert
    expect(
      await screen.findByText('An archived project cannot be reopened.'),
    ).toBeVisible();
    expect(screen.queryByRole('group', { name: 'Change status' })).toBeNull();
  });

  it('shows the status but no moves to someone who cannot change it', async () => {
    // Arrange
    server.use(...projectScenario({ project: 'MEMBER', status: 'PLANNING' }));

    // Act
    renderRoutes(routes, { route: projectPath(PROJECT_ID) });

    // Assert
    expect(await screen.findByText('Planning')).toBeVisible();
    expect(screen.queryByRole('group', { name: 'Change status' })).toBeNull();
  });

  it('moves the project and shows the new status from the result', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...projectScenario({ project: 'ADMIN', status: 'PLANNING' }),
      graphql.mutation('ChangeProjectStatus', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            changeProjectStatus: {
              __typename: 'Project',
              id: PROJECT_ID,
              status: 'ACTIVE',
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: projectPath(PROJECT_ID) });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Mark as active' }),
    );

    // Assert
    expect(await screen.findByText('The project is now Active.')).toBeVisible();
    await waitFor(async () =>
      expect(await statusButtons()).toEqual(['Mark as completed', 'Archive']),
    );
    expect(sent).toEqual({ id: PROJECT_ID, status: 'ACTIVE' });
  });

  it('leaves the status untouched when the server rejects the move', async () => {
    // Arrange — the client thought the move was legal; the server disagreed.
    server.use(
      ...projectScenario({ project: 'ADMIN', status: 'PLANNING' }),
      mutationFails('ChangeProjectStatus', 'BAD_USER_INPUT'),
    );
    const { user } = renderRoutes(routes, { route: projectPath(PROJECT_ID) });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Mark as active' }),
    );

    // Assert
    expect(
      await screen.findByText(/That status change isn’t allowed/),
    ).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
    expect(screen.getByText('Planning')).toBeVisible();
    expect(await statusButtons()).toEqual(['Mark as active', 'Archive']);
  });
});

describe('project frame', () => {
  it('names the project, links back to its organisation and builds the trail', async () => {
    // Arrange
    server.use(...projectScenario({ project: 'ADMIN' }));

    // Act
    renderRoutes(routes, { route: projectMembersPath(PROJECT_ID) });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Website', level: 1 }),
    ).toBeVisible();
    expect(
      await screen.findByRole('link', { name: 'Acme Inc.' }),
    ).toHaveAttribute('href', organizationPath(ORG_ID));
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    await waitFor(() =>
      expect(
        within(trail)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual(['Home', 'Website', 'Members']),
    );
  });

  it.each<[string, 'ADMIN' | 'MEMBER', string[]]>([
    [
      'a project admin',
      'ADMIN',
      [
        'Overview',
        'Board',
        'Tasks',
        'Sprints',
        'Epics',
        'Members',
        'Teams',
        'Settings',
      ],
    ],
    [
      'a project member',
      'MEMBER',
      ['Overview', 'Board', 'Tasks', 'Sprints', 'Epics', 'Members', 'Teams'],
    ],
  ])('shows the right tabs to %s', async (_label, role, expected) => {
    // Arrange
    server.use(...projectScenario({ project: role }));

    // Act
    renderRoutes(routes, { route: projectPath(PROJECT_ID) });

    // Assert
    const tabs = await screen.findByRole('navigation', {
      name: 'Project sections',
    });
    await waitFor(() =>
      expect(
        within(tabs)
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual(expected),
    );
  });

  it('gives an organisation owner project powers without project membership', async () => {
    // Arrange
    server.use(...projectScenario({ org: 'OWNER', project: null }));

    // Act
    renderRoutes(routes, { route: projectPath(PROJECT_ID) });

    // Assert
    const tabs = await screen.findByRole('navigation', {
      name: 'Project sections',
    });
    expect(
      await within(tabs).findByRole('link', { name: 'Settings' }),
    ).toBeVisible();
    expect(
      await screen.findByRole('group', { name: 'Change status' }),
    ).toBeVisible();
  });

  it('still renders for a project member outside the organisation', async () => {
    // Arrange — the organisation read is refused; the project one is not.
    server.use(...projectScenario({ org: null, project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: projectPath(PROJECT_ID) });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Website', level: 1 }),
    ).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Acme Inc.' })).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'You don’t have access' }),
    ).toBeNull();
  });

  it.each<[ErrorCode, string]>([
    ['FORBIDDEN', 'You don’t have access'],
    ['NOT_FOUND', 'Page not found'],
  ])('renders the right screen for %s', async (code, heading) => {
    // Arrange
    server.use(mockQueryError('Project', code, SERVER_DETAIL));

    // Act
    renderRoutes(routes, { route: projectPath(PROJECT_ID) });

    // Assert
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });
});

describe('create project', () => {
  it('is offered to an organisation admin and opens the new project', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...projectScenario({ org: 'ADMIN', project: 'ADMIN' }),
      projectsList([]),
      graphql.mutation('CreateProject', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            createProject: {
              __typename: 'Project',
              id: PROJECT_ID,
              name: 'Website',
              description: null,
              status: 'PLANNING',
              memberCount: 1,
            },
          },
        });
      }),
    );
    const { user, router } = renderRoutes(routes, {
      route: organizationPath(ORG_ID),
    });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'New project' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Create a project',
    });
    await user.type(within(dialog).getByLabelText('Name'), ' Website ');
    await user.click(
      within(dialog).getByRole('button', { name: 'Create project' }),
    );

    // Assert
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(projectPath(PROJECT_ID)),
    );
    expect(sent).toEqual({
      organizationId: ORG_ID,
      input: { name: 'Website', description: null },
    });
  });

  it('is not offered to a plain organisation member', async () => {
    // Arrange
    server.use(
      ...projectScenario({ org: 'MEMBER' }),
      projectsList([{ id: PROJECT_ID, name: 'Website' }]),
    );

    // Act
    renderRoutes(routes, { route: organizationPath(ORG_ID) });

    // Assert — the list is there, and each project is now a way in.
    expect(
      await screen.findByRole('link', { name: 'Website' }),
    ).toHaveAttribute('href', projectPath(PROJECT_ID));
    expect(screen.queryByRole('button', { name: 'New project' })).toBeNull();
  });

  it('validates the name before sending anything', async () => {
    // Arrange — no CreateProject handler: a request would fail the test.
    server.use(...projectScenario({ org: 'ADMIN' }), projectsList([]));
    const { user } = renderRoutes(routes, { route: organizationPath(ORG_ID) });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'New project' }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Create project' }),
    );

    // Assert
    expect(await within(dialog).findByText('Enter a name.')).toBeVisible();
  });
});

describe('project members', () => {
  async function pickPerson(
    user: ReturnType<typeof renderRoutes>['user'],
    name: string,
  ) {
    await user.type(await screen.findByLabelText('Person'), name.slice(0, 4));
    await user.click(await screen.findByRole('option', { name }));
  }

  it('adds someone from the organisation who is not on the project yet', async () => {
    // Arrange
    let sent: unknown;
    let added = false;
    server.use(
      // Listed first so it answers instead of the scenario's own handler, and
      // rebuilt per request so the refetch after adding sees the new member.
      graphql.query('Project', () => {
        const project = projectFixture({ project: 'ADMIN' });
        if (added) {
          const node = projectMember(NORA, 'VIEWER');
          project.members.edges.push({
            __typename: 'ProjectMemberEdge',
            cursor: `cursor-${node.id}`,
            node,
          });
          project.members.totalCount += 1;
          project.memberCount += 1;
        }
        return HttpResponse.json({ data: { project } });
      }),
      ...projectScenario({ project: 'ADMIN' }),
      graphql.mutation('AddProjectMember', ({ variables }) => {
        sent = variables;
        added = true;
        return HttpResponse.json({
          data: {
            addProjectMember: {
              __typename: 'ProjectMember',
              id: `pm-${NORA.id}`,
              role: 'VIEWER',
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, {
      route: projectMembersPath(PROJECT_ID),
    });

    // Act
    await pickPerson(user, NORA.name);
    await user.click(screen.getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Viewer' }));
    await user.click(screen.getByRole('button', { name: 'Add to project' }));

    // Assert
    expect(
      await screen.findByText('Nora Newcomer has been added to the project.'),
    ).toBeVisible();
    expect(
      await screen.findByRole('link', { name: 'Nora Newcomer' }),
    ).toBeVisible();
    expect(sent).toEqual({
      projectId: PROJECT_ID,
      userId: NORA.id,
      role: 'VIEWER',
    });
  });

  it('offers only people who are not already on the project', async () => {
    // Arrange
    server.use(...projectScenario({ project: 'ADMIN' }));
    const { user } = renderRoutes(routes, {
      route: projectMembersPath(PROJECT_ID),
    });

    // Act — "e" appears in every name in the organisation.
    await user.type(await screen.findByLabelText('Person'), 'e');

    // Assert
    const options = (await screen.findAllByRole('option')).map(
      (option) => option.textContent,
    );
    expect(options).toContain(NORA.name);
    expect(options).not.toContain(TERRY.name);
    expect(options).not.toContain(VIEWER.name);
  });

  it('requires a person to be chosen', async () => {
    // Arrange — no AddProjectMember handler: a request would fail the test.
    server.use(...projectScenario({ project: 'ADMIN' }));
    const { user } = renderRoutes(routes, {
      route: projectMembersPath(PROJECT_ID),
    });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Add to project' }),
    );

    // Assert
    expect(await screen.findByText('Choose a person.')).toBeVisible();
  });

  it.each<[ErrorCode, string]>([
    ['CONFLICT', 'That person is already on this project.'],
    ['FORBIDDEN', 'You don’t have permission to do that.'],
  ])('explains a %s when adding', async (code, message) => {
    // Arrange
    server.use(
      ...projectScenario({ project: 'ADMIN' }),
      mutationFails('AddProjectMember', code),
    );
    const { user } = renderRoutes(routes, {
      route: projectMembersPath(PROJECT_ID),
    });

    // Act
    await pickPerson(user, NORA.name);
    await user.click(screen.getByRole('button', { name: 'Add to project' }));

    // Assert
    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('changes a role from the mutation result', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...projectScenario({ project: 'ADMIN' }),
      graphql.mutation('UpdateProjectMemberRole', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            updateProjectMemberRole: {
              __typename: 'ProjectMember',
              id: `pm-${TERRY.id}`,
              role: 'VIEWER',
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, {
      route: projectMembersPath(PROJECT_ID),
    });

    // Act
    await user.click(
      await screen.findByRole('combobox', { name: 'Role for Terry Teammate' }),
    );
    await user.click(await screen.findByRole('option', { name: 'Viewer' }));

    // Assert
    expect(
      await screen.findByText('Terry Teammate is now Viewer.'),
    ).toBeVisible();
    expect(sent).toEqual({
      projectId: PROJECT_ID,
      userId: TERRY.id,
      role: 'VIEWER',
    });
  });

  it('removes a member only after a confirmation that names them', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...projectScenario({ project: 'ADMIN' }),
      graphql.mutation('RemoveProjectMember', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({ data: { removeProjectMember: true } });
      }),
    );
    const { user } = renderRoutes(routes, {
      route: projectMembersPath(PROJECT_ID),
    });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Remove Terry Teammate' }),
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Remove Terry Teammate?',
    });
    expect(sent).toBeUndefined();
    expect(dialog).toHaveTextContent(
      'Terry Teammate will lose access to Website.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    // Assert
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Terry Teammate' })).toBeNull(),
    );
    expect(screen.getByText('Showing 2 of 2')).toBeVisible();
    expect(sent).toEqual({ projectId: PROJECT_ID, userId: TERRY.id });
  });

  it('hides every manage action from a plain member', async () => {
    // Arrange
    server.use(...projectScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: projectMembersPath(PROJECT_ID) });

    // Assert
    await screen.findByRole('link', { name: 'Terry Teammate' });
    expect(screen.queryByLabelText('Person')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
  });
});

describe('project settings', () => {
  it('saves the details', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...projectScenario({ project: 'ADMIN' }),
      graphql.mutation('UpdateProject', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            updateProject: {
              __typename: 'Project',
              id: PROJECT_ID,
              name: 'Website v2',
              description: 'The public site.',
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, {
      route: projectSettingsPath(PROJECT_ID),
    });
    const name = await screen.findByLabelText('Name');

    // Act
    await user.clear(name);
    await user.type(name, 'Website v2');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(await screen.findByText('Project details saved.')).toBeVisible();
    expect(sent).toEqual({
      id: PROJECT_ID,
      input: { name: 'Website v2', description: 'The public site.' },
    });
    expect(
      await screen.findByRole('heading', { name: 'Website v2', level: 1 }),
    ).toBeVisible();
  });

  it('shows a network failure as a network failure and keeps what was typed', async () => {
    // Arrange
    server.use(
      ...projectScenario({ project: 'ADMIN' }),
      graphql.mutation('UpdateProject', () => HttpResponse.error()),
    );
    const { user } = renderRoutes(routes, {
      route: projectSettingsPath(PROJECT_ID),
    });
    const name = await screen.findByLabelText('Name');

    // Act
    await user.clear(name);
    await user.type(name, 'Website v2');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Can’t reach the server/,
    );
    expect(screen.getByLabelText('Name')).toHaveValue('Website v2');
  });

  it('says the workflow is stored as-is and not validated', async () => {
    // Arrange
    server.use(...projectScenario({ project: 'ADMIN' }));

    // Act
    renderRoutes(routes, { route: projectSettingsPath(PROJECT_ID) });

    // Assert
    expect(
      await screen.findByText('This is stored as-is and not used yet'),
    ).toBeVisible();
    expect(screen.getByText(/without checking its shape/)).toBeVisible();
  });

  it.each(['{ not json', '[1, 2, 3]', '"text"', '42', 'null'])(
    'refuses %s before sending anything',
    async (text) => {
      // Arrange — no ConfigureWorkflow handler: a request would fail the test.
      server.use(...projectScenario({ project: 'ADMIN' }));
      const { user } = renderRoutes(routes, {
        route: projectSettingsPath(PROJECT_ID),
      });
      const editor = await screen.findByLabelText('Workflow (JSON)');

      // Act
      await user.clear(editor);
      // `[` and `{` are userEvent key syntax; paste delivers them literally.
      await user.click(editor);
      await user.paste(text);
      await user.click(screen.getByRole('button', { name: 'Save workflow' }));

      // Assert
      expect(
        await screen.findByText(/Enter a valid JSON object/),
      ).toBeVisible();
    },
  );

  it('sends a valid workflow as a parsed object', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      ...projectScenario({ project: 'ADMIN', workflow: { columns: [] } }),
      graphql.mutation('ConfigureWorkflow', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            configureWorkflow: {
              __typename: 'Project',
              id: PROJECT_ID,
              settings: {
                __typename: 'ProjectSettings',
                workflow: { columns: ['todo'] },
              },
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, {
      route: projectSettingsPath(PROJECT_ID),
    });
    const editor = await screen.findByLabelText('Workflow (JSON)');
    expect(editor).toHaveValue('{\n  "columns": []\n}');

    // Act
    await user.clear(editor);
    await user.click(editor);
    await user.paste('{ "columns": ["todo"] }');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));

    // Assert
    expect(
      await screen.findByText('Workflow configuration saved.'),
    ).toBeVisible();
    expect(sent).toEqual({
      id: PROJECT_ID,
      workflow: { columns: ['todo'] },
    });
  });

  it('offers deletion only to organisation owners and admins', async () => {
    // Arrange — a project admin may edit and configure, but not delete.
    server.use(...projectScenario({ project: 'ADMIN' }));

    // Act
    renderRoutes(routes, { route: projectSettingsPath(PROJECT_ID) });

    // Assert
    expect(await screen.findByLabelText('Name')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Delete project' })).toBeNull();
  });

  it('deletes only after a confirmation that names the project', async () => {
    // Arrange
    let deleted: unknown;
    server.use(
      ...projectScenario({ org: 'ADMIN', project: null }),
      projectsList([]),
      graphql.mutation('DeleteProject', ({ variables }) => {
        deleted = variables;
        return HttpResponse.json({ data: { deleteProject: true } });
      }),
    );
    const { user, router } = renderRoutes(routes, {
      route: projectSettingsPath(PROJECT_ID),
    });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Delete project' }),
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Delete Website?',
    });
    expect(deleted).toBeUndefined();
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete project' }),
    );

    // Assert
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(organizationPath(ORG_ID)),
    );
    expect(deleted).toEqual({ id: PROJECT_ID });
    expect(
      screen.queryByRole('heading', { name: 'Page not found' }),
    ).toBeNull();
  });

  it('tells a member who opens settings by URL that they cannot edit', async () => {
    // Arrange
    server.use(...projectScenario({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: projectSettingsPath(PROJECT_ID) });

    // Assert
    expect(
      await screen.findByText('You can’t change these details'),
    ).toBeVisible();
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.queryByLabelText('Workflow (JSON)')).toBeNull();
  });
});

describe('workflow parsing', () => {
  it('accepts a JSON object', () => {
    expect(parseWorkflow('{"a": 1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it.each(['', '{', '[]', '"x"', '1', 'true', 'null'])('rejects %s', (text) => {
    expect(parseWorkflow(text)).toEqual({ ok: false });
  });
});

describe('project role resolution', () => {
  const members = [
    { role: 'ADMIN' as const, user: { id: 'a' } },
    { role: 'MEMBER' as const, user: { id: 'm' } },
    { role: 'VIEWER' as const, user: { id: 'v' } },
  ];

  it.each<[string, string, string[]]>([
    ['an admin', 'a', ['PROJECT_ADMIN']],
    ['a member', 'm', ['PROJECT_MEMBER']],
    ['a viewer', 'v', ['VIEWER']],
    ['someone not on the project', 'x', []],
  ])('resolves %s', (_label, viewerId, expected) => {
    expect(resolveProjectRoles(viewerId, [], members)).toEqual(expected);
  });

  it('keeps organisation roles alongside the project role', () => {
    expect(resolveProjectRoles('m', ['ORG_ADMIN'], members)).toEqual([
      'ORG_ADMIN',
      'PROJECT_MEMBER',
    ]);
  });
});

describe('people pickers', () => {
  it('never read the global user directory', () => {
    // The `users` query lists every account in the system (backend
    // known-debt). Pickers must be fed from a scoped membership instead.
    const operations = import.meta.glob('/src/modules/**/*.operations.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    });

    expect(Object.keys(operations).length).toBeGreaterThan(0);
    for (const [file, source] of Object.entries(operations)) {
      expect(String(source), file).not.toMatch(/\busers\s*\(/);
    }
  });
});
