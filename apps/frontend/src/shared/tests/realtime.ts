import type { ErrorCode } from '@contracts';
import { createApolloClient } from '@/shared/services/apollo.client';

/**
 * A stand-in for the API's WebSocket endpoint.
 *
 * It speaks just enough of the `graphql-ws` protocol for the real client to
 * run against it: acknowledge a connection, remember each subscription, and
 * let a test push an event or drop the line. The Apollo link, the socket
 * client, reconnection and every cache reconciler run for real on top of it.
 */

type Subscription = {
  id: string;
  operationName: string;
  variables: Record<string, unknown>;
};

type SocketMessage = {
  type: string;
  id?: string;
  payload?: unknown;
};

type CloseInit = { code: number; reason: string; wasClean: boolean };

export function createRealtimeServer() {
  const sockets: FakeSocket[] = [];
  let isAccepting = true;

  /** The parts of the browser's `WebSocket` that `graphql-ws` uses. */
  class FakeSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    readyState: number = FakeSocket.CONNECTING;
    onopen: ((event: unknown) => unknown) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: ((event: CloseInit) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;

    /** What the client sent with `connection_init`. */
    connectionParams: unknown = undefined;
    readonly subscriptions = new Map<string, Subscription>();

    constructor(
      readonly url: string,
      readonly protocol: string,
    ) {
      sockets.push(this);

      // A real socket opens, or fails, after the constructor has returned.
      queueMicrotask(() => {
        if (this.readyState !== FakeSocket.CONNECTING) return;

        if (!isAccepting) {
          this.finish({ code: 1006, reason: '', wasClean: false });
          return;
        }

        this.readyState = FakeSocket.OPEN;
        void this.onopen?.({});
      });
    }

    send(raw: string): void {
      const message = JSON.parse(raw) as SocketMessage;

      if (message.type === 'connection_init') {
        this.connectionParams = message.payload;
        queueMicrotask(() => this.deliver({ type: 'connection_ack' }));
        return;
      }

      if (message.type === 'subscribe' && message.id) {
        const payload = message.payload as {
          operationName?: string;
          variables?: Record<string, unknown>;
        };
        this.subscriptions.set(message.id, {
          id: message.id,
          operationName: payload.operationName ?? '',
          variables: payload.variables ?? {},
        });
        return;
      }

      if (message.type === 'complete' && message.id) {
        this.subscriptions.delete(message.id);
      }
    }

    close(code = 1000, reason = ''): void {
      if (this.readyState === FakeSocket.CLOSED) return;

      this.readyState = FakeSocket.CLOSING;
      // The close event arrives later, as it does in a browser.
      queueMicrotask(() =>
        this.finish({ code, reason, wasClean: code === 1000 }),
      );
    }

    deliver(message: SocketMessage): void {
      if (this.readyState !== FakeSocket.OPEN) return;
      this.onmessage?.({ data: JSON.stringify(message) });
    }

    /** The far end going away: no close frame, an abnormal closure. */
    drop(): void {
      this.finish({ code: 1006, reason: '', wasClean: false });
    }

    private finish(event: CloseInit): void {
      if (this.readyState === FakeSocket.CLOSED) return;

      this.readyState = FakeSocket.CLOSED;
      this.subscriptions.clear();
      this.onclose?.(event);
    }
  }

  function openSockets(): FakeSocket[] {
    return sockets.filter((socket) => socket.readyState === FakeSocket.OPEN);
  }

  function subscriptionsTo(operationName: string) {
    return openSockets().flatMap((socket) =>
      [...socket.subscriptions.values()]
        .filter((subscription) => subscription.operationName === operationName)
        .map((subscription) => ({ socket, subscription })),
    );
  }

  return {
    WebSocket: FakeSocket,
    /** Every socket the client has opened, oldest first. */
    sockets,
    /** The socket in use now, if one is open. */
    current: () => openSockets().at(-1),
    /** The variables of each live subscription to an operation. */
    subscribed: (operationName: string) =>
      subscriptionsTo(operationName).map(
        ({ subscription }) => subscription.variables,
      ),
    /** Sends an event to every live subscription to an operation. */
    push(operationName: string, data: Record<string, unknown>): number {
      const targets = subscriptionsTo(operationName);
      for (const { socket, subscription } of targets) {
        socket.deliver({
          id: subscription.id,
          type: 'next',
          payload: { data },
        });
      }
      return targets.length;
    },
    /** Refuses every live subscription to an operation, as the API would. */
    refuse(operationName: string, code: ErrorCode): void {
      for (const { socket, subscription } of subscriptionsTo(operationName)) {
        socket.subscriptions.delete(subscription.id);
        socket.deliver({
          id: subscription.id,
          type: 'error',
          payload: [{ message: 'refused', extensions: { code } }],
        });
      }
    },
    /** Cuts every open connection. */
    drop(): void {
      for (const socket of openSockets()) socket.drop();
    },
    /** Makes new connections fail, as an unreachable server does. */
    goDown(): void {
      isAccepting = false;
      for (const socket of openSockets()) socket.drop();
    },
    comeBack(): void {
      isAccepting = true;
    },
  };
}

export type RealtimeServer = ReturnType<typeof createRealtimeServer>;

/**
 * An Apollo client whose subscriptions run over a fake socket. Reconnects are
 * immediate unless a test asks for real timing.
 */
export function createRealtimeTestClient(
  server: RealtimeServer,
  retryDelay: (retries: number) => number = () => 0,
) {
  return createApolloClient({
    enableSubscriptions: true,
    realtime: { webSocketImpl: server.WebSocket, retryDelay },
  });
}
