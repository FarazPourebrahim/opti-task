import type { OrgRole, ProjectRole, TeamRole } from '@prisma/client';
import { PERMISSIONS, type Permission, type Role } from '@contracts';

/**
 * The role→permission matrix — the single source of truth for who may do what
 * (docs/rbac.md holds the human-readable table).
 *
 * The vocabulary (`Role`, `Permission`, the permission catalog) is shared with
 * clients through `@contracts` so a UI can hide actions a user cannot perform.
 * The matrix below is deliberately NOT shared: the server is the only authority
 * on what a principal is actually allowed to do, and it re-checks every request.
 *
 * A user can hold several roles at once (e.g. ORG_ADMIN + TEAM_MEMBER); their
 * effective permissions are the union (see `can`).
 */

export { PERMISSIONS };
export type { Role, Permission };

const READ_WORK_ITEMS: Permission[] = [
  'project:read',
  'team:read',
  'sprint:read',
  'epic:read',
  'task:read',
];

// A basic contributor: read work items, create/comment on tasks, request AI help.
const MEMBER_PERMISSIONS: Permission[] = [
  'organization:read',
  ...READ_WORK_ITEMS,
  'task:create',
  'task:comment',
  'ai:request',
];

// A team lead additionally manages their team and any task within it.
const TEAM_LEAD_PERMISSIONS: Permission[] = [
  ...MEMBER_PERMISSIONS,
  'task:update',
  'task:assign',
  'task:delete',
  'team:update',
  'team:manage_members',
  'analytics:view',
];

// A project admin manages the whole project and approves AI suggestions.
const PROJECT_ADMIN_PERMISSIONS: Permission[] = [
  ...TEAM_LEAD_PERMISSIONS,
  'project:update',
  'project:manage_members',
  'project:configure_workflow',
  'team:create',
  'team:delete',
  'sprint:create',
  'sprint:update',
  'sprint:delete',
  'epic:create',
  'epic:update',
  'epic:delete',
  'ai:approve',
];

// An org admin manages org membership and can create/delete projects.
const ORG_ADMIN_PERMISSIONS: Permission[] = [
  ...PROJECT_ADMIN_PERMISSIONS,
  'organization:update',
  'organization:manage_members',
  'organization:invite',
  'project:create',
  'project:delete',
];

// The AI system role: read context + create suggestions only. It can never
// mutate domain data or approve its own recommendations (docs/OptiTask.md).
const AI_AGENT_PERMISSIONS: Permission[] = [
  'project:read',
  'sprint:read',
  'epic:read',
  'task:read',
  'ai:request',
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  ORG_OWNER: new Set(PERMISSIONS),
  ORG_ADMIN: new Set(ORG_ADMIN_PERMISSIONS),
  ORG_MEMBER: new Set<Permission>(['organization:read']),
  PROJECT_ADMIN: new Set(PROJECT_ADMIN_PERMISSIONS),
  PROJECT_MEMBER: new Set(MEMBER_PERMISSIONS),
  TEAM_LEAD: new Set(TEAM_LEAD_PERMISSIONS),
  TEAM_MEMBER: new Set(MEMBER_PERMISSIONS),
  VIEWER: new Set<Permission>(['organization:read', ...READ_WORK_ITEMS]),
  AI_AGENT: new Set(AI_AGENT_PERMISSIONS),
};

/** True if ANY of the held roles grants the permission. Deny-by-default. */
export function can(roles: ReadonlySet<Role>, permission: Permission): boolean {
  for (const role of roles) {
    if (ROLE_PERMISSIONS[role].has(permission)) {
      return true;
    }
  }
  return false;
}

export function orgRoleToRole(role: OrgRole): Role {
  switch (role) {
    case 'OWNER':
      return 'ORG_OWNER';
    case 'ADMIN':
      return 'ORG_ADMIN';
    case 'MEMBER':
      return 'ORG_MEMBER';
  }
}

export function projectRoleToRole(role: ProjectRole): Role {
  switch (role) {
    case 'ADMIN':
      return 'PROJECT_ADMIN';
    case 'MEMBER':
      return 'PROJECT_MEMBER';
    case 'VIEWER':
      return 'VIEWER';
  }
}

export function teamRoleToRole(role: TeamRole): Role {
  return role === 'LEAD' ? 'TEAM_LEAD' : 'TEAM_MEMBER';
}
