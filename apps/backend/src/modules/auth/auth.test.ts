import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { prisma } from '@/shared/db';
import { env } from '@/shared/config';

/**
 * Auth lifecycle integration tests — drive the real app over HTTP. Cover the
 * testing.md matrix: success, failure, invalid input, and authorization.
 * Require a migrated Postgres via DATABASE_URL.
 */
const domain = '@authtest.test';
let app: Express;

type GqlBody = {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
};

async function gql(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string,
): Promise<GqlBody> {
  const req = request(app).post('/graphql');
  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }
  const response = await req.send({ query, variables });
  return response.body as GqlBody;
}

const REGISTER = /* GraphQL */ `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      refreshToken
      user {
        id
        email
      }
    }
  }
`;

const LOGIN = /* GraphQL */ `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
    }
  }
`;

const REFRESH = /* GraphQL */ `
  mutation Refresh($refreshToken: String) {
    refreshToken(refreshToken: $refreshToken) {
      accessToken
      refreshToken
    }
  }
`;

const ME = /* GraphQL */ `
  query Me {
    me {
      email
    }
  }
`;

function uniqueEmail(tag: string): string {
  return `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${domain}`;
}

async function registerUser(email: string): Promise<{
  accessToken: string;
  refreshToken: string;
  userId: string;
}> {
  const body = await gql(REGISTER, {
    input: { email, name: 'Auth Test', password: 'secret123' },
  });
  const register = body.data?.register as {
    accessToken: string;
    refreshToken: string;
    user: { id: string };
  };
  return {
    accessToken: register.accessToken,
    refreshToken: register.refreshToken,
    userId: register.user.id,
  };
}

beforeAll(async () => {
  app = await createApp();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: domain } } });
  await prisma.$disconnect();
});

describe('register', () => {
  it('creates a user and returns tokens that authorize me', async () => {
    // Arrange
    const email = uniqueEmail('reg');

    // Act
    const { accessToken } = await registerUser(email);
    const meBody = await gql(ME, {}, accessToken);

    // Assert
    expect(accessToken).toBeTruthy();
    expect((meBody.data?.me as { email: string }).email).toBe(email);
  });

  it('rejects a duplicate email with CONFLICT', async () => {
    const email = uniqueEmail('dupe');
    await registerUser(email);

    const body = await gql(REGISTER, {
      input: { email, name: 'Dupe', password: 'secret123' },
    });

    expect(body.errors?.[0]?.extensions?.code).toBe('CONFLICT');
  });

  it('rejects a weak password with BAD_USER_INPUT', async () => {
    const body = await gql(REGISTER, {
      input: { email: uniqueEmail('weak'), name: 'Weak', password: 'short' },
    });

    expect(body.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('rejects an invalid email with BAD_USER_INPUT', async () => {
    const body = await gql(REGISTER, {
      input: { email: 'not-an-email', name: 'Bad', password: 'secret123' },
    });

    expect(body.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });
});

describe('login', () => {
  it('authenticates with correct credentials', async () => {
    const email = uniqueEmail('login');
    await registerUser(email);

    const body = await gql(LOGIN, {
      input: { email, password: 'secret123' },
    });

    expect((body.data?.login as { accessToken: string }).accessToken).toBeTruthy();
  });

  it('rejects a wrong password with UNAUTHENTICATED', async () => {
    const email = uniqueEmail('wrong');
    await registerUser(email);

    const body = await gql(LOGIN, {
      input: { email, password: 'wrongpassword1' },
    });

    expect(body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
    // Generic message: no account enumeration.
    expect(body.errors?.[0]?.message).toBe('Invalid email or password');
  });

  it('rejects an unknown email with the same generic message', async () => {
    const body = await gql(LOGIN, {
      input: { email: uniqueEmail('ghost'), password: 'secret123' },
    });

    expect(body.errors?.[0]?.message).toBe('Invalid email or password');
  });
});

describe('me authorization', () => {
  it('rejects an anonymous request with UNAUTHENTICATED', async () => {
    const body = await gql(ME);
    expect(body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('treats an expired access token as anonymous', async () => {
    const { userId } = await registerUser(uniqueEmail('expired'));
    const expiredToken = jwt.sign(
      { sub: userId, email: 'x@x.test', sid: 'sess', type: 'access' },
      env.JWT_ACCESS_SECRET as string,
      { expiresIn: '-1s' },
    );

    const body = await gql(ME, {}, expiredToken);

    expect(body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a tampered access token', async () => {
    const { accessToken } = await registerUser(uniqueEmail('tamper'));
    const body = await gql(ME, {}, `${accessToken}tampered`);

    expect(body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });
});

describe('refresh rotation', () => {
  it('rotates tokens and revokes the session when an old token is reused', async () => {
    // Arrange
    const { refreshToken } = await registerUser(uniqueEmail('rotate'));

    // Act — first rotation succeeds and returns a different refresh token.
    const rotated = await gql(REFRESH, { refreshToken });
    const newRefresh = (rotated.data?.refreshToken as { refreshToken: string })
      .refreshToken;

    // Assert
    expect(newRefresh).toBeTruthy();
    expect(newRefresh).not.toBe(refreshToken);

    // Reusing the OLD token is detected and revokes the session.
    const reuse = await gql(REFRESH, { refreshToken });
    expect(reuse.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');

    // The rotated token is now also invalid because the session was revoked.
    const afterRevoke = await gql(REFRESH, { refreshToken: newRefresh });
    expect(afterRevoke.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a missing refresh token', async () => {
    const body = await gql(REFRESH, {});
    expect(body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });
});
