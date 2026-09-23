import type { Prisma, Sprint, TaskStatus } from '@prisma/client';
import { prisma, type Executor } from '@/shared/db';
import type {
  IndividualWorkload,
  PriorityCount,
  StatusCount,
} from './analytics.model.js';

/** Analytics data access. All aggregation runs as grouped queries (no N+1). */

export async function statusDistribution(
  projectId: string,
  db: Executor = prisma,
): Promise<StatusCount[]> {
  const rows = await db.task.groupBy({
    by: ['status'],
    where: { projectId },
    _count: { _all: true },
  });
  return rows.map((row) => ({ status: row.status, count: row._count._all }));
}

export async function priorityDistribution(
  projectId: string,
  db: Executor = prisma,
): Promise<PriorityCount[]> {
  const rows = await db.task.groupBy({
    by: ['priority'],
    where: { projectId },
    _count: { _all: true },
  });
  return rows.map((row) => ({ priority: row.priority, count: row._count._all }));
}

export type ProjectTotals = {
  totalTasks: number;
  completedTasks: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
};

export async function projectTotals(
  projectId: string,
  db: Executor = prisma,
): Promise<ProjectTotals> {
  const rows = await db.task.groupBy({
    by: ['status'],
    where: { projectId },
    _count: { _all: true },
    _sum: { storyPoints: true },
  });
  const totals: ProjectTotals = {
    totalTasks: 0,
    completedTasks: 0,
    totalStoryPoints: 0,
    completedStoryPoints: 0,
  };
  for (const row of rows) {
    const points = row._sum.storyPoints ?? 0;
    totals.totalTasks += row._count._all;
    totals.totalStoryPoints += points;
    if (row.status === 'DONE') {
      totals.completedTasks += row._count._all;
      totals.completedStoryPoints += points;
    }
  }
  return totals;
}

export async function individualWorkloads(
  projectId: string,
  db: Executor = prisma,
): Promise<IndividualWorkload[]> {
  const rows = await db.task.groupBy({
    by: ['assigneeId', 'status'],
    where: { projectId, assigneeId: { not: null } },
    _count: { _all: true },
    _sum: { storyPoints: true },
  });
  const byUser = new Map<string, IndividualWorkload>();
  for (const row of rows) {
    if (!row.assigneeId) {
      continue;
    }
    const entry =
      byUser.get(row.assigneeId) ??
      { assigneeId: row.assigneeId, activeTasks: 0, activeStoryPoints: 0, completedTasks: 0 };
    if (row.status === 'DONE') {
      entry.completedTasks += row._count._all;
    } else {
      entry.activeTasks += row._count._all;
      entry.activeStoryPoints += row._sum.storyPoints ?? 0;
    }
    byUser.set(row.assigneeId, entry);
  }
  return [...byUser.values()];
}

export function listProjectSprints(
  projectId: string,
  db: Executor = prisma,
): Promise<Sprint[]> {
  return db.sprint.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });
}

export type SprintPoints = {
  sprintId: string;
  committedStoryPoints: number;
  completedStoryPoints: number;
};

export async function sprintPointTotals(
  sprintIds: string[],
  db: Executor = prisma,
): Promise<Map<string, SprintPoints>> {
  const result = new Map<string, SprintPoints>();
  if (sprintIds.length === 0) {
    return result;
  }
  const rows = await db.task.groupBy({
    by: ['sprintId', 'status'],
    where: { sprintId: { in: sprintIds } },
    _sum: { storyPoints: true },
  });
  for (const row of rows) {
    if (!row.sprintId) {
      continue;
    }
    const entry =
      result.get(row.sprintId) ??
      { sprintId: row.sprintId, committedStoryPoints: 0, completedStoryPoints: 0 };
    const points = row._sum.storyPoints ?? 0;
    entry.committedStoryPoints += points;
    if (row.status === 'DONE') {
      entry.completedStoryPoints += points;
    }
    result.set(row.sprintId, entry);
  }
  return result;
}

// --- User analytics inputs ---

export function doneTasksForUser(
  userId: string,
  db: Executor = prisma,
): Promise<Array<{ id: string; storyPoints: number | null; createdAt: Date; sprintId: string | null }>> {
  return db.task.findMany({
    where: { assigneeId: userId, status: 'DONE' },
    select: { id: true, storyPoints: true, createdAt: true, sprintId: true },
  });
}

export function activeAssignmentCount(
  userId: string,
  db: Executor = prisma,
): Promise<number> {
  return db.task.count({
    where: { assigneeId: userId, status: { not: 'DONE' } },
  });
}

export function doneStatusActivity(
  taskIds: string[],
  db: Executor = prisma,
): Promise<Array<{ taskId: string | null; metadata: Prisma.JsonValue; createdAt: Date }>> {
  return db.activityLog.findMany({
    where: { taskId: { in: taskIds }, type: 'STATUS_CHANGED' },
    select: { taskId: true, metadata: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
}

export function upsertUserStatistics(
  userId: string,
  data: {
    completedTasks: number;
    historicalStoryPoints: number;
    avgCompletionSeconds: bigint | null;
    velocity: number | null;
  },
  db: Executor = prisma,
): Promise<unknown> {
  return db.userStatistics.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

const DONE_STATUS: TaskStatus = 'DONE';
export { DONE_STATUS };
