import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GraphQLContext } from '@/shared/graphql/context';
import { ForbiddenError } from '@/shared/errors';
import { prisma } from '@/shared/db';
import { resolveEffectiveRoles } from './scope.js';
import { can } from './roles.js';
import { authorize, authorizeOwnerOrPermission } from './authorize.js';

/**
 * Integration tests for scope resolution + the authorize guards — require a
 * migrated Postgres via DATABASE_URL. Verify effective-role climbing
 * (team→project→org), deny-by-default across orgs/projects, and ownership.
 */
const domain = '@rbac.test';
const ids: Record<string, string> = {};

function ctxFor(userId: string): GraphQLContext {
  return {
    prisma,
    user: { id: userId, email: `${userId}${domain}`, sessionId: 's' },
  } as unknown as GraphQLContext;
}

async function makeUser(tag: string): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `${tag}-${Date.now()}${domain}`, name: tag, passwordHash: 'x' },
  });
  return user.id;
}

beforeAll(async () => {
  ids.owner = await makeUser('owner');
  ids.orgAdmin = await makeUser('orgadmin');
  ids.orgMember = await makeUser('orgmember');
  ids.projectAdmin = await makeUser('projadmin');
  ids.projectMember = await makeUser('projmember');
  ids.viewer = await makeUser('viewer');
  ids.teamLead = await makeUser('teamlead');
  ids.teamMember = await makeUser('teammember');
  ids.outsider = await makeUser('outsider');
  ids.otherOwner = await makeUser('otherowner');

  const orgA = await prisma.organization.create({
    data: {
      name: `rbac-orgA-${Date.now()}`,
      ownerId: ids.owner,
      members: {
        create: [
          { userId: ids.orgAdmin, role: 'ADMIN' },
          { userId: ids.orgMember, role: 'MEMBER' },
        ],
      },
    },
  });
  ids.orgA = orgA.id;

  const projectA = await prisma.project.create({
    data: {
      name: 'rbac-projA',
      organizationId: orgA.id,
      members: {
        create: [
          { userId: ids.projectAdmin, role: 'ADMIN' },
          { userId: ids.projectMember, role: 'MEMBER' },
          { userId: ids.viewer, role: 'VIEWER' },
        ],
      },
    },
  });
  ids.projectA = projectA.id;

  const teamA = await prisma.team.create({
    data: {
      name: 'rbac-teamA',
      projectId: projectA.id,
      members: {
        create: [
          { userId: ids.teamLead, role: 'LEAD' },
          { userId: ids.teamMember, role: 'MEMBER' },
        ],
      },
    },
  });
  ids.teamA = teamA.id;

  // A separate org/project the orgA users have no access to.
  const orgB = await prisma.organization.create({
    data: { name: `rbac-orgB-${Date.now()}`, ownerId: ids.otherOwner },
  });
  const projectB = await prisma.project.create({
    data: { name: 'rbac-projB', organizationId: orgB.id },
  });
  ids.projectB = projectB.id;
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { name: { contains: 'rbac-org' } } });
  await prisma.user.deleteMany({ where: { email: { contains: domain } } });
  await prisma.$disconnect();
});

describe('resolveEffectiveRoles', () => {
  it('recognizes the organization owner via ownerId', async () => {
    const roles = await resolveEffectiveRoles(prisma, ids.owner, {
      organizationId: ids.orgA,
    });
    expect(roles.has('ORG_OWNER')).toBe(true);
  });

  it('climbs team → project → org to collect all roles', async () => {
    // teamLead is only a team member, but org context should still resolve.
    const roles = await resolveEffectiveRoles(prisma, ids.teamLead, {
      teamId: ids.teamA,
    });
    expect(roles.has('TEAM_LEAD')).toBe(true);
    expect(can(roles, 'task:assign')).toBe(true);
  });

  it('returns an empty set for a user with no membership (deny-by-default)', async () => {
    const roles = await resolveEffectiveRoles(prisma, ids.outsider, {
      projectId: ids.projectA,
    });
    expect(roles.size).toBe(0);
  });
});

describe('authorize', () => {
  it('allows an org admin to create a project', async () => {
    await expect(
      authorize(ctxFor(ids.orgAdmin), 'project:create', {
        organizationId: ids.orgA,
      }),
    ).resolves.toBeDefined();
  });

  it('forbids an org member from creating a project', async () => {
    await expect(
      authorize(ctxFor(ids.orgMember), 'project:create', {
        organizationId: ids.orgA,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows a project admin to update the project', async () => {
    await expect(
      authorize(ctxFor(ids.projectAdmin), 'project:update', {
        projectId: ids.projectA,
      }),
    ).resolves.toBeDefined();
  });

  it('forbids a viewer from updating tasks but allows reading', async () => {
    await expect(
      authorize(ctxFor(ids.viewer), 'task:update', { projectId: ids.projectA }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      authorize(ctxFor(ids.viewer), 'task:read', { projectId: ids.projectA }),
    ).resolves.toBeDefined();
  });

  it('denies cross-org access by default', async () => {
    await expect(
      authorize(ctxFor(ids.orgMember), 'project:read', {
        projectId: ids.projectB,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('authorizeOwnerOrPermission', () => {
  it('allows a team member to act on a task they own', async () => {
    await expect(
      authorizeOwnerOrPermission(
        ctxFor(ids.teamMember),
        'task:update',
        { teamId: ids.teamA },
        [ids.teamMember],
      ),
    ).resolves.toBeUndefined();
  });

  it("forbids a team member from acting on someone else's task", async () => {
    await expect(
      authorizeOwnerOrPermission(
        ctxFor(ids.teamMember),
        'task:update',
        { teamId: ids.teamA },
        [ids.teamLead],
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
