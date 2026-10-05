/**
 * Realtime events, passed on inside the app.
 *
 * One subscription per topic is held open (by the project frame, for a
 * project's tasks and sprints). The hook that holds it reconciles the cache and
 * then announces the event here, thin — ids only, as the server sent it — so a
 * screen can refresh a figure of its own that the event does not carry: a
 * sprint's burndown, an epic's progress, a task's audit trail.
 *
 * This is not a second write path. Listeners only re-read through their own
 * queries; nothing is written from here.
 */
export type RealtimeAppEvents = {
  taskUpdated: { taskId: string; projectId: string };
  sprintUpdated: { sprintId: string; projectId: string };
};

export type RealtimeAppTopic = keyof RealtimeAppEvents;

type Listener<Topic extends RealtimeAppTopic> = (
  event: RealtimeAppEvents[Topic],
) => void;

const listeners: {
  [Topic in RealtimeAppTopic]: Set<Listener<Topic>>;
} = {
  taskUpdated: new Set(),
  sprintUpdated: new Set(),
};

export function announceRealtimeEvent<Topic extends RealtimeAppTopic>(
  topic: Topic,
  event: RealtimeAppEvents[Topic],
): void {
  for (const listener of [...listeners[topic]]) listener(event);
}

export function onRealtimeEvent<Topic extends RealtimeAppTopic>(
  topic: Topic,
  listener: Listener<Topic>,
): () => void {
  listeners[topic].add(listener);
  return () => {
    listeners[topic].delete(listener);
  };
}
