import type {
  Label,
  Prisma,
  Task,
  TaskDependency,
  TaskWatcher,
} from '@prisma/client';
import { prisma, type Executor } from '@shared/db';
import { toPrismaSortOrder, type SortDirection } from '@shared/utils';
import type { TaskFilter, TaskSortField } from './task.model.js';

/** Task data access. Pure persistence; RBAC/validation live in the service. */
export function findTaskById(
  id: string,
  db: Executor = prisma,
): Promise<Task | null> {
  return db.task.findUnique({ where: { id } });
}

export function createTask(
  data: Prisma.TaskUncheckedCreateInput,
  db: Executor = prisma,
): Promise<Task> {
  return db.task.create({ data });
}

export function updateTask(
  id: string,
  data: Prisma.TaskUncheckedUpdateInput,
  db: Executor = prisma,
): Promise<Task> {
  return db.task.update({ where: { id }, data });
}

export async function deleteTask(
  id: string,
  db: Executor = prisma,
): Promise<void> {
  await db.task.delete({ where: { id } });
}

function buildWhere(
  projectId: string,
  filter: TaskFilter | undefined,
): Prisma.TaskWhereInput {
  return {
    projectId,
    ...(filter?.status ? { status: filter.status } : {}),
    ...(filter?.priority ? { priority: filter.priority } : {}),
    ...(filter?.assigneeId ? { assigneeId: filter.assigneeId } : {}),
    ...(filter?.sprintId ? { sprintId: filter.sprintId } : {}),
    ...(filter?.epicId ? { epicId: filter.epicId } : {}),
    ...(filter?.labelId ? { labels: { some: { labelId: filter.labelId } } } : {}),
  };
}

function buildOrderBy(
  sortField: TaskSortField,
  direction: SortDirection | null | undefined,
): Prisma.TaskOrderByWithRelationInput[] {
  const order = toPrismaSortOrder(direction);
  // Always tie-break on id so the cursor is stable across equal sort keys.
  switch (sortField) {
    case 'PRIORITY':
      return [{ priority: order }, { id: 'asc' }];
    case 'DUE_DATE':
      return [{ dueDate: order }, { id: 'asc' }];
    case 'CREATED_AT':
    default:
      return [{ createdAt: order }, { id: 'asc' }];
  }
}

export function listProjectTasksPage(
  args: {
    projectId: string;
    take: number;
    cursor?: string;
    filter?: TaskFilter;
    sortField: TaskSortField;
    direction?: SortDirection | null;
  },
  db: Executor = prisma,
): Promise<Task[]> {
  return db.task.findMany({
    where: buildWhere(args.projectId, args.filter),
    orderBy: buildOrderBy(args.sortField, args.direction),
    take: args.take,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
  });
}

export function countProjectTasks(
  projectId: string,
  filter: TaskFilter | undefined,
  db: Executor = prisma,
): Promise<number> {
  return db.task.count({ where: buildWhere(projectId, filter) });
}

// --- Dependencies ---

export function findDependency(
  taskId: string,
  dependsOnTaskId: string,
  db: Executor = prisma,
): Promise<TaskDependency | null> {
  return db.taskDependency.findUnique({
    where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } },
  });
}

export function createDependency(
  taskId: string,
  dependsOnTaskId: string,
  db: Executor = prisma,
): Promise<TaskDependency> {
  return db.taskDependency.create({ data: { taskId, dependsOnTaskId } });
}

export async function deleteDependency(
  taskId: string,
  dependsOnTaskId: string,
  db: Executor = prisma,
): Promise<void> {
  await db.taskDependency.deleteMany({ where: { taskId, dependsOnTaskId } });
}

/** All dependency edges within a project, for in-memory cycle detection. */
export function listDependencyEdges(
  projectId: string,
  db: Executor = prisma,
): Promise<Array<{ taskId: string; dependsOnTaskId: string }>> {
  return db.taskDependency.findMany({
    where: { task: { projectId } },
    select: { taskId: true, dependsOnTaskId: true },
  });
}

// --- Watchers ---

export function findWatcher(
  taskId: string,
  userId: string,
  db: Executor = prisma,
): Promise<TaskWatcher | null> {
  return db.taskWatcher.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });
}

export function createWatcher(
  taskId: string,
  userId: string,
  db: Executor = prisma,
): Promise<TaskWatcher> {
  return db.taskWatcher.create({ data: { taskId, userId } });
}

export async function deleteWatcher(
  taskId: string,
  userId: string,
  db: Executor = prisma,
): Promise<void> {
  await db.taskWatcher.deleteMany({ where: { taskId, userId } });
}

// --- Labels ---

export function findOrCreateLabel(
  projectId: string,
  name: string,
  db: Executor = prisma,
): Promise<Label> {
  return db.label.upsert({
    where: { projectId_name: { projectId, name } },
    update: {},
    create: { projectId, name },
  });
}

export function findLabelByName(
  projectId: string,
  name: string,
  db: Executor = prisma,
): Promise<Label | null> {
  return db.label.findUnique({ where: { projectId_name: { projectId, name } } });
}

export async function attachLabel(
  taskId: string,
  labelId: string,
  db: Executor = prisma,
): Promise<void> {
  await db.taskLabel.upsert({
    where: { taskId_labelId: { taskId, labelId } },
    update: {},
    create: { taskId, labelId },
  });
}

export async function detachLabel(
  taskId: string,
  labelId: string,
  db: Executor = prisma,
): Promise<void> {
  await db.taskLabel.deleteMany({ where: { taskId, labelId } });
}
