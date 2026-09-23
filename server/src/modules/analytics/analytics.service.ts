import type { User } from '@prisma/client';
import type { GraphQLContext } from '@shared/graphql/context';
import { prisma } from '@shared/db';
import { authorize, authorizeOwnerOrPermission, requireAuth } from '@shared/auth';
import { NotFoundError } from '@shared/errors';
import * as repo from './analytics.repository.js';
import type {
  ProjectAnalytics,
  SprintTrendPoint,
  UserAnalytics,
} from './analytics.model.js';

export async function getProjectAnalytics(
  ctx: GraphQLContext,
  projectId: string,
): Promise<ProjectAnalytics> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new NotFoundError('Project not found');
  }
  await authorize(ctx, 'analytics:view', { projectId });

  const [byStatus, byPriority, totals, workloads, sprints] = await Promise.all([
    repo.statusDistribution(projectId),
    repo.priorityDistribution(projectId),
    repo.projectTotals(projectId),
    repo.individualWorkloads(projectId),
    repo.listProjectSprints(projectId),
  ]);

  const sprintPoints = await repo.sprintPointTotals(sprints.map((s) => s.id));
  const storyPointTrends: SprintTrendPoint[] = sprints.map((sprint) => {
    const points = sprintPoints.get(sprint.id);
    return {
      sprintId: sprint.id,
      name: sprint.name,
      committedStoryPoints: points?.committedStoryPoints ?? 0,
      completedStoryPoints: points?.completedStoryPoints ?? 0,
    };
  });

  // Team velocity = average completed story points across COMPLETED sprints.
  const completedSprints = sprints.filter((s) => s.state === 'COMPLETED');
  const velocitySum = completedSprints.reduce(
    (sum, sprint) => sum + (sprintPoints.get(sprint.id)?.completedStoryPoints ?? 0),
    0,
  );
  const teamVelocity =
    completedSprints.length > 0
      ? Math.round((velocitySum / completedSprints.length) * 100) / 100
      : 0;

  const completionRate =
    totals.totalStoryPoints > 0
      ? totals.completedStoryPoints / totals.totalStoryPoints
      : totals.totalTasks > 0
        ? totals.completedTasks / totals.totalTasks
        : 0;

  return {
    projectId,
    totalTasks: totals.totalTasks,
    completedTasks: totals.completedTasks,
    totalStoryPoints: totals.totalStoryPoints,
    completedStoryPoints: totals.completedStoryPoints,
    completionRate,
    teamVelocity,
    taskDistributionByStatus: byStatus,
    taskDistributionByPriority: byPriority,
    storyPointTrends,
    individualWorkloads: workloads,
  };
}

/** Truncates to the latest STATUS_CHANGED→DONE time per task. */
function completionTimes(
  activity: Array<{ taskId: string | null; metadata: unknown; createdAt: Date }>,
): Map<string, Date> {
  const byTask = new Map<string, Date>();
  for (const entry of activity) {
    const to = (entry.metadata as { to?: unknown } | null)?.to;
    if (to === 'DONE' && entry.taskId) {
      byTask.set(entry.taskId, entry.createdAt);
    }
  }
  return byTask;
}

async function computeUserStatistics(userId: string): Promise<{
  completedTasks: number;
  historicalStoryPoints: number;
  avgCompletionSeconds: bigint | null;
  velocity: number | null;
}> {
  const done = await repo.doneTasksForUser(userId);
  const completedTasks = done.length;
  const historicalStoryPoints = done.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0);

  let avgCompletionSeconds: bigint | null = null;
  if (completedTasks > 0) {
    const completedAt = completionTimes(await repo.doneStatusActivity(done.map((t) => t.id)));
    const durations: number[] = [];
    for (const task of done) {
      const finished = completedAt.get(task.id);
      if (finished) {
        durations.push(Math.max(0, (finished.getTime() - task.createdAt.getTime()) / 1000));
      }
    }
    if (durations.length > 0) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      avgCompletionSeconds = BigInt(Math.round(avg));
    }
  }

  const distinctSprints = new Set(done.map((t) => t.sprintId).filter((id): id is string => id !== null));
  const velocity =
    distinctSprints.size > 0
      ? Math.round((historicalStoryPoints / distinctSprints.size) * 100) / 100
      : null;

  return { completedTasks, historicalStoryPoints, avgCompletionSeconds, velocity };
}

export async function getUserAnalytics(
  ctx: GraphQLContext,
  userId: string,
): Promise<UserAnalytics> {
  const principal = requireAuth(ctx);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }
  // A user may always see their own analytics; otherwise org-level view is required.
  if (principal.id !== userId) {
    const orgs = await prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    await ensureSharesAnyOrg(ctx, orgs.map((o) => o.organizationId));
  }

  const stats = await computeUserStatistics(userId);
  const activeAssignments = await repo.activeAssignmentCount(userId);
  return {
    userId,
    completedTasks: stats.completedTasks,
    historicalStoryPoints: stats.historicalStoryPoints,
    avgCompletionSeconds:
      stats.avgCompletionSeconds === null ? null : Number(stats.avgCompletionSeconds),
    velocity: stats.velocity,
    activeAssignments,
  };
}

async function ensureSharesAnyOrg(
  ctx: GraphQLContext,
  organizationIds: string[],
): Promise<void> {
  for (const organizationId of organizationIds) {
    try {
      await authorize(ctx, 'analytics:view', { organizationId });
      return;
    } catch {
      // try the next shared org
    }
  }
  // No shared org granted analytics:view — fall through to a hard denial.
  await authorize(ctx, 'analytics:view', {
    organizationId: organizationIds[0] ?? '00000000-0000-0000-0000-000000000000',
  });
}

/**
 * Recomputes and persists a user's `user_statistics` from real task/sprint
 * history (the Phase 5 stub is finalized here). Returns the user node.
 */
export async function recomputeUserStatistics(
  ctx: GraphQLContext,
  userId: string,
): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }
  await authorizeOwnerOrPermission(
    ctx,
    'analytics:view',
    { organizationId: '00000000-0000-0000-0000-000000000000' },
    [userId],
  );

  const stats = await computeUserStatistics(userId);
  await repo.upsertUserStatistics(userId, stats);
  return user;
}
