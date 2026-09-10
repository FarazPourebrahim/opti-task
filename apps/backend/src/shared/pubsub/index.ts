import type { RealtimeEvents, RealtimeTopic } from '@contracts';

/**
 * Typed in-process publish/subscribe for GraphQL subscriptions. Publishers (the
 * domain services) `publish` lightweight, id-bearing events; subscription
 * resolvers `subscribe` to a topic with an optional filter and receive an async
 * iterator. Kept dependency-free and in-memory — fine for a single instance; a
 * broker-backed adapter (Redis) is the path to horizontal scale (see known-debt).
 *
 * The event payloads themselves live in `@contracts`: the publisher here and the
 * client that consumes the subscription are checked against one definition.
 */
export type { RealtimeEvents };

type TopicName = RealtimeTopic;
type Listener = (payload: unknown) => void;

const channels = new Map<TopicName, Set<Listener>>();

export function publish<K extends TopicName>(topic: K, payload: RealtimeEvents[K]): void {
  const listeners = channels.get(topic);
  if (!listeners) {
    return;
  }
  for (const listener of listeners) {
    listener(payload);
  }
}

/**
 * Subscribes to a topic, yielding payloads that pass `filter` (RBAC scoping lives
 * in the caller's filter). The returned iterator unregisters itself on `return`,
 * so a disconnecting client leaks no listeners.
 */
export function subscribe<K extends TopicName>(
  topic: K,
  filter?: (payload: RealtimeEvents[K]) => boolean,
): AsyncIterableIterator<RealtimeEvents[K]> {
  const queue: RealtimeEvents[K][] = [];
  let pending: ((result: IteratorResult<RealtimeEvents[K]>) => void) | null = null;
  let closed = false;

  const listener: Listener = (raw) => {
    const payload = raw as RealtimeEvents[K];
    if (filter && !filter(payload)) {
      return;
    }
    if (pending) {
      const resolve = pending;
      pending = null;
      resolve({ value: payload, done: false });
    } else {
      queue.push(payload);
    }
  };

  const listeners = channels.get(topic) ?? new Set<Listener>();
  listeners.add(listener);
  channels.set(topic, listeners);

  function close(): void {
    if (closed) {
      return;
    }
    closed = true;
    listeners.delete(listener);
    if (pending) {
      const resolve = pending;
      pending = null;
      resolve({ value: undefined, done: true });
    }
  }

  return {
    next(): Promise<IteratorResult<RealtimeEvents[K]>> {
      const buffered = queue.shift();
      if (buffered !== undefined) {
        return Promise.resolve({ value: buffered, done: false });
      }
      if (closed) {
        return Promise.resolve({ value: undefined, done: true });
      }
      return new Promise((resolve) => {
        pending = resolve;
      });
    },
    return(): Promise<IteratorResult<RealtimeEvents[K]>> {
      close();
      return Promise.resolve({ value: undefined, done: true });
    },
    throw(error: unknown): Promise<IteratorResult<RealtimeEvents[K]>> {
      close();
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

/** Test/util: drops all listeners on a topic (or all topics). */
export function clearSubscriptions(): void {
  channels.clear();
}
