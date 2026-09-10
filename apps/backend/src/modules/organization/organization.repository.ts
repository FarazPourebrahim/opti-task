import type {
  Organization,
  OrganizationInvitation,
  OrganizationMember,
  OrgRole,
  Prisma,
} from '@prisma/client';
import { prisma, type Executor } from '@/shared/db';

/**
 * Organization data access. Pure persistence — RBAC, validation, and token
 * generation live in the service.
 */
export function findOrganizationById(
  id: string,
  db: Executor = prisma,
): Promise<Organization | null> {
  return db.organization.findUnique({ where: { id } });
}

export function findUserOrganizationsPage(
  args: { userId: string; take: number; cursor?: string },
  db: Executor = prisma,
): Promise<Organization[]> {
  return db.organization.findMany({
    where: {
      OR: [
        { ownerId: args.userId },
        { members: { some: { userId: args.userId } } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: args.take,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
  });
}

export function countUserOrganizations(
  userId: string,
  db: Executor = prisma,
): Promise<number> {
  return db.organization.count({
    where: {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
  });
}

export function createOrganizationWithOwner(
  data: {
    name: string;
    description: string | null;
    logoUrl: string | null;
    ownerId: string;
  },
  db: Executor = prisma,
): Promise<Organization> {
  return db.organization.create({
    data: {
      name: data.name,
      description: data.description,
      logoUrl: data.logoUrl,
      ownerId: data.ownerId,
      members: { create: { userId: data.ownerId, role: 'OWNER' } },
    },
  });
}

export function updateOrganization(
  id: string,
  data: Prisma.OrganizationUpdateInput,
  db: Executor = prisma,
): Promise<Organization> {
  return db.organization.update({ where: { id }, data });
}

export async function deleteOrganization(
  id: string,
  db: Executor = prisma,
): Promise<void> {
  await db.organization.delete({ where: { id } });
}

// --- Members ---

export function listMembersPage(
  args: { organizationId: string; take: number; cursor?: string },
  db: Executor = prisma,
): Promise<OrganizationMember[]> {
  return db.organizationMember.findMany({
    where: { organizationId: args.organizationId },
    orderBy: { createdAt: 'asc' },
    take: args.take,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
  });
}

export function countMembers(
  organizationId: string,
  db: Executor = prisma,
): Promise<number> {
  return db.organizationMember.count({ where: { organizationId } });
}

export function findMembership(
  organizationId: string,
  userId: string,
  db: Executor = prisma,
): Promise<OrganizationMember | null> {
  return db.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
}

export function createMembership(
  data: { organizationId: string; userId: string; role: OrgRole },
  db: Executor = prisma,
): Promise<OrganizationMember> {
  return db.organizationMember.create({ data });
}

export function updateMembershipRole(
  organizationId: string,
  userId: string,
  role: OrgRole,
  db: Executor = prisma,
): Promise<OrganizationMember> {
  return db.organizationMember.update({
    where: { organizationId_userId: { organizationId, userId } },
    data: { role },
  });
}

export async function deleteMembership(
  organizationId: string,
  userId: string,
  db: Executor = prisma,
): Promise<void> {
  await db.organizationMember.deleteMany({ where: { organizationId, userId } });
}

export function countProjects(
  organizationId: string,
  db: Executor = prisma,
): Promise<number> {
  return db.project.count({ where: { organizationId } });
}

// --- Invitations ---

export function createInvitation(
  data: {
    organizationId: string;
    email: string;
    role: OrgRole;
    token: string;
    invitedById: string;
    expiresAt: Date;
  },
  db: Executor = prisma,
): Promise<OrganizationInvitation> {
  return db.organizationInvitation.create({ data });
}

export function findInvitationByToken(
  token: string,
  db: Executor = prisma,
): Promise<OrganizationInvitation | null> {
  return db.organizationInvitation.findUnique({ where: { token } });
}

export function findInvitationById(
  id: string,
  db: Executor = prisma,
): Promise<OrganizationInvitation | null> {
  return db.organizationInvitation.findUnique({ where: { id } });
}

export function findPendingInvitation(
  organizationId: string,
  email: string,
  db: Executor = prisma,
): Promise<OrganizationInvitation | null> {
  return db.organizationInvitation.findFirst({
    where: { organizationId, email, status: 'PENDING' },
  });
}

export function updateInvitationStatus(
  id: string,
  status: OrganizationInvitation['status'],
  db: Executor = prisma,
): Promise<OrganizationInvitation> {
  return db.organizationInvitation.update({ where: { id }, data: { status } });
}

export function listInvitations(
  organizationId: string,
  db: Executor = prisma,
): Promise<OrganizationInvitation[]> {
  return db.organizationInvitation.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
}
