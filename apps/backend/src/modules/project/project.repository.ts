import type {
  Prisma,
  Project,
  ProjectMember,
  ProjectRole,
  ProjectSettings,
  ProjectState,
} from '@prisma/client';
import { prisma, type Executor } from '@/shared/db';

/** Project data access. Pure persistence; RBAC/validation live in the service. */
export function findProjectById(
  id: string,
  db: Executor = prisma,
): Promise<Project | null> {
  return db.project.findUnique({ where: { id } });
}

export function findOrgProjectsPage(
  args: {
    organizationId: string;
    status?: ProjectState;
    take: number;
    cursor?: string;
  },
  db: Executor = prisma,
): Promise<Project[]> {
  return db.project.findMany({
    where: {
      organizationId: args.organizationId,
      ...(args.status ? { status: args.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: args.take,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
  });
}

export function countOrgProjects(
  organizationId: string,
  status: ProjectState | undefined,
  db: Executor = prisma,
): Promise<number> {
  return db.project.count({
    where: { organizationId, ...(status ? { status } : {}) },
  });
}

export function createProjectWithAdmin(
  data: {
    organizationId: string;
    name: string;
    description: string | null;
    creatorId: string;
  },
  db: Executor = prisma,
): Promise<Project> {
  return db.project.create({
    data: {
      organizationId: data.organizationId,
      name: data.name,
      description: data.description,
      settings: { create: {} },
      members: { create: { userId: data.creatorId, role: 'ADMIN' } },
    },
  });
}

export function updateProject(
  id: string,
  data: Prisma.ProjectUpdateInput,
  db: Executor = prisma,
): Promise<Project> {
  return db.project.update({ where: { id }, data });
}

export async function deleteProject(
  id: string,
  db: Executor = prisma,
): Promise<void> {
  await db.project.delete({ where: { id } });
}

export function upsertSettings(
  projectId: string,
  data: { workflow?: Prisma.InputJsonValue; settings?: Prisma.InputJsonValue },
  db: Executor = prisma,
): Promise<ProjectSettings> {
  return db.projectSettings.upsert({
    where: { projectId },
    update: data,
    create: { projectId, ...data },
  });
}

// --- Members ---

export function listMembersPage(
  args: { projectId: string; take: number; cursor?: string },
  db: Executor = prisma,
): Promise<ProjectMember[]> {
  return db.projectMember.findMany({
    where: { projectId: args.projectId },
    orderBy: { createdAt: 'asc' },
    take: args.take,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
  });
}

export function countMembers(
  projectId: string,
  db: Executor = prisma,
): Promise<number> {
  return db.projectMember.count({ where: { projectId } });
}

export function findMembership(
  projectId: string,
  userId: string,
  db: Executor = prisma,
): Promise<ProjectMember | null> {
  return db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

export function createMembership(
  data: { projectId: string; userId: string; role: ProjectRole },
  db: Executor = prisma,
): Promise<ProjectMember> {
  return db.projectMember.create({ data });
}

export function updateMembershipRole(
  projectId: string,
  userId: string,
  role: ProjectRole,
  db: Executor = prisma,
): Promise<ProjectMember> {
  return db.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { role },
  });
}

export async function deleteMembership(
  projectId: string,
  userId: string,
  db: Executor = prisma,
): Promise<void> {
  await db.projectMember.deleteMany({ where: { projectId, userId } });
}
