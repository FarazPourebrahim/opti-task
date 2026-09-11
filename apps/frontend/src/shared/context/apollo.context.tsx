import { ApolloProvider } from '@apollo/client/react';
import { useMemo, useRef } from 'react';
import type { ApolloClient } from '@apollo/client';
import type { ReactNode } from 'react';
import { createApolloClient } from '@/shared/services/apollo.client';

type ApolloRootProviderProps = {
  children: ReactNode;
  /**
   * Supplied by tests so each case gets an isolated cache. Production always
   * builds its own — exactly one client for the app's lifetime.
   */
  client?: ApolloClient;
  onSessionExpired?: () => void;
};

/**
 * Creates the app's single Apollo client.
 *
 * One instance, created once: a client rebuilt on re-render would drop the
 * cache and refetch everything on screen. `useRef` rather than `useState`
 * because the client is not render state — nothing should re-render when it is
 * created.
 */
export function ApolloRootProvider({
  children,
  client,
  onSessionExpired,
}: ApolloRootProviderProps) {
  const created = useRef<ApolloClient | null>(null);

  const instance = useMemo(() => {
    if (client) return client;
    created.current ??= createApolloClient({
      ...(onSessionExpired ? { onSessionExpired } : {}),
    });
    return created.current;
    // Intentionally created once. A changing `onSessionExpired` identity must
    // not rebuild the client and discard the cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  return <ApolloProvider client={instance}>{children}</ApolloProvider>;
}
