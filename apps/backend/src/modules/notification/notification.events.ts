import { on, resetHandlers } from '@/shared/events';
import { prisma } from '@/shared/db';
import * as notificationService from './notification.service.js';

/**
 * Wires the notification fan-out onto the domain event bus. Idempotent: repeated
 * calls (e.g. every `createApp` in tests) reset and re-register so handlers
 * never accumulate and double-notify.
 */
export function registerNotificationHandlers(): void {
  resetHandlers();

  on('task.assigned', async (event) => {
    // Don't notify someone for assigning a task to themselves.
    if (event.assigneeId === event.actorId) {
      return;
    }
    const task = await prisma.task.findUnique({
      where: { id: event.taskId },
      select: { title: true },
    });
    await notificationService.deliver({
      recipientId: event.assigneeId,
      type: 'TASK_ASSIGNED',
      title: 'You were assigned a task',
      body: task ? `You were assigned “${task.title}”.` : null,
      entityType: 'task',
      entityId: event.taskId,
      metadata: { projectId: event.projectId },
    });
  });

  on('comment.mentioned', async (event) => {
    const recipients = event.mentionedUserIds.filter((id) => id !== event.actorId);
    if (recipients.length === 0) {
      return;
    }
    await Promise.all(
      recipients.map((recipientId) =>
        notificationService.deliver({
          recipientId,
          type: 'MENTION',
          title: 'You were mentioned in a comment',
          entityType: 'comment',
          entityId: event.commentId,
          metadata: { taskId: event.taskId, projectId: event.projectId },
        }),
      ),
    );
  });
}
