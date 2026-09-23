import type { Epic, Milestone, Prisma } from '@prisma/client';
import { prisma, type Executor } from '@shared/db';

/** Epic & milestone data access. Pure persistence; rules live in the service. */
export function findEpicById(
  id: string,
  db: Executor = prisma,
): Promise<Epic | null> {
  return db.epic.findUnique({ where: { id } });
}

export function createEpic(
  data: Prisma.EpicUncheckedCreateInput,
  db: Executor = prisma,
): Promise<Epic> {
  return db.epic.create({ data });
}

export function updateEpic(
  id: string,
  data: Prisma.EpicUncheckedUpdateInput,
  db: Executor = prisma,
): Promise<Epic> {
  return db.epic.update({ where: { id }, data });
}

export async function deleteEpic(
  id: string,
  db: Executor = prisma,
): Promise<void> {
  await db.epic.delete({ where: { id } });
}

export function listProjectEpicsPage(
  args: { projectId: string; take: number; cursor?: string },
  db: Executor = prisma,
): Promise<Epic[]> {
  return db.epic.findMany({
    where: { projectId: args.projectId },
    orderBy: { createdAt: 'desc' },
    take: args.take,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
  });
}

export function countProjectEpics(
  projectId: string,
  db: Executor = prisma,
): Promise<number> {
  return db.epic.count({ where: { projectId } });
}

export function countEpicTasks(
  epicId: string,
  db: Executor = prisma,
): Promise<number> {
  return db.task.count({ where: { epicId } });
}

export function countEpicTasksByStatus(
  epicId: string,
  status: 'DONE',
  db: Executor = prisma,
): Promise<number> {
  return db.task.count({ where: { epicId, status } });
}

// --- Milestones ---

export function createMilestone(
  data: Prisma.MilestoneUncheckedCreateInput,
  db: Executor = prisma,
): Promise<Milestone> {
  return db.milestone.create({ data });
}

export function findMilestoneById(
  id: string,
  db: Executor = prisma,
): Promise<Milestone | null> {
  return db.milestone.findUnique({ where: { id } });
}

export async function deleteMilestone(
  id: string,
  db: Executor = prisma,
): Promise<void> {
  await db.milestone.delete({ where: { id } });
}

export function listEpicMilestones(
  epicId: string,
  db: Executor = prisma,
): Promise<Milestone[]> {
  return db.milestone.findMany({
    where: { epicId },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  });
}
