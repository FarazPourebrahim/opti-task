import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { prisma } from '@/shared/db';

/**
 * Task module integration tests: CRUD, the status state machine, transactional
 * assignment + activity logging, dependency cycle detection, time tracking,
 * watchers, labels, filtering, and RBAC. Requires Postgres via DATABASE_URL.
 */
const domain = '@p7task.test';
const TAG = `p7t_${Date.now()}`;

let app: Express;
let ownerToken = '';
let outsiderToken = '';
let assigneeId = '';
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

async function createTask(title: string): Promise<string> {
  const body = await gql(
    /* GraphQL */ `
      mutation ($projectId: UUID!, $input: CreateTaskInput!) {
        createTask(projectId: $projectId, input: $input) { id }
      }
    `,
    { projectId, input: { title } },
    ownerToken,
  );
  return (body.data?.createTask as { id: string }).id;
}

beforeAll(async () => {
  app = await createApp();
  const owner = await register('owner');
  ownerToken = owner.token;
  const outsider = await register('outsider');
  outsiderToken = outsider.token;
  const assignee = await register('assignee');
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
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.user.deleteMany({ where: { email: { contains: domain } } });
  await prisma.$disconnect();
});

describe('createTask', () => {
  it('creates a BACKLOG task with the creator as reporter and logs activity', async () => {
    const body = await gql(
      /* GraphQL */ `
        mutation ($projectId: UUID!, $input: CreateTaskInput!) {
          createTask(projectId: $projectId, input: $input) {
            id
            status
            priority
            reporter { id }
            activities { totalCount edges { node { type } } }
          }
        }
      `,
      { projectId, input: { title: `${TAG}-first`, priority: 'HIGH' } },
      ownerToken,
    );
    const task = body.data?.createTask as {
      status: string;
      priority: string;
      reporter: { id: string } | null;
      activities: { totalCount: number; edges: Array<{ node: { type: string } }> };
    };
    expect(task.status).toBe('BACKLOG');
    expect(task.priority).toBe('HIGH');
    expect(task.reporter?.id).toBeTruthy();
    expect(task.activities.totalCount).toBe(1);
    expect(task.activities.edges[0]?.node.type).toBe('TASK_CREATED');
  });

  it('forbids a non-member from creating a task', async () => {
    const body = await gql(
      /* GraphQL */ `
        mutation ($projectId: UUID!, $input: CreateTaskInput!) {
          createTask(projectId: $projectId, input: $input) { id }
        }
      `,
      { projectId, input: { title: `${TAG}-x` } },
      outsiderToken,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('lists tasks under the project with a status filter', async () => {
    await createTask(`${TAG}-listed`);
    const body = await gql(
      /* GraphQL */ `
        query ($id: UUID!) {
          project(id: $id) {
            tasks(filter: { status: BACKLOG }) {
              totalCount
              edges { node { status } }
            }
          }
        }
      `,
      { id: projectId },
      ownerToken,
    );
    const conn = body.data?.project as {
      tasks: { totalCount: number; edges: Array<{ node: { status: string } }> };
    };
    expect(conn.tasks.totalCount).toBeGreaterThanOrEqual(1);
    expect(conn.tasks.edges.every((e) => e.node.status === 'BACKLOG')).toBe(true);
  });
});

describe('status state machine', () => {
  const CHANGE = /* GraphQL */ `
    mutation ($id: UUID!, $status: TaskStatus!) {
      changeTaskStatus(id: $id, status: $status) { status }
    }
  `;

  it('allows valid transitions and rejects illegal and self transitions', async () => {
    const id = await createTask(`${TAG}-sm`);

    const toTodo = await gql(CHANGE, { id, status: 'TODO' }, ownerToken);
    expect((toTodo.data?.changeTaskStatus as { status: string }).status).toBe('TODO');

    // TODO -> DONE is not a legal single step.
    const illegal = await gql(CHANGE, { id, status: 'DONE' }, ownerToken);
    expect(illegal.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');

    // A self-transition is rejected.
    const self = await gql(CHANGE, { id, status: 'TODO' }, ownerToken);
    expect(self.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');

    const toProgress = await gql(CHANGE, { id, status: 'IN_PROGRESS' }, ownerToken);
    expect((toProgress.data?.changeTaskStatus as { status: string }).status).toBe(
      'IN_PROGRESS',
    );
  });
});

describe('assignment & story points (transactional + audited)', () => {
  it('assigns a task and records an ASSIGNED activity', async () => {
    const id = await createTask(`${TAG}-assign`);
    const body = await gql(
      /* GraphQL */ `
        mutation ($id: UUID!, $assigneeId: UUID) {
          assignTask(id: $id, assigneeId: $assigneeId) {
            assignee { id }
            activities { edges { node { type } } }
          }
        }
      `,
      { id, assigneeId },
      ownerToken,
    );
    const task = body.data?.assignTask as {
      assignee: { id: string } | null;
      activities: { edges: Array<{ node: { type: string } }> };
    };
    expect(task.assignee?.id).toBe(assigneeId);
    expect(task.activities.edges.some((e) => e.node.type === 'ASSIGNED')).toBe(true);
  });

  it('updates story points', async () => {
    const id = await createTask(`${TAG}-sp`);
    const body = await gql(
      /* GraphQL */ `
        mutation ($id: UUID!, $sp: Int) {
          setTaskStoryPoints(id: $id, storyPoints: $sp) { storyPoints }
        }
      `,
      { id, sp: 8 },
      ownerToken,
    );
    expect((body.data?.setTaskStoryPoints as { storyPoints: number }).storyPoints).toBe(8);
  });
});

describe('dependencies (cycle detection)', () => {
  const ADD = /* GraphQL */ `
    mutation ($taskId: UUID!, $dependsOnTaskId: UUID!) {
      addTaskDependency(taskId: $taskId, dependsOnTaskId: $dependsOnTaskId) {
        dependencies { id }
      }
    }
  `;

  it('adds a dependency, rejects self/duplicate/cycle', async () => {
    const a = await createTask(`${TAG}-dep-a`);
    const b = await createTask(`${TAG}-dep-b`);

    const added = await gql(ADD, { taskId: a, dependsOnTaskId: b }, ownerToken);
    const deps = (added.data?.addTaskDependency as { dependencies: Array<{ id: string }> })
      .dependencies;
    expect(deps.some((d) => d.id === b)).toBe(true);

    const dup = await gql(ADD, { taskId: a, dependsOnTaskId: b }, ownerToken);
    expect(dup.errors?.[0]?.extensions?.code).toBe('CONFLICT');

    const selfDep = await gql(ADD, { taskId: a, dependsOnTaskId: a }, ownerToken);
    expect(selfDep.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');

    // b -> a would close the loop a -> b -> a.
    const cycle = await gql(ADD, { taskId: b, dependsOnTaskId: a }, ownerToken);
    expect(cycle.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });
});

describe('time tracking, watchers, labels', () => {
  it('logs time additively', async () => {
    const id = await createTask(`${TAG}-time`);
    const LOG = /* GraphQL */ `
      mutation ($id: UUID!, $seconds: Int!) {
        logTaskTime(id: $id, seconds: $seconds) { loggedSeconds }
      }
    `;
    await gql(LOG, { id, seconds: 3600 }, ownerToken);
    const body = await gql(LOG, { id, seconds: 1800 }, ownerToken);
    expect((body.data?.logTaskTime as { loggedSeconds: number }).loggedSeconds).toBe(5400);
  });

  it('adds a label and a self-watch', async () => {
    const id = await createTask(`${TAG}-meta`);
    const labelled = await gql(
      /* GraphQL */ `
        mutation ($taskId: UUID!, $name: String!) {
          addTaskLabel(taskId: $taskId, name: $name) { labels { name } }
        }
      `,
      { taskId: id, name: 'backend' },
      ownerToken,
    );
    const labels = (labelled.data?.addTaskLabel as { labels: Array<{ name: string }> }).labels;
    expect(labels.some((l) => l.name === 'backend')).toBe(true);

    const watched = await gql(
      /* GraphQL */ `
        mutation ($taskId: UUID!) {
          watchTask(taskId: $taskId) { watchers { id } }
        }
      `,
      { taskId: id },
      ownerToken,
    );
    expect((watched.data?.watchTask as { watchers: Array<{ id: string }> }).watchers.length).toBe(
      1,
    );
  });
});

describe('task authz', () => {
  it('forbids an outsider from updating a task', async () => {
    const id = await createTask(`${TAG}-authz`);
    const body = await gql(
      /* GraphQL */ `
        mutation ($id: UUID!, $input: UpdateTaskInput!) {
          updateTask(id: $id, input: $input) { id }
        }
      `,
      { id, input: { title: 'hacked' } },
      outsiderToken,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('rejects an unknown task with NOT_FOUND', async () => {
    const body = await gql(
      /* GraphQL */ `query ($id: UUID!) { task(id: $id) { id } }`,
      { id: '00000000-0000-0000-0000-0000000000ff' },
      ownerToken,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });
});
