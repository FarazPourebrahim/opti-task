import { HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { routes } from '@/App';
import { resolveReturnTo } from '@/modules/auth/utils/auth.utils';
import { ROUTES, acceptInvitationPath } from '@/shared/routes/route.constants';
import { resetRefreshState } from '@/shared/services/auth.gateway';
import { clearAccessToken } from '@/shared/services/session.store';
import { graphql } from '@/shared/tests/graphql';
import {
  renderRoutes,
  screen,
  waitFor,
} from '@/shared/tests/renderWithProviders';
import { server } from '@/shared/tests/server';
import {
  TEST_USER,
  loginSucceeds,
  signedIn,
  signedOut,
} from '@/shared/tests/session';

const SESSION = {
  __typename: 'Session',
  id: 's1',
  userAgent: 'Firefox on Linux',
  ipAddress: '203.0.113.7',
  createdAt: '2026-10-01T10:00:00.000Z',
  expiresAt: '2026-10-08T10:00:00.000Z',
  current: true,
};

function sessionsSucceed() {
  return graphql.query('Sessions', () =>
    HttpResponse.json({ data: { sessions: [SESSION] } }),
  );
}

async function signInThroughTheForm(
  user: ReturnType<typeof renderRoutes>['user'],
) {
  await user.type(await screen.findByLabelText('Email'), 'me@acme.test');
  await user.type(screen.getByLabelText('Password'), 'passw0rd');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
});

describe('protected routes', () => {
  it('sends a signed-out visitor to sign in', async () => {
    // Arrange
    server.use(...signedOut());

    // Act
    const { router } = renderRoutes(routes, { route: ROUTES.accountSessions });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Sign in to OptiTask' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(ROUTES.login);
  });

  it('returns to the intended page after signing in', async () => {
    // Arrange
    server.use(...signedOut(), loginSucceeds(), sessionsSucceed());
    const { user, router } = renderRoutes(routes, {
      route: ROUTES.accountSessions,
    });

    // Act
    await signInThroughTheForm(user);

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Active sessions' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(ROUTES.accountSessions);
  });

  it('does not bounce a signed-in user to sign in while the session loads', async () => {
    // Arrange
    server.use(...signedIn(), sessionsSucceed());

    // Act
    const { router } = renderRoutes(routes, { route: ROUTES.accountSessions });

    // Assert — a loader first, never the sign-in form.
    expect(screen.getByRole('status', { name: 'Loading…' })).toBeVisible();
    expect(
      await screen.findByRole('heading', { name: 'Active sessions' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(ROUTES.accountSessions);
  });

  it('sends the user to sign in when the session expires mid-use', async () => {
    // Arrange — signed in at boot, but the next request finds the session gone
    // and the refresh fails too.
    const unauthenticated = {
      errors: [{ message: 'expired', extensions: { code: 'UNAUTHENTICATED' } }],
      data: null,
    };
    server.use(
      ...signedIn(),
      graphql.query('Sessions', () => HttpResponse.json(unauthenticated)),
      graphql.mutation('Refresh', () => HttpResponse.json(unauthenticated)),
    );

    // Act
    const { router } = renderRoutes(routes, { route: ROUTES.accountSessions });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Sign in to OptiTask' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(ROUTES.login);
  });
});

describe('guest routes', () => {
  it('moves an already signed-in user off the sign-in screen', async () => {
    // Arrange
    server.use(...signedIn());

    // Act
    const { router } = renderRoutes(routes, { route: ROUTES.login });

    // Assert
    expect(
      await screen.findByRole('heading', {
        name: `Welcome back, ${TEST_USER.name}`,
      }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(ROUTES.home);
  });

  it('navigates between the signed-out screens without a reload', async () => {
    // Arrange
    server.use(...signedOut());
    const { user, router } = renderRoutes(routes, { route: ROUTES.login });

    // Act
    await user.click(
      await screen.findByRole('link', { name: 'Create account' }),
    );

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Create your account' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(ROUTES.register);
  });
});

describe('return-to resolution', () => {
  it('rebuilds the path, query and hash of the intended page', () => {
    const state = {
      from: { pathname: '/account/sessions', search: '?tab=1', hash: '#top' },
    };

    expect(resolveReturnTo(state)).toBe('/account/sessions?tab=1#top');
  });

  // Router state survives a reload and is not typed, so it is validated.
  const rejected: Array<[string, unknown]> = [
    ['no state', null],
    ['an unrelated object', { foo: 'bar' }],
    ['a non-string path', { from: { pathname: 42 } }],
    ['an absolute URL', { from: { pathname: 'https://evil.test/' } }],
    ['a protocol-relative URL', { from: { pathname: '//evil.test/' } }],
  ];

  it.each(rejected)('falls back to home for %s', (_label, state) => {
    expect(resolveReturnTo(state)).toBe(ROUTES.home);
  });
});

describe('accept invitation', () => {
  it('asks a signed-out visitor to sign in, then returns to the invitation', async () => {
    // Arrange
    let accepted = 0;
    server.use(
      ...signedOut(),
      loginSucceeds(),
      graphql.mutation('AcceptInvitation', () => {
        accepted += 1;
        return HttpResponse.json({
          data: {
            acceptInvitation: {
              __typename: 'OrganizationMember',
              id: 'm1',
              role: 'MEMBER',
              user: { __typename: 'User', id: 'u1', name: 'Dana Scully' },
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, {
      route: acceptInvitationPath('tok-1'),
    });

    // Act
    await user.click(await screen.findByRole('link', { name: 'Sign in' }));
    await signInThroughTheForm(user);

    // Assert
    expect(
      await screen.findByText('You’ve joined the organisation.'),
    ).toBeVisible();
    expect(accepted).toBe(1);
  });

  it('reports an expired or used link without redeeming twice', async () => {
    // Arrange
    let attempts = 0;
    server.use(
      ...signedIn(),
      graphql.mutation('AcceptInvitation', () => {
        attempts += 1;
        return HttpResponse.json({
          errors: [{ message: 'gone', extensions: { code: 'NOT_FOUND' } }],
          data: null,
        });
      }),
    );

    // Act
    renderRoutes(routes, { route: acceptInvitationPath('tok-used') });

    // Assert
    expect(
      await screen.findByText('This invitation link is no longer valid.'),
    ).toBeVisible();
    await waitFor(() => expect(attempts).toBe(1));
  });
});
