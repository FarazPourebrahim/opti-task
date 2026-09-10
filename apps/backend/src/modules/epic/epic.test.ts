import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { prisma } from '@/shared/db';

/**
 * Epic module integration tests: CRUD, milestones, related tasks, and live
 * progress aggregation that tracks child-task state. Requires Postgres via
 * DATABASE_URL.
 */
const domain = '@p8epic.test';
const TAG = `p8e_${Date.now()}`;

let app: Express;
let ownerToken = '';
let outsiderToken = '';
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

async function createEpic(name: string): Promise<string> {
  const body = await gql(
    /* GraphQL */ `
      mutation ($projectId: UUID!, $input: CreateEpicInput!) {
        createEpic(projectId: $projectId, input: $input) { id }
      }
    `,
    { projectId, input: { name } },
    ownerToken,
  );
  return (body.data?.createEpic as { id: string }).id;
}

async function createTaskInEpic(title: string, epicId: string): Promise<string> {
  const body = await gql(
    /* GraphQL */ `
      mutation ($projectId: UUID!, $input: CreateTaskInput!) {
        createTask(projectId: $projectId, input: $input) { id }
      }
    `,
    { projectId, input: { title, epicId } },
    ownerToken,
  );
  return (body.data?.createTask as { id: string }).id;
}

async function changeStatus(id: string, status: string): Promise<void> {
  await gql(
    /* GraphQL */ `
      mutation ($id: UUID!, $status: TaskStatus!) {
        changeTaskStatus(id: $id, status: $status) { status }
      }
    `,
    { id, status },
    ownerToken,
  );
}

beforeAll(async () => {
  app = await createApp();
  ownerToken = (await register('owner')).token;
  outsiderToken = (await register('outsider')).token;

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

describe('epic CRUD & progress', () => {
  it('creates an epic listed under the project at 0% progress', async () => {
    const id = await createEpic(`${TAG}-e1`);
    const body = await gql(
      /* GraphQL */ `query ($id: UUID!) { project(id: $id) { epics { totalCount edges { node { id progress } } } } }`,
      { id: projectId },
      ownerToken,
    );
    const conn = body.data?.project as {
      epics: { totalCount: number; edges: Array<{ node: { id: string; progress: number } }> };
    };
    const node = conn.epics.edges.find((e) => e.node.id === id)?.node;
    expect(node?.progress).toBe(0);
  });

  it('recalculates live progress from child-task completion', async () => {
    const epicId = await createEpic(`${TAG}-prog`);
    const t1 = await createTaskInEpic(`${TAG}-p-a`, epicId);
    await createTaskInEpic(`${TAG}-p-b`, epicId);
    await createTaskInEpic(`${TAG}-p-c`, epicId);
    await createTaskInEpic(`${TAG}-p-d`, epicId);

    // Walk one of four tasks to DONE => 25%.
    for (const s of ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'DONE']) {
      await changeStatus(t1, s);
    }

    const body = await gql(
      /* GraphQL */ `
        query ($id: UUID!) {
          epic(id: $id) {
            totalTasks
            completedTasks
            progress
            tasks { totalCount }
          }
        }
      `,
      { id: epicId },
      ownerToken,
    );
    const epic = body.data?.epic as {
      totalTasks: number;
      completedTasks: number;
      progress: number;
      tasks: { totalCount: number };
    };
    expect(epic.totalTasks).toBe(4);
    expect(epic.completedTasks).toBe(1);
    expect(epic.progress).toBe(25);
    expect(epic.tasks.totalCount).toBe(4);
  });

  it('persists progress onto the epic column via refreshEpicProgress', async () => {
    const epicId = await createEpic(`${TAG}-refresh`);
    const t1 = await createTaskInEpic(`${TAG}-r-a`, epicId);
    await createTaskInEpic(`${TAG}-r-b`, epicId);
    for (const s of ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'DONE']) {
      await changeStatus(t1, s);
    }
    const body = await gql(
      /* GraphQL */ `mutation ($id: UUID!) { refreshEpicProgress(id: $id) { progress } }`,
      { id: epicId },
      ownerToken,
    );
    expect((body.data?.refreshEpicProgress as { progress: number }).progress).toBe(50);
  });
});

describe('milestones', () => {
  it('creates a milestone linked to an epic and lists it', async () => {
    const epicId = await createEpic(`${TAG}-ms`);
    const created = await gql(
      /* GraphQL */ `
        mutation ($projectId: UUID!, $input: CreateMilestoneInput!) {
          createMilestone(projectId: $projectId, input: $input) { id name epicId }
        }
      `,
      {
        projectId,
        input: { name: `${TAG}-v1`, epicId, dueDate: '2026-04-01T00:00:00.000Z' },
      },
      ownerToken,
    );
    const milestone = created.data?.createMilestone as { id: string; epicId: string };
    expect(milestone.epicId).toBe(epicId);

    const body = await gql(
      /* GraphQL */ `query ($id: UUID!) { epic(id: $id) { milestones { id name } } }`,
      { id: epicId },
      ownerToken,
    );
    const epic = body.data?.epic as { milestones: Array<{ id: string }> };
    expect(epic.milestones.some((m) => m.id === milestone.id)).toBe(true);
  });
});

describe('epic authz', () => {
  it('forbids an outsider from creating an epic', async () => {
    const body = await gql(
      /* GraphQL */ `
        mutation ($projectId: UUID!, $input: CreateEpicInput!) {
          createEpic(projectId: $projectId, input: $input) { id }
        }
      `,
      { projectId, input: { name: `${TAG}-x` } },
      outsiderToken,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('rejects an unknown epic with NOT_FOUND', async () => {
    const body = await gql(
      /* GraphQL */ `query ($id: UUID!) { epic(id: $id) { id } }`,
      { id: '00000000-0000-0000-0000-0000000000ff' },
      ownerToken,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });
});
