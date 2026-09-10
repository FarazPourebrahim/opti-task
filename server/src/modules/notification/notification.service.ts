import type { Notification } from '@prisma/client';
import type { GraphQLContext } from '@shared/graphql/context';
import { requireAuth } from '@shared/auth';
import { ForbiddenError, NotFoundError } from '@shared/errors';
import {
  buildConnection,
  clampFirst,
  decodeCursor,
  encodeCursor,
  type Connection,
} from '@shared/utils';
import { publish } from '@shared/pubsub';
import * as repo from './notification.repository.js';
import { getEmailAdapter } from './notification.email.js';
import type { NotificationInput } from './notification.model.js';
import { prisma } from '@shared/db';

/**
 * Creates an in-app notification and best-effort emails the recipient. Called by
 * the event handlers (not user-facing). Never throws into the originating
 * mutation — the bus already isolates handler failures.
 */
export async function deliver(input: NotificationInput): Promise<void> {
  const notification = await repo.createNotification(input);
  publish('NOTIFICATION_CREATED', {
    notificationId: notification.id,
    recipientId: notification.recipientId,
  });
  const recipient = await prisma.user.findUnique({
    where: { id: input.recipientId },
    select: { email: true },
  });
  if (recipient) {
    await getEmailAdapter().send({
      to: recipient.email,
      subject: notification.title,
      body: notification.body ?? notification.title,
    });
  }
}

export async function listMyNotifications(
  ctx: GraphQLContext,
  args: { first?: number | null; after?: string | null; unreadOnly?: boolean | null },
): Promise<Connection<Notification>> {
  const principal = requireAuth(ctx);
  const pageSize = clampFirst(args.first);
  const after = args.after ? decodeCursor(args.after) : null;
  const unreadOnly = args.unreadOnly ?? false;

  const [rows, totalCount] = await Promise.all([
    repo.listForRecipient({
      recipientId: principal.id,
      take: pageSize + 1,
      unreadOnly,
      ...(after ? { cursor: after } : {}),
    }),
    repo.countForRecipient(principal.id, unreadOnly),
  ]);

  return buildConnection(rows, {
    pageSize,
    after,
    totalCount,
    getCursor: (notification) => encodeCursor(notification.id),
  });
}

export function unreadCount(ctx: GraphQLContext): Promise<number> {
  const principal = requireAuth(ctx);
  return repo.countForRecipient(principal.id, true);
}

export async function markRead(
  ctx: GraphQLContext,
  id: string,
): Promise<Notification> {
  const principal = requireAuth(ctx);
  const notification = await repo.findById(id);
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }
  // A user may only read their own notifications.
  if (notification.recipientId !== principal.id) {
    throw new ForbiddenError();
  }
  if (notification.readAt) {
    return notification;
  }
  return repo.markRead(id, new Date());
}

export async function markAllRead(ctx: GraphQLContext): Promise<number> {
  const principal = requireAuth(ctx);
  return repo.markAllRead(principal.id, new Date());
}
