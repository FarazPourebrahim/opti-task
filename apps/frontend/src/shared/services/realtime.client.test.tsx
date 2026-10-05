import { HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApolloClient } from '@apollo/client';
import { NotificationReceivedSubscription } from '@/modules/notification/graphql/notification.operations';
import {
  REALTIME_RETRY_CAP_MS,
  REALTIME_RETRY_JITTER_MS,
} from '@/shared/constants/realtime.constants';
import { resetRefreshState } from '@/shared/services/auth.gateway';
import {
  getRealtimeStatus,
  onRealtimeGapClosed,
  reconnectDelay,
} from '@/shared/services/realtime.client';
import {
  clearAccessToken,
  setAccessToken,
} from '@/shared/services/session.store';
import { graphql } from '@/shared/tests/graphql';
import {
  createRealtimeServer,
  createRealtimeTestClient,
} from '@/shared/tests/realtime';
import type { RealtimeServer } from '@/shared/tests/realtime';
import { waitFor } from '@/shared/tests/renderWithProviders';
import { server as http } from '@/shared/tests/server';

const EVENT = {
  notificationReceived: {
    __typename: 'NotificationEvent',
    notificationId: 'n1',
    notification: null,
  },
};

let socketServer: RealtimeServer;
let stop: Array<() => void>;

/** Subscribes the way a screen does, and records what arrives. */
function listen(client: ApolloClient) {
  const received: unknown[] = [];
  const errors: unknown[] = [];
  const subscription = client
    .subscribe({
      query: NotificationReceivedSubscription,
      fetchPolicy: 'no-cache',
    })
    .subscribe({
      // Apollo reports a refused subscription as a result, not a thrown error.
      next: (result) => {
        if (result.error) errors.push(result.error);
        else received.push(result.data);
      },
      error: (error: unknown) => errors.push(error),
    });
  stop.push(() => subscription.unsubscribe());

  return { received, errors, unsubscribe: () => subscription.unsubscribe() };
}

function refreshReturns(token: string | null) {
  let calls = 0;
  http.use(
    graphql.mutation('Refresh', () => {
      calls += 1;
      return token
        ? HttpResponse.json({
            data: { refreshToken: { accessToken: token } },
          })
        : HttpResponse.json({
            errors: [
              { message: 'no', extensions: { code: 'UNAUTHENTICATED' } },
            ],
            data: null,
          });
    }),
  );
  return { calls: () => calls };
}

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
  socketServer = createRealtimeServer();
  stop = [];
});

afterEach(() => {
  for (const end of stop) end();
  clearAccessToken();
  vi.useRealTimers();
});

describe('reconnect delay', () => {
  it('doubles with each attempt, up to a cap', () => {
    // Arrange
    const attempts = [0, 1, 2, 3, 4, 5, 6, 20];

    // Act
    const delays = attempts.map((attempt) => reconnectDelay(attempt, 0));

    // Assert
    expect(delays).toEqual([
      1_000,
      2_000,
      4_000,
      8_000,
      16_000,
      REALTIME_RETRY_CAP_MS,
      REALTIME_RETRY_CAP_MS,
      REALTIME_RETRY_CAP_MS,
    ]);
  });

  it('adds a bounded random wait so clients do not return in step', () => {
    // Arrange
    const none = reconnectDelay(2, 0);

    // Act
    const most = reconnectDelay(2, 1);

    // Assert
    expect(most - none).toBe(REALTIME_RETRY_JITTER_MS);
  });
});

describe('realtime socket', () => {
  it('opens only when something subscribes, and authenticates from memory', async () => {
    // Arrange
    setAccessToken('token-1');
    const client = createRealtimeTestClient(socketServer);

    // Assert — lazy: no socket until it is needed.
    expect(socketServer.sockets).toHaveLength(0);
    expect(getRealtimeStatus()).toBe('idle');

    // Act
    listen(client);

    // Assert
    await waitFor(() => expect(getRealtimeStatus()).toBe('live'));
    expect(socketServer.current()?.connectionParams).toEqual({
      authorization: 'Bearer token-1',
    });
    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
  });

  it('obtains a token with one refresh when a reload left none in memory', async () => {
    // Arrange
    const refresh = refreshReturns('token-after-reload');
    const client = createRealtimeTestClient(socketServer);

    // Act
    listen(client);
    listen(client);

    // Assert
    await waitFor(() => expect(getRealtimeStatus()).toBe('live'));
    expect(socketServer.current()?.connectionParams).toEqual({
      authorization: 'Bearer token-after-reload',
    });
    expect(refresh.calls()).toBe(1);
    // Its own refresh is not answered with a restart.
    expect(socketServer.sockets).toHaveLength(1);
  });

  it('delivers an event to its subscriber', async () => {
    // Arrange
    setAccessToken('token-1');
    const client = createRealtimeTestClient(socketServer);
    const { received } = listen(client);
    await waitFor(() =>
      expect(socketServer.subscribed('NotificationReceived')).toHaveLength(1),
    );

    // Act
    socketServer.push('NotificationReceived', EVENT);

    // Assert
    await waitFor(() => expect(received).toEqual([EVENT]));
  });

  it('re-authenticates after a token refresh without losing a subscription', async () => {
    // Arrange
    setAccessToken('token-1');
    const client = createRealtimeTestClient(socketServer);
    const { received, errors } = listen(client);
    const gaps = vi.fn();
    stop.push(onRealtimeGapClosed(gaps));
    await waitFor(() =>
      expect(socketServer.subscribed('NotificationReceived')).toHaveLength(1),
    );

    // Act — what the HTTP side does when it renews an expired session.
    setAccessToken('token-2');

    // Assert
    await waitFor(() => expect(socketServer.sockets).toHaveLength(2));
    await waitFor(() =>
      expect(socketServer.subscribed('NotificationReceived')).toHaveLength(1),
    );
    expect(socketServer.current()?.connectionParams).toEqual({
      authorization: 'Bearer token-2',
    });

    // Act
    socketServer.push('NotificationReceived', EVENT);

    // Assert
    await waitFor(() => expect(received).toEqual([EVENT]));
    expect(errors).toEqual([]);
    // A restart the client made itself is not a gap to catch up on.
    expect(gaps).not.toHaveBeenCalled();
  });

  it('reconnects after the line drops, resubscribes, and says the gap is over', async () => {
    // Arrange
    setAccessToken('token-1');
    const client = createRealtimeTestClient(socketServer);
    const { received } = listen(client);
    const gaps = vi.fn();
    stop.push(onRealtimeGapClosed(gaps));
    await waitFor(() => expect(getRealtimeStatus()).toBe('live'));

    // Act
    socketServer.drop();

    // Assert
    await waitFor(() => expect(socketServer.sockets).toHaveLength(2));
    await waitFor(() => expect(getRealtimeStatus()).toBe('live'));
    await waitFor(() =>
      expect(socketServer.subscribed('NotificationReceived')).toHaveLength(1),
    );
    expect(gaps).toHaveBeenCalledTimes(1);

    // Act
    socketServer.push('NotificationReceived', EVENT);

    // Assert
    await waitFor(() => expect(received).toEqual([EVENT]));
  });

  it('closes at once on sign-out and does not come back', async () => {
    // Arrange
    setAccessToken('token-1');
    const refresh = refreshReturns('must-not-be-asked-for');
    const client = createRealtimeTestClient(socketServer);
    listen(client);
    await waitFor(() => expect(getRealtimeStatus()).toBe('live'));

    // Act
    clearAccessToken();

    // Assert
    expect(getRealtimeStatus()).toBe('idle');
    await waitFor(() => expect(socketServer.current()).toBeUndefined());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(socketServer.sockets).toHaveLength(1);
    expect(refresh.calls()).toBe(0);
  });

  it('renews the session and resubscribes when a subscription is refused as signed out', async () => {
    // Arrange
    setAccessToken('expired-token');
    const refresh = refreshReturns('fresh-token');
    const client = createRealtimeTestClient(socketServer);
    const { received, errors } = listen(client);
    await waitFor(() =>
      expect(socketServer.subscribed('NotificationReceived')).toHaveLength(1),
    );

    // Act — the token ran out while the socket stayed open.
    socketServer.refuse('NotificationReceived', 'UNAUTHENTICATED');

    // Assert
    await waitFor(() => expect(refresh.calls()).toBe(1));
    await waitFor(() =>
      expect(socketServer.current()?.connectionParams).toEqual({
        authorization: 'Bearer fresh-token',
      }),
    );
    await waitFor(() =>
      expect(socketServer.subscribed('NotificationReceived')).toHaveLength(1),
    );

    // Act
    socketServer.push('NotificationReceived', EVENT);

    // Assert
    await waitFor(() => expect(received).toEqual([EVENT]));
    expect(errors).toEqual([]);
  });

  it('ends quietly when the server refuses a subscription outright', async () => {
    // Arrange
    setAccessToken('token-1');
    const client = createRealtimeTestClient(socketServer);
    const { errors } = listen(client);
    await waitFor(() =>
      expect(socketServer.subscribed('NotificationReceived')).toHaveLength(1),
    );

    // Act
    socketServer.refuse('NotificationReceived', 'FORBIDDEN');

    // Assert — one error for the subscriber to ignore; no retry, no restart.
    await waitFor(() => expect(errors).toHaveLength(1));
    expect(socketServer.subscribed('NotificationReceived')).toHaveLength(0);
    expect(socketServer.sockets).toHaveLength(1);
  });

  it('backs off while the server is unreachable, and says it is offline', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    setAccessToken('token-1');
    socketServer.goDown();
    const client = createRealtimeTestClient(socketServer, (retries) =>
      reconnectDelay(retries, 0),
    );

    // Act — attempts fall at 0s, 1s, 3s, 7s, 15s and 31s.
    listen(client);
    await vi.advanceTimersByTimeAsync(60_000);

    // Assert — six attempts in a minute, not sixty.
    expect(socketServer.sockets).toHaveLength(6);
    expect(getRealtimeStatus()).toBe('offline');

    // Act
    socketServer.comeBack();
    await vi.advanceTimersByTimeAsync(REALTIME_RETRY_CAP_MS);

    // Assert
    expect(getRealtimeStatus()).toBe('live');
  });
});
