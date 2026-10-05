import { taskCommentPath, taskPath } from '@/shared/routes/route.constants';
import { isUuid } from '@/shared/utils/id.utils';

type NotificationSubject = {
  entityType?: string | null | undefined;
  entityId?: string | null | undefined;
  metadata: Readonly<Record<string, unknown>>;
};

/** `metadata` is free-form JSON: a value is an id only if it looks like one. */
function readId(value: unknown): string | null {
  return typeof value === 'string' && isUuid(value) ? value : null;
}

/**
 * Where a notification leads, or null when it leads nowhere this app can show.
 *
 * Mirrors what the backend's `notification.events.ts` records: a task carries
 * its project in `metadata`, and a comment carries its task and project. An
 * entity type the server adds later simply has no link until it is added here;
 * the notification is still shown.
 */
export function notificationTarget(
  notification: NotificationSubject,
): string | null {
  const entityId = readId(notification.entityId);
  const projectId = readId(notification.metadata['projectId']);
  if (!entityId || !projectId) return null;

  if (notification.entityType === 'task') {
    return taskPath(projectId, entityId);
  }

  if (notification.entityType === 'comment') {
    const taskId = readId(notification.metadata['taskId']);
    return taskId ? taskCommentPath(projectId, taskId, entityId) : null;
  }

  return null;
}
