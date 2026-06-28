import type { Prisma, Team, TeamMember } from '@prisma/client';
import { prisma, type Executor } from '@shared/db';

/** Team data access. Pure persistence; RBAC/validation live in the service. */
export function findTeamById(
  id: string,
  db: Executor = prisma,
): Promise<Team | null> {
  return db.team.findUnique({ where: { id } });
}

export function createTeam(
  data: { projectId: string; name: string; description: string | null },
  db: Executor = prisma,
): Promise<Team> {
  return db.team.create({ data });
}

export function updateTeam(
  id: string,
  data: Prisma.TeamUpdateInput,
  db: Executor = prisma,
): Promise<Team> {
  return db.team.update({ where: { id }, data });
}

export async function deleteTeam(
  id: string,
  db: Executor = prisma,
): Promise<void> {
  await db.team.delete({ where: { id } });
}

export function countMembers(
  teamId: string,
  db: Executor = prisma,
): Promise<number> {
  return db.teamMember.count({ where: { teamId } });
}

export function findMembership(
  teamId: string,
  userId: string,
  db: Executor = prisma,
): Promise<TeamMember | null> {
  return db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
}

export function createMembership(
  data: Prisma.TeamMemberUncheckedCreateInput,
  db: Executor = prisma,
): Promise<TeamMember> {
  return db.teamMember.create({ data });
}

export function updateMembership(
  teamId: string,
  userId: string,
  data: Prisma.TeamMemberUpdateInput,
  db: Executor = prisma,
): Promise<TeamMember> {
  return db.teamMember.update({
    where: { teamId_userId: { teamId, userId } },
    data,
  });
}

export async function deleteMembership(
  teamId: string,
  userId: string,
  db: Executor = prisma,
): Promise<void> {
  await db.teamMember.deleteMany({ where: { teamId, userId } });
}
