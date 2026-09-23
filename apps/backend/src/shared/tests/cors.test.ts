import request from 'supertest';
import { describe, expect, it, beforeAll } from 'vitest';
import type { Express } from 'express';
import { createApp } from '@/app';
import { env } from '@/shared/config';
import { ACCESS_COOKIE } from '@/shared/auth/cookies';
import { CLIENT_HEADER } from '@/shared/middleware/cors';

/**
 * Cross-origin and cross-site request policy.
 *
 * These assertions exist because the previous configuration — `cors({
 * credentials: true })`, which defaults to the `*` wildcard — silently made
 * every credentialed browser request fail. Nothing caught it, because a
 * non-browser test client ignores CORS entirely.
 */
let app: Express;

const ALLOWED = env.CORS_ORIGINS[0] ?? 'http://localhost:5173';
const FOREIGN = 'https://evil.example.com';

const HEALTH_QUERY = { query: '{ health { status } }' };

beforeAll(async () => {
  app = await createApp();
});

describe('CORS', () => {
  it('reflects an allowed origin instead of the wildcard', async () => {
    const response = await request(app)
      .post('/graphql')
      .set('Origin', ALLOWED)
      .send(HEALTH_QUERY);

    // A browser refuses `*` on a credentialed response, so the exact origin
    // must come back.
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(response.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('allows credentials so the auth cookies are sent and stored', async () => {
    const response = await request(app)
      .post('/graphql')
      .set('Origin', ALLOWED)
      .send(HEALTH_QUERY);

    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('sends no CORS headers for an origin that is not allowed', async () => {
    const response = await request(app)
      .post('/graphql')
      .set('Origin', FOREIGN)
      .send(HEALTH_QUERY);

    // Omitting the header is what makes the browser block the response.
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('exposes the request id so a browser client can read it', async () => {
    const response = await request(app)
      .post('/graphql')
      .set('Origin', ALLOWED)
      .send(HEALTH_QUERY);

    expect(response.headers['access-control-expose-headers']).toContain(
      'x-request-id',
    );
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('answers the preflight for the client header the web app sends', async () => {
    const response = await request(app)
      .options('/graphql')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', CLIENT_HEADER);

    expect(response.status).toBeLessThan(300);
    expect(
      response.headers['access-control-allow-headers']?.toLowerCase(),
    ).toContain(CLIENT_HEADER);
  });

  it('leaves non-browser clients alone', async () => {
    // No Origin header at all: curl, a script, a server-to-server call.
    const response = await request(app).post('/graphql').send(HEALTH_QUERY);

    expect(response.status).toBe(200);
  });
});

describe('CSRF guard', () => {
  it('rejects a cookie-authenticated request with no client header', async () => {
    const response = await request(app)
      .post('/graphql')
      .set('Cookie', `${ACCESS_COOKIE}=some-token`)
      .set('Origin', ALLOWED)
      .send(HEALTH_QUERY);

    expect(response.status).toBe(403);
    expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN');
  });

  it('accepts a cookie-authenticated request that sends the client header', async () => {
    const response = await request(app)
      .post('/graphql')
      .set('Cookie', `${ACCESS_COOKIE}=some-token`)
      .set('Origin', ALLOWED)
      .set(CLIENT_HEADER, 'optitask-web')
      .send(HEALTH_QUERY);

    expect(response.status).toBe(200);
  });

  it('rejects a cookie-authenticated request from a foreign origin', async () => {
    const response = await request(app)
      .post('/graphql')
      .set('Cookie', `${ACCESS_COOKIE}=some-token`)
      .set('Origin', FOREIGN)
      .set(CLIENT_HEADER, 'optitask-web')
      .send(HEALTH_QUERY);

    expect(response.status).toBe(403);
  });

  it('does not guard a request authenticated by the Authorization header', async () => {
    // A cross-site form cannot set Authorization, so there is nothing to forge.
    const response = await request(app)
      .post('/graphql')
      .set('Authorization', 'Bearer some-token')
      .send(HEALTH_QUERY);

    expect(response.status).toBe(200);
  });

  it('does not guard an unauthenticated request', async () => {
    const response = await request(app).post('/graphql').send(HEALTH_QUERY);

    expect(response.status).toBe(200);
  });

  it('guards the refresh cookie too, not only the access cookie', async () => {
    // A refresh alone is enough to mint a new session, so it must be covered.
    const response = await request(app)
      .post('/graphql')
      .set('Cookie', 'optitask_refresh=some-token')
      .set('Origin', ALLOWED)
      .send(HEALTH_QUERY);

    expect(response.status).toBe(403);
  });
});
