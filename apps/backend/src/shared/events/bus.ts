import { logger } from '@/shared/logger';

/**
 * Decoupled in-process domain event bus. Domain services `emit` events after the
 * change they describe has committed; cross-cutting concerns (notifications,
 * later analytics) subscribe via `on`. This keeps the task/comment modules from
 * importing the notification module directly.
 *
 * `emit` awaits its handlers so callers can guarantee side effects have run
 * before returning, but a throwing handler is logged and swallowed — a failed
 * notification must never fail the originating mutation. Handlers therefore run
 * as a best-effort side effect, NOT inside the triggering transaction.
 */
export type DomainEvents = {
  'task.assigned': {
    taskId: string;
    projectId: string;
    assigneeId: string;
    actorId: string;
  };
  'comment.mentioned': {
    commentId: string;
    taskId: string;
    projectId: string;
    mentionedUserIds: string[];
    actorId: string;
  };
};

type EventName = keyof DomainEvents;
type Handler<K extends EventName> = (payload: DomainEvents[K]) => void | Promise<void>;

// Internally untyped to avoid the correlated-union pitfall when indexing by a
// generic key; the public `on`/`emit` signatures keep callers fully typed.
type AnyHandler = (payload: never) => void | Promise<void>;
const handlers = new Map<EventName, AnyHandler[]>();

export function on<K extends EventName>(event: K, handler: Handler<K>): void {
  const existing = handlers.get(event) ?? [];
  existing.push(handler as AnyHandler);
  handlers.set(event, existing);
}

/** Removes all handlers (used to keep registration idempotent across re-wires). */
export function resetHandlers(): void {
  handlers.clear();
}

export async function emit<K extends EventName>(
  event: K,
  payload: DomainEvents[K],
): Promise<void> {
  const registered = handlers.get(event);
  if (!registered || registered.length === 0) {
    return;
  }
  await Promise.all(
    registered.map(async (handler) => {
      try {
        await (handler as Handler<K>)(payload);
      } catch (error) {
        logger.error({ err: error, event }, 'domain event handler failed');
      }
    }),
  );
}
