import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { prisma } from '@shared/db';

/**
 * User module integration tests over HTTP. Covers the connection query
 * (empty/single/multi-page + DataLoader fields), profile/skill/expertise
 * mutations, validation, and authorization. Requires Postgres via DATABASE_URL.
 */
const domain = '@p5user.test';
const TOKEN = `p5u_${Date.now()}`;

let app: Express;
let token = '';
let actorId = '';

type GqlBody = {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
};

async function gql(
  query: string,
  variables: Record<string, unknown> = {},
  authToken: string | undefined = token,
): Promise<GqlBody> {
  const req = request(app).post('/graphql');
  if (authToken) {
    req.set('Authorization', `Bearer ${authToken}`);
  }
  const response = await req.send({ query, variables });
  return response.body as GqlBody;
}

const USERS_QUERY = /* GraphQL */ `
  query Users($first: Int, $after: String, $filter: UserFilter) {
    users(first: $first, after: $after, filter: $filter, orderBy: ASC) {
      totalCount
      pageInfo { hasNextPage hasPreviousPage endCursor }
      edges { cursor node { id email organizationCount } }
    }
  }
`;

type UsersConnection = {
  totalCount: number;
  pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean; endCursor: string | null };
  edges: Array<{ cursor: string; node: { id: string; email: string; organizationCount: number } }>;
};

async function runUsers(variables: Record<string, unknown>): Promise<UsersConnection> {
  const body = await gql(USERS_QUERY, variables);
  expect(body.errors).toBeUndefined();
  return (body.data?.users as UsersConnection);
}

beforeAll(async () => {
  app = await createApp();

  const reg = await gql(
    /* GraphQL */ `
      mutation ($input: RegisterInput!) {
        register(input: $input) {
          accessToken
          user { id }
        }
      }
    `,
    { input: { email: `actor-${Date.now()}${domain}`, name: 'Actor', password: 'secret123' } },
    '',
  );
  const register = reg.data?.register as { accessToken: string; user: { id: string } };
  token = register.accessToken;
  actorId = register.user.id;

  // The actor owns an organization, so organizationCount should resolve to 1.
  await gql(
    /* GraphQL */ `
      mutation ($input: CreateOrganizationInput!) {
        createOrganization(input: $input) { id }
      }
    `,
    { input: { name: `${TOKEN}-org` } },
  );

  // Three filterable users for pagination assertions.
  for (let i = 1; i <= 3; i += 1) {
    await prisma.user.create({
      data: { email: `${TOKEN}-${i}${domain}`, name: `User ${i}`, passwordHash: 'x' },
    });
  }
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { name: { contains: TOKEN } } });
  await prisma.user.deleteMany({ where: { email: { contains: domain } } });
  await prisma.$disconnect();
});

describe('users connection', () => {
  it('requires authentication', async () => {
    const body = await gql(USERS_QUERY, { first: 5 }, '');
    expect(body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('returns an explicit empty connection when nothing matches', async () => {
    const users = await runUsers({ filter: { emailContains: 'no-match-xyz' } });
    expect(users.edges).toEqual([]);
    expect(users.totalCount).toBe(0);
    expect(users.pageInfo.hasNextPage).toBe(false);
  });

  it('returns a full single page', async () => {
    const users = await runUsers({ first: 50, filter: { emailContains: TOKEN } });
    expect(users.totalCount).toBe(3);
    expect(users.edges).toHaveLength(3);
    expect(users.pageInfo.hasNextPage).toBe(false);
  });

  it('paginates across multiple pages', async () => {
    const page1 = await runUsers({ first: 2, filter: { emailContains: TOKEN } });
    expect(page1.edges).toHaveLength(2);
    expect(page1.pageInfo.hasNextPage).toBe(true);

    const page2 = await runUsers({
      first: 2,
      after: page1.pageInfo.endCursor,
      filter: { emailContains: TOKEN },
    });
    expect(page2.edges).toHaveLength(1);
    expect(page2.pageInfo.hasPreviousPage).toBe(true);
  });

  it('returns a safe BAD_USER_INPUT error for an invalid page size', async () => {
    const body = await gql(USERS_QUERY, { first: -5 });
    expect(body.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });
});

describe('user profile', () => {
  it('resolves organizationCount via the DataLoader', async () => {
    const body = await gql(
      /* GraphQL */ `
        query ($id: UUID!) {
          user(id: $id) { id email organizationCount }
        }
      `,
      { id: actorId },
    );
    expect((body.data?.user as { organizationCount: number }).organizationCount).toBe(1);
  });

  it('updates the profile', async () => {
    const body = await gql(
      /* GraphQL */ `
        mutation ($input: UpdateProfileInput!) {
          updateProfile(input: $input) { name seniority }
        }
      `,
      { input: { name: 'Renamed Actor', seniority: 'SENIOR' } },
    );
    const user = body.data?.updateProfile as { name: string; seniority: string };
    expect(user.name).toBe('Renamed Actor');
    expect(user.seniority).toBe('SENIOR');
  });

  it('adds and removes skills', async () => {
    const added = await gql(
      /* GraphQL */ `mutation { addSkill(skill: "TypeScript") { skills } }`,
    );
    expect((added.data?.addSkill as { skills: string[] }).skills).toContain('TypeScript');

    const removed = await gql(
      /* GraphQL */ `mutation { removeSkill(skill: "TypeScript") { skills } }`,
    );
    expect((removed.data?.removeSkill as { skills: string[] }).skills).not.toContain(
      'TypeScript',
    );
  });

  it('adds expertise and rejects an out-of-range confidence', async () => {
    const ok = await gql(
      /* GraphQL */ `
        mutation ($input: AddExpertiseInput!) {
          addExpertise(input: $input) { expertise { tag confidenceScore } }
        }
      `,
      { input: { tag: 'backend', confidenceScore: 0.8 } },
    );
    const expertise = (ok.data?.addExpertise as { expertise: Array<{ tag: string }> }).expertise;
    expect(expertise.some((e) => e.tag === 'backend')).toBe(true);

    const bad = await gql(
      /* GraphQL */ `
        mutation ($input: AddExpertiseInput!) {
          addExpertise(input: $input) { id }
        }
      `,
      { input: { tag: 'frontend', confidenceScore: 5 } },
    );
    expect(bad.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('requires authentication to update the profile', async () => {
    const body = await gql(
      /* GraphQL */ `mutation { addSkill(skill: "x") { id } }`,
      {},
      '',
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });
});
