import type { Notification, Prisma } from '@prisma/client';
import { prisma, type Executor } from '@/shared/db';
import type { NotificationInput } from './notification.model.js';

/** Notification data access. Pure persistence; rules live in the service. */
export function createNotification(
  input: NotificationInput,
  db: Executor = prisma,
): Promise<Notification> {
  return db.notification.create({
    data: {
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      ...(input.metadata !== undefined
        ? { metadata: input.metadata as Prisma.InputJsonValue }
        : {}),
    },
  });
}

export function listForRecipient(
  args: { recipientId: string; take: number; cursor?: string; unreadOnly: boolean },
  db: Executor = prisma,
): Promise<Notification[]> {
  return db.notification.findMany({
    where: {
      recipientId: args.recipientId,
      ...(args.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: args.take,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
  });
}

export function countForRecipient(
  recipientId: string,
  unreadOnly: boolean,
  db: Executor = prisma,
): Promise<number> {
  return db.notification.count({
    where: { recipientId, ...(unreadOnly ? { readAt: null } : {}) },
  });
}

export function findById(
  id: string,
  db: Executor = prisma,
): Promise<Notification | null> {
  return db.notification.findUnique({ where: { id } });
}

export function markRead(
  id: string,
  readAt: Date,
  db: Executor = prisma,
): Promise<Notification> {
  return db.notification.update({ where: { id }, data: { readAt } });
}

export async function markAllRead(
  recipientId: string,
  readAt: Date,
  db: Executor = prisma,
): Promise<number> {
  const result = await db.notification.updateMany({
    where: { recipientId, readAt: null },
    data: { readAt },
  });
  return result.count;
}
