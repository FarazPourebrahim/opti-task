import type { Permission, Role } from '@contracts';

/**
 * Capability HINTS — not authority.
 *
 * The server owns the role → permission matrix and re-checks every action. The
 * client cannot compute permissions; it only knows which roles the user holds
 * on a resource. This table mirrors `apps/backend/docs/rbac.md` so the UI can
 * hide an action the user would be refused anyway.
 *
 * It may drift from the server, in either direction. That is safe by
 * construction: a hint that is too generous shows a button whose request is
 * rejected with `FORBIDDEN` (which every mutation must handle), and one that is
 * too strict hides a button. Neither grants anything.
 */

const ORG_ADMIN_PERMISSIONS: readonly Permission[] = [
  'organization:read',
  'organization:update',
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
];

const PROJECT_ADMIN_PERMISSIONS: readonly Permission[] = [
  'project:read',
  'project:update',
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
];

const TEAM_LEAD_PERMISSIONS: readonly Permission[] = [
  'project:read',
  'team:read',
  'team:update',
  'team:manage_members',
  'sprint:read',
  'epic:read',
  'task:create',
  'task:read',
  'task:update',
  'task:delete',
  'task:assign',
  'task:comment',
  'analytics:view',
  'ai:request',
];

/*
 * `task:update` is absent on purpose: a basic member may update only tasks they
 * own (assignee or reporter), which is a per-task fact, not a role fact. Use
 * `canUpdateOwnTask` for that case.
 */
const MEMBER_PERMISSIONS: readonly Permission[] = [
  'organization:read',
  'project:read',
  'team:read',
  'sprint:read',
  'epic:read',
  'task:create',
  'task:read',
  'task:comment',
  'ai:request',
];

const VIEWER_PERMISSIONS: readonly Permission[] = [
  'organization:read',
  'project:read',
  'team:read',
  'sprint:read',
  'epic:read',
  'task:read',
];

const ROLE_PERMISSION_HINTS: Record<Role, readonly Permission[]> = {
  ORG_OWNER: [...ORG_ADMIN_PERMISSIONS, 'organization:delete'],
  ORG_ADMIN: ORG_ADMIN_PERMISSIONS,
  ORG_MEMBER: ['organization:read'],
  PROJECT_ADMIN: PROJECT_ADMIN_PERMISSIONS,
  PROJECT_MEMBER: MEMBER_PERMISSIONS,
  TEAM_LEAD: TEAM_LEAD_PERMISSIONS,
  TEAM_MEMBER: MEMBER_PERMISSIONS,
  VIEWER: VIEWER_PERMISSIONS,
  // A system principal; no person signs in with it.
  AI_AGENT: [
    'project:read',
    'sprint:read',
    'epic:read',
    'task:read',
    'ai:request',
  ],
};

/**
 * True when any of the user's roles on the resource suggests the permission.
 * Roles are a union on the server too, so one match is enough.
 */
export function can(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((role) => ROLE_PERMISSION_HINTS[role].includes(permission));
}

/**
 * The "member may edit their own task" rule: allowed by role, or by being the
 * task's assignee or reporter.
 */
export function canUpdateOwnTask(
  roles: readonly Role[],
  userId: string,
  owners: ReadonlyArray<string | null | undefined>,
): boolean {
  if (can(roles, 'task:update')) return true;

  const isMember = roles.some(
    (role) => role === 'PROJECT_MEMBER' || role === 'TEAM_MEMBER',
  );
  return isMember && owners.includes(userId);
}
