import { HttpResponse } from 'msw';
import { graphql } from '@/shared/tests/graphql';
import { TEST_USER } from '@/shared/tests/session';

/**
 * Test fixtures for the project and team screens: one organisation, one
 * project, one team, and the signed-in user placed in them at whatever roles a
 * test needs.
 */

export const ORG_ID = '11111111-1111-4111-8111-111111111111';
export const PROJECT_ID = '44444444-4444-4444-8444-444444444444';
export const TEAM_ID = '55555555-5555-4555-8555-555555555555';

type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER';
type ProjectRole = 'ADMIN' | 'MEMBER' | 'VIEWER';
type TeamRole = 'LEAD' | 'MEMBER';

export type Person = { id: string; name: string; email: string };

export const VIEWER: Person = {
  id: TEST_USER.id,
  name: TEST_USER.name,
  email: TEST_USER.email,
};
export const OLIVE: Person = {
  id: 'olive',
  name: 'Olive Owner',
  email: 'olive@acme.test',
};
export const PAT: Person = {
  id: 'pat',
  name: 'Pat Project',
  email: 'pat@acme.test',
};
export const TERRY: Person = {
  id: 'terry',
  name: 'Terry Teammate',
  email: 'terry@acme.test',
};
/** In the organisation, but on neither the project nor the team. */
export const NORA: Person = {
  id: 'nora',
  name: 'Nora Newcomer',
  email: 'nora@acme.test',
};

function userNode(person: Person) {
  return { __typename: 'User', ...person, avatarUrl: null };
}

function connection<Node extends { id: string }>(
  typename: string,
  nodes: Node[],
) {
  return {
    __typename: `${typename}Connection`,
    edges: nodes.map((node) => ({
      __typename: `${typename}Edge`,
      cursor: `cursor-${node.id}`,
      node,
    })),
    pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null },
    totalCount: nodes.length,
  };
}

export type Scenario = {
  /** The viewer's role in the organisation, or null if they are not in it. */
  org?: OrgRole | null;
  /** The viewer's role on the project, or null if they are not a member. */
  project?: ProjectRole | null;
  /** The viewer's role on the team, or null if they are not on it. */
  team?: TeamRole | null;
  status?: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  workflow?: Record<string, unknown>;
  /** Drop every team from the project. */
  noTeams?: boolean;
};

function organizationFixture({ org = 'MEMBER' }: Scenario) {
  const viewerOwns = org === 'OWNER';
  const members = [
    {
      __typename: 'OrganizationMember',
      id: 'om-owner',
      role: 'OWNER',
      createdAt: '2026-09-01T10:00:00.000Z',
      user: userNode(viewerOwns ? VIEWER : OLIVE),
    },
    ...(viewerOwns || org === null
      ? []
      : [
          {
            __typename: 'OrganizationMember',
            id: 'om-viewer',
            role: org,
            createdAt: '2026-09-01T10:00:00.000Z',
            user: userNode(VIEWER),
          },
        ]),
    ...[PAT, TERRY, NORA].map((person) => ({
      __typename: 'OrganizationMember',
      id: `om-${person.id}`,
      role: 'MEMBER',
      createdAt: '2026-09-01T10:00:00.000Z',
      user: userNode(person),
    })),
  ];

  return {
    __typename: 'Organization',
    id: ORG_ID,
    name: 'Acme Inc.',
    description: null,
    logoUrl: null,
    memberCount: members.length,
    projectCount: 1,
    owner: {
      __typename: 'User',
      id: viewerOwns ? VIEWER.id : OLIVE.id,
      name: viewerOwns ? VIEWER.name : OLIVE.name,
    },
    members: connection('OrganizationMember', members),
  };
}

export function projectMember(person: Person, role: ProjectRole) {
  return {
    __typename: 'ProjectMember',
    id: `pm-${person.id}`,
    role,
    createdAt: '2026-09-02T10:00:00.000Z',
    user: userNode(person),
  };
}

function teamSummary({ team = null }: Scenario) {
  return {
    __typename: 'Team',
    id: TEAM_ID,
    name: 'Platform',
    description: 'Keeps the lights on.',
    memberCount: team ? 2 : 1,
    members: [
      {
        __typename: 'TeamMember',
        id: 'tm-terry',
        role: 'MEMBER',
        user: { __typename: 'User', id: TERRY.id },
      },
      ...(team
        ? [
            {
              __typename: 'TeamMember',
              id: 'tm-viewer',
              role: team,
              user: { __typename: 'User', id: VIEWER.id },
            },
          ]
        : []),
    ],
  };
}

export function projectFixture(scenario: Scenario = {}) {
  const { project = 'MEMBER', status = 'ACTIVE', workflow = {} } = scenario;
  const members = [
    projectMember(PAT, 'ADMIN'),
    projectMember(TERRY, 'MEMBER'),
    ...(project ? [projectMember(VIEWER, project)] : []),
  ];
  const teams = scenario.noTeams ? [] : [teamSummary(scenario)];

  return {
    __typename: 'Project',
    id: PROJECT_ID,
    name: 'Website',
    description: 'The public site.',
    status,
    organizationId: ORG_ID,
    memberCount: members.length,
    teamCount: teams.length,
    settings: { __typename: 'ProjectSettings', workflow },
    members: connection('ProjectMember', members),
    teams,
  };
}

export function teamMember(
  person: Person,
  role: TeamRole,
  overrides: Record<string, unknown> = {},
) {
  return {
    __typename: 'TeamMember',
    id: `tm-${person.id === VIEWER.id ? 'viewer' : person.id}`,
    role,
    responsibilities: null,
    availability: 'AVAILABLE',
    workload: 3,
    createdAt: '2026-09-03T10:00:00.000Z',
    user: userNode(person),
    ...overrides,
  };
}

export function teamFixture({ team = null }: Scenario = {}) {
  const members = [
    teamMember(TERRY, 'MEMBER', {
      responsibilities: 'On-call rota',
      availability: 'BUSY',
      workload: 7,
    }),
    ...(team ? [teamMember(VIEWER, team)] : []),
  ];

  return {
    __typename: 'Team',
    id: TEAM_ID,
    name: 'Platform',
    description: 'Keeps the lights on.',
    projectId: PROJECT_ID,
    memberCount: members.length,
    members,
  };
}

/**
 * Handlers for the project frame: the project, and the organisation it reads
 * for the viewer's organisation-level roles. A viewer outside the organisation
 * is refused that second read, as the real API would.
 */
export function projectScenario(scenario: Scenario = {}) {
  return [
    graphql.query('Project', () =>
      HttpResponse.json({ data: { project: projectFixture(scenario) } }),
    ),
    graphql.query('Organization', () =>
      scenario.org === null
        ? HttpResponse.json({
            errors: [
              { message: 'not a member', extensions: { code: 'FORBIDDEN' } },
            ],
            data: null,
          })
        : HttpResponse.json({
            data: { organization: organizationFixture(scenario) },
          }),
    ),
  ];
}

export function teamScenario(scenario: Scenario = {}) {
  return [
    ...projectScenario(scenario),
    graphql.query('Team', () =>
      HttpResponse.json({ data: { team: teamFixture(scenario) } }),
    ),
  ];
}
