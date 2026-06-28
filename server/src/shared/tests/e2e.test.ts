import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { prisma } from '@shared/db';

/**
 * End-to-end happy path across every module: a user registers, builds an org →
 * project → team → sprint, creates and progresses a task, comments, requests and
 * approves an AI estimate, and reads analytics. Proves the modules compose into a
 * working whole over the real HTTP + DB path. Requires Postgres via DATABASE_URL.
 */
const domain = '@p12e2e.test';
const TAG = `p12e_${Date.now()}`;

let app: Express;
let token = '';
let memberId = '';

type GqlBody = {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
};

async function gql(query: string, variables: Record<string, unknown>): Promise<GqlBody> {
  const req = request(app).post('/graphql');
  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }
  const response = await req.send({ query, variables });
  return response.body as GqlBody;
}

function data<T>(body: GqlBody, field: string): T {
  expect(body.errors).toBeUndefined();
  return (body.data as Record<string, unknown>)[field] as T;
}

beforeAll(async () => {
  app = await createApp();
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.user.deleteMany({ where: { email: { contains: domain } } });
  await prisma.$disconnect();
});

describe('full platform happy path', () => {
  it('walks register → project → team → sprint → task → comment → AI → analytics', async () => {
    // 1. Register (the actor becomes the org owner).
    const reg = await gql(
      /* GraphQL */ `
        mutation ($input: RegisterInput!) {
          register(input: $input) { accessToken user { id } }
        }
      `,
      { input: { email: `owner-${TAG}${domain}`, name: 'owner', password: 'secret123' } },
    );
    const auth = data<{ accessToken: string; user: { id: string } }>(reg, 'register');
    token = auth.accessToken;

    const memberReg = await gql(
      /* GraphQL */ `
        mutation ($input: RegisterInput!) {
          register(input: $input) { user { id } }
        }
      `,
      { input: { email: `member-${TAG}${domain}`, name: 'member', password: 'secret123' } },
    );
    memberId = data<{ user: { id: string } }>(memberReg, 'register').user.id;

    // 2. Organization.
    const org = await gql(
      /* GraphQL */ `mutation ($input: CreateOrganizationInput!) { createOrganization(input: $input) { id } }`,
      { input: { name: `${TAG}-org` } },
    );
    const orgId = data<{ id: string }>(org, 'createOrganization').id;

    // 3. Project.
    const project = await gql(
      /* GraphQL */ `mutation ($organizationId: UUID!, $input: CreateProjectInput!) { createProject(organizationId: $organizationId, input: $input) { id status } }`,
      { organizationId: orgId, input: { name: `${TAG}-proj` } },
    );
    const projectId = data<{ id: string }>(project, 'createProject').id;

    // 4. Team + member with capacity attributes.
    const team = await gql(
      /* GraphQL */ `mutation ($projectId: UUID!, $input: CreateTeamInput!) { createTeam(projectId: $projectId, input: $input) { id } }`,
      { projectId, input: { name: `${TAG}-team` } },
    );
    const teamId = data<{ id: string }>(team, 'createTeam').id;
    await gql(
      /* GraphQL */ `mutation ($teamId: UUID!, $userId: UUID!, $input: AddTeamMemberInput!) { addTeamMember(teamId: $teamId, userId: $userId, input: $input) { id } }`,
      { teamId, userId: memberId, input: { workload: 2 } },
    );

    // 5. Sprint.
    const sprint = await gql(
      /* GraphQL */ `mutation ($projectId: UUID!, $input: CreateSprintInput!) { createSprint(projectId: $projectId, input: $input) { id } }`,
      { projectId, input: { name: `${TAG}-sprint`, capacity: 20 } },
    );
    const sprintId = data<{ id: string }>(sprint, 'createSprint').id;

    // 6. Task in the sprint, assigned to the member.
    const task = await gql(
      /* GraphQL */ `mutation ($projectId: UUID!, $input: CreateTaskInput!) { createTask(projectId: $projectId, input: $input) { id status } }`,
      { projectId, input: { title: `${TAG}-task`, sprintId, assigneeId: memberId, storyPoints: 5 } },
    );
    const taskId = data<{ id: string; status: string }>(task, 'createTask').id;

    // 7. Progress the task and comment on it.
    const moved = await gql(
      /* GraphQL */ `mutation ($id: UUID!, $status: TaskStatus!) { changeTaskStatus(id: $id, status: $status) { status } }`,
      { id: taskId, status: 'TODO' },
    );
    expect(data<{ status: string }>(moved, 'changeTaskStatus').status).toBe('TODO');

    const comment = await gql(
      /* GraphQL */ `mutation ($taskId: UUID!, $input: CreateCommentInput!) { createComment(taskId: $taskId, input: $input) { id } }`,
      { taskId, input: { body: 'Looks good', mentionedUserIds: [memberId] } },
    );
    expect(data<{ id: string }>(comment, 'createComment').id).toBeTruthy();

    // 8. AI estimate → approve → applied to the task.
    const rec = await gql(
      /* GraphQL */ `mutation ($taskId: UUID!) { requestStoryPointEstimate(taskId: $taskId) { id approvalStatus metadata } }`,
      { taskId },
    );
    const recommendation = data<{ id: string; approvalStatus: string; metadata: { storyPoints: number } }>(
      rec,
      'requestStoryPointEstimate',
    );
    expect(recommendation.approvalStatus).toBe('PENDING');

    const approved = await gql(
      /* GraphQL */ `mutation ($id: UUID!) { approveRecommendation(id: $id) { approvalStatus } }`,
      { id: recommendation.id },
    );
    expect(data<{ approvalStatus: string }>(approved, 'approveRecommendation').approvalStatus).toBe('APPROVED');

    // 9. Analytics reflect the work.
    const analytics = await gql(
      /* GraphQL */ `query ($id: UUID!) { projectAnalytics(projectId: $id) { totalTasks totalStoryPoints individualWorkloads { user { id } } } }`,
      { id: projectId },
    );
    const a = data<{
      totalTasks: number;
      totalStoryPoints: number;
      individualWorkloads: Array<{ user: { id: string } }>;
    }>(analytics, 'projectAnalytics');
    expect(a.totalTasks).toBe(1);
    expect(a.totalStoryPoints).toBe(recommendation.metadata.storyPoints);
    expect(a.individualWorkloads.some((w) => w.user.id === memberId)).toBe(true);
  });
});
