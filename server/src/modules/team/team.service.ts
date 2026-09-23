import type { Team, TeamMember } from '@prisma/client';
import type { GraphQLContext } from '@shared/graphql/context';
import { prisma } from '@shared/db';
import { authorize } from '@shared/auth';
import { ConflictError, NotFoundError } from '@shared/errors';
import * as repo from './team.repository.js';
import {
  validateAddTeamMember,
  validateCreateTeam,
  validateUpdateTeam,
  validateUpdateTeamMember,
} from './team.validation.js';

async function getTeamOrThrow(id: string): Promise<Team> {
  const team = await repo.findTeamById(id);
  if (!team) {
    throw new NotFoundError('Team not found');
  }
  return team;
}

export async function getTeam(ctx: GraphQLContext, id: string): Promise<Team> {
  const team = await getTeamOrThrow(id);
  await authorize(ctx, 'team:read', { teamId: id });
  return team;
}

export async function createTeam(
  ctx: GraphQLContext,
  projectId: string,
  input: unknown,
): Promise<Team> {
  await authorize(ctx, 'team:create', { projectId });
  const data = validateCreateTeam(input);
  return repo.createTeam({
    projectId,
    name: data.name,
    description: data.description ?? null,
  });
}

export async function updateTeam(
  ctx: GraphQLContext,
  id: string,
  input: unknown,
): Promise<Team> {
  await getTeamOrThrow(id);
  await authorize(ctx, 'team:update', { teamId: id });
  const data = validateUpdateTeam(input);
  return repo.updateTeam(id, data);
}

export async function deleteTeam(
  ctx: GraphQLContext,
  id: string,
): Promise<void> {
  await getTeamOrThrow(id);
  await authorize(ctx, 'team:delete', { teamId: id });
  await repo.deleteTeam(id);
}

export async function addMember(
  ctx: GraphQLContext,
  teamId: string,
  userId: string,
  input: unknown,
): Promise<TeamMember> {
  await getTeamOrThrow(teamId);
  await authorize(ctx, 'team:manage_members', { teamId });
  const attrs = validateAddTeamMember(input);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }
  const existing = await repo.findMembership(teamId, userId);
  if (existing) {
    throw new ConflictError('User is already a team member');
  }

  return repo.createMembership({
    teamId,
    userId,
    role: attrs.role ?? 'MEMBER',
    responsibilities: attrs.responsibilities ?? null,
    availability: attrs.availability ?? 'AVAILABLE',
    workload: attrs.workload ?? 0,
  });
}

export async function updateMember(
  ctx: GraphQLContext,
  teamId: string,
  userId: string,
  input: unknown,
): Promise<TeamMember> {
  await getTeamOrThrow(teamId);
  await authorize(ctx, 'team:manage_members', { teamId });
  const attrs = validateUpdateTeamMember(input);

  const membership = await repo.findMembership(teamId, userId);
  if (!membership) {
    throw new NotFoundError('Team member not found');
  }

  return repo.updateMembership(teamId, userId, {
    ...(attrs.role !== undefined ? { role: attrs.role } : {}),
    ...(attrs.responsibilities !== undefined
      ? { responsibilities: attrs.responsibilities }
      : {}),
    ...(attrs.availability !== undefined
      ? { availability: attrs.availability }
      : {}),
    ...(attrs.workload !== undefined ? { workload: attrs.workload } : {}),
  });
}

export async function removeMember(
  ctx: GraphQLContext,
  teamId: string,
  userId: string,
): Promise<void> {
  await getTeamOrThrow(teamId);
  await authorize(ctx, 'team:manage_members', { teamId });
  const membership = await repo.findMembership(teamId, userId);
  if (!membership) {
    throw new NotFoundError('Team member not found');
  }
  await repo.deleteMembership(teamId, userId);
}
