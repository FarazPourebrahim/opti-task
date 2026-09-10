import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { prisma } from '@/shared/db';

/**
 * Project module integration tests: CRUD, the status state machine, project
 * membership, and RBAC. Requires Postgres via DATABASE_URL.
 */
const domain = '@p6proj.test';
const TAG = `p6p_${Date.now()}`;

let app: Express;
let ownerToken = '';
let outsiderToken = '';
let outsiderId = '';
let orgId = '';

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

async function createProject(name: string): Promise<string> {
  const body = await gql(
    /* GraphQL */ `
      mutation ($organizationId: UUID!, $input: CreateProjectInput!) {
        createProject(organizationId: $organizationId, input: $input) { id status }
      }
    `,
    { organizationId: orgId, input: { name } },
    ownerToken,
  );
  return (body.data?.createProject as { id: string }).id;
}

beforeAll(async () => {
  app = await createApp();
  const owner = await register('owner');
  ownerToken = owner.token;
  const outsider = await register('outsider');
  outsiderToken = outsider.token;
  outsiderId = outsider.id;

  const org = await gql(
    /* GraphQL */ `
      mutation ($input: CreateOrganizationInput!) {
        createOrganization(input: $input) { id }
      }
    `,
    { input: { name: `${TAG}-org` } },
    ownerToken,
  );
  orgId = (org.data?.createOrganization as { id: string }).id;
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.user.deleteMany({ where: { email: { contains: domain } } });
  await prisma.$disconnect();
});

describe('createProject', () => {
  it('creates a PLANNING project owned by an admin member', async () => {
    const body = await gql(
      /* GraphQL */ `
        mutation ($organizationId: UUID!, $input: CreateProjectInput!) {
          createProject(organizationId: $organizationId, input: $input) {
            status
            memberCount
            members { edges { node { role } } }
          }
        }
      `,
      { organizationId: orgId, input: { name: `${TAG}-p1` } },
      ownerToken,
    );
    const project = body.data?.createProject as {
      status: string;
      memberCount: number;
      members: { edges: Array<{ node: { role: string } }> };
    };
    expect(project.status).toBe('PLANNING');
    expect(project.memberCount).toBe(1);
    expect(project.members.edges[0]?.node.role).toBe('ADMIN');
  });

  it('forbids a non-org-member from creating a project', async () => {
    const body = await gql(
      /* GraphQL */ `
        mutation ($organizationId: UUID!, $input: CreateProjectInput!) {
          createProject(organizationId: $organizationId, input: $input) { id }
        }
      `,
      { organizationId: orgId, input: { name: `${TAG}-x` } },
      outsiderToken,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('lists projects under the organization with a status filter', async () => {
    const body = await gql(
      /* GraphQL */ `
        query ($id: UUID!) {
          organization(id: $id) {
            projects(status: PLANNING) { totalCount edges { node { status } } }
          }
        }
      `,
      { id: orgId },
      ownerToken,
    );
    const conn = body.data?.organization as {
      projects: { totalCount: number; edges: Array<{ node: { status: string } }> };
    };
    expect(conn.projects.totalCount).toBeGreaterThanOrEqual(1);
    expect(conn.projects.edges.every((e) => e.node.status === 'PLANNING')).toBe(true);
  });
});

describe('status state machine', () => {
  const CHANGE = /* GraphQL */ `
    mutation ($id: UUID!, $status: ProjectState!) {
      changeProjectStatus(id: $id, status: $status) { status }
    }
  `;

  it('allows valid transitions and rejects illegal ones', async () => {
    const id = await createProject(`${TAG}-sm`);

    const toActive = await gql(CHANGE, { id, status: 'ACTIVE' }, ownerToken);
    expect((toActive.data?.changeProjectStatus as { status: string }).status).toBe(
      'ACTIVE',
    );

    // ACTIVE -> PLANNING is not allowed.
    const illegal = await gql(CHANGE, { id, status: 'PLANNING' }, ownerToken);
    expect(illegal.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');

    const toCompleted = await gql(CHANGE, { id, status: 'COMPLETED' }, ownerToken);
    expect((toCompleted.data?.changeProjectStatus as { status: string }).status).toBe(
      'COMPLETED',
    );
  });
});

describe('project membership & authz', () => {
  it('adds a member, rejects duplicates, and grants the member read access', async () => {
    const id = await createProject(`${TAG}-mem`);

    const ADD = /* GraphQL */ `
      mutation ($projectId: UUID!, $userId: UUID!, $role: ProjectRole!) {
        addProjectMember(projectId: $projectId, userId: $userId, role: $role) { role }
      }
    `;
    const added = await gql(
      ADD,
      { projectId: id, userId: outsiderId, role: 'MEMBER' },
      ownerToken,
    );
    expect((added.data?.addProjectMember as { role: string }).role).toBe('MEMBER');

    const dup = await gql(
      ADD,
      { projectId: id, userId: outsiderId, role: 'MEMBER' },
      ownerToken,
    );
    expect(dup.errors?.[0]?.extensions?.code).toBe('CONFLICT');

    // The new member can now read the project.
    const read = await gql(
      /* GraphQL */ `query ($id: UUID!) { project(id: $id) { id } }`,
      { id },
      outsiderToken,
    );
    expect(read.errors).toBeUndefined();
  });

  it('forbids an outsider from updating or deleting a project', async () => {
    const id = await createProject(`${TAG}-auth`);

    const update = await gql(
      /* GraphQL */ `
        mutation ($id: UUID!, $input: UpdateProjectInput!) {
          updateProject(id: $id, input: $input) { id }
        }
      `,
      { id, input: { name: 'hacked' } },
      outsiderToken,
    );
    expect(update.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');

    const del = await gql(
      /* GraphQL */ `mutation ($id: UUID!) { deleteProject(id: $id) }`,
      { id },
      outsiderToken,
    );
    expect(del.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('lets the owner delete a project', async () => {
    const id = await createProject(`${TAG}-del`);
    const body = await gql(
      /* GraphQL */ `mutation ($id: UUID!) { deleteProject(id: $id) }`,
      { id },
      ownerToken,
    );
    expect(body.data?.deleteProject).toBe(true);
  });

  it('rejects an unknown project with NOT_FOUND', async () => {
    const body = await gql(
      /* GraphQL */ `query ($id: UUID!) { project(id: $id) { id } }`,
      { id: '00000000-0000-0000-0000-0000000000ff' },
      ownerToken,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });
});
