import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { prisma } from '@shared/db';

/**
 * Organization module integration tests over HTTP: org CRUD, membership
 * management, invitation lifecycle, RBAC enforcement, and empty states.
 * Requires Postgres via DATABASE_URL.
 */
const domain = '@p5org.test';
const TAG = `p5o_${Date.now()}`;

let app: Express;
const ownerToken = { value: '' };
const inviteeToken = { value: '' };
const outsiderToken = { value: '' };
let inviteeEmail = '';
let inviteeId = '';
let orgId = '';

type GqlBody = {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
};

async function gql(
  query: string,
  variables: Record<string, unknown>,
  authToken?: string,
): Promise<GqlBody> {
  const req = request(app).post('/graphql');
  if (authToken) {
    req.set('Authorization', `Bearer ${authToken}`);
  }
  const response = await req.send({ query, variables });
  return response.body as GqlBody;
}

async function registerUser(
  tag: string,
): Promise<{ token: string; id: string; email: string }> {
  const email = `${tag}-${TAG}${domain}`;
  const body = await gql(
    /* GraphQL */ `
      mutation ($input: RegisterInput!) {
        register(input: $input) {
          accessToken
          user { id }
        }
      }
    `,
    { input: { email, name: tag, password: 'secret123' } },
  );
  const register = body.data?.register as { accessToken: string; user: { id: string } };
  return { token: register.accessToken, id: register.user.id, email };
}

beforeAll(async () => {
  app = await createApp();

  const owner = await registerUser('owner');
  ownerToken.value = owner.token;

  const invitee = await registerUser('invitee');
  inviteeToken.value = invitee.token;
  inviteeEmail = invitee.email;
  inviteeId = invitee.id;

  const outsider = await registerUser('outsider');
  outsiderToken.value = outsider.token;

  const created = await gql(
    /* GraphQL */ `
      mutation ($input: CreateOrganizationInput!) {
        createOrganization(input: $input) {
          id
          memberCount
          projectCount
        }
      }
    `,
    { input: { name: `${TAG}-org`, description: 'Phase 5 org' } },
    ownerToken.value,
  );
  orgId = (created.data?.createOrganization as { id: string }).id;
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.user.deleteMany({ where: { email: { contains: domain } } });
  await prisma.$disconnect();
});

describe('createOrganization', () => {
  it('creates an org owned by the creator with one member and no projects', async () => {
    const body = await gql(
      /* GraphQL */ `
        query ($id: UUID!) {
          organization(id: $id) {
            name
            memberCount
            projectCount
            owner { id }
            members { totalCount edges { node { role } } }
          }
        }
      `,
      { id: orgId },
      ownerToken.value,
    );
    const org = body.data?.organization as {
      memberCount: number;
      projectCount: number;
      members: { totalCount: number; edges: Array<{ node: { role: string } }> };
    };
    expect(org.memberCount).toBe(1);
    expect(org.projectCount).toBe(0);
    expect(org.members.totalCount).toBe(1);
    expect(org.members.edges[0]?.node.role).toBe('OWNER');
  });

  it('returns an explicit empty list of invitations initially', async () => {
    const body = await gql(
      /* GraphQL */ `
        query ($id: UUID!) {
          organizationInvitations(organizationId: $id) { id }
        }
      `,
      { id: orgId },
      ownerToken.value,
    );
    expect(body.data?.organizationInvitations).toEqual([]);
  });

  it('denies a non-member from reading the org (deny-by-default)', async () => {
    const body = await gql(
      /* GraphQL */ `query ($id: UUID!) { organization(id: $id) { name } }`,
      { id: orgId },
      outsiderToken.value,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});

describe('invitations', () => {
  const INVITE = /* GraphQL */ `
    mutation ($organizationId: UUID!, $input: InviteMemberInput!) {
      inviteToOrganization(organizationId: $organizationId, input: $input) {
        id
        email
        status
        role
      }
    }
  `;

  it('forbids a non-admin from inviting', async () => {
    const body = await gql(
      INVITE,
      { organizationId: orgId, input: { email: inviteeEmail } },
      outsiderToken.value,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('lets the owner invite, the invitee accept, and grows membership', async () => {
    const invited = await gql(
      INVITE,
      { organizationId: orgId, input: { email: inviteeEmail, role: 'MEMBER' } },
      ownerToken.value,
    );
    const invitation = invited.data?.inviteToOrganization as { status: string };
    expect(invitation.status).toBe('PENDING');

    // Fetch the token directly (not exposed via API) to accept.
    const row = await prisma.organizationInvitation.findFirst({
      where: { organizationId: orgId, email: inviteeEmail, status: 'PENDING' },
    });
    const accepted = await gql(
      /* GraphQL */ `
        mutation ($token: String!) {
          acceptInvitation(token: $token) { role user { id } }
        }
      `,
      { token: row?.token ?? '' },
      inviteeToken.value,
    );
    const member = accepted.data?.acceptInvitation as {
      role: string;
      user: { id: string };
    };
    expect(member.role).toBe('MEMBER');
    expect(member.user.id).toBe(inviteeId);
  });

  it('rejects a duplicate invitation for an existing member with CONFLICT', async () => {
    const body = await gql(
      INVITE,
      { organizationId: orgId, input: { email: inviteeEmail } },
      ownerToken.value,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('CONFLICT');
  });

  it('forbids accepting an invitation for a different email', async () => {
    const otherEmail = `stranger-${TAG}${domain}`;
    await gql(
      INVITE,
      { organizationId: orgId, input: { email: otherEmail } },
      ownerToken.value,
    );
    const row = await prisma.organizationInvitation.findFirst({
      where: { organizationId: orgId, email: otherEmail, status: 'PENDING' },
    });
    const body = await gql(
      /* GraphQL */ `mutation ($token: String!) { acceptInvitation(token: $token) { id } }`,
      { token: row?.token ?? '' },
      outsiderToken.value,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});

describe('member management', () => {
  it("forbids changing the owner's role", async () => {
    const ownerRow = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { ownerId: true },
    });
    const body = await gql(
      /* GraphQL */ `
        mutation ($organizationId: UUID!, $userId: UUID!, $role: OrgRole!) {
          updateMemberRole(organizationId: $organizationId, userId: $userId, role: $role) { id }
        }
      `,
      { organizationId: orgId, userId: ownerRow?.ownerId, role: 'ADMIN' },
      ownerToken.value,
    );
    expect(body.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('promotes a member to ADMIN', async () => {
    const body = await gql(
      /* GraphQL */ `
        mutation ($organizationId: UUID!, $userId: UUID!, $role: OrgRole!) {
          updateMemberRole(organizationId: $organizationId, userId: $userId, role: $role) { role }
        }
      `,
      { organizationId: orgId, userId: inviteeId, role: 'ADMIN' },
      ownerToken.value,
    );
    expect((body.data?.updateMemberRole as { role: string }).role).toBe('ADMIN');
  });

  it('removes a member', async () => {
    const body = await gql(
      /* GraphQL */ `
        mutation ($organizationId: UUID!, $userId: UUID!) {
          removeMember(organizationId: $organizationId, userId: $userId)
        }
      `,
      { organizationId: orgId, userId: inviteeId },
      ownerToken.value,
    );
    expect(body.data?.removeMember).toBe(true);
  });
});

describe('updateOrganization', () => {
  it('lets the owner update and forbids outsiders', async () => {
    const ok = await gql(
      /* GraphQL */ `
        mutation ($id: UUID!, $input: UpdateOrganizationInput!) {
          updateOrganization(id: $id, input: $input) { description }
        }
      `,
      { id: orgId, input: { description: 'Updated' } },
      ownerToken.value,
    );
    expect((ok.data?.updateOrganization as { description: string }).description).toBe(
      'Updated',
    );

    const denied = await gql(
      /* GraphQL */ `
        mutation ($id: UUID!, $input: UpdateOrganizationInput!) {
          updateOrganization(id: $id, input: $input) { id }
        }
      `,
      { id: orgId, input: { description: 'Hacked' } },
      outsiderToken.value,
    );
    expect(denied.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('lists the org under myOrganizations for the owner', async () => {
    const body = await gql(
      /* GraphQL */ `
        query { myOrganizations(first: 10) { totalCount edges { node { id } } } }
      `,
      {},
      ownerToken.value,
    );
    const conn = body.data?.myOrganizations as {
      edges: Array<{ node: { id: string } }>;
    };
    expect(conn.edges.some((edge) => edge.node.id === orgId)).toBe(true);
  });
});
