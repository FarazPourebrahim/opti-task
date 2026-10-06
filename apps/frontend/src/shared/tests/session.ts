import { HttpResponse, graphql } from './graphql';

/**
 * Session fixtures.
 *
 * The provider tree bootstraps a session on mount, so every rendered test
 * needs to say who is signed in — otherwise the bootstrap request is unhandled.
 */

export const TEST_USER = {
  __typename: 'User',
  id: 'u1',
  email: 'me@acme.test',
  name: 'Dana Scully',
  avatarUrl: null,
  seniority: null,
  organizationCount: 1,
};

const UNAUTHENTICATED = {
  errors: [{ message: 'no session', extensions: { code: 'UNAUTHENTICATED' } }],
  data: null,
};

/** `me` succeeds: the app boots straight into the signed-in state. */
export function signedIn(user: typeof TEST_USER = TEST_USER) {
  return [
    graphql.query('CurrentUser', () =>
      HttpResponse.json({ data: { me: user } }),
    ),
    // The shell's bell asks for this on every signed-in screen. None unread,
    // unless a test about notifications puts its own handler first.
    graphql.query('UnreadNotificationCount', () =>
      HttpResponse.json({ data: { unreadNotificationCount: 0 } }),
    ),
  ];
}

/** No access cookie and no refresh cookie: the app boots signed-out. */
export function signedOut() {
  return [
    graphql.query('CurrentUser', () => HttpResponse.json(UNAUTHENTICATED)),
    graphql.mutation('Refresh', () => HttpResponse.json(UNAUTHENTICATED)),
  ];
}

export function loginSucceeds(user: typeof TEST_USER = TEST_USER) {
  return graphql.mutation('Login', () =>
    HttpResponse.json({ data: { login: { accessToken: 'access-123', user } } }),
  );
}
