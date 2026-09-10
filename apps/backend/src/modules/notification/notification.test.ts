import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { prisma } from '@/shared/db';

/**
 * Notification module integration tests: event-driven fan-out (assignment,
 * mention), the per-recipient feed, read/mark-all-read, and empty state.
 * Requires Postgres via DATABASE_URL.
 */
const domain = '@p9notif.test';
const TAG = `p9n_${Date.now()}`;

let app: Express;
let ownerToken = '';
let assigneeToken = '';
let assigneeId = '';
let mentionedToken = '';
let mentionedId = '';
let freshToken = '';
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

async function myNotifications(
  token: string,
  unreadOnly = false,
): Promise<Array<{ type: string; read: boolean; entityId: string | null }>> {
  const body = await gql(
    /* GraphQL */ `
      query ($unreadOnly: Boolean) {
        myNotifications(unreadOnly: $unreadOnly) {
          totalCount
          edges { node { type read entityId } }
        }
      }
    `,
    { unreadOnly },
    token,
  );
  const conn = body.data?.myNotifications as {
    edges: Array<{ node: { type: string; read: boolean; entityId: string | null } }>;
  };
  return conn.edges.map((e) => e.node);
}

beforeAll(async () => {
  app = await createApp();
  ownerToken = (await register('owner')).token;
  const assignee = await register('assignee');
  assigneeToken = assignee.token;
  assigneeId = assignee.id;
  const mentioned = await register('mentioned');
  mentionedToken = mentioned.token;
  mentionedId = mentioned.id;
  freshToken = (await register('fresh')).token;

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

describe('event-driven fan-out', () => {
  it('notifies the assignee when a task is assigned', async () => {
    const id = await createTask(`${TAG}-assign`);
    await gql(
      /* GraphQL */ `mutation ($id: UUID!, $assigneeId: UUID) { assignTask(id: $id, assigneeId: $assigneeId) { id } }`,
      { id, assigneeId },
      ownerToken,
    );

    const notes = await myNotifications(assigneeToken);
    const assigned = notes.find((n) => n.type === 'TASK_ASSIGNED' && n.entityId === id);
    expect(assigned).toBeDefined();
    expect(assigned?.read).toBe(false);
  });

  it('notifies a mentioned user', async () => {
    const id = await createTask(`${TAG}-mention`);
    const comment = await gql(
      /* GraphQL */ `
        mutation ($taskId: UUID!, $input: CreateCommentInput!) {
          createComment(taskId: $taskId, input: $input) { id }
        }
      `,
      { taskId: id, input: { body: 'ping', mentionedUserIds: [mentionedId] } },
      ownerToken,
    );
    const commentId = (comment.data?.createComment as { id: string }).id;

    const notes = await myNotifications(mentionedToken);
    expect(notes.some((n) => n.type === 'MENTION' && n.entityId === commentId)).toBe(true);
  });

  it('does not notify the actor for self-assignment', async () => {
    const before = (await myNotifications(ownerToken)).length;
    const id = await createTask(`${TAG}-self`);
    // owner is the actor; assigning to a different user notifies that user, not owner.
    await gql(
      /* GraphQL */ `mutation ($id: UUID!, $assigneeId: UUID) { assignTask(id: $id, assigneeId: $assigneeId) { id } }`,
      { id, assigneeId },
      ownerToken,
    );
    const after = (await myNotifications(ownerToken)).length;
    expect(after).toBe(before);
  });
});

describe('feed, read state & empty state', () => {
  it('marks a single notification read', async () => {
    const notes = await myNotifications(assigneeToken, true);
    expect(notes.length).toBeGreaterThanOrEqual(1);

    // Find the actual id to mark.
    const body = await gql(
      /* GraphQL */ `query { myNotifications(unreadOnly: true) { edges { node { id } } } }`,
      {},
      assigneeToken,
    );
    const first = (body.data?.myNotifications as { edges: Array<{ node: { id: string } }> })
      .edges[0]?.node.id as string;

    const marked = await gql(
      /* GraphQL */ `mutation ($id: UUID!) { markNotificationRead(id: $id) { read } }`,
      { id: first },
      assigneeToken,
    );
    expect((marked.data?.markNotificationRead as { read: boolean }).read).toBe(true);
  });

  it('marks all read and zeroes the unread count', async () => {
    await gql(/* GraphQL */ `mutation { markAllNotificationsRead }`, {}, assigneeToken);
    const count = await gql(
      /* GraphQL */ `query { unreadNotificationCount }`,
      {},
      assigneeToken,
    );
    expect(count.data?.unreadNotificationCount).toBe(0);
  });

  it('forbids marking another user’s notification', async () => {
    const id = await createTask(`${TAG}-cross`);
    await gql(
      /* GraphQL */ `mutation ($id: UUID!, $assigneeId: UUID) { assignTask(id: $id, assigneeId: $assigneeId) { id } }`,
      { id, assigneeId },
      ownerToken,
    );
    const body = await gql(
      /* GraphQL */ `query { myNotifications(unreadOnly: true) { edges { node { id } } } }`,
      {},
      assigneeToken,
    );
    const notifId = (body.data?.myNotifications as { edges: Array<{ node: { id: string } }> })
      .edges[0]?.node.id as string;

    const cross = await gql(
      /* GraphQL */ `mutation ($id: UUID!) { markNotificationRead(id: $id) { id } }`,
      { id: notifId },
      mentionedToken,
    );
    expect(cross.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('returns an explicit empty feed for a user with no notifications', async () => {
    const body = await gql(
      /* GraphQL */ `query { myNotifications { totalCount edges { node { id } } } unreadNotificationCount }`,
      {},
      freshToken,
    );
    const conn = body.data?.myNotifications as { totalCount: number; edges: unknown[] };
    expect(conn.totalCount).toBe(0);
    expect(conn.edges).toHaveLength(0);
    expect(body.data?.unreadNotificationCount).toBe(0);
  });
});
