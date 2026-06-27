import type { Prisma, Sprint, SprintState } from '@prisma/client';
import type { GraphQLContext } from '@shared/graphql/context';
import { prisma, withTransaction } from '@shared/db';
import { authorize, requireAuth } from '@shared/auth';
import { NotFoundError, ValidationError } from '@shared/errors';
import {
  buildConnection,
  clampFirst,
  decodeCursor,
  encodeCursor,
  type Connection,
} from '@shared/utils';
import * as activityRepo from '@modules/activity/activity.repository';
import * as repo from './sprint.repository.js';
import { validateCreateSprint, validateUpdateSprint } from './sprint.validation.js';
import {
  canTransitionSprint,
  type BurndownPoint,
  type SprintMetrics,
} from './sprint.model.js';

const DAY_MS = 86_400_000;
const DONE: string = 'DONE';

async function getSprintOrThrow(id: string): Promise<Sprint> {
  const sprint = await repo.findSprintById(id);
  if (!sprint) {
    throw new NotFoundError('Sprint not found');
  }
  return sprint;
}

export async function getSprint(
  ctx: GraphQLContext,
  id: string,
): Promise<Sprint> {
  const sprint = await getSprintOrThrow(id);
  await authorize(ctx, 'sprint:read', { projectId: sprint.projectId });
  return sprint;
}

export async function listProjectSprints(
  ctx: GraphQLContext,
  projectId: string,
  args: { first?: number | null; after?: string | null },
): Promise<Connection<Sprint>> {
  await authorize(ctx, 'sprint:read', { projectId });

  const pageSize = clampFirst(args.first);
  const after = args.after ? decodeCursor(args.after) : null;

  const [rows, totalCount] = await Promise.all([
    repo.listProjectSprintsPage({
      projectId,
      take: pageSize + 1,
      ...(after ? { cursor: after } : {}),
    }),
    repo.countProjectSprints(projectId),
  ]);

  return buildConnection(rows, {
    pageSize,
    after,
    totalCount,
    getCursor: (sprint) => encodeCursor(sprint.id),
  });
}

export async function createSprint(
  ctx: GraphQLContext,
  projectId: string,
  input: unknown,
): Promise<Sprint> {
  await authorize(ctx, 'sprint:create', { projectId });
  const data = validateCreateSprint(input);

  const createData: Prisma.SprintUncheckedCreateInput = {
    projectId,
    name: data.name,
    goal: data.goal ?? null,
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    capacity: data.capacity ?? null,
  };
  return repo.createSprint(createData);
}

export async function updateSprint(
  ctx: GraphQLContext,
  id: string,
  input: unknown,
): Promise<Sprint> {
  const sprint = await getSprintOrThrow(id);
  await authorize(ctx, 'sprint:update', { projectId: sprint.projectId });
  const data = validateUpdateSprint(input);

  const updateData: Prisma.SprintUncheckedUpdateInput = {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.goal !== undefined ? { goal: data.goal } : {}),
    ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
    ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
    ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
  };
  return repo.updateSprint(id, updateData);
}

export async function changeSprintState(
  ctx: GraphQLContext,
  id: string,
  state: SprintState,
): Promise<Sprint> {
  const sprint = await getSprintOrThrow(id);
  await authorize(ctx, 'sprint:update', { projectId: sprint.projectId });

  if (sprint.state === state || !canTransitionSprint(sprint.state, state)) {
    throw new ValidationError(
      `Cannot change sprint state from ${sprint.state} to ${state}`,
    );
  }
  return repo.updateSprint(id, { state });
}

export async function deleteSprint(
  ctx: GraphQLContext,
  id: string,
): Promise<void> {
  const sprint = await getSprintOrThrow(id);
  await authorize(ctx, 'sprint:delete', { projectId: sprint.projectId });
  await repo.deleteSprint(id);
}

async function moveTask(
  ctx: GraphQLContext,
  sprintId: string,
  taskId: string,
  target: string | null,
): Promise<Sprint> {
  const sprint = await getSprintOrThrow(sprintId);
  const principal = requireAuth(ctx);
  await authorize(ctx, 'sprint:update', { projectId: sprint.projectId });

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, sprintId: true },
  });
  if (!task) {
    throw new NotFoundError('Task not found');
  }
  if (task.projectId !== sprint.projectId) {
    throw new ValidationError('Task does not belong to this sprint’s project');
  }
  if (task.sprintId === target) {
    return sprint;
  }

  await withTransaction(async (tx) => {
    await tx.task.update({ where: { id: taskId }, data: { sprintId: target } });
    await activityRepo.createActivity(
      {
        projectId: sprint.projectId,
        taskId,
        actorId: principal.id,
        type: 'SPRINT_MOVED',
        metadata: { from: task.sprintId, to: target },
      },
      tx,
    );
  });
  return sprint;
}

export function addTaskToSprint(
  ctx: GraphQLContext,
  sprintId: string,
  taskId: string,
): Promise<Sprint> {
  return moveTask(ctx, sprintId, taskId, sprintId);
}

export function removeTaskFromSprint(
  ctx: GraphQLContext,
  sprintId: string,
  taskId: string,
): Promise<Sprint> {
  return moveTask(ctx, sprintId, taskId, null);
}

// --- Metrics ---

export async function getMetrics(
  ctx: GraphQLContext,
  sprint: Sprint,
): Promise<SprintMetrics> {
  await authorize(ctx, 'sprint:read', { projectId: sprint.projectId });

  const [statusRows, workloadRows] = await Promise.all([
    repo.aggregateByStatus(sprint.id),
    repo.aggregateByAssignee(sprint.id),
  ]);

  let totalStoryPoints = 0;
  let completedStoryPoints = 0;
  let totalTasks = 0;
  let completedTasks = 0;
  for (const row of statusRows) {
    totalStoryPoints += row.storyPoints;
    totalTasks += row.taskCount;
    if (row.status === 'DONE') {
      completedStoryPoints += row.storyPoints;
      completedTasks += row.taskCount;
    }
  }

  const completionRate =
    totalStoryPoints > 0
      ? completedStoryPoints / totalStoryPoints
      : totalTasks > 0
        ? completedTasks / totalTasks
        : 0;

  return {
    totalStoryPoints,
    completedStoryPoints,
    remainingStoryPoints: totalStoryPoints - completedStoryPoints,
    totalTasks,
    completedTasks,
    completionRate,
    velocity: completedStoryPoints,
    capacity: sprint.capacity,
    overCapacity: sprint.capacity !== null && totalStoryPoints > sprint.capacity,
    workloadDistribution: workloadRows
      .map((row) => ({
        assigneeId: row.assigneeId,
        storyPoints: row.storyPoints,
        taskCount: row.taskCount,
      }))
      .sort((a, b) => b.storyPoints - a.storyPoints),
  };
}

/** Truncates a timestamp to the start of its UTC day. */
function startOfUtcDay(date: Date): number {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

export async function getBurndown(
  ctx: GraphQLContext,
  sprint: Sprint,
): Promise<BurndownPoint[]> {
  await authorize(ctx, 'sprint:read', { projectId: sprint.projectId });

  if (!sprint.startDate || !sprint.endDate) {
    return [];
  }
  const start = startOfUtcDay(sprint.startDate);
  const end = startOfUtcDay(sprint.endDate);
  const days = Math.round((end - start) / DAY_MS) + 1;
  if (days < 2) {
    return [];
  }

  const tasks = await repo.listSprintTasks(sprint.id);
  const total = tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0);

  // Date each currently-DONE task by its latest STATUS_CHANGED → DONE activity.
  const doneTasks = tasks.filter((task) => task.status === DONE);
  const pointsByTask = new Map(doneTasks.map((task) => [task.id, task.storyPoints ?? 0]));
  const completedAt = new Map<string, number>();
  if (doneTasks.length > 0) {
    const activity = await repo.listStatusActivity([...pointsByTask.keys()]);
    for (const entry of activity) {
      const to = (entry.metadata as { to?: unknown } | null)?.to;
      if (to === DONE && entry.taskId) {
        completedAt.set(entry.taskId, startOfUtcDay(entry.createdAt));
      }
    }
  }

  const points: BurndownPoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const dayStart = start + i * DAY_MS;
    let completedByDay = 0;
    for (const [taskId, pts] of pointsByTask) {
      const when = completedAt.get(taskId);
      // Fall back to "completed at end" when the activity date is unknown.
      if (when !== undefined ? when <= dayStart : i === days - 1) {
        completedByDay += pts;
      }
    }
    points.push({
      date: new Date(dayStart),
      idealRemaining: Math.round((total * (1 - i / (days - 1))) * 100) / 100,
      actualRemaining: total - completedByDay,
    });
  }
  return points;
}
