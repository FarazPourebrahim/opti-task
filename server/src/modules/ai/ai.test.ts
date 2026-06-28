import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { prisma } from '@shared/db';
import { setAiProvider, stubAiProvider, type AiProvider } from './ai.provider.js';

/**
 * AI module integration tests: suggestions persisted with metadata, the
 * approve/reject/override gate (applied transactionally), the approval-permission
 * gate, and graceful provider-failure handling. Requires Postgres via DATABASE_URL.
 */
const domain = '@p10ai.test';
const TAG = `p10_${Date.now()}`;

let app: Express;
let ownerToken = '';
let memberToken = '';
let lowId = '';
let highId = '';
let projectId = '';

type GqlBody = {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
};

async function gql(
  query: string,
  variables: Record<string, unknown>,
  authToken: string,
): Promise<GqlBody> {
  const req = request(app).post('/graphql');
  if (authToken) {
    req.set('Authorization', `Bearer ${authToken}`);
  }
  const response = await req.send({ query, variables });
  return response.body as GqlBody;
}

async function register(tag: string): Promise<{ token: string; id: string }> {
  const body = await gql(
    /* GraphQL */ `
      mutation ($input: RegisterInput!) {
        register(input: $input) { accessToken user { id } }
      }
    `,
    { input: { email: `${tag}-${TAG}${domain}`, name: tag, password: 'secret123' } },
    '',
  );
  const reg = body.data?.register as { accessToken: string; user: { id: string } };
  return { token: reg.accessToken, id: reg.user.id };
}

async function createTask(title: string): Promise<string> {
  const body = await gql(
    /* GraphQL */ `
      mutation ($projectId: UUID!, $input: CreateTaskInput!) {
        createTask(projectId: $projectId, input: $input) { id }
      }
    `,
    { projectId, input: { title } },
    ownerToken,
  );
  return (body.data?.createTask as { id: string }).id;
}

beforeAll(async () => {
  app = await createApp();
  ownerToken = (await register('owner')).token;
  const member = await register('member');
  memberToken = member.token;
  const memberId = member.id;
  const low = await register('low');
  lowId = low.id;
  const high = await register('high');
  highId = high.id;

  const org = await gql(
    /* GraphQL */ `mutation ($input: CreateOrganizationInput!) { createOrganization(input: $input) { id } }`,
    { input: { name: `${TAG}-org` } },
    ownerToken,
  );
  const orgId = (org.data?.createOrganization as { id: string }).id;

  const project = await gql(
    /* GraphQL */ `
      mutation ($organizationId: UUID!, $input: CreateProjectInput!) {
        createProject(organizationId: $organizationId, input: $input) { id }
      }
    `,
    { organizationId: orgId, input: { name: `${TAG}-proj` } },
    ownerToken,
  );
  projectId = (project.data?.createProject as { id: string }).id;

  // A plain project member: holds ai:request but NOT ai:approve.
  await gql(
    /* GraphQL */ `
      mutation ($projectId: UUID!, $userId: UUID!, $role: ProjectRole!) {
        addProjectMember(projectId: $projectId, userId: $userId, role: $role) { role }
      }
    `,
    { projectId, userId: memberId, role: 'MEMBER' },
    ownerToken,
  );

  // A team with two candidates of differing workload (stub picks the lighter).
  const team = await gql(
    /* GraphQL */ `mutation ($projectId: UUID!, $input: CreateTeamInput!) { createTeam(projectId: $projectId, input: $input) { id } }`,
    { projectId, input: { name: `${TAG}-team` } },
    ownerToken,
  );
  const teamId = (team.data?.createTeam as { id: string }).id;
  const ADD_TM = /* GraphQL */ `
    mutation ($teamId: UUID!, $userId: UUID!, $input: AddTeamMemberInput!) {
      addTeamMember(teamId: $teamId, userId: $userId, input: $input) { id }
    }
  `;
  await gql(ADD_TM, { teamId, userId: lowId, input: { workload: 1 } }, ownerToken);
  await gql(ADD_TM, { teamId, userId: highId, input: { workload: 9 } }, ownerToken);
});

afterAll(async () => {
  setAiProvider(stubAiProvider);
  await prisma.organization.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.user.deleteMany({ where: { email: { contains: domain } } });
  await prisma.$disconnect();
});

describe('story point estimation lifecycle', () => {
  async function requestEstimate(taskId: string): Promise<{ id: string; storyPoints: number }> {
    const body = await gql(
      /* GraphQL */ `
        mutation ($taskId: UUID!) {
          requestStoryPointEstimate(taskId: $taskId) {
            id approvalStatus resolutionStatus confidenceScore provider metadata
          }
        }
      `,
      { taskId },
      ownerToken,
    );
    const rec = body.data?.requestStoryPointEstimate as {
      id: string;
      approvalStatus: string;
      provider: string;
      metadata: { storyPoints: number };
    };
    expect(rec.approvalStatus).toBe('PENDING');
    expect(rec.provider).toBe('stub');
    return { id: rec.id, storyPoints: rec.metadata.storyPoints };
  }

  it('persists a PENDING estimate, then applies it on approval', async () => {
    const taskId = await createTask(`${TAG}-est`);
    const { id, storyPoints } = await requestEstimate(taskId);
    expect(storyPoints).toBeGreaterThan(0);

    const approved = await gql(
      /* GraphQL */ `
        mutation ($id: UUID!) {
          approveRecommendation(id: $id) { approvalStatus resolutionStatus }
        }
      `,
      { id },
      ownerToken,
    );
    const rec = approved.data?.approveRecommendation as {
      approvalStatus: string;
      resolutionStatus: string;
    };
    expect(rec.approvalStatus).toBe('APPROVED');
    expect(rec.resolutionStatus).toBe('RESOLVED');

    const task = await gql(
      /* GraphQL */ `query ($id: UUID!) { task(id: $id) { storyPoints activities { edges { node { type } } } } }`,
      { id: taskId },
      ownerToken,
    );
    const t = task.data?.task as {
      storyPoints: number;
      activities: { edges: Array<{ node: { type: string } }> };
    };
    expect(t.storyPoints).toBe(storyPoints);
    const types = t.activities.edges.map((e) => e.node.type);
    expect(types).toContain('AI_RECOMMENDATION');
    expect(types).toContain('USER_APPROVAL');
    expect(types).toContain('STORY_POINTS_UPDATED');
  });

  it('rejecting leaves the task unchanged', async () => {
    const taskId = await createTask(`${TAG}-rej`);
    const { id } = await requestEstimate(taskId);
    const rejected = await gql(
      /* GraphQL */ `mutation ($id: UUID!) { rejectRecommendation(id: $id) { approvalStatus resolutionStatus } }`,
      { id },
      ownerToken,
    );
    const rec = rejected.data?.rejectRecommendation as {
      approvalStatus: string;
      resolutionStatus: string;
    };
    expect(rec.approvalStatus).toBe('REJECTED');
    expect(rec.resolutionStatus).toBe('DISMISSED');

    const task = await gql(
      /* GraphQL */ `query ($id: UUID!) { task(id: $id) { storyPoints } }`,
      { id: taskId },
      ownerToken,
    );
    expect((task.data?.task as { storyPoints: number | null }).storyPoints).toBeNull();
  });

  it('override applies a human-chosen value', async () => {
    const taskId = await createTask(`${TAG}-ovr`);
    const { id } = await requestEstimate(taskId);
    const overridden = await gql(
      /* GraphQL */ `
        mutation ($id: UUID!, $input: OverrideRecommendationInput!) {
          overrideRecommendation(id: $id, input: $input) { approvalStatus }
        }
      `,
      { id, input: { storyPoints: 42 } },
      ownerToken,
    );
    expect((overridden.data?.overrideRecommendation as { approvalStatus: string }).approvalStatus).toBe(
      'OVERRIDDEN',
    );

    const task = await gql(
      /* GraphQL */ `query ($id: UUID!) { task(id: $id) { storyPoints } }`,
      { id: taskId },
      ownerToken,
    );
    expect((task.data?.task as { storyPoints: number }).storyPoints).toBe(42);
  });

  it('rejects approving an already-resolved recommendation', async () => {
    const taskId = await createTask(`${TAG}-dup`);
    const { id } = await requestEstimate(taskId);
    await gql(/* GraphQL */ `mutation ($id: UUID!) { approveRecommendation(id: $id) { id } }`, { id }, ownerToken);
    const again = await gql(
      /* GraphQL */ `mutation ($id: UUID!) { approveRecommendation(id: $id) { id } }`,
      { id },
      ownerToken,
    );
    expect(again.errors?.[0]?.extensions?.code).toBe('CONFLICT');
  });
});

describe('assignment recommendation', () => {
  it('exposes the candidate dataset', async () => {
    const taskId = await createTask(`${TAG}-ctx`);
    const body = await gql(
      /* GraphQL */ `
        query ($taskId: UUID!) {
          assignmentContext(taskId: $taskId) {
            candidates { user { id } workload activeTaskCount }
          }
        }
      `,
      { taskId },
      ownerToken,
    );
    const ctx = body.data?.assignmentContext as {
      candidates: Array<{ user: { id: string }; workload: number }>;
    };
    expect(ctx.candidates.some((c) => c.user.id === lowId)).toBe(true);
    expect(ctx.candidates.some((c) => c.user.id === highId)).toBe(true);
  });

  it('suggests the lighter-loaded candidate and assigns on approval', async () => {
    const taskId = await createTask(`${TAG}-assign`);
    const recBody = await gql(
      /* GraphQL */ `
        mutation ($taskId: UUID!) {
          requestAssignmentRecommendation(taskId: $taskId) { id metadata }
        }
      `,
      { taskId },
      ownerToken,
    );
    const rec = recBody.data?.requestAssignmentRecommendation as {
      id: string;
      metadata: { suggestedAssigneeId: string };
    };
    expect(rec.metadata.suggestedAssigneeId).toBe(lowId);

    await gql(
      /* GraphQL */ `mutation ($id: UUID!) { approveRecommendation(id: $id) { approvalStatus } }`,
      { id: rec.id },
      ownerToken,
    );
    const task = await gql(
      /* GraphQL */ `query ($id: UUID!) { task(id: $id) { assignee { id } } }`,
      { id: taskId },
      ownerToken,
    );
    expect((task.data?.task as { assignee: { id: string } }).assignee.id).toBe(lowId);
  });
});

describe('approval permission gate (AI suggests, humans approve)', () => {
  it('lets a member request but forbids them approving', async () => {
    const taskId = await createTask(`${TAG}-gate`);
    const reqBody = await gql(
      /* GraphQL */ `mutation ($taskId: UUID!) { requestStoryPointEstimate(taskId: $taskId) { id } }`,
      { taskId },
      memberToken,
    );
    const id = (reqBody.data?.requestStoryPointEstimate as { id: string }).id;
    expect(id).toBeTruthy();

    const approve = await gql(
      /* GraphQL */ `mutation ($id: UUID!) { approveRecommendation(id: $id) { id } }`,
      { id },
      memberToken,
    );
    expect(approve.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});

describe('scrum master insights', () => {
  it('persists a sprint-health recommendation and resolves on approval', async () => {
    const sprint = await gql(
      /* GraphQL */ `mutation ($projectId: UUID!, $input: CreateSprintInput!) { createSprint(projectId: $projectId, input: $input) { id } }`,
      { projectId, input: { name: `${TAG}-sprint`, capacity: 5 } },
      ownerToken,
    );
    const sprintId = (sprint.data?.createSprint as { id: string }).id;

    const recBody = await gql(
      /* GraphQL */ `
        mutation ($sprintId: UUID!) {
          requestSprintHealthAnalysis(sprintId: $sprintId) { id type text approvalStatus }
        }
      `,
      { sprintId },
      ownerToken,
    );
    const rec = recBody.data?.requestSprintHealthAnalysis as {
      id: string;
      type: string;
      approvalStatus: string;
    };
    expect(rec.type).toBe('SPRINT_HEALTH');
    expect(rec.approvalStatus).toBe('PENDING');

    const approved = await gql(
      /* GraphQL */ `mutation ($id: UUID!) { approveRecommendation(id: $id) { approvalStatus resolutionStatus } }`,
      { id: rec.id },
      ownerToken,
    );
    const out = approved.data?.approveRecommendation as {
      approvalStatus: string;
      resolutionStatus: string;
    };
    expect(out.approvalStatus).toBe('APPROVED');
    expect(out.resolutionStatus).toBe('RESOLVED');
  });
});

describe('provider failure handling', () => {
  it('degrades to SERVICE_UNAVAILABLE without crashing', async () => {
    const failing: AiProvider = {
      name: 'failing',
      estimateStoryPoints: () => Promise.reject(new Error('boom')),
      suggestAssignee: () => Promise.reject(new Error('boom')),
      analyzeSprintHealth: () => Promise.reject(new Error('boom')),
      trackProgress: () => Promise.reject(new Error('boom')),
    };
    setAiProvider(failing);
    try {
      const taskId = await createTask(`${TAG}-fail`);
      const body = await gql(
        /* GraphQL */ `mutation ($taskId: UUID!) { requestStoryPointEstimate(taskId: $taskId) { id } }`,
        { taskId },
        ownerToken,
      );
      expect(body.errors?.[0]?.extensions?.code).toBe('SERVICE_UNAVAILABLE');
    } finally {
      setAiProvider(stubAiProvider);
    }
  });
});
