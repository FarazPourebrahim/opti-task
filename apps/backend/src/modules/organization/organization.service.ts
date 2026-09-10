import { randomUUID } from 'node:crypto';
import type {
  Organization,
  OrganizationInvitation,
  OrganizationMember,
} from '@prisma/client';
import type { GraphQLContext } from '@/shared/graphql/context';
import { prisma, withTransaction } from '@/shared/db';
import { authorize, requireAuth } from '@/shared/auth';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors';
import {
  buildConnection,
  clampFirst,
  decodeCursor,
  encodeCursor,
  type Connection,
} from '@/shared/utils';
import * as repo from './organization.repository.js';
import {
  validateAssignableRole,
  validateCreateOrganization,
  validateInvite,
  validateUpdateOrganization,
} from './organization.validation.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function getOrgOrThrow(id: string): Promise<Organization> {
  const organization = await repo.findOrganizationById(id);
  if (!organization) {
    throw new NotFoundError('Organization not found');
  }
  return organization;
}

export async function getOrganization(
  ctx: GraphQLContext,
  id: string,
): Promise<Organization> {
  const organization = await getOrgOrThrow(id);
  await authorize(ctx, 'organization:read', { organizationId: id });
  return organization;
}

export async function listMyOrganizations(
  ctx: GraphQLContext,
  args: { first?: number | null; after?: string | null },
): Promise<Connection<Organization>> {
  const principal = requireAuth(ctx);
  const pageSize = clampFirst(args.first);
  const after = args.after ? decodeCursor(args.after) : null;

  const [rows, totalCount] = await Promise.all([
    repo.findUserOrganizationsPage({
      userId: principal.id,
      take: pageSize + 1,
      ...(after ? { cursor: after } : {}),
    }),
    repo.countUserOrganizations(principal.id),
  ]);

  return buildConnection(rows, {
    pageSize,
    after,
    totalCount,
    getCursor: (org) => encodeCursor(org.id),
  });
}

export async function createOrganization(
  ctx: GraphQLContext,
  input: unknown,
): Promise<Organization> {
  const principal = requireAuth(ctx);
  const data = validateCreateOrganization(input);

  return repo.createOrganizationWithOwner({
    name: data.name,
    description: data.description ?? null,
    logoUrl: data.logoUrl ?? null,
    ownerId: principal.id,
  });
}

export async function updateOrganization(
  ctx: GraphQLContext,
  id: string,
  input: unknown,
): Promise<Organization> {
  await getOrgOrThrow(id);
  await authorize(ctx, 'organization:update', { organizationId: id });
  const data = validateUpdateOrganization(input);
  return repo.updateOrganization(id, data);
}

export async function deleteOrganization(
  ctx: GraphQLContext,
  id: string,
): Promise<void> {
  await getOrgOrThrow(id);
  await authorize(ctx, 'organization:delete', { organizationId: id });
  await repo.deleteOrganization(id);
}

export async function listMembers(
  ctx: GraphQLContext,
  organizationId: string,
  args: { first?: number | null; after?: string | null },
): Promise<Connection<OrganizationMember>> {
  await authorize(ctx, 'organization:read', { organizationId });
  const pageSize = clampFirst(args.first);
  const after = args.after ? decodeCursor(args.after) : null;

  const [rows, totalCount] = await Promise.all([
    repo.listMembersPage({
      organizationId,
      take: pageSize + 1,
      ...(after ? { cursor: after } : {}),
    }),
    repo.countMembers(organizationId),
  ]);

  return buildConnection(rows, {
    pageSize,
    after,
    totalCount,
    getCursor: (member) => encodeCursor(member.id),
  });
}

export async function inviteMember(
  ctx: GraphQLContext,
  organizationId: string,
  input: unknown,
): Promise<OrganizationInvitation> {
  await getOrgOrThrow(organizationId);
  await authorize(ctx, 'organization:invite', { organizationId });
  const principal = requireAuth(ctx);
  const { email, role } = validateInvite(input);

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const membership = await repo.findMembership(organizationId, existingUser.id);
    if (membership) {
      throw new ConflictError('User is already a member');
    }
  }

  const pending = await repo.findPendingInvitation(organizationId, email);
  if (pending) {
    throw new ConflictError('An invitation is already pending for this email');
  }

  return repo.createInvitation({
    organizationId,
    email,
    role: role ?? 'MEMBER',
    token: randomUUID(),
    invitedById: principal.id,
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
  });
}

export async function acceptInvitation(
  ctx: GraphQLContext,
  token: string,
): Promise<OrganizationMember> {
  const principal = requireAuth(ctx);
  const invitation = await repo.findInvitationByToken(token);

  if (!invitation || invitation.status !== 'PENDING') {
    throw new NotFoundError('Invitation not found');
  }
  if (invitation.expiresAt && invitation.expiresAt <= new Date()) {
    await repo.updateInvitationStatus(invitation.id, 'EXPIRED');
    throw new ValidationError('Invitation has expired');
  }
  if (invitation.email.toLowerCase() !== principal.email.toLowerCase()) {
    throw new ForbiddenError('This invitation is for a different email');
  }

  return withTransaction(async (tx) => {
    const existing = await repo.findMembership(
      invitation.organizationId,
      principal.id,
      tx,
    );
    const member =
      existing ??
      (await repo.createMembership(
        {
          organizationId: invitation.organizationId,
          userId: principal.id,
          role: invitation.role,
        },
        tx,
      ));
    await repo.updateInvitationStatus(invitation.id, 'ACCEPTED', tx);
    return member;
  });
}

export async function revokeInvitation(
  ctx: GraphQLContext,
  invitationId: string,
): Promise<void> {
  const invitation = await repo.findInvitationById(invitationId);
  if (!invitation) {
    throw new NotFoundError('Invitation not found');
  }
  await authorize(ctx, 'organization:invite', {
    organizationId: invitation.organizationId,
  });
  if (invitation.status === 'PENDING') {
    await repo.updateInvitationStatus(invitationId, 'REVOKED');
  }
}

export async function listInvitations(
  ctx: GraphQLContext,
  organizationId: string,
): Promise<OrganizationInvitation[]> {
  await authorize(ctx, 'organization:manage_members', { organizationId });
  return repo.listInvitations(organizationId);
}

export async function updateMemberRole(
  ctx: GraphQLContext,
  organizationId: string,
  userId: string,
  role: unknown,
): Promise<OrganizationMember> {
  const organization = await getOrgOrThrow(organizationId);
  await authorize(ctx, 'organization:manage_members', { organizationId });
  const assignable = validateAssignableRole(role);

  if (organization.ownerId === userId) {
    throw new ValidationError("The organization owner's role cannot be changed");
  }
  const membership = await repo.findMembership(organizationId, userId);
  if (!membership) {
    throw new NotFoundError('Member not found');
  }

  return repo.updateMembershipRole(organizationId, userId, assignable);
}

export async function removeMember(
  ctx: GraphQLContext,
  organizationId: string,
  userId: string,
): Promise<void> {
  const organization = await getOrgOrThrow(organizationId);
  await authorize(ctx, 'organization:manage_members', { organizationId });

  if (organization.ownerId === userId) {
    throw new ValidationError('The organization owner cannot be removed');
  }
  const membership = await repo.findMembership(organizationId, userId);
  if (!membership) {
    throw new NotFoundError('Member not found');
  }

  await repo.deleteMembership(organizationId, userId);
}
