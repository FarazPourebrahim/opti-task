import type { OrgRole, ProjectRole, TeamRole } from '@prisma/client';

/**
 * RBAC roles, normalized across the three membership scopes (org / project /
 * team) plus the AI system role. A user can hold several at once (e.g. ORG_ADMIN
 * + TEAM_MEMBER); their effective permissions are the union (see can()).
 */
export type Role =
  | 'ORG_OWNER'
  | 'ORG_ADMIN'
  | 'ORG_MEMBER'
  | 'PROJECT_ADMIN'
  | 'PROJECT_MEMBER'
  | 'TEAM_LEAD'
  | 'TEAM_MEMBER'
  | 'VIEWER'
  | 'AI_AGENT';

/**
 * The full permission catalog (`resource:action`). The matrix below is the
 * single source of truth for who can do what; see docs/rbac.md for the
 * human-readable table.
 */
export const PERMISSIONS = [
  'organization:read',
  'organization:update',
  'organization:delete',
  'organization:manage_members',
  'organization:invite',
  'project:create',
  'project:read',
  'project:update',
  'project:delete',
  'project:manage_members',
  'project:configure_workflow',
  'team:create',
  'team:read',
  'team:update',
  'team:delete',
  'team:manage_members',
  'sprint:create',
  'sprint:read',
  'sprint:update',
  'sprint:delete',
  'epic:create',
  'epic:read',
  'epic:update',
  'epic:delete',
  'task:create',
  'task:read',
  'task:update',
  'task:delete',
  'task:assign',
  'task:comment',
  'analytics:view',
  'ai:request',
  'ai:approve',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

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
