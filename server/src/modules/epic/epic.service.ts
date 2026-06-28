import type { Epic, Milestone, Prisma } from '@prisma/client';
import type { GraphQLContext } from '@shared/graphql/context';
import { authorize } from '@shared/auth';
import { NotFoundError, ValidationError } from '@shared/errors';
import {
  buildConnection,
  clampFirst,
  decodeCursor,
  encodeCursor,
  type Connection,
} from '@shared/utils';
import * as repo from './epic.repository.js';
import {
  validateCreateEpic,
  validateCreateMilestone,
  validateUpdateEpic,
} from './epic.validation.js';
import type { EpicProgress } from './epic.model.js';

async function getEpicOrThrow(id: string): Promise<Epic> {
  const epic = await repo.findEpicById(id);
  if (!epic) {
    throw new NotFoundError('Epic not found');
  }
  return epic;
}

export async function getEpic(ctx: GraphQLContext, id: string): Promise<Epic> {
  const epic = await getEpicOrThrow(id);
  await authorize(ctx, 'epic:read', { projectId: epic.projectId });
  return epic;
}

export async function listProjectEpics(
  ctx: GraphQLContext,
  projectId: string,
  args: { first?: number | null; after?: string | null },
): Promise<Connection<Epic>> {
  await authorize(ctx, 'epic:read', { projectId });

  const pageSize = clampFirst(args.first);
  const after = args.after ? decodeCursor(args.after) : null;

  const [rows, totalCount] = await Promise.all([
    repo.listProjectEpicsPage({
      projectId,
      take: pageSize + 1,
      ...(after ? { cursor: after } : {}),
    }),
    repo.countProjectEpics(projectId),
  ]);

  return buildConnection(rows, {
    pageSize,
    after,
    totalCount,
    getCursor: (epic) => encodeCursor(epic.id),
  });
}

export async function createEpic(
  ctx: GraphQLContext,
  projectId: string,
  input: unknown,
): Promise<Epic> {
  await authorize(ctx, 'epic:create', { projectId });
  const data = validateCreateEpic(input);
  return repo.createEpic({
    projectId,
    name: data.name,
    description: data.description ?? null,
  });
}

export async function updateEpic(
  ctx: GraphQLContext,
  id: string,
  input: unknown,
): Promise<Epic> {
  const epic = await getEpicOrThrow(id);
  await authorize(ctx, 'epic:update', { projectId: epic.projectId });
  const data = validateUpdateEpic(input);

  const updateData: Prisma.EpicUncheckedUpdateInput = {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
  };
  return repo.updateEpic(id, updateData);
}

export async function deleteEpic(
  ctx: GraphQLContext,
  id: string,
): Promise<void> {
  const epic = await getEpicOrThrow(id);
  await authorize(ctx, 'epic:delete', { projectId: epic.projectId });
  await repo.deleteEpic(id);
}

/**
 * Computes epic progress live from child-task completion, so it always reflects
 * the current task states (the spec's "recalculates from task state changes").
 */
export async function computeProgress(epicId: string): Promise<EpicProgress> {
  const [totalTasks, completedTasks] = await Promise.all([
    repo.countEpicTasks(epicId),
    repo.countEpicTasksByStatus(epicId, 'DONE'),
  ]);
  const progress =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 10000) / 100 : 0;
  return { totalTasks, completedTasks, progress };
}

/** Persists the live progress onto the epic's denormalized `progress` column. */
export async function refreshProgress(
  ctx: GraphQLContext,
  id: string,
): Promise<Epic> {
  const epic = await getEpicOrThrow(id);
  await authorize(ctx, 'epic:update', { projectId: epic.projectId });
  const { progress } = await computeProgress(id);
  return repo.updateEpic(id, { progress });
}

// --- Milestones ---

export async function createMilestone(
  ctx: GraphQLContext,
  projectId: string,
  input: unknown,
): Promise<Milestone> {
  await authorize(ctx, 'epic:create', { projectId });
  const data = validateCreateMilestone(input);

  if (data.epicId) {
    const epic = await repo.findEpicById(data.epicId);
    if (!epic || epic.projectId !== projectId) {
      throw new ValidationError('Epic does not belong to this project');
    }
  }

  return repo.createMilestone({
    projectId,
    name: data.name,
    description: data.description ?? null,
    dueDate: data.dueDate ?? null,
    epicId: data.epicId ?? null,
  });
}

export async function deleteMilestone(
  ctx: GraphQLContext,
  id: string,
): Promise<void> {
  const milestone = await repo.findMilestoneById(id);
  if (!milestone) {
    throw new NotFoundError('Milestone not found');
  }
  await authorize(ctx, 'epic:delete', { projectId: milestone.projectId });
  await repo.deleteMilestone(id);
}

export function listEpicMilestones(epicId: string): Promise<Milestone[]> {
  return repo.listEpicMilestones(epicId);
}
