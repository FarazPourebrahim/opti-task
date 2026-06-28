import type { ActivityLog } from '@prisma/client';
import type { GraphQLContext } from '@shared/graphql/context';
import { prisma } from '@shared/db';
import { authorize } from '@shared/auth';
import { NotFoundError } from '@shared/errors';
import {
  buildConnection,
  clampFirst,
  decodeCursor,
  encodeCursor,
  type Connection,
} from '@shared/utils';
import * as repo from './activity.repository.js';

/**
 * Lists a task's audit trail (newest first). Read access mirrors the task: a
 * user who may read the task may read its activity. Writes happen only from the
 * domain services (transactionally), never through a user-facing mutation.
 */
export async function listTaskActivities(
  ctx: GraphQLContext,
  taskId: string,
  args: { first?: number | null; after?: string | null },
): Promise<Connection<ActivityLog>> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) {
    throw new NotFoundError('Task not found');
  }
  await authorize(ctx, 'task:read', { projectId: task.projectId });

  const pageSize = clampFirst(args.first);
  const after = args.after ? decodeCursor(args.after) : null;

  const [rows, totalCount] = await Promise.all([
    repo.listTaskActivitiesPage({
      taskId,
      take: pageSize + 1,
      ...(after ? { cursor: after } : {}),
    }),
    repo.countTaskActivities(taskId),
  ]);

  return buildConnection(rows, {
    pageSize,
    after,
    totalCount,
    getCursor: (activity) => encodeCursor(activity.id),
  });
}
