import type { Prisma, Project, ProjectMember, ProjectState } from '@prisma/client';
import type { GraphQLContext } from '@shared/graphql/context';
import { prisma } from '@shared/db';
import { authorize, requireAuth } from '@shared/auth';
import { ConflictError, NotFoundError, ValidationError } from '@shared/errors';
import {
  buildConnection,
  clampFirst,
  decodeCursor,
  encodeCursor,
  type Connection,
} from '@shared/utils';
import * as repo from './project.repository.js';
import {
  validateCreateProject,
  validateProjectRole,
  validateUpdateProject,
  validateWorkflow,
} from './project.validation.js';
import { canTransition } from './project.model.js';

async function getProjectOrThrow(id: string): Promise<Project> {
  const project = await repo.findProjectById(id);
  if (!project) {
    throw new NotFoundError('Project not found');
  }
  return project;
}

export async function getProject(
  ctx: GraphQLContext,
  id: string,
): Promise<Project> {
  const project = await getProjectOrThrow(id);
  await authorize(ctx, 'project:read', { projectId: id });
  return project;
}

export async function listOrganizationProjects(
  ctx: GraphQLContext,
  organizationId: string,
  args: { first?: number | null; after?: string | null; status?: ProjectState | null },
): Promise<Connection<Project>> {
  await authorize(ctx, 'organization:read', { organizationId });

  const pageSize = clampFirst(args.first);
  const after = args.after ? decodeCursor(args.after) : null;
  const status = args.status ?? undefined;

  const [rows, totalCount] = await Promise.all([
    repo.findOrgProjectsPage({
      organizationId,
      take: pageSize + 1,
      ...(status ? { status } : {}),
      ...(after ? { cursor: after } : {}),
    }),
    repo.countOrgProjects(organizationId, status),
  ]);

  return buildConnection(rows, {
    pageSize,
    after,
    totalCount,
    getCursor: (project) => encodeCursor(project.id),
  });
}

export async function createProject(
  ctx: GraphQLContext,
  organizationId: string,
  input: unknown,
): Promise<Project> {
  const principal = requireAuth(ctx);
  await authorize(ctx, 'project:create', { organizationId });
  const data = validateCreateProject(input);

  return repo.createProjectWithAdmin({
    organizationId,
    name: data.name,
    description: data.description ?? null,
    creatorId: principal.id,
  });
}

export async function updateProject(
  ctx: GraphQLContext,
  id: string,
  input: unknown,
): Promise<Project> {
  await getProjectOrThrow(id);
  await authorize(ctx, 'project:update', { projectId: id });
  const data = validateUpdateProject(input);
  return repo.updateProject(id, data);
}

export async function changeProjectStatus(
  ctx: GraphQLContext,
  id: string,
  status: ProjectState,
): Promise<Project> {
  const project = await getProjectOrThrow(id);
  await authorize(ctx, 'project:update', { projectId: id });

  if (!canTransition(project.status, status)) {
    throw new ValidationError(
      `Cannot change project status from ${project.status} to ${status}`,
    );
  }
  return repo.updateProject(id, { status });
}

export async function deleteProject(
  ctx: GraphQLContext,
  id: string,
): Promise<void> {
  await getProjectOrThrow(id);
  await authorize(ctx, 'project:delete', { projectId: id });
  await repo.deleteProject(id);
}

export async function configureWorkflow(
  ctx: GraphQLContext,
  id: string,
  workflow: unknown,
): Promise<Project> {
  const project = await getProjectOrThrow(id);
  await authorize(ctx, 'project:configure_workflow', { projectId: id });
  const clean = validateWorkflow(workflow);
  await repo.upsertSettings(id, { workflow: clean as Prisma.InputJsonValue });
  return project;
}

export async function listMembers(
  ctx: GraphQLContext,
  projectId: string,
  args: { first?: number | null; after?: string | null },
): Promise<Connection<ProjectMember>> {
  await authorize(ctx, 'project:read', { projectId });

  const pageSize = clampFirst(args.first);
  const after = args.after ? decodeCursor(args.after) : null;

  const [rows, totalCount] = await Promise.all([
    repo.listMembersPage({
      projectId,
      take: pageSize + 1,
      ...(after ? { cursor: after } : {}),
    }),
    repo.countMembers(projectId),
  ]);

  return buildConnection(rows, {
    pageSize,
    after,
    totalCount,
    getCursor: (member) => encodeCursor(member.id),
  });
}

export async function addMember(
  ctx: GraphQLContext,
  projectId: string,
  userId: string,
  role: unknown,
): Promise<ProjectMember> {
  await getProjectOrThrow(projectId);
  await authorize(ctx, 'project:manage_members', { projectId });
  const projectRole = validateProjectRole(role);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }
  const existing = await repo.findMembership(projectId, userId);
  if (existing) {
    throw new ConflictError('User is already a project member');
  }
  return repo.createMembership({ projectId, userId, role: projectRole });
}

export async function updateMemberRole(
  ctx: GraphQLContext,
  projectId: string,
  userId: string,
  role: unknown,
): Promise<ProjectMember> {
  await getProjectOrThrow(projectId);
  await authorize(ctx, 'project:manage_members', { projectId });
  const projectRole = validateProjectRole(role);

  const membership = await repo.findMembership(projectId, userId);
  if (!membership) {
    throw new NotFoundError('Project member not found');
  }
  return repo.updateMembershipRole(projectId, userId, projectRole);
}

export async function removeMember(
  ctx: GraphQLContext,
  projectId: string,
  userId: string,
): Promise<void> {
  await getProjectOrThrow(projectId);
  await authorize(ctx, 'project:manage_members', { projectId });
  const membership = await repo.findMembership(projectId, userId);
  if (!membership) {
    throw new NotFoundError('Project member not found');
  }
  await repo.deleteMembership(projectId, userId);
}
