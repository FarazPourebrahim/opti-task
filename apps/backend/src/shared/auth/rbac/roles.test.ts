import { describe, expect, it } from 'vitest';
import { can, type Role } from './roles.js';
import { ownsAny } from './ownership.js';

const roles = (...r: Role[]): Set<Role> => new Set(r);

/**
 * Capability matrix unit tests — representative role × action pairs. The matrix
 * in roles.ts is the source of truth; docs/rbac.md mirrors it for humans.
 */
describe('permission matrix', () => {
  it('grants ORG_OWNER every action', () => {
    const owner = roles('ORG_OWNER');
    expect(can(owner, 'organization:delete')).toBe(true);
    expect(can(owner, 'project:create')).toBe(true);
    expect(can(owner, 'ai:approve')).toBe(true);
  });

  it('lets ORG_ADMIN create projects but not delete the organization', () => {
    const admin = roles('ORG_ADMIN');
    expect(can(admin, 'project:create')).toBe(true);
    expect(can(admin, 'organization:delete')).toBe(false);
  });

  it('lets PROJECT_ADMIN manage the project and approve AI, but not create projects', () => {
    const admin = roles('PROJECT_ADMIN');
    expect(can(admin, 'project:update')).toBe(true);
    expect(can(admin, 'ai:approve')).toBe(true);
    expect(can(admin, 'project:create')).toBe(false);
    expect(can(admin, 'organization:update')).toBe(false);
  });

  it('lets TEAM_LEAD assign tasks but not update the project', () => {
    const lead = roles('TEAM_LEAD');
    expect(can(lead, 'task:assign')).toBe(true);
    expect(can(lead, 'task:delete')).toBe(true);
    expect(can(lead, 'project:update')).toBe(false);
  });

  it('limits TEAM_MEMBER to creating/commenting, not assigning or deleting', () => {
    const member = roles('TEAM_MEMBER');
    expect(can(member, 'task:create')).toBe(true);
    expect(can(member, 'task:comment')).toBe(true);
    expect(can(member, 'task:read')).toBe(true);
    expect(can(member, 'task:assign')).toBe(false);
    expect(can(member, 'task:delete')).toBe(false);
  });

  it('makes VIEWER strictly read-only', () => {
    const viewer = roles('VIEWER');
    expect(can(viewer, 'task:read')).toBe(true);
    expect(can(viewer, 'task:create')).toBe(false);
    expect(can(viewer, 'task:update')).toBe(false);
  });

  it('lets AI_AGENT request suggestions but never approve or mutate', () => {
    const ai = roles('AI_AGENT');
    expect(can(ai, 'ai:request')).toBe(true);
    expect(can(ai, 'task:read')).toBe(true);
    expect(can(ai, 'ai:approve')).toBe(false);
    expect(can(ai, 'task:update')).toBe(false);
    expect(can(ai, 'task:create')).toBe(false);
  });

  it('denies by default when no role grants the permission', () => {
    expect(can(roles(), 'task:read')).toBe(false);
    expect(can(roles('VIEWER', 'TEAM_MEMBER'), 'project:delete')).toBe(false);
  });

  it('unions permissions across multiple held roles', () => {
    // A viewer who is also a team lead gains the lead's powers.
    const combined = roles('VIEWER', 'TEAM_LEAD');
    expect(can(combined, 'task:assign')).toBe(true);
  });
});

describe('ownsAny', () => {
  it('matches when the user is one of the owners', () => {
    expect(ownsAny('u1', 'u2', 'u1')).toBe(true);
  });

  it('ignores null/undefined owner ids', () => {
    expect(ownsAny('u1', null, undefined)).toBe(false);
    expect(ownsAny('u1', null, 'u1')).toBe(true);
  });
});
