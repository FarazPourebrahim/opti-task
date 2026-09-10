import type { Executor } from '@/shared/db';
import {
  orgRoleToRole,
  projectRoleToRole,
  teamRoleToRole,
  type Role,
} from './roles.js';

/**
 * Identifies the resource being acted on. Any subset may be supplied; scope
 * resolution climbs team → project → org to fill in the missing ancestors, so
 * passing just a `teamId` still yields the user's project- and org-level roles.
 */
export type AuthScope = {
  organizationId?: string;
  projectId?: string;
  teamId?: string;
};

/**
 * Computes every RBAC role a user holds relative to a resource. Returns an empty
 * set when the user has no membership anywhere in the resource's hierarchy —
 * which, with deny-by-default, denies access (the cross-org/cross-project guard).
 */
export async function resolveEffectiveRoles(
  db: Executor,
  userId: string,
  scope: AuthScope,
): Promise<Set<Role>> {
  const roles = new Set<Role>();

  let projectId = scope.projectId;
  let organizationId = scope.organizationId;

  if (scope.teamId) {
    const team = await db.team.findUnique({
      where: { id: scope.teamId },
      select: { projectId: true },
    });
    if (team) {
      projectId ??= team.projectId;
      const membership = await db.teamMember.findUnique({
        where: { teamId_userId: { teamId: scope.teamId, userId } },
        select: { role: true },
      });
      if (membership) {
        roles.add(teamRoleToRole(membership.role));
      }
    }
  }

  if (projectId) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (project) {
      organizationId ??= project.organizationId;
      const membership = await db.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
        select: { role: true },
      });
      if (membership) {
        roles.add(projectRoleToRole(membership.role));
      }
    }
  }

  if (organizationId) {
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: { ownerId: true },
    });
    if (organization) {
      if (organization.ownerId === userId) {
        roles.add('ORG_OWNER');
      }
      const membership = await db.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
        select: { role: true },
      });
      if (membership) {
        roles.add(orgRoleToRole(membership.role));
      }
    }
  }

  return roles;
}
