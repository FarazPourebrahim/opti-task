import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { prisma } from '@shared/db';

/**
 * Sprint module integration tests: CRUD, the state machine, task membership,
 * and computed metrics (story points, completion, velocity, capacity, burndown).
 * Requires Postgres via DATABASE_URL.
 */
const domain = '@p8sprint.test';
const TAG = `p8s_${Date.now()}`;

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

async function createSprint(input: Record<string, unknown>): Promise<string> {
  const body = await gql(
    /* GraphQL */ `
      mutation ($projectId: UUID!, $input: CreateSprintInput!) {
        createSprint(projectId: $projectId, input: $input) { id state }
      }
    `,
    { projectId, input },
    ownerToken,
  );
  return (body.data?.createSprint as { id: string }).id;
}

async function createTask(title: string, storyPoints: number): Promise<string> {
  const body = await gql(
    /* GraphQL */ `
      mutation ($projectId: UUID!, $input: CreateTaskInput!) {
        createTask(projectId: $projectId, input: $input) { id }
      }
    `,
    { projectId, input: { title, storyPoints } },
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

describe('createSprint & state machine', () => {
  it('creates a PLANNED sprint listed under the project', async () => {
    const id = await createSprint({ name: `${TAG}-s1` });
    const body = await gql(
      /* GraphQL */ `query ($id: UUID!) { project(id: $id) { sprints { totalCount edges { node { id state } } } } }`,
      { id: projectId },
      ownerToken,
    );
    const conn = body.data?.project as {
      sprints: { totalCount: number; edges: Array<{ node: { id: string; state: string } }> };
    };
    expect(conn.sprints.edges.some((e) => e.node.id === id && e.node.state === 'PLANNED')).toBe(
      true,
    );
  });

  it('allows valid transitions and rejects illegal/self ones', async () => {
    const id = await createSprint({ name: `${TAG}-sm` });
    const CHANGE = /* GraphQL */ `
      mutation ($id: UUID!, $state: SprintState!) {
        changeSprintState(id: $id, state: $state) { state }
      }
    `;
    const active = await gql(CHANGE, { id, state: 'ACTIVE' }, ownerToken);
    expect((active.data?.changeSprintState as { state: string }).state).toBe('ACTIVE');

    // ACTIVE -> PLANNED is illegal.
    const illegal = await gql(CHANGE, { id, state: 'PLANNED' }, ownerToken);
    expect(illegal.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');

    const done = await gql(CHANGE, { id, state: 'COMPLETED' }, ownerToken);
    expect((done.data?.changeSprintState as { state: string }).state).toBe('COMPLETED');
  });

  it('rejects an end date before the start date', async () => {
    const body = await gql(
      /* GraphQL */ `
        mutation ($projectId: UUID!, $input: CreateSprintInput!) {
          createSprint(projectId: $projectId, input: $input) { id }
        }
      `,
      {
        projectId,
        input: {
          name: `${TAG}-bad`,
          startDate: '2026-02-10T00:00:00.000Z',
          endDate: '2026-02-01T00:00:00.000Z',
        },
      },
      ownerToken,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('forbids an outsider from creating a sprint', async () => {
    const body = await gql(
      /* GraphQL */ `
        mutation ($projectId: UUID!, $input: CreateSprintInput!) {
          createSprint(projectId: $projectId, input: $input) { id }
        }
      `,
      { projectId, input: { name: `${TAG}-x` } },
      outsiderToken,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});

describe('metrics & burndown', () => {
  it('computes story-point metrics, capacity flag, and burndown', async () => {
    // A window spanning "now" (yesterday → tomorrow) so completions dated now
    // fall inside the burndown range: 3 UTC days.
    const now = Date.now();
    const id = await createSprint({
      name: `${TAG}-metrics`,
      capacity: 10,
      startDate: new Date(now - 86_400_000).toISOString(),
      endDate: new Date(now + 86_400_000).toISOString(),
    });

    // 8 + 5 + 3 = 16 points total; mark the 8-pointer DONE => 8 completed.
    const t1 = await createTask(`${TAG}-m-a`, 8);
    const t2 = await createTask(`${TAG}-m-b`, 5);
    const t3 = await createTask(`${TAG}-m-c`, 3);
    for (const t of [t1, t2, t3]) {
      await gql(
        /* GraphQL */ `mutation ($sprintId: UUID!, $taskId: UUID!) { addTaskToSprint(sprintId: $sprintId, taskId: $taskId) { id } }`,
        { sprintId: id, taskId: t },
        ownerToken,
      );
    }
    // Walk t1 to DONE (BACKLOG->TODO->IN_PROGRESS->IN_REVIEW->TESTING->DONE).
    for (const s of ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'DONE']) {
      await changeStatus(t1, s);
    }

    const body = await gql(
      /* GraphQL */ `
        query ($id: UUID!) {
          sprint(id: $id) {
            metrics {
              totalStoryPoints
              completedStoryPoints
              remainingStoryPoints
              totalTasks
              completedTasks
              velocity
              capacity
              overCapacity
              completionRate
              workloadDistribution { storyPoints taskCount }
            }
            burndown { idealRemaining actualRemaining }
          }
        }
      `,
      { id },
      ownerToken,
    );
    const sprint = body.data?.sprint as {
      metrics: {
        totalStoryPoints: number;
        completedStoryPoints: number;
        remainingStoryPoints: number;
        totalTasks: number;
        completedTasks: number;
        velocity: number;
        capacity: number;
        overCapacity: boolean;
        completionRate: number;
      };
      burndown: Array<{ idealRemaining: number; actualRemaining: number }>;
    };
    const m = sprint.metrics;
    expect(m.totalStoryPoints).toBe(16);
    expect(m.completedStoryPoints).toBe(8);
    expect(m.remainingStoryPoints).toBe(8);
    expect(m.totalTasks).toBe(3);
    expect(m.completedTasks).toBe(1);
    expect(m.velocity).toBe(8);
    expect(m.overCapacity).toBe(true); // 16 > 10
    expect(m.completionRate).toBeCloseTo(0.5, 5);

    // 3-day sprint => 3 burndown points; ideal runs total -> 0.
    expect(sprint.burndown).toHaveLength(3);
    expect(sprint.burndown[0]?.idealRemaining).toBe(16);
    expect(sprint.burndown[2]?.idealRemaining).toBe(0);
    expect(sprint.burndown[2]?.actualRemaining).toBe(8); // 16 total - 8 done
  });

  it('returns zeroed metrics for an empty sprint', async () => {
    const id = await createSprint({ name: `${TAG}-empty` });
    const body = await gql(
      /* GraphQL */ `
        query ($id: UUID!) {
          sprint(id: $id) {
            metrics { totalStoryPoints completedTasks completionRate overCapacity }
            burndown { idealRemaining }
          }
        }
      `,
      { id },
      ownerToken,
    );
    const sprint = body.data?.sprint as {
      metrics: { totalStoryPoints: number; completedTasks: number; completionRate: number; overCapacity: boolean };
      burndown: unknown[];
    };
    expect(sprint.metrics.totalStoryPoints).toBe(0);
    expect(sprint.metrics.completedTasks).toBe(0);
    expect(sprint.metrics.completionRate).toBe(0);
    expect(sprint.metrics.overCapacity).toBe(false);
    expect(sprint.burndown).toHaveLength(0); // no dates set
  });
});
