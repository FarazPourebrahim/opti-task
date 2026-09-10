/**
 * The authorization vocabulary shared by the API and its clients.
 *
 * Only the vocabulary is shared — the role→permission matrix itself stays in the
 * backend, which is the sole authority on what a principal may do. A client uses
 * these names to hide actions a user cannot perform; the server still re-checks
 * every one of them (never trust the client).
 */

/**
 * Roles normalized across the three membership scopes (org / project / team)
 * plus the AI system role. A user can hold several at once — effective
 * permissions are the union.
 */
export const ROLES = [
  'ORG_OWNER',
  'ORG_ADMIN',
  'ORG_MEMBER',
  'PROJECT_ADMIN',
  'PROJECT_MEMBER',
  'TEAM_LEAD',
  'TEAM_MEMBER',
  'VIEWER',
  'AI_AGENT',
] as const;
export type Role = (typeof ROLES)[number];

/** The full permission catalog, addressed as `resource:action`. */
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
