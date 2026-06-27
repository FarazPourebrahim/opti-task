import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { prisma } from '@shared/db';

/**
 * Integration tests for the platform spine — drive the real Express + Apollo app
 * over HTTP (the production path), so pagination, scalars, filtering, the
 * DataLoader-backed `organizationCount`, and the error formatter are all
 * exercised end to end. Requires a migrated Postgres via DATABASE_URL.
 */
const TOKEN = `p2_${Date.now()}`;
const domain = '@p2.test';

const USERS_QUERY = /* GraphQL */ `
  query Users($first: Int, $after: String, $filter: UserFilter) {
    users(first: $first, after: $after, filter: $filter, orderBy: ASC) {
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        cursor
        node {
          id
          email
          organizationCount
        }
      }
    }
  }
`;

type UsersConnection = {
  totalCount: number;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  edges: Array<{
    cursor: string;
    node: { id: string; email: string; organizationCount: number };
  }>;
};

let app: Express;
let ownerId = '';

async function runUsers(
  variables: Record<string, unknown>,
): Promise<UsersConnection> {
  const response = await request(app)
    .post('/graphql')
    .send({ query: USERS_QUERY, variables });

  expect(response.status).toBe(200);
  expect(response.body.errors).toBeUndefined();
  return response.body.data.users as UsersConnection;
}

beforeAll(async () => {
  app = await createApp();

  const owner = await prisma.user.create({
    data: { email: `${TOKEN}-1${domain}`, name: 'P2 One', passwordHash: 'x' },
  });
  ownerId = owner.id;
  await prisma.user.create({
    data: { email: `${TOKEN}-2${domain}`, name: 'P2 Two', passwordHash: 'x' },
  });
  await prisma.user.create({
    data: { email: `${TOKEN}-3${domain}`, name: 'P2 Three', passwordHash: 'x' },
  });

  await prisma.organization.create({
    data: {
      name: `${TOKEN}-org`,
      ownerId,
      members: { create: { userId: ownerId, role: 'OWNER' } },
    },
  });
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { name: { contains: TOKEN } } });
  await prisma.user.deleteMany({ where: { email: { contains: domain } } });
  await prisma.$disconnect();
});

describe('users connection query (HTTP)', () => {
  it('returns an explicit empty connection when nothing matches', async () => {
    const users = await runUsers({ filter: { emailContains: 'no-such-user-xyz' } });

    expect(users.edges).toEqual([]);
    expect(users.totalCount).toBe(0);
    expect(users.pageInfo.hasNextPage).toBe(false);
    expect(users.pageInfo.startCursor).toBeNull();
    expect(users.pageInfo.endCursor).toBeNull();
  });

  it('returns a full single page when first exceeds the result size', async () => {
    const users = await runUsers({ first: 50, filter: { emailContains: TOKEN } });

    expect(users.totalCount).toBe(3);
    expect(users.edges).toHaveLength(3);
    expect(users.pageInfo.hasNextPage).toBe(false);
  });

  it('paginates across multiple pages via the cursor', async () => {
    const firstPage = await runUsers({ first: 2, filter: { emailContains: TOKEN } });

    expect(firstPage.edges).toHaveLength(2);
    expect(firstPage.totalCount).toBe(3);
    expect(firstPage.pageInfo.hasNextPage).toBe(true);

    const secondPage = await runUsers({
      first: 2,
      after: firstPage.pageInfo.endCursor,
      filter: { emailContains: TOKEN },
    });

    expect(secondPage.edges).toHaveLength(1);
    expect(secondPage.pageInfo.hasNextPage).toBe(false);
    expect(secondPage.pageInfo.hasPreviousPage).toBe(true);
  });

  it('resolves organizationCount through the DataLoader', async () => {
    const users = await runUsers({ first: 50, filter: { emailContains: TOKEN } });

    const owner = users.edges.find((edge) => edge.node.id === ownerId);
    expect(owner?.node.organizationCount).toBe(1);
  });

  it('returns a safe BAD_USER_INPUT error for an invalid page size', async () => {
    const response = await request(app)
      .post('/graphql')
      .send({ query: USERS_QUERY, variables: { first: -5 } });

    expect(response.status).toBe(200);
    expect(response.body.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    expect(response.body.errors?.[0]?.message).toContain('positive integer');
  });
});
