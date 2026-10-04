import { HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ErrorCode } from '@contracts';
import { routes } from '@/App';
import {
  inviteSchema,
  organizationSchema,
} from '@/modules/organization/schemas/organization.schema';
import { resolveOrganizationRoles } from '@/modules/organization/utils/organization.utils';
import {
  ROUTES,
  organizationInvitationsPath,
  organizationMembersPath,
  organizationPath,
  organizationSettingsPath,
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
import { TEST_USER, signedIn } from '@/shared/tests/session';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222';

type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER';

function memberRow(id: string, name: string, role: OrgRole, userId = id) {
  return {
    __typename: 'OrganizationMember',
    id: `member-${id}`,
    role,
    createdAt: '2026-09-01T10:00:00.000Z',
    user: {
      __typename: 'User',
      id: userId,
      name,
      email: `${name.split(' ')[0]?.toLowerCase()}@acme.test`,
      avatarUrl: null,
    },
  };
}

const OWNER = memberRow('owner', 'Olive Owner', 'OWNER');
const ALEX = memberRow('alex', 'Alex Admin', 'ADMIN');
const MORGAN = memberRow('morgan', 'Morgan Member', 'MEMBER');

/** The signed-in user's own row, at the role a test needs. */
function viewerRow(role: OrgRole) {
  return memberRow('viewer', TEST_USER.name, role, TEST_USER.id);
}

function organization(
  viewerRole: OrgRole,
  members = [OWNER, viewerRow(viewerRole), MORGAN],
) {
  const owner =
    viewerRole === 'OWNER'
      ? { __typename: 'User', id: TEST_USER.id, name: TEST_USER.name }
      : { __typename: 'User', id: OWNER.user.id, name: OWNER.user.name };
  const rows =
    viewerRole === 'OWNER' ? [viewerRow('OWNER'), ALEX, MORGAN] : members;

  return {
    __typename: 'Organization',
    id: ORG_ID,
    name: 'Acme Inc.',
    description: 'Rockets and anvils.',
    logoUrl: null,
    memberCount: rows.length,
    projectCount: 2,
    owner,
    members: {
      __typename: 'OrganizationMemberConnection',
      edges: rows.map((node) => ({
        __typename: 'OrganizationMemberEdge',
        cursor: `cursor-${node.id}`,
        node,
      })),
      pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null },
      totalCount: rows.length,
    },
  };
}

function organizationAs(viewerRole: OrgRole) {
  return graphql.query('Organization', () =>
    HttpResponse.json({ data: { organization: organization(viewerRole) } }),
  );
}

// The server's own wording, which must never reach the screen.
const SERVER_DETAIL = 'internal reason';

function queryFails(name: string, code: ErrorCode) {
  return mockQueryError(name, code, SERVER_DETAIL);
}

function mutationFails(name: string, code: ErrorCode) {
  return mockMutationError(name, code, SERVER_DETAIL);
}

function project(id: string, name: string, status: string) {
  return {
    __typename: 'Project',
    id,
    name,
    description: null,
    status,
    memberCount: 3,
  };
}

function projectsResponse(nodes: ReturnType<typeof project>[]) {
  return {
    data: {
      organization: {
        __typename: 'Organization',
        id: ORG_ID,
        projects: {
          __typename: 'ProjectConnection',
          edges: nodes.map((node) => ({
            __typename: 'ProjectEdge',
            cursor: `cursor-${node.id}`,
            node,
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
  };
}

function projectsByStatus() {
  return graphql.query('OrganizationProjects', ({ variables }) => {
    const all = [
      project('p1', 'Website', 'ACTIVE'),
      project('p2', 'Mobile app', 'PLANNING'),
    ];
    const status = variables['status'] as string | null;

    return HttpResponse.json(
      projectsResponse(
        status ? all.filter((node) => node.status === status) : all,
      ),
    );
  });
}

function listItem(id: string, name: string) {
  return {
    __typename: 'Organization',
    id,
    name,
    description: null,
    logoUrl: null,
    memberCount: 1,
    projectCount: 0,
  };
}

function organizationsPage(
  nodes: ReturnType<typeof listItem>[],
  page: { hasNextPage: boolean; endCursor: string | null; totalCount: number },
) {
  return {
    data: {
      myOrganizations: {
        __typename: 'OrganizationConnection',
        edges: nodes.map((node) => ({
          __typename: 'OrganizationEdge',
          cursor: `cursor-${node.id}`,
          node,
        })),
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: page.hasNextPage,
          endCursor: page.endCursor,
        },
        totalCount: page.totalCount,
      },
    },
  };
}

function invitation(id: string, email: string, status: string) {
  return {
    __typename: 'OrganizationInvitation',
    id,
    email,
    role: 'MEMBER',
    status,
    expiresAt: '2026-10-11T10:00:00.000Z',
    createdAt: '2026-10-04T10:00:00.000Z',
  };
}

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
  server.use(...signedIn());
});

describe('organisation list', () => {
  it('lists the organisations the user belongs to', async () => {
    // Arrange
    server.use(
      graphql.query('MyOrganizations', () =>
        HttpResponse.json(
          organizationsPage(
            [listItem(ORG_ID, 'Acme Inc.'), listItem(OTHER_ORG_ID, 'Globex')],
            { hasNextPage: false, endCursor: null, totalCount: 2 },
          ),
        ),
      ),
    );

    // Act
    renderRoutes(routes, { route: ROUTES.organizations });

    // Assert
    expect(
      await screen.findByRole('link', { name: /Acme Inc\./ }),
    ).toHaveAttribute('href', organizationPath(ORG_ID));
    expect(screen.getByRole('link', { name: /Globex/ })).toBeVisible();
    expect(screen.getByText('Showing 2 of 2')).toBeVisible();
  });

  it('pages past the first page, appending rather than replacing', async () => {
    // Arrange
    const requested: Array<{ first: unknown; after: unknown }> = [];
    server.use(
      graphql.query('MyOrganizations', ({ variables }) => {
        requested.push({
          first: variables['first'],
          after: variables['after'],
        });

        return HttpResponse.json(
          variables['after'] === 'cursor-page-1'
            ? organizationsPage([listItem(OTHER_ORG_ID, 'Globex')], {
                hasNextPage: false,
                endCursor: null,
                totalCount: 2,
              })
            : organizationsPage([listItem(ORG_ID, 'Acme Inc.')], {
                hasNextPage: true,
                endCursor: 'cursor-page-1',
                totalCount: 2,
              }),
        );
      }),
    );
    const { user } = renderRoutes(routes, { route: ROUTES.organizations });
    await screen.findByText('Showing 1 of 2');

    // Act
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    // Assert
    expect(await screen.findByRole('link', { name: /Globex/ })).toBeVisible();
    expect(screen.getByRole('link', { name: /Acme Inc\./ })).toBeVisible();
    expect(screen.getByText('Showing 2 of 2')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    // The cursor goes back exactly as received, and no page asks for over 100.
    expect(requested[1]?.after).toBe('cursor-page-1');
    for (const request of requested) {
      expect(Number(request.first)).toBeLessThanOrEqual(100);
    }
  });

  it('shows an empty state with a way to create the first one', async () => {
    // Arrange
    server.use(
      graphql.query('MyOrganizations', () =>
        HttpResponse.json(
          organizationsPage([], {
            hasNextPage: false,
            endCursor: null,
            totalCount: 0,
          }),
        ),
      ),
    );

    // Act
    renderRoutes(routes, { route: ROUTES.organizations });

    // Assert
    expect(
      await screen.findByText(/You’re not part of an organisation yet/),
    ).toBeVisible();
    expect(
      screen.getAllByRole('button', { name: 'New organisation' }),
    ).toHaveLength(2);
  });

  it('resolves a network failure into an error with a retry', async () => {
    // Arrange
    let attempts = 0;
    server.use(
      graphql.query('MyOrganizations', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json(
              organizationsPage([listItem(ORG_ID, 'Acme Inc.')], {
                hasNextPage: false,
                endCursor: null,
                totalCount: 1,
              }),
            );
      }),
    );
    const { user } = renderRoutes(routes, { route: ROUTES.organizations });

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Can’t reach the server/,
    );

    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(
      await screen.findByRole('link', { name: /Acme Inc\./ }),
    ).toBeVisible();
  });
});

describe('create organisation', () => {
  function emptyList() {
    return graphql.query('MyOrganizations', () =>
      HttpResponse.json(
        organizationsPage([], {
          hasNextPage: false,
          endCursor: null,
          totalCount: 0,
        }),
      ),
    );
  }

  async function openDialog(user: ReturnType<typeof renderRoutes>['user']) {
    const [button] = await screen.findAllByRole('button', {
      name: 'New organisation',
    });
    await user.click(button as HTMLElement);
    return screen.findByRole('dialog', { name: 'Create an organisation' });
  }

  it('creates the organisation and opens it', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      emptyList(),
      organizationAs('OWNER'),
      projectsByStatus(),
      graphql.mutation('CreateOrganization', ({ variables }) => {
        sent = variables['input'];
        return HttpResponse.json({
          data: { createOrganization: listItem(ORG_ID, 'Acme Inc.') },
        });
      }),
    );
    const { user, router } = renderRoutes(routes, {
      route: ROUTES.organizations,
    });
    const dialog = await openDialog(user);

    // Act
    await user.type(within(dialog).getByLabelText('Name'), '  Acme Inc.  ');
    await user.click(
      within(dialog).getByRole('button', { name: 'Create organisation' }),
    );

    // Assert
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(organizationPath(ORG_ID)),
    );
    // Trimmed, and blank optional fields sent as null rather than "".
    expect(sent).toEqual({
      name: 'Acme Inc.',
      description: null,
      logoUrl: null,
    });
    expect(
      await screen.findByText('Acme Inc. has been created.'),
    ).toBeVisible();
  });

  it('validates before sending anything', async () => {
    // Arrange
    let calls = 0;
    server.use(
      emptyList(),
      graphql.mutation('CreateOrganization', () => {
        calls += 1;
        return HttpResponse.json({ data: null });
      }),
    );
    const { user } = renderRoutes(routes, { route: ROUTES.organizations });
    const dialog = await openDialog(user);

    // Act
    await user.type(within(dialog).getByLabelText('Logo URL'), 'not a link');
    await user.click(
      within(dialog).getByRole('button', { name: 'Create organisation' }),
    );

    // Assert
    expect(await within(dialog).findByText('Enter a name.')).toBeVisible();
    expect(
      within(dialog).getByText('Enter a full link, starting with https://.'),
    ).toBeVisible();
    expect(calls).toBe(0);
  });

  it('shows a server rejection as a form-level error', async () => {
    // Arrange
    server.use(
      emptyList(),
      mutationFails('CreateOrganization', 'BAD_USER_INPUT'),
    );
    const { user } = renderRoutes(routes, { route: ROUTES.organizations });
    const dialog = await openDialog(user);

    // Act
    await user.type(within(dialog).getByLabelText('Name'), 'Acme Inc.');
    await user.click(
      within(dialog).getByRole('button', { name: 'Create organisation' }),
    );

    // Assert
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Some of the details below need fixing.');
    expect(alert).not.toHaveTextContent('internal reason');
  });
});

describe('organisation frame', () => {
  it('names the organisation in the heading and the breadcrumb', async () => {
    // Arrange
    server.use(organizationAs('OWNER'), projectsByStatus());

    // Act
    renderRoutes(routes, { route: organizationPath(ORG_ID) });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Acme Inc.', level: 1 }),
    ).toBeVisible();
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    await waitFor(() =>
      expect(
        within(trail)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual(['Home', 'Organisations', 'Acme Inc.']),
    );
  });

  it('offers the admin tabs to an owner', async () => {
    // Arrange
    server.use(organizationAs('OWNER'), projectsByStatus());

    // Act
    renderRoutes(routes, { route: organizationPath(ORG_ID) });

    // Assert
    const tabs = await screen.findByRole('navigation', {
      name: 'Organisation sections',
    });
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Projects', 'Members', 'Invitations', 'Settings']);
    expect(
      within(tabs).getByRole('link', { name: 'Projects' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('hides the admin tabs from a plain member', async () => {
    // Arrange
    server.use(organizationAs('MEMBER'), projectsByStatus());

    // Act
    renderRoutes(routes, { route: organizationPath(ORG_ID) });

    // Assert
    const tabs = await screen.findByRole('navigation', {
      name: 'Organisation sections',
    });
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Projects', 'Members']);
  });

  it('renders Forbidden when the server refuses the organisation', async () => {
    // Arrange
    server.use(queryFails('Organization', 'FORBIDDEN'));

    // Act
    renderRoutes(routes, { route: organizationPath(ORG_ID) });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'You don’t have access' }),
    ).toBeVisible();
    expect(screen.queryByText('internal reason')).toBeNull();
  });

  it('renders Not Found for an id that does not exist', async () => {
    // Arrange
    server.use(queryFails('Organization', 'NOT_FOUND'));

    // Act
    renderRoutes(routes, { route: organizationPath(ORG_ID) });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
  });

  it('renders Not Found for a malformed id without asking the server', async () => {
    // Arrange — no Organization handler: a request would fail the test.

    // Act
    renderRoutes(routes, { route: organizationPath('not-an-id') });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
  });
});

describe('organisation projects', () => {
  it('lists projects with their status', async () => {
    // Arrange
    server.use(organizationAs('MEMBER'), projectsByStatus());

    // Act
    renderRoutes(routes, { route: organizationPath(ORG_ID) });

    // Assert
    const websiteRow = (await screen.findByText('Website')).closest('tr');
    expect(within(websiteRow as HTMLElement).getByText('Active')).toBeVisible();
    const mobileRow = screen.getByText('Mobile app').closest('tr');
    expect(
      within(mobileRow as HTMLElement).getByText('Planning'),
    ).toBeVisible();
  });

  it('distinguishes "none yet" from "none in this status"', async () => {
    // Arrange — one project exists, and it is ACTIVE.
    server.use(
      organizationAs('MEMBER'),
      graphql.query('OrganizationProjects', ({ variables }) =>
        HttpResponse.json(
          projectsResponse(
            variables['status'] === 'ARCHIVED'
              ? []
              : [project('p1', 'Website', 'ACTIVE')],
          ),
        ),
      ),
    );
    const { user } = renderRoutes(routes, { route: organizationPath(ORG_ID) });
    await screen.findByText('Website');

    // Act
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Archived' }));

    // Assert
    expect(await screen.findByText('No projects are Archived.')).toBeVisible();
    expect(
      screen.queryByText('This organisation has no projects yet.'),
    ).toBeNull();
  });

  it('says so when the organisation has no projects at all', async () => {
    // Arrange
    server.use(
      organizationAs('MEMBER'),
      graphql.query('OrganizationProjects', () =>
        HttpResponse.json(projectsResponse([])),
      ),
    );

    // Act
    renderRoutes(routes, { route: organizationPath(ORG_ID) });

    // Assert
    expect(
      await screen.findByText('This organisation has no projects yet.'),
    ).toBeVisible();
  });
});

describe('organisation members', () => {
  it('shows the owner as immutable and lets an owner manage everyone else', async () => {
    // Arrange
    server.use(organizationAs('OWNER'));

    // Act
    renderRoutes(routes, { route: organizationMembersPath(ORG_ID) });

    // Assert
    const ownerRow = (
      await screen.findByText(TEST_USER.name, { selector: 'a' })
    ).closest('tr') as HTMLElement;
    expect(within(ownerRow).getByText('Owner')).toBeVisible();
    expect(within(ownerRow).queryByRole('combobox')).toBeNull();
    expect(
      within(ownerRow).queryByRole('button', { name: /Remove/ }),
    ).toBeNull();

    const alexRow = screen
      .getByRole('link', { name: 'Alex Admin' })
      .closest('tr') as HTMLElement;
    expect(
      within(alexRow).getByRole('combobox', { name: 'Role for Alex Admin' }),
    ).toBeVisible();
    expect(
      within(alexRow).getByRole('button', { name: 'Remove Alex Admin' }),
    ).toBeVisible();
  });

  it('hides every manage action from a plain member', async () => {
    // Arrange
    server.use(organizationAs('MEMBER'));

    // Act
    renderRoutes(routes, { route: organizationMembersPath(ORG_ID) });

    // Assert
    await screen.findByText('Morgan Member');
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
  });

  it('changes a role through the cache, without refetching the organisation', async () => {
    // Arrange
    let organizationRequests = 0;
    let sent: unknown;
    server.use(
      graphql.query('Organization', () => {
        organizationRequests += 1;
        return HttpResponse.json({
          data: { organization: organization('OWNER') },
        });
      }),
      graphql.mutation('UpdateMemberRole', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            updateMemberRole: {
              __typename: 'OrganizationMember',
              id: MORGAN.id,
              role: 'ADMIN',
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, {
      route: organizationMembersPath(ORG_ID),
    });
    const select = await screen.findByRole('combobox', {
      name: 'Role for Morgan Member',
    });
    expect(select).toHaveTextContent('Member');

    // Act
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: 'Admin' }));

    // Assert
    expect(
      await screen.findByText('Morgan Member is now Admin.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Role for Morgan Member' }),
      ).toHaveTextContent('Admin'),
    );
    expect(sent).toEqual({
      organizationId: ORG_ID,
      userId: MORGAN.user.id,
      role: 'ADMIN',
    });
    expect(organizationRequests).toBe(1);
  });

  it('explains a refused role change and leaves the role as it was', async () => {
    // Arrange — the hint showed the control, the server still said no.
    server.use(
      organizationAs('OWNER'),
      mutationFails('UpdateMemberRole', 'FORBIDDEN'),
    );
    const { user } = renderRoutes(routes, {
      route: organizationMembersPath(ORG_ID),
    });
    const select = await screen.findByRole('combobox', {
      name: 'Role for Morgan Member',
    });

    // Act
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: 'Admin' }));

    // Assert
    expect(
      await screen.findByText('You don’t have permission to do that.'),
    ).toBeVisible();
    expect(
      screen.getByRole('combobox', { name: 'Role for Morgan Member' }),
    ).toHaveTextContent('Member');
  });

  it('removes a member only after a confirmation that names them', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      organizationAs('OWNER'),
      graphql.mutation('RemoveMember', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({ data: { removeMember: true } });
      }),
    );
    const { user } = renderRoutes(routes, {
      route: organizationMembersPath(ORG_ID),
    });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Remove Morgan Member' }),
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Remove Morgan Member?',
    });

    // Assert — nothing has been sent yet, and the target is spelled out.
    expect(sent).toBeUndefined();
    expect(dialog).toHaveTextContent(
      'Morgan Member will lose access to Acme Inc. and everything in it.',
    );

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    // Assert
    expect(
      await screen.findByText('Morgan Member has been removed.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Morgan Member' })).toBeNull(),
    );
    expect(screen.getByText('Showing 2 of 2')).toBeVisible();
    expect(sent).toEqual({ organizationId: ORG_ID, userId: MORGAN.user.id });
  });

  it('keeps the member when removal fails', async () => {
    // Arrange
    server.use(
      organizationAs('OWNER'),
      graphql.mutation('RemoveMember', () => HttpResponse.error()),
    );
    const { user } = renderRoutes(routes, {
      route: organizationMembersPath(ORG_ID),
    });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Remove Morgan Member' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    // Assert
    expect(await screen.findByText(/Can’t reach the server/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Morgan Member' })).toBeVisible();
  });
});

describe('organisation invitations', () => {
  function invitationsAre(rows: ReturnType<typeof invitation>[]) {
    return graphql.query('OrganizationInvitations', () =>
      HttpResponse.json({ data: { organizationInvitations: rows } }),
    );
  }

  it('lists invitations with a distinct label per status', async () => {
    // Arrange
    server.use(
      organizationAs('OWNER'),
      invitationsAre([
        invitation('i1', 'pending@acme.test', 'PENDING'),
        invitation('i2', 'accepted@acme.test', 'ACCEPTED'),
        invitation('i3', 'revoked@acme.test', 'REVOKED'),
        invitation('i4', 'expired@acme.test', 'EXPIRED'),
      ]),
    );

    // Act
    renderRoutes(routes, { route: organizationInvitationsPath(ORG_ID) });

    // Assert
    const expected: Array<[string, string]> = [
      ['pending@acme.test', 'Pending'],
      ['accepted@acme.test', 'Accepted'],
      ['revoked@acme.test', 'Revoked'],
      ['expired@acme.test', 'Expired'],
    ];
    for (const [email, label] of expected) {
      const row = (await screen.findByRole('cell', { name: email })).closest(
        'tr',
      ) as HTMLElement;
      expect(within(row).getByText(label)).toBeVisible();
    }
    // Only an open invitation can be revoked.
    expect(screen.getAllByRole('button', { name: /^Revoke/ })).toHaveLength(1);
  });

  it('says plainly that invitations are not delivered', async () => {
    // Arrange
    server.use(organizationAs('OWNER'), invitationsAre([]));

    // Act
    renderRoutes(routes, { route: organizationInvitationsPath(ORG_ID) });

    // Assert
    expect(
      await screen.findByText('Invitations are not delivered yet'),
    ).toBeVisible();
    expect(screen.getByText('No one has been invited yet.')).toBeVisible();
    expect(
      screen.queryByText(/we(’| ha)ve sent|check their inbox/i),
    ).toBeNull();
  });

  it('records an invitation and shows it in the list', async () => {
    // Arrange
    const rows: ReturnType<typeof invitation>[] = [];
    let sent: unknown;
    server.use(
      organizationAs('OWNER'),
      graphql.query('OrganizationInvitations', () =>
        HttpResponse.json({ data: { organizationInvitations: [...rows] } }),
      ),
      graphql.mutation('InviteToOrganization', ({ variables }) => {
        sent = variables;
        const created = invitation('i9', 'new@acme.test', 'PENDING');
        rows.push(created);
        return HttpResponse.json({ data: { inviteToOrganization: created } });
      }),
    );
    const { user } = renderRoutes(routes, {
      route: organizationInvitationsPath(ORG_ID),
    });

    // Act
    await user.type(await screen.findByLabelText('Email'), '  New@Acme.test ');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    // Assert
    expect(
      await screen.findByRole('cell', { name: 'new@acme.test' }),
    ).toBeVisible();
    // Normalised the way the server does it.
    expect(sent).toEqual({
      organizationId: ORG_ID,
      input: { email: 'new@acme.test', role: 'MEMBER' },
    });
    expect(screen.getByLabelText('Email')).toHaveValue('');
  });

  it('rejects an invalid email before sending anything', async () => {
    // Arrange
    let calls = 0;
    server.use(
      organizationAs('OWNER'),
      invitationsAre([]),
      graphql.mutation('InviteToOrganization', () => {
        calls += 1;
        return HttpResponse.json({ data: null });
      }),
    );
    const { user } = renderRoutes(routes, {
      route: organizationInvitationsPath(ORG_ID),
    });

    // Act
    await user.type(await screen.findByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    // Assert
    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeVisible();
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(calls).toBe(0);
  });

  it.each<[ErrorCode, string]>([
    ['BAD_USER_INPUT', 'Some of the details below need fixing.'],
    ['FORBIDDEN', 'You don’t have permission to do that.'],
    [
      'CONFLICT',
      'That person is already a member, or already has a pending invitation.',
    ],
  ])('explains a %s from the server', async (code, message) => {
    // Arrange
    server.use(
      organizationAs('OWNER'),
      invitationsAre([]),
      mutationFails('InviteToOrganization', code),
    );
    const { user } = renderRoutes(routes, {
      route: organizationInvitationsPath(ORG_ID),
    });

    // Act
    await user.type(await screen.findByLabelText('Email'), 'new@acme.test');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    // Assert
    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.queryByText('internal reason')).toBeNull();
    // The address stays in the field so it can be corrected, not retyped.
    expect(screen.getByLabelText('Email')).toHaveValue('new@acme.test');
  });

  it('shows a network failure as a network failure', async () => {
    // Arrange
    server.use(
      organizationAs('OWNER'),
      invitationsAre([]),
      graphql.mutation('InviteToOrganization', () => HttpResponse.error()),
    );
    const { user } = renderRoutes(routes, {
      route: organizationInvitationsPath(ORG_ID),
    });

    // Act
    await user.type(await screen.findByLabelText('Email'), 'new@acme.test');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    // Assert
    expect(await screen.findByText(/Can’t reach the server/)).toBeVisible();
  });

  it('revokes only after a confirmation that names the address', async () => {
    // Arrange
    let revoked: unknown;
    let rows = [invitation('i1', 'pending@acme.test', 'PENDING')];
    server.use(
      organizationAs('OWNER'),
      graphql.query('OrganizationInvitations', () =>
        HttpResponse.json({ data: { organizationInvitations: rows } }),
      ),
      graphql.mutation('RevokeInvitation', ({ variables }) => {
        revoked = variables;
        rows = [invitation('i1', 'pending@acme.test', 'REVOKED')];
        return HttpResponse.json({ data: { revokeInvitation: true } });
      }),
    );
    const { user } = renderRoutes(routes, {
      route: organizationInvitationsPath(ORG_ID),
    });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Revoke pending@acme.test' }),
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Revoke the invitation for pending@acme.test?',
    });
    expect(revoked).toBeUndefined();
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    // Assert
    const row = (await screen.findByText('Revoked')).closest(
      'tr',
    ) as HTMLElement;
    expect(within(row).getByText('pending@acme.test')).toBeVisible();
    expect(revoked).toEqual({ invitationId: 'i1' });
  });

  it('renders Forbidden when a member opens the tab by URL', async () => {
    // Arrange — the tab is hidden from members; the address bar is not.
    server.use(
      organizationAs('MEMBER'),
      queryFails('OrganizationInvitations', 'FORBIDDEN'),
    );

    // Act
    renderRoutes(routes, { route: organizationInvitationsPath(ORG_ID) });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'You don’t have access' }),
    ).toBeVisible();
  });
});

describe('organisation settings', () => {
  it('saves the details', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      organizationAs('OWNER'),
      graphql.mutation('UpdateOrganization', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            updateOrganization: {
              __typename: 'Organization',
              id: ORG_ID,
              name: 'Acme Corp',
              description: 'Rockets and anvils.',
              logoUrl: null,
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, {
      route: organizationSettingsPath(ORG_ID),
    });
    const name = await screen.findByLabelText('Name');

    // Act
    await user.clear(name);
    await user.type(name, 'Acme Corp');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(
      await screen.findByText('Organisation details saved.'),
    ).toBeVisible();
    expect(sent).toEqual({
      id: ORG_ID,
      input: {
        name: 'Acme Corp',
        description: 'Rockets and anvils.',
        logoUrl: null,
      },
    });
    // The heading follows from the cache, with no refetch.
    expect(
      await screen.findByRole('heading', { name: 'Acme Corp', level: 1 }),
    ).toBeVisible();
  });

  it('offers deletion to the owner only', async () => {
    // Arrange
    server.use(organizationAs('ADMIN'));

    // Act
    renderRoutes(routes, { route: organizationSettingsPath(ORG_ID) });

    // Assert — an admin may edit, but not delete.
    expect(await screen.findByLabelText('Name')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Delete organisation' }),
    ).toBeNull();
  });

  it('tells a member who opens settings by URL that they cannot edit', async () => {
    // Arrange
    server.use(organizationAs('MEMBER'));

    // Act
    renderRoutes(routes, { route: organizationSettingsPath(ORG_ID) });

    // Assert
    expect(
      await screen.findByText('You can’t change these settings'),
    ).toBeVisible();
    expect(screen.queryByLabelText('Name')).toBeNull();
  });

  it('deletes only after a confirmation that names the organisation', async () => {
    // Arrange
    let deleted: unknown;
    server.use(
      organizationAs('OWNER'),
      graphql.query('MyOrganizations', () =>
        HttpResponse.json(
          organizationsPage([], {
            hasNextPage: false,
            endCursor: null,
            totalCount: 0,
          }),
        ),
      ),
      graphql.mutation('DeleteOrganization', ({ variables }) => {
        deleted = variables;
        return HttpResponse.json({ data: { deleteOrganization: true } });
      }),
    );
    const { user, router } = renderRoutes(routes, {
      route: organizationSettingsPath(ORG_ID),
    });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Delete organisation' }),
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Delete Acme Inc.?',
    });
    expect(deleted).toBeUndefined();
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete organisation' }),
    );

    // Assert
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(ROUTES.organizations),
    );
    expect(deleted).toEqual({ id: ORG_ID });
    expect(
      await screen.findByText(/You’re not part of an organisation yet/),
    ).toBeVisible();
    // Leaving must not pass through the Not Found screen.
    expect(
      screen.queryByRole('heading', { name: 'Page not found' }),
    ).toBeNull();
  });

  it('stays put and explains when deletion is refused', async () => {
    // Arrange
    server.use(
      organizationAs('OWNER'),
      mutationFails('DeleteOrganization', 'FORBIDDEN'),
    );
    const { user, router } = renderRoutes(routes, {
      route: organizationSettingsPath(ORG_ID),
    });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Delete organisation' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete organisation' }),
    );

    // Assert
    expect(
      await screen.findByText('You don’t have permission to do that.'),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(
      organizationSettingsPath(ORG_ID),
    );
  });
});

describe('organisation validation', () => {
  // Mirrors apps/backend/src/modules/organization/organization.validation.ts.
  it.each<[string, string, boolean]>([
    ['blank', '   ', false],
    ['one character', 'A', true],
    ['exactly 120', 'a'.repeat(120), true],
    ['121 characters', 'a'.repeat(121), false],
  ])('name: %s', (_label, name, valid) => {
    const result = organizationSchema.safeParse({
      name,
      description: '',
      logoUrl: '',
    });

    expect(result.success).toBe(valid);
  });

  it('sends blank optional fields as null', () => {
    const parsed = organizationSchema.parse({
      name: 'Acme',
      description: '   ',
      logoUrl: '',
    });

    expect(parsed).toEqual({ name: 'Acme', description: null, logoUrl: null });
  });

  it('accepts a full link and rejects a bare word as the logo', () => {
    const base = { name: 'Acme', description: '' };

    expect(
      organizationSchema.safeParse({ ...base, logoUrl: 'https://a.test/x.png' })
        .success,
    ).toBe(true);
    expect(
      organizationSchema.safeParse({ ...base, logoUrl: 'logo' }).success,
    ).toBe(false);
  });

  it('never lets an invitation grant ownership', () => {
    expect(
      inviteSchema.safeParse({ email: 'a@b.co', role: 'OWNER' }).success,
    ).toBe(false);
  });
});

describe('viewer role resolution', () => {
  const members = [
    { role: 'OWNER' as const, user: { id: 'o' } },
    { role: 'ADMIN' as const, user: { id: 'a' } },
    { role: 'MEMBER' as const, user: { id: 'm' } },
  ];

  it.each<[string, string, string[]]>([
    ['the owner', 'o', ['ORG_OWNER']],
    ['an admin', 'a', ['ORG_ADMIN']],
    ['a member', 'm', ['ORG_MEMBER']],
  ])('resolves %s', (_label, viewerId, expected) => {
    expect(resolveOrganizationRoles(viewerId, 'o', members)).toEqual(expected);
  });

  it('assumes the least privilege when the viewer’s row is not loaded', () => {
    // The member list is paginated; a guess must never widen what is offered.
    expect(resolveOrganizationRoles('unloaded', 'o', members)).toEqual([
      'ORG_MEMBER',
    ]);
  });

  it('grants nothing without a signed-in viewer', () => {
    expect(resolveOrganizationRoles(undefined, 'o', members)).toEqual([]);
  });
});
