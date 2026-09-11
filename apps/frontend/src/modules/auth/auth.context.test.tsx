import { HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { HealthQuery } from '@/shared/graphql/health.operations';
import { resetRefreshState } from '@/shared/services/auth.gateway';
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from '@/shared/services/session.store';
import { createApolloClient } from '@/shared/services/apollo.client';
import { graphql, mockQuery } from '@/shared/tests/graphql';
import {
  render,
  renderWithProviders,
  screen,
  waitFor,
} from '@/shared/tests/renderWithProviders';
import { server } from '@/shared/tests/server';

const USER = {
  __typename: 'User',
  id: 'u1',
  email: 'me@acme.test',
  name: 'Dana Scully',
  avatarUrl: null,
  seniority: null,
  organizationCount: 2,
};

function AuthProbe() {
  const { status, user, logout } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.name ?? 'none'}</span>
      <button type="button" onClick={() => void logout()}>
        Sign out
      </button>
    </div>
  );
}

function meSucceeds() {
  return graphql.query('CurrentUser', () =>
    HttpResponse.json({ data: { me: USER } }),
  );
}

function meUnauthenticated() {
  return graphql.query('CurrentUser', () =>
    HttpResponse.json({
      errors: [{ message: 'no session', extensions: { code: 'UNAUTHENTICATED' } }],
      data: null,
    }),
  );
}

function refreshFails() {
  return graphql.mutation('Refresh', () =>
    HttpResponse.json({
      errors: [{ message: 'no session', extensions: { code: 'UNAUTHENTICATED' } }],
      data: null,
    }),
  );
}

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
});

describe('session bootstrap', () => {
  it('recovers an existing session from the cookie on load', async () => {
    server.use(meSucceeds());

    renderWithProviders(<AuthProbe />);

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    );
    expect(screen.getByTestId('user')).toHaveTextContent('Dana Scully');
  });

  it('reports loading first, so a guard never redirects prematurely', () => {
    server.use(meSucceeds());

    renderWithProviders(<AuthProbe />);

    // Treating "not yet known" as "signed out" would bounce a signed-in user
    // to the login screen on every reload.
    expect(screen.getByTestId('status')).toHaveTextContent('loading');
  });

  it('settles on unauthenticated when there is no session to recover', async () => {
    server.use(meUnauthenticated(), refreshFails());

    renderWithProviders(<AuthProbe />);

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'),
    );
  });

  it('recovers through a refresh when only the refresh cookie survives', async () => {
    let meCalls = 0;
    let refreshed = false;

    server.use(
      graphql.query('CurrentUser', () => {
        meCalls += 1;
        // Unauthorized until the refresh has happened.
        return refreshed
          ? HttpResponse.json({ data: { me: USER } })
          : HttpResponse.json({
              errors: [
                { message: 'expired', extensions: { code: 'UNAUTHENTICATED' } },
              ],
              data: null,
            });
      }),
      graphql.mutation('Refresh', () => {
        refreshed = true;
        return HttpResponse.json({
          data: { refreshToken: { accessToken: 'fresh' } },
        });
      }),
    );

    renderWithProviders(<AuthProbe />);

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    );
    expect(meCalls).toBeGreaterThan(1);
  });
});

describe('sign out', () => {
  it('leaves no trace of the previous user for the next one', async () => {
    server.use(
      meSucceeds(),
      mockQuery('Health', {
        health: {
          __typename: 'HealthStatus',
          status: 'ok',
          uptimeSeconds: 1,
          timestamp: '2026-03-01T00:00:00.000Z',
        },
      }),
      graphql.mutation('Logout', () => HttpResponse.json({ data: { logout: true } })),
    );

    const client = createApolloClient({ enableSubscriptions: false });
    setAccessToken('token-for-user-one');

    const { user } = renderWithProviders(<AuthProbe />, {
      apolloClient: client,
    });
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    );

    // Put something in the cache that must not survive.
    await client.query({ query: HealthQuery });
    expect(client.cache.extract()).not.toEqual({});

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'),
    );
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    // The three things that would otherwise leak into the next session.
    expect(getAccessToken()).toBeNull();
    expect(client.cache.extract()).toEqual({});
  });

  it('signs out locally even when the server call fails', async () => {
    server.use(
      meSucceeds(),
      graphql.mutation('Logout', () => HttpResponse.error()),
    );
    setAccessToken('token-for-user-one');

    const { user } = renderWithProviders(<AuthProbe />);
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    );

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    // Leaving someone apparently signed in because sign-out failed is worse
    // than signing them out optimistically.
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'),
    );
    expect(getAccessToken()).toBeNull();
  });
});

describe('useAuth', () => {
  it('throws a useful error outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Plain `render`, deliberately: renderWithProviders supplies the provider,
    // which would make this assertion vacuous.
    expect(() => render(<AuthProbe />)).toThrowError(/AuthProvider/);

    spy.mockRestore();
  });
});
