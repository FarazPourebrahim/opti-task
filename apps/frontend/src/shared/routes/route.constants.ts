/**
 * Every path in the app.
 *
 * Components and the route tree read paths from here, so a URL can be changed
 * in one place and a link can never point at a path the router does not know.
 */
export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  acceptInvitation: '/invitations/:token',
  account: '/account',
  accountSessions: '/account/sessions',
  accountSecurity: '/account/security',
} as const;

export const ROUTE_PARAMS = {
  invitationToken: 'token',
} as const;

export function acceptInvitationPath(token: string): string {
  return `/invitations/${encodeURIComponent(token)}`;
}
