import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLES } from '@contracts';
import type { Permission, Role } from '@contracts';
import { can, canUpdateOwnTask } from '@/shared/lib/capabilities';

describe('capability hints', () => {
  // Rows from apps/backend/docs/rbac.md. Not the whole matrix — the cells where
  // one role stops and the next begins, which is where a hint goes wrong.
  const cases: Array<[Role, Permission, boolean]> = [
    ['ORG_OWNER', 'organization:delete', true],
    ['ORG_ADMIN', 'organization:delete', false],
    ['ORG_ADMIN', 'project:delete', true],
    ['PROJECT_ADMIN', 'project:delete', false],
    ['PROJECT_ADMIN', 'project:create', false],
    ['PROJECT_ADMIN', 'ai:approve', true],
    ['TEAM_LEAD', 'ai:approve', false],
    ['TEAM_LEAD', 'task:assign', true],
    ['TEAM_LEAD', 'sprint:create', false],
    ['PROJECT_MEMBER', 'task:create', true],
    ['PROJECT_MEMBER', 'task:assign', false],
    ['TEAM_MEMBER', 'analytics:view', false],
    ['VIEWER', 'task:read', true],
    ['VIEWER', 'task:comment', false],
    ['VIEWER', 'ai:request', false],
    ['ORG_MEMBER', 'project:read', false],
    ['AI_AGENT', 'ai:request', true],
    ['AI_AGENT', 'ai:approve', false],
  ];

  it.each(cases)('%s → %s is %s', (role, permission, expected) => {
    expect(can([role], permission)).toBe(expected);
  });

  it('grants the owner every permission in the catalog', () => {
    for (const permission of PERMISSIONS) {
      expect(can(['ORG_OWNER'], permission)).toBe(true);
    }
  });

  it('has a hint for every role in the shared vocabulary', () => {
    // A role added to @contracts without a hint would throw here, not at a
    // user's first click.
    for (const role of ROLES) {
      expect(() => can([role], 'task:read')).not.toThrow();
    }
  });

  it('takes the union of several roles', () => {
    expect(can(['VIEWER', 'TEAM_LEAD'], 'task:assign')).toBe(true);
  });

  it('denies by default when the user holds no role', () => {
    expect(can([], 'project:read')).toBe(false);
  });
});

describe('own-task rule', () => {
  it('lets a member update a task they are assigned to or reported', () => {
    expect(canUpdateOwnTask(['PROJECT_MEMBER'], 'u1', ['u1', 'u2'])).toBe(true);
  });

  it('does not let a member update someone else’s task', () => {
    expect(canUpdateOwnTask(['PROJECT_MEMBER'], 'u1', ['u2', null])).toBe(
      false,
    );
  });

  it('does not let a viewer update a task they reported', () => {
    expect(canUpdateOwnTask(['VIEWER'], 'u1', ['u1'])).toBe(false);
  });

  it('lets a team lead update any task', () => {
    expect(canUpdateOwnTask(['TEAM_LEAD'], 'u1', ['u2'])).toBe(true);
  });
});
