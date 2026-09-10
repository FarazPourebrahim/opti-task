import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { prisma } from '@/shared/db';

/**
 * Analytics integration tests: project analytics reconcile with the underlying
 * fixtures, empty projects return zeroed shapes, and user statistics recompute
 * from real history. Requires Postgres via DATABASE_URL.
 */
const domain = '@p11analytics.test';
const TAG = `p11a_${Date.now()}`;

let app: Express;
let ownerToken = '';
let outsiderToken = '';
let assigneeToken = '';
let assigneeId = '';
let projectId = '';
let sprintId = '';

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

async function createTask(title: string, storyPoints: number): Promise<string> {
  const body = await gql(
    /* GraphQL */ `
      mutation ($projectId: UUID!, $input: CreateTaskInput!) {
        createTask(projectId: $projectId, input: $input) { id }
      }
    `,
    { projectId, input: { title, storyPoints, assigneeId, sprintId } },
    ownerToken,
  );
  return (body.data?.createTask as { id: string }).id;
}

async function complete(id: string): Promise<void> {
  for (const status of ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'DONE']) {
    await gql(
      /* GraphQL */ `mutation ($id: UUID!, $status: TaskStatus!) { changeTaskStatus(id: $id, status: $status) { status } }`,
      { id, status },
      ownerToken,
    );
  }
}

beforeAll(async () => {
  app = await createApp();
  ownerToken = (await register('owner')).token;
  outsiderToken = (await register('outsider')).token;
  const assignee = await register('assignee');
  assigneeToken = assignee.token;
  assigneeId = assignee.id;

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

  const sprint = await gql(
    /* GraphQL */ `mutation ($projectId: UUID!, $input: CreateSprintInput!) { createSprint(projectId: $projectId, input: $input) { id } }`,
    { projectId, input: { name: `${TAG}-sprint` } },
    ownerToken,
  );
  sprintId = (sprint.data?.createSprint as { id: string }).id;

  // 5 + 3 + 8 = 16 points; complete the 5 and 3 (8 done), leave the 8 active.
  const t1 = await createTask(`${TAG}-t1`, 5);
  const t2 = await createTask(`${TAG}-t2`, 3);
  await createTask(`${TAG}-t3`, 8);
  await complete(t1);
  await complete(t2);

  // Close the sprint so it counts toward team velocity.
  const change = /* GraphQL */ `mutation ($id: UUID!, $state: SprintState!) { changeSprintState(id: $id, state: $state) { state } }`;
  await gql(change, { id: sprintId, state: 'ACTIVE' }, ownerToken);
  await gql(change, { id: sprintId, state: 'COMPLETED' }, ownerToken);
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.user.deleteMany({ where: { email: { contains: domain } } });
  await prisma.$disconnect();
});

describe('project analytics', () => {
  it('reconciles totals, distribution, trends, velocity and workloads', async () => {
    const body = await gql(
      /* GraphQL */ `
        query ($id: UUID!) {
          projectAnalytics(projectId: $id) {
            totalTasks
            completedTasks
            totalStoryPoints
            completedStoryPoints
            completionRate
            teamVelocity
            taskDistributionByStatus { status count }
            storyPointTrends { committedStoryPoints completedStoryPoints }
            individualWorkloads { user { id } activeTasks activeStoryPoints completedTasks }
          }
        }
      `,
      { id: projectId },
      ownerToken,
    );
    const a = body.data?.projectAnalytics as {
      totalTasks: number;
      completedTasks: number;
      totalStoryPoints: number;
      completedStoryPoints: number;
      completionRate: number;
      teamVelocity: number;
      taskDistributionByStatus: Array<{ status: string; count: number }>;
      storyPointTrends: Array<{ committedStoryPoints: number; completedStoryPoints: number }>;
      individualWorkloads: Array<{
        user: { id: string };
        activeTasks: number;
        activeStoryPoints: number;
        completedTasks: number;
      }>;
    };
    expect(a.totalTasks).toBe(3);
    expect(a.completedTasks).toBe(2);
    expect(a.totalStoryPoints).toBe(16);
    expect(a.completedStoryPoints).toBe(8);
    expect(a.completionRate).toBeCloseTo(0.5, 5);
    expect(a.teamVelocity).toBe(8); // one COMPLETED sprint with 8 done points

    const done = a.taskDistributionByStatus.find((s) => s.status === 'DONE');
    expect(done?.count).toBe(2);

    const trend = a.storyPointTrends[0];
    expect(trend?.committedStoryPoints).toBe(16);
    expect(trend?.completedStoryPoints).toBe(8);

    const wl = a.individualWorkloads.find((w) => w.user.id === assigneeId);
    expect(wl?.activeTasks).toBe(1);
    expect(wl?.activeStoryPoints).toBe(8);
    expect(wl?.completedTasks).toBe(2);
  });

  it('forbids analytics to a non-member', async () => {
    const body = await gql(
      /* GraphQL */ `query ($id: UUID!) { projectAnalytics(projectId: $id) { totalTasks } }`,
      { id: projectId },
      outsiderToken,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('returns zeroed analytics for an empty project', async () => {
    const org = await gql(
      /* GraphQL */ `mutation ($input: CreateOrganizationInput!) { createOrganization(input: $input) { id } }`,
      { input: { name: `${TAG}-empty-org` } },
      ownerToken,
    );
    const orgId = (org.data?.createOrganization as { id: string }).id;
    const project = await gql(
      /* GraphQL */ `mutation ($organizationId: UUID!, $input: CreateProjectInput!) { createProject(organizationId: $organizationId, input: $input) { id } }`,
      { organizationId: orgId, input: { name: `${TAG}-empty-proj` } },
      ownerToken,
    );
    const emptyId = (project.data?.createProject as { id: string }).id;

    const body = await gql(
      /* GraphQL */ `
        query ($id: UUID!) {
          projectAnalytics(projectId: $id) {
            totalTasks completedStoryPoints completionRate teamVelocity
            taskDistributionByStatus { status }
            individualWorkloads { activeTasks }
          }
        }
      `,
      { id: emptyId },
      ownerToken,
    );
    const a = body.data?.projectAnalytics as {
      totalTasks: number;
      completedStoryPoints: number;
      completionRate: number;
      teamVelocity: number;
      taskDistributionByStatus: unknown[];
      individualWorkloads: unknown[];
    };
    expect(a.totalTasks).toBe(0);
    expect(a.completedStoryPoints).toBe(0);
    expect(a.completionRate).toBe(0);
    expect(a.teamVelocity).toBe(0);
    expect(a.taskDistributionByStatus).toHaveLength(0);
    expect(a.individualWorkloads).toHaveLength(0);
  });
});

describe('user analytics & statistics', () => {
  it('computes a user’s delivery metrics from history (self view)', async () => {
    const body = await gql(
      /* GraphQL */ `
        query ($id: UUID!) {
          userAnalytics(userId: $id) {
            completedTasks historicalStoryPoints activeAssignments velocity avgCompletionSeconds
          }
        }
      `,
      { id: assigneeId },
      assigneeToken,
    );
    const a = body.data?.userAnalytics as {
      completedTasks: number;
      historicalStoryPoints: number;
      activeAssignments: number;
      velocity: number | null;
      avgCompletionSeconds: number | null;
    };
    expect(a.completedTasks).toBe(2);
    expect(a.historicalStoryPoints).toBe(8);
    expect(a.activeAssignments).toBe(1);
    expect(a.velocity).toBe(8); // 8 points over one distinct sprint
    expect(a.avgCompletionSeconds).not.toBeNull();
  });

  it('recompute persists real statistics onto the user', async () => {
    const recompute = await gql(
      /* GraphQL */ `mutation ($id: UUID!) { recomputeUserStatistics(userId: $id) { id } }`,
      { id: assigneeId },
      assigneeToken,
    );
    expect(recompute.errors).toBeUndefined();

    const body = await gql(
      /* GraphQL */ `query ($id: UUID!) { user(id: $id) { statistics { completedTasks historicalStoryPoints } } }`,
      { id: assigneeId },
      assigneeToken,
    );
    const stats = (body.data?.user as { statistics: { completedTasks: number; historicalStoryPoints: number } })
      .statistics;
    expect(stats.completedTasks).toBe(2);
    expect(stats.historicalStoryPoints).toBe(8);
  });
});
