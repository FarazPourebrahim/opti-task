import { HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthQuery } from '@/shared/graphql/health.operations';
import { ApiError } from '@/shared/lib/apiError';
import { createApolloClient } from '@/shared/services/apollo.client';
import {
  CLIENT_HEADER,
  resetRefreshState,
} from '@/shared/services/auth.gateway';
import {
  clearAccessToken,
  getAccessToken,
} from '@/shared/services/session.store';
import {
  graphql,
  mockNonGraphqlResponse,
  mockQuery,
  mockQueryError,
} from '@/shared/tests/graphql';
import { MyNotificationsQuery } from '@/modules/notification/graphql/notification.operations';
import { server } from '@/shared/tests/server';

const HEALTH_DATA = {
  health: {
    __typename: 'HealthStatus',
    status: 'ok',
    uptimeSeconds: 12,
    timestamp: '2026-03-01T00:00:00.000Z',
  },
};

function client() {
  return createApolloClient({ enableSubscriptions: false });
}

async function expectApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(ApiError.is(error), 'not an ApiError').toBe(true);
    return error as ApiError;
  }
  throw new Error('expected the operation to reject');
}

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('link chain', () => {
  it('resolves a query through the real chain', async () => {
    server.use(mockQuery('Health', HEALTH_DATA));

    const result = await client().query({ query: HealthQuery });

    expect(result.data?.health.status).toBe('ok');
  });

  it('sends the CSRF client header on every request', async () => {
    const seen: Array<string | null> = [];
    server.use(
      graphql.query('Health', ({ request }) => {
        seen.push(request.headers.get(CLIENT_HEADER));
        return HttpResponse.json({ data: HEALTH_DATA });
      }),
    );

    await client().query({ query: HealthQuery });

    // A cross-site form cannot set a custom header, so its presence is what
    // backs up the SameSite cookie.
    expect(seen).toEqual(['optitask-web']);
  });

  it('normalizes a GraphQL error into an ApiError, never a raw Apollo error', async () => {
    server.use(mockQueryError('Health', 'FORBIDDEN', 'nope'));

    const error = await expectApiError(client().query({ query: HealthQuery }));

    expect(error.kind).toBe('forbidden');
    expect(error.messageKey).toBe('error.forbidden');
  });

  it('normalizes a transport failure', async () => {
    server.use(graphql.query('Health', () => HttpResponse.error()));

    const error = await expectApiError(client().query({ query: HealthQuery }));

    expect(error.kind).toBe('network');
  });

  it('keeps the HTTP status when the body is not GraphQL at all', async () => {
    server.use(mockNonGraphqlResponse('Health', 502));

    const error = await expectApiError(client().query({ query: HealthQuery }));

    expect(error.status).toBe(502);
    expect(error.kind).toBe('server');
  });

  it('attaches the request id from the response header', async () => {
    server.use(
      graphql.query('Health', () =>
        HttpResponse.json(
          { errors: [{ message: 'boom', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] },
          { headers: { 'x-request-id': 'req-2f9c1a' } },
        ),
      ),
    );

    const error = await expectApiError(client().query({ query: HealthQuery }));

    expect(error.requestId).toBe('req-2f9c1a');
  });
});

describe('authentication refresh', () => {
  /**
   * Fails with UNAUTHENTICATED until the session has been refreshed.
   *
   * Keyed on the refresh having happened rather than on a call count: Apollo
   * deduplicates identical concurrent operations, so a count-based handler
   * would see one request where the test issued three.
   */
  function healthUntilRefreshed(
    refreshCounter: { calls: number },
    counter: { calls: number },
    neverRecover = false,
  ) {
    return graphql.query('Health', () => {
      counter.calls += 1;
      if (neverRecover || refreshCounter.calls === 0) {
        return HttpResponse.json({
          errors: [
            { message: 'expired', extensions: { code: 'UNAUTHENTICATED' } },
          ],
          data: null,
        });
      }
      return HttpResponse.json({ data: HEALTH_DATA });
    });
  }

  function refreshHandler(counter: { calls: number }, succeed = true) {
    return graphql.mutation('Refresh', () => {
      counter.calls += 1;
      return succeed
        ? HttpResponse.json({
            data: { refreshToken: { accessToken: 'fresh-token' } },
          })
        : HttpResponse.json({
            errors: [
              { message: 'expired', extensions: { code: 'UNAUTHENTICATED' } },
            ],
            data: null,
          });
    });
  }

  it('refreshes and replays the operation, invisibly to the caller', async () => {
    const health = { calls: 0 };
    const refresh = { calls: 0 };
    server.use(healthUntilRefreshed(refresh, health), refreshHandler(refresh));

    const result = await client().query({ query: HealthQuery });

    expect(result.data?.health.status).toBe('ok');
    expect(refresh.calls).toBe(1);
    // Original attempt + replay.
    expect(health.calls).toBe(2);
  });

  it('stores the refreshed token in memory, never in storage', async () => {
    const health = { calls: 0 };
    const refresh = { calls: 0 };
    server.use(healthUntilRefreshed(refresh, health), refreshHandler(refresh));

    await client().query({ query: HealthQuery });

    expect(getAccessToken()).toBe('fresh-token');
    expect(window.localStorage.getItem('optitask-access')).toBeNull();
    expect(JSON.stringify(window.localStorage)).not.toContain('fresh-token');
    expect(JSON.stringify(window.sessionStorage)).not.toContain('fresh-token');
  });

  it('refreshes ONCE when several requests fail at the same time', async () => {
    const health = { calls: 0 };
    const refresh = { calls: 0 };
    server.use(healthUntilRefreshed(refresh, health), refreshHandler(refresh));

    const shared = client();
    await Promise.all([
      shared.query({ query: HealthQuery, fetchPolicy: 'no-cache' }),
      shared.query({ query: HealthQuery, fetchPolicy: 'no-cache' }),
      shared.query({ query: HealthQuery, fetchPolicy: 'no-cache' }),
    ]);

    // Three refreshes would rotate the refresh token three times and the
    // backend's reuse detection would revoke the session.
    expect(refresh.calls).toBe(1);
  });

  it('gives up after one replay rather than looping', async () => {
    const health = { calls: 0 };
    const refresh = { calls: 0 };
    // Always unauthenticated, even after a successful refresh.
    server.use(healthUntilRefreshed(refresh, health, true), refreshHandler(refresh));

    const error = await expectApiError(client().query({ query: HealthQuery }));

    expect(error.kind).toBe('unauthorized');
    expect(health.calls).toBe(2);
    expect(refresh.calls).toBe(1);
  });

  it('signals session expiry and clears the cache when refresh fails', async () => {
    const health = { calls: 0 };
    const refresh = { calls: 0 };
    server.use(
      healthUntilRefreshed(refresh, health, true),
      refreshHandler(refresh, false),
    );

    const onSessionExpired = vi.fn();
    const instance = createApolloClient({
      enableSubscriptions: false,
      onSessionExpired,
    });

    const error = await expectApiError(instance.query({ query: HealthQuery }));

    expect(error.kind).toBe('unauthorized');
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    // Nothing cached belongs to a signed-out user.
    expect(instance.cache.extract()).toEqual({});
  });
});

describe('cache policies', () => {
  const NOTIFICATION = (id: string, title: string, read: boolean) => ({
    __typename: 'NotificationEdge',
    cursor: `cursor-${id}`,
    node: {
      __typename: 'Notification',
      id,
      type: 'MENTION',
      title,
      body: null,
      read,
      createdAt: '2026-03-01T00:00:00.000Z',
    },
  });

  function notificationPage(
    edges: ReturnType<typeof NOTIFICATION>[],
    hasNextPage = false,
  ) {
    return {
      myNotifications: {
        __typename: 'NotificationConnection',
        edges,
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage,
          endCursor: edges.at(-1)?.cursor ?? null,
        },
        totalCount: edges.length,
      },
    };
  }

  it('keeps separate entries per filter, so switching filters never shows stale rows', async () => {
    server.use(
      graphql.query('MyNotifications', ({ variables }) =>
        HttpResponse.json({
          data: notificationPage([
            variables['unreadOnly'] === true
              ? NOTIFICATION('u1', 'Unread only', false)
              : NOTIFICATION('a1', 'Everything', true),
          ]),
        }),
      ),
    );

    const instance = client();
    const unread = await instance.query({
      query: MyNotificationsQuery,
      variables: { unreadOnly: true },
    });
    const all = await instance.query({
      query: MyNotificationsQuery,
      variables: { unreadOnly: false },
    });

    expect(unread.data?.myNotifications.edges[0]?.node?.title).toBe(
      'Unread only',
    );
    // Without `unreadOnly` in keyArgs the second read would return the first
    // list from cache.
    expect(all.data?.myNotifications.edges[0]?.node?.title).toBe('Everything');
  });

  it('appends on fetchMore rather than replacing the visible page', async () => {
    server.use(
      graphql.query('MyNotifications', ({ variables }) =>
        HttpResponse.json({
          data: variables['after']
            ? notificationPage([NOTIFICATION('n2', 'Second', false)], false)
            : notificationPage([NOTIFICATION('n1', 'First', false)], true),
        }),
      ),
    );

    const instance = client();
    const first = await instance.query({
      query: MyNotificationsQuery,
      variables: { first: 1 },
    });
    expect(first.data?.myNotifications.edges.map((e) => e?.node?.title)).toEqual(
      ['First'],
    );

    // `network-only`, because relayStylePagination's read returns the whole
    // merged list — a cache-first read with `after` would be satisfied from
    // cache and never fetch the next page.
    await instance.query({
      query: MyNotificationsQuery,
      variables: { first: 1, after: 'cursor-n1' },
      fetchPolicy: 'network-only',
    });

    const merged = instance.readQuery({
      query: MyNotificationsQuery,
      variables: { first: 1 },
    });

    // The new page is appended to the existing list, not swapped for it.
    expect(merged?.myNotifications.edges.map((e) => e?.node?.title)).toEqual([
      'First',
      'Second',
    ]);
  });

  it('does not blow away the cache on an ordinary error', async () => {
    const instance = client();
    server.use(mockQuery('Health', HEALTH_DATA));
    await instance.query({ query: HealthQuery });

    server.use(mockQueryError('Health', 'FORBIDDEN'));
    await expectApiError(
      instance.query({ query: HealthQuery, fetchPolicy: 'network-only' }),
    );

    expect(instance.cache.extract()).not.toEqual({});
  });
});
