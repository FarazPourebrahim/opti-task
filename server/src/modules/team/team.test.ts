import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { prisma } from '@shared/db';

/**
 * Team module integration tests: teams under projects, member attributes for AI
 * consumption (role/responsibilities/availability/workload), and RBAC.
 * Requires Postgres via DATABASE_URL.
 */
const domain = '@p6team.test';
const TAG = `p6t_${Date.now()}`;

let app: Express;
let ownerToken = '';
let outsiderToken = '';
let memberId = '';
let projectId = '';

type GqlBody = {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
};

async function gql(
  query: string,
  variables: Record<string, unknown>,
  authToken: string,
): Promise<GqlBody> {
  const req = request(app).post('/graphql');
  if (authToken) {
    req.set('Authorization', `Bearer ${authToken}`);
  }
  const response = await req.send({ query, variables });
  return response.body as GqlBody;
}

async function register(tag: string): Promise<{ token: string; id: string }> {
  const body = await gql(
    /* GraphQL */ `
      mutation ($input: RegisterInput!) {
        register(input: $input) { accessToken user { id } }
      }
    `,
    { input: { email: `${tag}-${TAG}${domain}`, name: tag, password: 'secret123' } },
    '',
  );
  const reg = body.data?.register as { accessToken: string; user: { id: string } };
  return { token: reg.accessToken, id: reg.user.id };
}

async function createTeam(name: string): Promise<string> {
  const body = await gql(
    /* GraphQL */ `
      mutation ($projectId: UUID!, $input: CreateTeamInput!) {
        createTeam(projectId: $projectId, input: $input) { id }
      }
    `,
    { projectId, input: { name } },
    ownerToken,
  );
  return (body.data?.createTeam as { id: string }).id;
}

beforeAll(async () => {
  app = await createApp();
  const owner = await register('owner');
  ownerToken = owner.token;
  const outsider = await register('outsider');
  outsiderToken = outsider.token;
  const member = await register('member');
  memberId = member.id;

  const org = await gql(
    /* GraphQL */ `mutation ($input: CreateOrganizationInput!) { createOrganization(input: $input) { id } }`,
    { input: { name: `${TAG}-org` } },
    ownerToken,
  );
  const orgId = (org.data?.createOrganization as { id: string }).id;

  const project = await gql(
    /* GraphQL */ `
      mutation ($organizationId: UUID!, $input: CreateProjectInput!) {
        createProject(organizationId: $organizationId, input: $input) { id }
      }
    `,
    { organizationId: orgId, input: { name: `${TAG}-proj` } },
    ownerToken,
  );
  projectId = (project.data?.createProject as { id: string }).id;
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.user.deleteMany({ where: { email: { contains: domain } } });
  await prisma.$disconnect();
});

describe('createTeam', () => {
  it('creates a team listed under the project', async () => {
    const id = await createTeam(`${TAG}-t1`);

    const body = await gql(
      /* GraphQL */ `
        query ($id: UUID!) {
          project(id: $id) { teamCount teams { id name } }
        }
      `,
      { id: projectId },
      ownerToken,
    );
    const project = body.data?.project as {
      teamCount: number;
      teams: Array<{ id: string }>;
    };
    expect(project.teamCount).toBeGreaterThanOrEqual(1);
    expect(project.teams.some((team) => team.id === id)).toBe(true);
  });

  it('forbids a non-member from creating a team', async () => {
    const body = await gql(
      /* GraphQL */ `
        mutation ($projectId: UUID!, $input: CreateTeamInput!) {
          createTeam(projectId: $projectId, input: $input) { id }
        }
      `,
      { projectId, input: { name: `${TAG}-x` } },
      outsiderToken,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});

describe('team membership (AI-relevant attributes)', () => {
  it('adds a member with availability/workload and exposes them', async () => {
    const teamId = await createTeam(`${TAG}-mem`);

    const added = await gql(
      /* GraphQL */ `
        mutation ($teamId: UUID!, $userId: UUID!, $input: AddTeamMemberInput!) {
          addTeamMember(teamId: $teamId, userId: $userId, input: $input) {
            role
            availability
            workload
            responsibilities
            user { id }
          }
        }
      `,
      {
        teamId,
        userId: memberId,
        input: {
          role: 'MEMBER',
          availability: 'BUSY',
          workload: 5,
          responsibilities: 'Backend',
        },
      },
      ownerToken,
    );
    const member = added.data?.addTeamMember as {
      availability: string;
      workload: number;
      responsibilities: string;
      user: { id: string };
    };
    expect(member.availability).toBe('BUSY');
    expect(member.workload).toBe(5);
    expect(member.responsibilities).toBe('Backend');
    expect(member.user.id).toBe(memberId);

    // Surfaced via the team for the AI assignment service.
    const teamBody = await gql(
      /* GraphQL */ `
        query ($id: UUID!) {
          team(id: $id) {
            memberCount
            members { workload availability user { id } }
          }
        }
      `,
      { id: teamId },
      ownerToken,
    );
    const team = teamBody.data?.team as {
      memberCount: number;
      members: Array<{ workload: number; user: { id: string } }>;
    };
    expect(team.memberCount).toBe(1);
    expect(team.members[0]?.workload).toBe(5);
  });

  it('rejects a duplicate team member with CONFLICT', async () => {
    const teamId = await createTeam(`${TAG}-dup`);
    const ADD = /* GraphQL */ `
      mutation ($teamId: UUID!, $userId: UUID!, $input: AddTeamMemberInput!) {
        addTeamMember(teamId: $teamId, userId: $userId, input: $input) { id }
      }
    `;
    await gql(ADD, { teamId, userId: memberId, input: {} }, ownerToken);
    const dup = await gql(ADD, { teamId, userId: memberId, input: {} }, ownerToken);
    expect(dup.errors?.[0]?.extensions?.code).toBe('CONFLICT');
  });

  it('updates and removes a team member', async () => {
    const teamId = await createTeam(`${TAG}-upd`);
    await gql(
      /* GraphQL */ `
        mutation ($teamId: UUID!, $userId: UUID!, $input: AddTeamMemberInput!) {
          addTeamMember(teamId: $teamId, userId: $userId, input: $input) { id }
        }
      `,
      { teamId, userId: memberId, input: { workload: 1 } },
      ownerToken,
    );

    const updated = await gql(
      /* GraphQL */ `
        mutation ($teamId: UUID!, $userId: UUID!, $input: UpdateTeamMemberInput!) {
          updateTeamMember(teamId: $teamId, userId: $userId, input: $input) {
            workload
            availability
          }
        }
      `,
      { teamId, userId: memberId, input: { workload: 8, availability: 'AWAY' } },
      ownerToken,
    );
    const member = updated.data?.updateTeamMember as {
      workload: number;
      availability: string;
    };
    expect(member.workload).toBe(8);
    expect(member.availability).toBe('AWAY');

    const removed = await gql(
      /* GraphQL */ `
        mutation ($teamId: UUID!, $userId: UUID!) {
          removeTeamMember(teamId: $teamId, userId: $userId)
        }
      `,
      { teamId, userId: memberId },
      ownerToken,
    );
    expect(removed.data?.removeTeamMember).toBe(true);
  });
});

describe('team authz', () => {
  it('forbids an outsider from updating a team', async () => {
    const teamId = await createTeam(`${TAG}-authz`);
    const body = await gql(
      /* GraphQL */ `
        mutation ($id: UUID!, $input: UpdateTeamInput!) {
          updateTeam(id: $id, input: $input) { id }
        }
      `,
      { id: teamId, input: { name: 'hacked' } },
      outsiderToken,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('rejects an invalid workload with BAD_USER_INPUT', async () => {
    const teamId = await createTeam(`${TAG}-bad`);
    const body = await gql(
      /* GraphQL */ `
        mutation ($teamId: UUID!, $userId: UUID!, $input: AddTeamMemberInput!) {
          addTeamMember(teamId: $teamId, userId: $userId, input: $input) { id }
        }
      `,
      { teamId, userId: memberId, input: { workload: -3 } },
      ownerToken,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });
});
