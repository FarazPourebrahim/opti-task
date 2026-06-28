import type { AiRecommendation, Prisma, Sprint, Task } from '@prisma/client';
import type { GraphQLContext } from '@shared/graphql/context';
import { prisma, withTransaction } from '@shared/db';
import { authorize, requireAuth } from '@shared/auth';
import { ConflictError, NotFoundError, ValidationError } from '@shared/errors';
import {
  buildConnection,
  clampFirst,
  decodeCursor,
  encodeCursor,
  type Connection,
} from '@shared/utils';
import { emit } from '@shared/events';
import { publish } from '@shared/pubsub';
import * as activityRepo from '@modules/activity/activity.repository';
import * as repo from './ai.repository.js';
import {
  callProvider,
  getAiProvider,
  type AssignmentCandidateInput,
} from './ai.provider.js';
import type {
  AssignmentCandidate,
  OverrideRecommendationInput,
} from './ai.model.js';

// --- Lookups ---

async function getTaskOrThrow(id: string): Promise<Task> {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    throw new NotFoundError('Task not found');
  }
  return task;
}

async function getSprintOrThrow(id: string): Promise<Sprint> {
  const sprint = await prisma.sprint.findUnique({ where: { id } });
  if (!sprint) {
    throw new NotFoundError('Sprint not found');
  }
  return sprint;
}

async function getRecommendationOrThrow(id: string): Promise<AiRecommendation> {
  const rec = await repo.findById(id);
  if (!rec) {
    throw new NotFoundError('Recommendation not found');
  }
  return rec;
}

async function taskLabels(taskId: string): Promise<string[]> {
  const rows = await prisma.taskLabel.findMany({
    where: { taskId },
    include: { label: true },
  });
  return rows.map((row) => row.label.name);
}

// --- Assignment context dataset (exposed for transparency + AI input) ---

export async function getAssignmentContext(
  ctx: GraphQLContext,
  taskId: string,
): Promise<{ taskId: string; candidates: AssignmentCandidate[] }> {
  const task = await getTaskOrThrow(taskId);
  await authorize(ctx, 'task:read', { projectId: task.projectId });
  const candidates = await gatherCandidates(task.projectId);
  return { taskId, candidates };
}

async function gatherCandidates(projectId: string): Promise<AssignmentCandidate[]> {
  const members = await prisma.teamMember.findMany({
    where: { team: { projectId } },
    include: { user: { include: { skills: true, expertise: true } } },
  });

  const tasks = await prisma.task.findMany({
    where: { projectId, assigneeId: { not: null } },
    select: { assigneeId: true, status: true },
  });
  const active = new Map<string, number>();
  const completed = new Map<string, number>();
  for (const task of tasks) {
    if (!task.assigneeId) {
      continue;
    }
    if (task.status === 'DONE') {
      completed.set(task.assigneeId, (completed.get(task.assigneeId) ?? 0) + 1);
    } else {
      active.set(task.assigneeId, (active.get(task.assigneeId) ?? 0) + 1);
    }
  }

  const byUser = new Map<string, AssignmentCandidate>();
  for (const member of members) {
    if (byUser.has(member.userId)) {
      continue;
    }
    byUser.set(member.userId, {
      userId: member.userId,
      skills: member.user.skills.map((s) => s.skill),
      expertise: member.user.expertise.map((e) => e.tag),
      workload: member.workload,
      availability: member.availability,
      activeTaskCount: active.get(member.userId) ?? 0,
      completedTasks: completed.get(member.userId) ?? 0,
    });
  }
  return [...byUser.values()];
}

// --- Requesting suggestions (each persisted before return) ---

export async function requestStoryPointEstimate(
  ctx: GraphQLContext,
  taskId: string,
): Promise<AiRecommendation> {
  const task = await getTaskOrThrow(taskId);
  const principal = requireAuth(ctx);
  await authorize(ctx, 'ai:request', { projectId: task.projectId });

  const [labels, similar] = await Promise.all([
    taskLabels(taskId),
    prisma.task.findMany({
      where: { projectId: task.projectId, status: 'DONE', storyPoints: { not: null }, id: { not: taskId } },
      select: { storyPoints: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
  ]);
  const similarStoryPoints = similar
    .map((row) => row.storyPoints)
    .filter((value): value is number => value !== null);

  const provider = getAiProvider();
  const result = await callProvider('estimateStoryPoints', (p) =>
    p.estimateStoryPoints({
      title: task.title,
      description: task.description,
      labels,
      similarStoryPoints,
    }),
  );

  return persistRecommendation(task.projectId, principal.id, {
    type: 'STORY_POINT_ESTIMATION',
    taskId,
    text: result.reasoning,
    confidenceScore: result.confidence,
    provider: provider.name,
    metadata: { storyPoints: result.storyPoints },
  });
}

export async function requestAssignmentRecommendation(
  ctx: GraphQLContext,
  taskId: string,
): Promise<AiRecommendation> {
  const task = await getTaskOrThrow(taskId);
  const principal = requireAuth(ctx);
  await authorize(ctx, 'ai:request', { projectId: task.projectId });

  const [labels, candidates] = await Promise.all([
    taskLabels(taskId),
    gatherCandidates(task.projectId),
  ]);
  const candidateInput: AssignmentCandidateInput[] = candidates.map((c) => ({
    userId: c.userId,
    skills: c.skills,
    expertise: c.expertise,
    workload: c.workload,
    activeTaskCount: c.activeTaskCount,
    completedTasks: c.completedTasks,
  }));

  const provider = getAiProvider();
  const result = await callProvider('suggestAssignee', (p) =>
    p.suggestAssignee({
      title: task.title,
      description: task.description,
      labels,
      candidates: candidateInput,
    }),
  );

  return persistRecommendation(task.projectId, principal.id, {
    type: 'TASK_ASSIGNMENT',
    taskId,
    text: result.reasoning,
    confidenceScore: result.confidence,
    provider: provider.name,
    metadata: { suggestedAssigneeId: result.suggestedAssigneeId, ranking: result.ranking },
  });
}

export async function requestSprintHealthAnalysis(
  ctx: GraphQLContext,
  sprintId: string,
): Promise<AiRecommendation> {
  return requestSprintInsight(ctx, sprintId, 'SPRINT_HEALTH');
}

export async function requestProgressTracking(
  ctx: GraphQLContext,
  sprintId: string,
): Promise<AiRecommendation> {
  return requestSprintInsight(ctx, sprintId, 'PROGRESS_TRACKING');
}

async function requestSprintInsight(
  ctx: GraphQLContext,
  sprintId: string,
  type: 'SPRINT_HEALTH' | 'PROGRESS_TRACKING',
): Promise<AiRecommendation> {
  const sprint = await getSprintOrThrow(sprintId);
  const principal = requireAuth(ctx);
  await authorize(ctx, 'ai:request', { projectId: sprint.projectId });

  const statusRows = await prisma.task.groupBy({
    by: ['status'],
    where: { sprintId },
    _sum: { storyPoints: true },
  });
  let total = 0;
  let completed = 0;
  for (const row of statusRows) {
    const points = row._sum.storyPoints ?? 0;
    total += points;
    if (row.status === 'DONE') {
      completed += points;
    }
  }
  const workloadRows = await prisma.task.groupBy({
    by: ['assigneeId'],
    where: { sprintId },
    _sum: { storyPoints: true },
  });

  const input = {
    name: sprint.name,
    totalStoryPoints: total,
    completedStoryPoints: completed,
    remainingStoryPoints: total - completed,
    capacity: sprint.capacity,
    overCapacity: sprint.capacity !== null && total > sprint.capacity,
    workload: workloadRows.map((row) => ({
      assigneeId: row.assigneeId,
      storyPoints: row._sum.storyPoints ?? 0,
    })),
  };

  const provider = getAiProvider();
  const result = await callProvider(type, (p) =>
    type === 'SPRINT_HEALTH' ? p.analyzeSprintHealth(input) : p.trackProgress(input),
  );

  return persistRecommendation(sprint.projectId, principal.id, {
    type,
    sprintId,
    text: result.summary,
    confidenceScore: result.confidence,
    provider: provider.name,
    metadata: { risks: result.risks },
  });
}

async function persistRecommendation(
  projectId: string,
  requestedById: string,
  data: {
    type: Prisma.AiRecommendationUncheckedCreateInput['type'];
    taskId?: string;
    sprintId?: string;
    text: string;
    confidenceScore: number;
    provider: string;
    metadata: Record<string, unknown>;
  },
): Promise<AiRecommendation> {
  const rec = await repo.createRecommendation({
    projectId,
    requestedById,
    type: data.type,
    text: data.text,
    confidenceScore: data.confidenceScore,
    provider: data.provider,
    metadata: data.metadata as Prisma.InputJsonValue,
    ...(data.taskId ? { taskId: data.taskId } : {}),
    ...(data.sprintId ? { sprintId: data.sprintId } : {}),
  });
  // Audit that a suggestion was made (it has NOT mutated any domain data).
  await activityRepo.createActivity({
    projectId,
    ...(data.taskId ? { taskId: data.taskId } : {}),
    actorId: requestedById,
    type: 'AI_RECOMMENDATION',
    metadata: { recommendationId: rec.id, type: data.type },
  });
  return rec;
}

// --- Listing ---

export async function getRecommendation(
  ctx: GraphQLContext,
  id: string,
): Promise<AiRecommendation> {
  const rec = await getRecommendationOrThrow(id);
  await authorize(ctx, 'task:read', { projectId: rec.projectId });
  return rec;
}

export async function listProjectRecommendations(
  ctx: GraphQLContext,
  projectId: string,
  args: {
    first?: number | null;
    after?: string | null;
    type?: AiRecommendation['type'] | null;
    approvalStatus?: AiRecommendation['approvalStatus'] | null;
  },
): Promise<Connection<AiRecommendation>> {
  await authorize(ctx, 'task:read', { projectId });

  const pageSize = clampFirst(args.first);
  const after = args.after ? decodeCursor(args.after) : null;
  const filter = {
    ...(args.type ? { type: args.type } : {}),
    ...(args.approvalStatus ? { approvalStatus: args.approvalStatus } : {}),
  };

  const [rows, totalCount] = await Promise.all([
    repo.listProjectRecommendationsPage({
      projectId,
      take: pageSize + 1,
      ...filter,
      ...(after ? { cursor: after } : {}),
    }),
    repo.countProjectRecommendations(projectId, filter),
  ]);

  return buildConnection(rows, {
    pageSize,
    after,
    totalCount,
    getCursor: (rec) => encodeCursor(rec.id),
  });
}

// --- Decisions (approve / reject / override) — all persisted ---

function assertPending(rec: AiRecommendation): void {
  if (rec.approvalStatus !== 'PENDING') {
    throw new ConflictError('Recommendation has already been resolved');
  }
}

export async function approveRecommendation(
  ctx: GraphQLContext,
  id: string,
): Promise<AiRecommendation> {
  const rec = await getRecommendationOrThrow(id);
  const principal = requireAuth(ctx);
  await authorize(ctx, 'ai:approve', { projectId: rec.projectId });
  assertPending(rec);

  let result: AiRecommendation;
  if (rec.type === 'STORY_POINT_ESTIMATION') {
    const points = (rec.metadata as { storyPoints?: number }).storyPoints ?? null;
    result = await applyStoryPoints(rec, principal.id, points, 'APPROVED');
  } else if (rec.type === 'TASK_ASSIGNMENT') {
    const assigneeId = (rec.metadata as { suggestedAssigneeId?: string | null }).suggestedAssigneeId ?? null;
    result = await applyAssignment(rec, principal.id, assigneeId, 'APPROVED');
  } else {
    // Informational recommendations: approving simply records the decision.
    result = await resolveInformational(rec, principal.id, 'APPROVED');
  }
  publishDecision(result);
  return result;
}

function publishDecision(rec: AiRecommendation): void {
  publish('AI_RECOMMENDATION_UPDATED', {
    recommendationId: rec.id,
    projectId: rec.projectId,
    approvalStatus: rec.approvalStatus,
  });
}

export async function rejectRecommendation(
  ctx: GraphQLContext,
  id: string,
): Promise<AiRecommendation> {
  const rec = await getRecommendationOrThrow(id);
  const principal = requireAuth(ctx);
  await authorize(ctx, 'ai:approve', { projectId: rec.projectId });
  assertPending(rec);

  const result = await withTransaction(async (tx) => {
    await activityRepo.createActivity(
      {
        projectId: rec.projectId,
        ...(rec.taskId ? { taskId: rec.taskId } : {}),
        actorId: principal.id,
        type: 'USER_APPROVAL',
        metadata: { recommendationId: rec.id, decision: 'rejected' },
      },
      tx,
    );
    return repo.updateRecommendation(
      rec.id,
      { approvalStatus: 'REJECTED', resolutionStatus: 'DISMISSED', approvedById: principal.id },
      tx,
    );
  });
  publishDecision(result);
  return result;
}

export async function overrideRecommendation(
  ctx: GraphQLContext,
  id: string,
  input: OverrideRecommendationInput,
): Promise<AiRecommendation> {
  const rec = await getRecommendationOrThrow(id);
  const principal = requireAuth(ctx);
  await authorize(ctx, 'ai:approve', { projectId: rec.projectId });
  assertPending(rec);

  let result: AiRecommendation;
  if (rec.type === 'STORY_POINT_ESTIMATION') {
    if (input.storyPoints === undefined || input.storyPoints === null) {
      throw new ValidationError('storyPoints is required to override this recommendation');
    }
    result = await applyStoryPoints(rec, principal.id, input.storyPoints, 'OVERRIDDEN');
  } else if (rec.type === 'TASK_ASSIGNMENT') {
    const assigneeId = input.assigneeId ?? null;
    if (assigneeId) {
      const user = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (!user) {
        throw new NotFoundError('Override assignee not found');
      }
    }
    result = await applyAssignment(rec, principal.id, assigneeId, 'OVERRIDDEN');
  } else {
    throw new ValidationError('This recommendation type cannot be overridden');
  }
  publishDecision(result);
  return result;
}

// --- Transactional appliers ---

async function applyStoryPoints(
  rec: AiRecommendation,
  actorId: string,
  storyPoints: number | null,
  decision: 'APPROVED' | 'OVERRIDDEN',
): Promise<AiRecommendation> {
  if (!rec.taskId) {
    throw new ValidationError('Recommendation is not linked to a task');
  }
  const task = await getTaskOrThrow(rec.taskId);
  const taskId = rec.taskId;

  return withTransaction(async (tx) => {
    await tx.task.update({ where: { id: taskId }, data: { storyPoints } });
    await activityRepo.createActivity(
      {
        projectId: rec.projectId,
        taskId,
        actorId,
        type: 'STORY_POINTS_UPDATED',
        metadata: { from: task.storyPoints, to: storyPoints, source: 'ai', recommendationId: rec.id },
      },
      tx,
    );
    await activityRepo.createActivity(
      {
        projectId: rec.projectId,
        taskId,
        actorId,
        type: 'USER_APPROVAL',
        metadata: { recommendationId: rec.id, decision: decision.toLowerCase() },
      },
      tx,
    );
    return repo.updateRecommendation(
      rec.id,
      { approvalStatus: decision, resolutionStatus: 'RESOLVED', approvedById: actorId },
      tx,
    );
  });
}

async function applyAssignment(
  rec: AiRecommendation,
  actorId: string,
  assigneeId: string | null,
  decision: 'APPROVED' | 'OVERRIDDEN',
): Promise<AiRecommendation> {
  if (!rec.taskId) {
    throw new ValidationError('Recommendation is not linked to a task');
  }
  const task = await getTaskOrThrow(rec.taskId);
  const taskId = rec.taskId;

  const updated = await withTransaction(async (tx) => {
    await tx.task.update({ where: { id: taskId }, data: { assigneeId } });
    await activityRepo.createActivity(
      {
        projectId: rec.projectId,
        taskId,
        actorId,
        type: 'ASSIGNED',
        metadata: { from: task.assigneeId, to: assigneeId, source: 'ai', recommendationId: rec.id },
      },
      tx,
    );
    await activityRepo.createActivity(
      {
        projectId: rec.projectId,
        taskId,
        actorId,
        type: 'USER_APPROVAL',
        metadata: { recommendationId: rec.id, decision: decision.toLowerCase() },
      },
      tx,
    );
    return repo.updateRecommendation(
      rec.id,
      { approvalStatus: decision, resolutionStatus: 'RESOLVED', approvedById: actorId },
      tx,
    );
  });

  if (assigneeId) {
    await emit('task.assigned', {
      taskId,
      projectId: rec.projectId,
      assigneeId,
      actorId,
    });
  }
  return updated;
}

async function resolveInformational(
  rec: AiRecommendation,
  actorId: string,
  decision: 'APPROVED',
): Promise<AiRecommendation> {
  return withTransaction(async (tx) => {
    await activityRepo.createActivity(
      {
        projectId: rec.projectId,
        ...(rec.taskId ? { taskId: rec.taskId } : {}),
        actorId,
        type: 'USER_APPROVAL',
        metadata: { recommendationId: rec.id, decision: decision.toLowerCase() },
      },
      tx,
    );
    return repo.updateRecommendation(
      rec.id,
      { approvalStatus: decision, resolutionStatus: 'RESOLVED', approvedById: actorId },
      tx,
    );
  });
}
