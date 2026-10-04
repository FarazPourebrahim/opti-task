import { useApolloClient } from '@apollo/client/react';
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  CurrentUserQuery,
  LoginMutation,
  LogoutMutation,
  RegisterMutation,
} from '@/modules/auth/graphql/auth.operations';
import type { CurrentUserQuery as CurrentUserQueryResult } from '@/shared/graphql/generated/graphql';
import { ApiError } from '@/shared/lib/apiError';
import { refreshSession } from '@/shared/services/auth.gateway';
import {
  clearAccessToken,
  onSessionExpired,
  setAccessToken,
} from '@/shared/services/session.store';

export type AuthenticatedUser = CurrentUserQueryResult['me'];

/**
 * `loading` is its own state rather than `user === null`.
 *
 * On a reload the session is recovered from the refresh cookie, which takes a
 * round trip. Without this a guard would read "no user" and redirect to login
 * before the answer arrived, bouncing a signed-in user out of the app on every
 * refresh.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  /**
   * True from a deliberate sign-out until the next sign-in. It tells the route
   * guard not to remember the page: an expired session should return to where
   * the user was, but the next person to sign in on this browser should not
   * land on the previous user's page.
   */
  signedOutByUser: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: {
    email: string;
    name: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads `me`, e.g. after a profile update. */
  refreshUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useApolloClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [signedOutByUser, setSignedOutByUser] = useState(false);

  const loadCurrentUser = useCallback(async (): Promise<boolean> => {
    try {
      const result = await client.query({
        query: CurrentUserQuery,
        fetchPolicy: 'network-only',
      });

      if (result.data?.me) {
        setUser(result.data.me);
        setStatus('authenticated');
        return true;
      }
    } catch (error) {
      // Anything other than "not signed in" is a real failure, but there is no
      // useful recovery here either — the user is shown the signed-out app.
      if (!ApiError.is(error) || error.kind !== 'unauthorized') {
        setStatus('unauthenticated');
        return false;
      }
    }

    setUser(null);
    setStatus('unauthenticated');
    return false;
  }, [client]);

  /*
   * Session bootstrap, once on mount.
   *
   * `me` is attempted first. If the access cookie has expired the link chain
   * refreshes and replays it transparently, so a separate refresh call is only
   * needed when that fails — which is the case where the access cookie is gone
   * entirely but the refresh cookie survives (a tab left open past the access
   * TTL, or a cold load).
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const signedIn = await loadCurrentUser();
      if (cancelled || signedIn) return;

      const refreshed = await refreshSession();
      if (cancelled || !refreshed) return;

      await loadCurrentUser();
    })();

    return () => {
      cancelled = true;
    };
  }, [loadCurrentUser]);

  /*
   * A refresh that fails mid-session. The link has already dropped the token
   * and the cache; settling on `unauthenticated` here is what lets the route
   * guard send the user to sign in again instead of leaving them on a screen
   * whose every request now fails.
   */
  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null);
        setStatus('unauthenticated');
      }),
    [],
  );

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const result = await client.mutate({
        mutation: LoginMutation,
        variables: { input },
      });

      const payload = result.data?.login;
      if (!payload) return;

      // Held in memory only, for the WebSocket's connectionParams. The HTTP
      // side authenticates with the cookies this mutation just set.
      setAccessToken(payload.accessToken);
      setUser(payload.user);
      setSignedOutByUser(false);
      setStatus('authenticated');
    },
    [client],
  );

  const register = useCallback(
    async (input: { email: string; name: string; password: string }) => {
      const result = await client.mutate({
        mutation: RegisterMutation,
        variables: { input },
      });

      const payload = result.data?.register;
      if (!payload) return;

      setAccessToken(payload.accessToken);
      setUser(payload.user);
      setSignedOutByUser(false);
      setStatus('authenticated');
    },
    [client],
  );

  const logout = useCallback(async () => {
    try {
      await client.mutate({ mutation: LogoutMutation });
    } catch {
      // The server may already consider the session gone. Signing out locally
      // must happen regardless — leaving a user apparently signed in because
      // the sign-out request failed is the worse outcome.
    }

    // Order matters: drop the token (which closes the socket) before clearing
    // the cache, so no subscription can write into a store being emptied.
    clearAccessToken();
    setUser(null);
    setSignedOutByUser(true);
    setStatus('unauthenticated');
    await client.clearStore();
  }, [client]);

  const refreshUser = useCallback(async () => {
    await loadCurrentUser();
  }, [loadCurrentUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signedOutByUser,
      login,
      register,
      logout,
      refreshUser,
    }),
    [status, user, signedOutByUser, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
