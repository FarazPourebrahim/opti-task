import type { Prisma, Sprint, TaskStatus } from '@prisma/client';
import { prisma, type Executor } from '@shared/db';

/** Sprint data access. Pure persistence; RBAC/validation live in the service. */
export function findSprintById(
  id: string,
  db: Executor = prisma,
): Promise<Sprint | null> {
  return db.sprint.findUnique({ where: { id } });
}

export function createSprint(
  data: Prisma.SprintUncheckedCreateInput,
  db: Executor = prisma,
): Promise<Sprint> {
  return db.sprint.create({ data });
}

export function updateSprint(
  id: string,
  data: Prisma.SprintUncheckedUpdateInput,
  db: Executor = prisma,
): Promise<Sprint> {
  return db.sprint.update({ where: { id }, data });
}

export async function deleteSprint(
  id: string,
  db: Executor = prisma,
): Promise<void> {
  await db.sprint.delete({ where: { id } });
}

export function listProjectSprintsPage(
  args: { projectId: string; take: number; cursor?: string },
  db: Executor = prisma,
): Promise<Sprint[]> {
  return db.sprint.findMany({
    where: { projectId: args.projectId },
    orderBy: { createdAt: 'desc' },
    take: args.take,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
  });
}

export function countProjectSprints(
  projectId: string,
  db: Executor = prisma,
): Promise<number> {
  return db.sprint.count({ where: { projectId } });
}

// --- Metrics aggregates (no N+1: one grouped query each) ---

export type StatusAggregate = {
  status: TaskStatus;
  storyPoints: number;
  taskCount: number;
};

export async function aggregateByStatus(
  sprintId: string,
  db: Executor = prisma,
): Promise<StatusAggregate[]> {
  const rows = await db.task.groupBy({
    by: ['status'],
    where: { sprintId },
    _sum: { storyPoints: true },
    _count: { _all: true },
  });
  return rows.map((row) => ({
    status: row.status,
    storyPoints: row._sum.storyPoints ?? 0,
    taskCount: row._count._all,
  }));
}

export type WorkloadAggregate = {
  assigneeId: string | null;
  storyPoints: number;
  taskCount: number;
};

export async function aggregateByAssignee(
  sprintId: string,
  db: Executor = prisma,
): Promise<WorkloadAggregate[]> {
  const rows = await db.task.groupBy({
    by: ['assigneeId'],
    where: { sprintId },
    _sum: { storyPoints: true },
    _count: { _all: true },
  });
  return rows.map((row) => ({
    assigneeId: row.assigneeId,
    storyPoints: row._sum.storyPoints ?? 0,
    taskCount: row._count._all,
  }));
}

export function listSprintTasks(
  sprintId: string,
  db: Executor = prisma,
): Promise<Array<{ id: string; storyPoints: number | null; status: TaskStatus }>> {
  return db.task.findMany({
    where: { sprintId },
    select: { id: true, storyPoints: true, status: true },
  });
}

/** Status-change activity for the given tasks, used to date burndown completion. */
export function listStatusActivity(
  taskIds: string[],
  db: Executor = prisma,
): Promise<Array<{ taskId: string | null; metadata: Prisma.JsonValue; createdAt: Date }>> {
  return db.activityLog.findMany({
    where: { taskId: { in: taskIds }, type: 'STATUS_CHANGED' },
    select: { taskId: true, metadata: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
}
