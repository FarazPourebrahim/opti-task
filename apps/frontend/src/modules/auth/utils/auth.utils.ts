import type { Location } from 'react-router';
import { ROUTES } from '@/shared/routes/route.constants';

/** What a redirect to the sign-in screen carries, so sign-in can return. */
export type ReturnToState = {
  from: Pick<Location, 'pathname' | 'search' | 'hash'>;
};

export function toReturnToState(location: Location): ReturnToState {
  return {
    from: {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    },
  };
}

/**
 * Where to send a user who has just signed in.
 *
 * Router state is untyped and survives a reload, so it is validated rather
 * than trusted: only an in-app path is accepted. `//host` is rejected because
 * a browser reads it as another origin.
 */
export function resolveReturnTo(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) {
    return ROUTES.home;
  }

  const { from } = state;
  if (typeof from !== 'object' || from === null || !('pathname' in from)) {
    return ROUTES.home;
  }

  const { pathname } = from;
  if (
    typeof pathname !== 'string' ||
    !pathname.startsWith('/') ||
    pathname.startsWith('//')
  ) {
    return ROUTES.home;
  }

  const search =
    'search' in from && typeof from.search === 'string' ? from.search : '';
  const hash = 'hash' in from && typeof from.hash === 'string' ? from.hash : '';

  return `${pathname}${search}${hash}`;
}
