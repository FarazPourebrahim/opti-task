import type { Label, Prisma, Task, TaskStatus } from '@prisma/client';
import type { GraphQLContext } from '@shared/graphql/context';
import { prisma, withTransaction } from '@shared/db';
import {
  authorize,
  authorizeOwnerOrPermission,
  requireAuth,
} from '@shared/auth';
import { ConflictError, NotFoundError, ValidationError } from '@shared/errors';
import {
  buildConnection,
  clampFirst,
  decodeCursor,
  encodeCursor,
  type Connection,
  type SortDirection,
} from '@shared/utils';
import { emit } from '@shared/events';
import * as activityRepo from '@modules/activity/activity.repository';
import * as repo from './task.repository.js';
import {
  validateCreateTask,
  validateSeconds,
  validateStoryPoints,
  validateUpdateTask,
} from './task.validation.js';
import { canTransitionTask, type TaskFilter, type TaskSortField } from './task.model.js';

async function getTaskOrThrow(id: string): Promise<Task> {
  const task = await repo.findTaskById(id);
  if (!task) {
    throw new NotFoundError('Task not found');
  }
  return task;
}

export async function getTask(ctx: GraphQLContext, id: string): Promise<Task> {
  const task = await getTaskOrThrow(id);
  await authorize(ctx, 'task:read', { projectId: task.projectId });
  return task;
}

export async function listProjectTasks(
  ctx: GraphQLContext,
  projectId: string,
  args: {
    first?: number | null;
    after?: string | null;
    filter?: TaskFilter | null;
    sortField?: TaskSortField | null;
    sortDirection?: SortDirection | null;
  },
): Promise<Connection<Task>> {
  await authorize(ctx, 'task:read', { projectId });

  const pageSize = clampFirst(args.first);
  const after = args.after ? decodeCursor(args.after) : null;
  const filter = args.filter ?? undefined;

  const [rows, totalCount] = await Promise.all([
    repo.listProjectTasksPage({
      projectId,
      take: pageSize + 1,
      sortField: args.sortField ?? 'CREATED_AT',
      direction: args.sortDirection ?? null,
      ...(filter ? { filter } : {}),
      ...(after ? { cursor: after } : {}),
    }),
    repo.countProjectTasks(projectId, filter),
  ]);

  return buildConnection(rows, {
    pageSize,
    after,
    totalCount,
    getCursor: (task) => encodeCursor(task.id),
  });
}

async function assertUserExists(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }
}

/** Ensures an optional sprint/epic reference belongs to the task's project. */
async function assertSprintInProject(
  sprintId: string,
  projectId: string,
): Promise<void> {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { projectId: true },
  });
  if (!sprint || sprint.projectId !== projectId) {
    throw new ValidationError('Sprint does not belong to this project');
  }
}

async function assertEpicInProject(
  epicId: string,
  projectId: string,
): Promise<void> {
  const epic = await prisma.epic.findUnique({
    where: { id: epicId },
    select: { projectId: true },
  });
  if (!epic || epic.projectId !== projectId) {
    throw new ValidationError('Epic does not belong to this project');
  }
}

export async function createTask(
  ctx: GraphQLContext,
  projectId: string,
  input: unknown,
): Promise<Task> {
  const principal = requireAuth(ctx);
  await authorize(ctx, 'task:create', { projectId });
  const data = validateCreateTask(input);

  if (data.assigneeId) {
    await assertUserExists(data.assigneeId);
  }
  if (data.sprintId) {
    await assertSprintInProject(data.sprintId, projectId);
  }
  if (data.epicId) {
    await assertEpicInProject(data.epicId, projectId);
  }

  const createData: Prisma.TaskUncheckedCreateInput = {
    projectId,
    title: data.title,
    reporterId: principal.id,
    description: data.description ?? null,
    storyPoints: data.storyPoints ?? null,
    assigneeId: data.assigneeId ?? null,
    sprintId: data.sprintId ?? null,
    epicId: data.epicId ?? null,
    dueDate: data.dueDate ?? null,
    ...(data.priority !== undefined ? { priority: data.priority } : {}),
  };

  const task = await withTransaction(async (tx) => {
    const created = await repo.createTask(createData, tx);
    await activityRepo.createActivity(
      {
        projectId,
        taskId: created.id,
        actorId: principal.id,
        type: 'TASK_CREATED',
        metadata: { title: created.title },
      },
      tx,
    );
    return created;
  });

  if (task.assigneeId) {
    await emit('task.assigned', {
      taskId: task.id,
      projectId,
      assigneeId: task.assigneeId,
      actorId: principal.id,
    });
  }
  return task;
}

export async function updateTask(
  ctx: GraphQLContext,
  id: string,
  input: unknown,
): Promise<Task> {
  const task = await getTaskOrThrow(id);
  await authorizeOwnerOrPermission(ctx, 'task:update', { projectId: task.projectId }, [
    task.assigneeId,
    task.reporterId,
  ]);
  const data = validateUpdateTask(input);

  const updateData: Prisma.TaskUncheckedUpdateInput = {
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.priority !== undefined ? { priority: data.priority } : {}),
    ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
  };
  return repo.updateTask(id, updateData);
}

export async function changeStatus(
  ctx: GraphQLContext,
  id: string,
  status: TaskStatus,
): Promise<Task> {
  const task = await getTaskOrThrow(id);
  const principal = requireAuth(ctx);
  await authorizeOwnerOrPermission(ctx, 'task:update', { projectId: task.projectId }, [
    task.assigneeId,
    task.reporterId,
  ]);

  if (task.status === status || !canTransitionTask(task.status, status)) {
    throw new ValidationError(
      `Cannot change task status from ${task.status} to ${status}`,
    );
  }

  return withTransaction(async (tx) => {
    const updated = await repo.updateTask(id, { status }, tx);
    await activityRepo.createActivity(
      {
        projectId: task.projectId,
        taskId: id,
        actorId: principal.id,
        type: 'STATUS_CHANGED',
        metadata: { from: task.status, to: status },
      },
      tx,
    );
    return updated;
  });
}

export async function assignTask(
  ctx: GraphQLContext,
  id: string,
  assigneeId: string | null,
): Promise<Task> {
  const task = await getTaskOrThrow(id);
  const principal = requireAuth(ctx);
  await authorize(ctx, 'task:assign', { projectId: task.projectId });

  if (assigneeId) {
    await assertUserExists(assigneeId);
  }
  if (task.assigneeId === assigneeId) {
    return task;
  }

  const updated = await withTransaction(async (tx) => {
    const result = await repo.updateTask(id, { assigneeId }, tx);
    await activityRepo.createActivity(
      {
        projectId: task.projectId,
        taskId: id,
        actorId: principal.id,
        type: 'ASSIGNED',
        metadata: { from: task.assigneeId, to: assigneeId },
      },
      tx,
    );
    return result;
  });

  if (assigneeId) {
    await emit('task.assigned', {
      taskId: id,
      projectId: task.projectId,
      assigneeId,
      actorId: principal.id,
    });
  }
  return updated;
}

export async function setStoryPoints(
  ctx: GraphQLContext,
  id: string,
  storyPoints: unknown,
): Promise<Task> {
  const task = await getTaskOrThrow(id);
  const principal = requireAuth(ctx);
  await authorizeOwnerOrPermission(ctx, 'task:update', { projectId: task.projectId }, [
    task.assigneeId,
    task.reporterId,
  ]);
  const points = validateStoryPoints(storyPoints);

  if (task.storyPoints === points) {
    return task;
  }

  return withTransaction(async (tx) => {
    const updated = await repo.updateTask(id, { storyPoints: points }, tx);
    await activityRepo.createActivity(
      {
        projectId: task.projectId,
        taskId: id,
        actorId: principal.id,
        type: 'STORY_POINTS_UPDATED',
        metadata: { from: task.storyPoints, to: points },
      },
      tx,
    );
    return updated;
  });
}

export async function moveToSprint(
  ctx: GraphQLContext,
  id: string,
  sprintId: string | null,
): Promise<Task> {
  const task = await getTaskOrThrow(id);
  const principal = requireAuth(ctx);
  await authorizeOwnerOrPermission(ctx, 'task:update', { projectId: task.projectId }, [
    task.assigneeId,
    task.reporterId,
  ]);

  if (sprintId) {
    await assertSprintInProject(sprintId, task.projectId);
  }
  if (task.sprintId === sprintId) {
    return task;
  }

  return withTransaction(async (tx) => {
    const updated = await repo.updateTask(id, { sprintId }, tx);
    await activityRepo.createActivity(
      {
        projectId: task.projectId,
        taskId: id,
        actorId: principal.id,
        type: 'SPRINT_MOVED',
        metadata: { from: task.sprintId, to: sprintId },
      },
      tx,
    );
    return updated;
  });
}

export async function deleteTask(
  ctx: GraphQLContext,
  id: string,
): Promise<void> {
  const task = await getTaskOrThrow(id);
  await authorizeOwnerOrPermission(ctx, 'task:delete', { projectId: task.projectId }, [
    task.reporterId,
  ]);
  await repo.deleteTask(id);
}

export async function logTime(
  ctx: GraphQLContext,
  id: string,
  seconds: unknown,
): Promise<Task> {
  const task = await getTaskOrThrow(id);
  await authorizeOwnerOrPermission(ctx, 'task:update', { projectId: task.projectId }, [
    task.assigneeId,
    task.reporterId,
  ]);
  const amount = validateSeconds(seconds);
  return repo.updateTask(id, { loggedSeconds: { increment: BigInt(amount) } });
}

/**
 * Adding `taskId depends on dependsOnTaskId` introduces a cycle iff
 * `dependsOnTaskId` can already reach `taskId` along existing dependency edges.
 * We load the project's edges and traverse them in memory.
 */
async function wouldCreateCycle(
  projectId: string,
  taskId: string,
  dependsOnTaskId: string,
): Promise<boolean> {
  const edges = await repo.listDependencyEdges(projectId);
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const bucket = adjacency.get(edge.taskId);
    if (bucket) {
      bucket.push(edge.dependsOnTaskId);
    } else {
      adjacency.set(edge.taskId, [edge.dependsOnTaskId]);
    }
  }

  const stack = [dependsOnTaskId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === taskId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      stack.push(next);
    }
  }
  return false;
}

export async function addDependency(
  ctx: GraphQLContext,
  taskId: string,
  dependsOnTaskId: string,
): Promise<Task> {
  const task = await getTaskOrThrow(taskId);
  await authorizeOwnerOrPermission(ctx, 'task:update', { projectId: task.projectId }, [
    task.assigneeId,
    task.reporterId,
  ]);

  if (taskId === dependsOnTaskId) {
    throw new ValidationError('A task cannot depend on itself');
  }
  const dependency = await getTaskOrThrow(dependsOnTaskId);
  if (dependency.projectId !== task.projectId) {
    throw new ValidationError('Dependencies must be within the same project');
  }
  const existing = await repo.findDependency(taskId, dependsOnTaskId);
  if (existing) {
    throw new ConflictError('Dependency already exists');
  }
  if (await wouldCreateCycle(task.projectId, taskId, dependsOnTaskId)) {
    throw new ValidationError('Dependency would create a cycle');
  }

  await repo.createDependency(taskId, dependsOnTaskId);
  return task;
}

export async function removeDependency(
  ctx: GraphQLContext,
  taskId: string,
  dependsOnTaskId: string,
): Promise<Task> {
  const task = await getTaskOrThrow(taskId);
  await authorizeOwnerOrPermission(ctx, 'task:update', { projectId: task.projectId }, [
    task.assigneeId,
    task.reporterId,
  ]);
  const existing = await repo.findDependency(taskId, dependsOnTaskId);
  if (!existing) {
    throw new NotFoundError('Dependency not found');
  }
  await repo.deleteDependency(taskId, dependsOnTaskId);
  return task;
}

export async function watchTask(
  ctx: GraphQLContext,
  taskId: string,
): Promise<Task> {
  const task = await getTaskOrThrow(taskId);
  const principal = requireAuth(ctx);
  await authorize(ctx, 'task:read', { projectId: task.projectId });
  const existing = await repo.findWatcher(taskId, principal.id);
  if (!existing) {
    await repo.createWatcher(taskId, principal.id);
  }
  return task;
}

export async function unwatchTask(
  ctx: GraphQLContext,
  taskId: string,
): Promise<Task> {
  const task = await getTaskOrThrow(taskId);
  const principal = requireAuth(ctx);
  await authorize(ctx, 'task:read', { projectId: task.projectId });
  await repo.deleteWatcher(taskId, principal.id);
  return task;
}

export async function addLabel(
  ctx: GraphQLContext,
  taskId: string,
  name: string,
): Promise<Task> {
  const task = await getTaskOrThrow(taskId);
  await authorizeOwnerOrPermission(ctx, 'task:update', { projectId: task.projectId }, [
    task.assigneeId,
    task.reporterId,
  ]);
  const trimmed = name.trim();
  if (!trimmed) {
    throw new ValidationError('Label name is required');
  }
  const label: Label = await repo.findOrCreateLabel(task.projectId, trimmed);
  await repo.attachLabel(taskId, label.id);
  return task;
}

export async function removeLabel(
  ctx: GraphQLContext,
  taskId: string,
  name: string,
): Promise<Task> {
  const task = await getTaskOrThrow(taskId);
  await authorizeOwnerOrPermission(ctx, 'task:update', { projectId: task.projectId }, [
    task.assigneeId,
    task.reporterId,
  ]);
  const label = await repo.findLabelByName(task.projectId, name.trim());
  if (label) {
    await repo.detachLabel(taskId, label.id);
  }
  return task;
}
