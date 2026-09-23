import type { ActivityLog, Prisma } from '@prisma/client';
import { prisma, type Executor } from '@shared/db';
import type { RecordActivityInput } from './activity.model.js';

/**
 * Activity-log data access. Append-only: there is no update or delete path. The
 * `Executor` parameter lets domain services write the log inside the same
 * transaction as the change it records, so the two commit or roll back together.
 */
export function createActivity(
  input: RecordActivityInput,
  db: Executor = prisma,
): Promise<ActivityLog> {
  return db.activityLog.create({
    data: {
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      actorId: input.actorId ?? null,
      type: input.type,
      ...(input.metadata !== undefined
        ? { metadata: input.metadata as Prisma.InputJsonValue }
        : {}),
    },
  });
}

export function listTaskActivitiesPage(
  args: { taskId: string; take: number; cursor?: string },
  db: Executor = prisma,
): Promise<ActivityLog[]> {
  return db.activityLog.findMany({
    where: { taskId: args.taskId },
    orderBy: { createdAt: 'desc' },
    take: args.take,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
  });
}

export function countTaskActivities(
  taskId: string,
  db: Executor = prisma,
): Promise<number> {
  return db.activityLog.count({ where: { taskId } });
}
