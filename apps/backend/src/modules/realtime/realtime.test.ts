import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { prisma } from '@/shared/db';
import {
  createSubscriptionContext,
  type GraphQLContext,
} from '@/shared/graphql/context';
import { publish, clearSubscriptions } from '@/shared/pubsub';
import { realtimeResolvers } from './graphql/realtime.resolvers.js';

/**
 * Real-time subscription tests. The WebSocket transport itself is not exercised
 * here (supertest is HTTP-only); instead we test the two things that matter for
 * correctness: the pubsub async-iterator + filter, and each subscription's
 * RBAC-scoped `subscribe` (authorized → scoped stream; unauthorized → denied).
 * Requires Postgres via DATABASE_URL.
 */
const domain = '@p11rt.test';
const TAG = `p11r_${Date.now()}`;

let app: Express;
let ownerCtx: GraphQLContext;
let outsiderCtx: GraphQLContext;
let ownerId = '';
let projectId = '';

type GqlBody = { data?: Record<string, unknown> | null };

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

function ctxFor(token: string): GraphQLContext {
  return createSubscriptionContext({ authorization: `Bearer ${token}` });
}

const sub = realtimeResolvers.Subscription;

beforeAll(async () => {
  app = await createApp();
  const owner = await register('owner');
  ownerId = owner.id;
  ownerCtx = ctxFor(owner.token);
  outsiderCtx = ctxFor((await register('outsider')).token);

  const org = await gql(
    /* GraphQL */ `mutation ($input: CreateOrganizationInput!) { createOrganization(input: $input) { id } }`,
    { input: { name: `${TAG}-org` } },
    owner.token,
  );
  const orgId = (org.data?.createOrganization as { id: string }).id;
  const project = await gql(
    /* GraphQL */ `mutation ($organizationId: UUID!, $input: CreateProjectInput!) { createProject(organizationId: $organizationId, input: $input) { id } }`,
    { organizationId: orgId, input: { name: `${TAG}-proj` } },
    owner.token,
  );
  projectId = (project.data?.createProject as { id: string }).id;
});

afterAll(async () => {
  clearSubscriptions();
  await prisma.organization.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.user.deleteMany({ where: { email: { contains: domain } } });
  await prisma.$disconnect();
});

describe('pubsub async iterator', () => {
  it('yields only payloads passing the filter', async () => {
    const iterator = (await import('@/shared/pubsub')).subscribe(
      'TASK_UPDATED',
      (p) => p.projectId === 'keep',
    );

    publish('TASK_UPDATED', { taskId: 'a', projectId: 'drop' });
    publish('TASK_UPDATED', { taskId: 'b', projectId: 'keep' });

    const first = await iterator.next();
    expect(first.value.taskId).toBe('b'); // the 'drop' event was filtered out

    await iterator.return?.();
  });
});

describe('subscription scoping (authorized vs denied)', () => {
  it('streams scoped task events to an authorized subscriber', async () => {
    const iterator = await sub.taskUpdated.subscribe(null, { projectId }, ownerCtx);

    publish('TASK_UPDATED', { taskId: 'other', projectId: 'someone-elses-project' });
    publish('TASK_UPDATED', { taskId: 'mine', projectId });

    const event = await iterator.next();
    expect(event.value.taskId).toBe('mine');
    expect(sub.taskUpdated.resolve(event.value).projectId).toBe(projectId);

    await iterator.return?.();
  });

  it('denies a subscriber with no access to the project', async () => {
    await expect(
      sub.taskUpdated.subscribe(null, { projectId }, outsiderCtx),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('scopes notifications to the recipient', async () => {
    const iterator = sub.notificationReceived.subscribe(null, undefined, ownerCtx);

    publish('NOTIFICATION_CREATED', { notificationId: 'theirs', recipientId: 'someone-else' });
    publish('NOTIFICATION_CREATED', { notificationId: 'mine', recipientId: ownerId });

    const event = await iterator.next();
    expect(event.value.notificationId).toBe('mine');

    await iterator.return?.();
  });

  it('requires authentication for the notification stream', () => {
    const anonymous = createSubscriptionContext({});
    expect(() => sub.notificationReceived.subscribe(null, undefined, anonymous)).toThrow();
  });
});
