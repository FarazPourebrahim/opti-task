import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import type { ApolloLink } from '@apollo/client';
import {
  REALTIME_OFFLINE_AFTER_FAILURES,
  REALTIME_RETRY_BASE_MS,
  REALTIME_RETRY_CAP_MS,
  REALTIME_RETRY_JITTER_MS,
} from '@/shared/constants/realtime.constants';
import { refreshSession } from '@/shared/services/auth.gateway';
import {
  getAccessToken,
  onAccessTokenChange,
} from '@/shared/services/session.store';

/**
 * The subscription transport: one socket for the whole app.
 *
 * Realtime is an enhancement, never a dependency. Every screen reads and writes
 * over HTTP; the socket only brings other people's changes in sooner. So a
 * socket that cannot connect is reported honestly (see `RealtimeStatus`) and
 * nothing waits on it.
 */

/**
 * What the socket is doing.
 *
 * - `idle`: nothing is subscribed, or nobody is signed in. No socket is wanted.
 * - `connecting`: the first attempt.
 * - `live`: connected and acknowledged.
 * - `reconnecting`: the connection dropped and is being retried.
 * - `offline`: the browser is offline, or several attempts in a row failed.
 *   Retries continue in the background, more slowly.
 */
export type RealtimeStatus =
  'idle' | 'connecting' | 'live' | 'reconnecting' | 'offline';

type StatusListener = () => void;

let status: RealtimeStatus = 'idle';
const statusListeners = new Set<StatusListener>();

function setStatus(next: RealtimeStatus): void {
  if (status === next) return;

  status = next;
  for (const listener of statusListeners) listener();
}

export function getRealtimeStatus(): RealtimeStatus {
  return status;
}

/** Shaped for `useSyncExternalStore`. */
export function subscribeToRealtimeStatus(
  listener: StatusListener,
): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

type GapListener = () => void;
const gapListeners = new Set<GapListener>();

/**
 * Announces that the socket is back after being down.
 *
 * Events sent in between are gone — the server keeps no backlog — so this is
 * the moment to re-read what is on screen. A restart the client made itself,
 * to present a new token, is not a gap: it lasts a moment and is not announced.
 */
export function onRealtimeGapClosed(listener: GapListener): () => void {
  gapListeners.add(listener);
  return () => gapListeners.delete(listener);
}

/** The close code `graphql-ws` uses for a restart the client asked for. */
const TERMINATED_BY_CLIENT = 4499;

/**
 * How long to wait before reconnect attempt number `retries` (from 0).
 *
 * Doubles each time up to a cap, so a server that is down is not hammered, and
 * adds jitter so a fleet of clients dropped together does not return together.
 */
export function reconnectDelay(
  retries: number,
  jitter = Math.random(),
): number {
  const backoff = Math.min(
    REALTIME_RETRY_CAP_MS,
    REALTIME_RETRY_BASE_MS * 2 ** Math.max(0, retries),
  );
  return backoff + Math.round(jitter * REALTIME_RETRY_JITTER_MS);
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export type RealtimeLinkOptions = {
  url: string;
  /** A stand-in socket, for tests. The browser's own is used otherwise. */
  webSocketImpl?: unknown;
  /** Overrides `reconnectDelay`, for tests that cannot wait a real second. */
  retryDelay?: (retries: number) => number;
};

/** Tears down the previous link's socket and listeners, if there was one. */
let disposePrevious: (() => void) | null = null;

/**
 * Builds the socket link.
 *
 * Authentication: `connectionParams` is read on every connect. The token lives
 * in memory only (see `session.store`), so after a reload there is none — the
 * HTTP side runs on cookies — and one is obtained with a refresh. A token that
 * changes mid-session restarts the socket so the server sees the new one, and
 * `graphql-ws` re-sends every active subscription on the new connection.
 *
 * A subscription refused as `UNAUTHENTICATED` (the token expired while the
 * socket stayed open) is handled above this link, by the same refresh-and-replay
 * that handles an expired HTTP request.
 */
export function createRealtimeLink(options: RealtimeLinkOptions): ApolloLink {
  disposePrevious?.();

  const { url, webSocketImpl, retryDelay = reconnectDelay } = options;

  /** True from sign-out (or an expired session) until the next sign-in. */
  let isSignedOut = false;
  /** True while this link is itself fetching a token, so the change it causes
      is not mistaken for someone else's and answered by a restart. */
  let isAuthenticating = false;
  let tokenInUse: string | null = null;
  let failedAttempts = 0;
  let hadGap = false;
  /** False once a newer link has replaced this one. */
  let isCurrent = true;

  /*
   * The status is the app's, not this link's: one socket is the app's socket
   * at a time. A link that has been replaced may still be winding down, and
   * what it has to say is no longer about the connection in use.
   */
  function report(next: RealtimeStatus): void {
    if (isCurrent) setStatus(next);
  }

  const client = createClient({
    url,
    lazy: true,
    retryAttempts: Infinity,
    ...(webSocketImpl ? { webSocketImpl } : {}),
    // Signed out: the socket stays closed until someone signs in again.
    shouldRetry: () => !isSignedOut,
    retryWait: (retries) =>
      new Promise((resolve) => setTimeout(resolve, retryDelay(retries))),
    connectionParams: async () => {
      if (isSignedOut) return {};

      let token = getAccessToken();
      if (!token) {
        isAuthenticating = true;
        try {
          await refreshSession();
        } finally {
          isAuthenticating = false;
        }
        token = getAccessToken();
      }

      tokenInUse = token;
      return token ? { authorization: `Bearer ${token}` } : {};
    },
    on: {
      connecting: (isRetry) => {
        if (status === 'offline') return;
        report(isRetry ? 'reconnecting' : 'connecting');
      },
      connected: () => {
        failedAttempts = 0;
        report('live');

        if (hadGap && isCurrent) {
          hadGap = false;
          for (const listener of [...gapListeners]) listener();
        }
      },
      closed: (event) => {
        const code =
          typeof event === 'object' && event !== null && 'code' in event
            ? event.code
            : undefined;

        // A normal closure is the socket being put away: the last subscription
        // ended, or the session did.
        if (isSignedOut || code === 1000) {
          failedAttempts = 0;
          report('idle');
          return;
        }

        if (code !== TERMINATED_BY_CLIENT) hadGap = true;

        failedAttempts += 1;
        report(
          isBrowserOffline() ||
            failedAttempts >= REALTIME_OFFLINE_AFTER_FAILURES
            ? 'offline'
            : 'reconnecting',
        );
      },
    },
  });

  const stopListeningToToken = onAccessTokenChange((token) => {
    if (token === null) {
      isSignedOut = true;
      tokenInUse = null;
      client.terminate();
      report('idle');
      return;
    }

    isSignedOut = false;
    if (isAuthenticating || token === tokenInUse) return;

    // Reconnects with the new credentials.
    client.terminate();
  });

  function handleOffline() {
    if (status !== 'idle') report('offline');
  }
  function handleOnline() {
    if (status === 'offline') report('reconnecting');
  }
  window.addEventListener('offline', handleOffline);
  window.addEventListener('online', handleOnline);

  setStatus('idle');

  disposePrevious = () => {
    stopListeningToToken();
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('online', handleOnline);
    isCurrent = false;
    // A socket that never connected has nothing to close.
    void Promise.resolve(client.dispose()).catch(() => undefined);
    disposePrevious = null;
  };

  return new GraphQLWsLink(client);
}
