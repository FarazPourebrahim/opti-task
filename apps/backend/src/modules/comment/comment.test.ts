import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { prisma } from '@/shared/db';

/**
 * Comment module integration tests: comments on tasks, mentions, edit/resolve
 * authz, and attachments behind the storage adapter. Requires Postgres via
 * DATABASE_URL.
 */
const domain = '@p9comment.test';
const TAG = `p9c_${Date.now()}`;

let app: Express;
let ownerToken = '';
let outsiderToken = '';
let memberToken = '';
let memberId = '';
let taskId = '';

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

async function createComment(
  body: string,
  mentionedUserIds: string[] = [],
  token = ownerToken,
): Promise<{ id: string; errors?: GqlBody['errors'] }> {
  const res = await gql(
    /* GraphQL */ `
      mutation ($taskId: UUID!, $input: CreateCommentInput!) {
        createComment(taskId: $taskId, input: $input) { id body }
      }
    `,
    { taskId, input: { body, mentionedUserIds } },
    token,
  );
  return { id: (res.data?.createComment as { id: string } | undefined)?.id ?? '', errors: res.errors };
}

beforeAll(async () => {
  app = await createApp();
  ownerToken = (await register('owner')).token;
  outsiderToken = (await register('outsider')).token;
  const member = await register('member');
  memberToken = member.token;
  memberId = member.id;

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
  const projectId = (project.data?.createProject as { id: string }).id;

  // Add the member so they can comment.
  await gql(
    /* GraphQL */ `
      mutation ($projectId: UUID!, $userId: UUID!, $role: ProjectRole!) {
        addProjectMember(projectId: $projectId, userId: $userId, role: $role) { role }
      }
    `,
    { projectId, userId: memberId, role: 'MEMBER' },
    ownerToken,
  );

  const task = await gql(
    /* GraphQL */ `
      mutation ($projectId: UUID!, $input: CreateTaskInput!) {
        createTask(projectId: $projectId, input: $input) { id }
      }
    `,
    { projectId, input: { title: `${TAG}-task` } },
    ownerToken,
  );
  taskId = (task.data?.createTask as { id: string }).id;
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.user.deleteMany({ where: { email: { contains: domain } } });
  await prisma.$disconnect();
});

describe('createComment & mentions', () => {
  it('creates a comment listed under the task', async () => {
    const { id } = await createComment('First comment');
    expect(id).toBeTruthy();

    const body = await gql(
      /* GraphQL */ `
        query ($id: UUID!) {
          task(id: $id) {
            commentCount
            comments { totalCount edges { node { id body author { id } } } }
          }
        }
      `,
      { id: taskId },
      ownerToken,
    );
    const task = body.data?.task as {
      commentCount: number;
      comments: { totalCount: number; edges: Array<{ node: { id: string } }> };
    };
    expect(task.commentCount).toBeGreaterThanOrEqual(1);
    expect(task.comments.edges.some((e) => e.node.id === id)).toBe(true);
  });

  it('resolves mentions and exposes them on the comment', async () => {
    const { id } = await createComment('Hey @member', [memberId]);
    const body = await gql(
      /* GraphQL */ `query ($id: UUID!) { comment(id: $id) { mentions { id } } }`,
      { id },
      ownerToken,
    );
    const comment = body.data?.comment as { mentions: Array<{ id: string }> };
    expect(comment.mentions.some((m) => m.id === memberId)).toBe(true);
  });

  it('rejects a mention of a non-existent user', async () => {
    const { errors } = await createComment('ghost', [
      '00000000-0000-0000-0000-0000000000ee',
    ]);
    expect(errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('forbids an outsider from commenting', async () => {
    const { errors } = await createComment('intrusion', [], outsiderToken);
    expect(errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});

describe('edit & resolve authz', () => {
  it('lets the author edit and flags edited; forbids a non-author', async () => {
    const { id } = await createComment('editable', [], memberToken);

    const edited = await gql(
      /* GraphQL */ `
        mutation ($id: UUID!, $input: UpdateCommentInput!) {
          editComment(id: $id, input: $input) { body edited }
        }
      `,
      { id, input: { body: 'edited body' } },
      memberToken,
    );
    const comment = edited.data?.editComment as { body: string; edited: boolean };
    expect(comment.body).toBe('edited body');
    expect(comment.edited).toBe(true);

    // The owner (project admin) may moderate via task:update, but the outsider may not.
    const forbidden = await gql(
      /* GraphQL */ `
        mutation ($id: UUID!, $input: UpdateCommentInput!) {
          editComment(id: $id, input: $input) { id }
        }
      `,
      { id, input: { body: 'hacked' } },
      outsiderToken,
    );
    expect(forbidden.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('resolves a discussion', async () => {
    const { id } = await createComment('to resolve');
    const body = await gql(
      /* GraphQL */ `mutation ($id: UUID!) { resolveComment(id: $id, resolved: true) { resolved } }`,
      { id },
      ownerToken,
    );
    expect((body.data?.resolveComment as { resolved: boolean }).resolved).toBe(true);
  });
});

describe('attachments', () => {
  it('attaches a file to a task and exposes a url via the adapter', async () => {
    const body = await gql(
      /* GraphQL */ `
        mutation ($taskId: UUID!, $input: AddAttachmentInput!) {
          addTaskAttachment(taskId: $taskId, input: $input) {
            id
            filename
            sizeBytes
            url
            uploadedBy { id }
          }
        }
      `,
      { taskId, input: { filename: 'design.pdf', contentType: 'application/pdf', sizeBytes: 2048 } },
      ownerToken,
    );
    const attachment = body.data?.addTaskAttachment as {
      filename: string;
      sizeBytes: number;
      url: string;
    };
    expect(attachment.filename).toBe('design.pdf');
    expect(attachment.sizeBytes).toBe(2048);
    expect(attachment.url).toContain('/files/task/');

    const list = await gql(
      /* GraphQL */ `query ($id: UUID!) { task(id: $id) { attachments { filename } } }`,
      { id: taskId },
      ownerToken,
    );
    const task = list.data?.task as { attachments: Array<{ filename: string }> };
    expect(task.attachments.some((a) => a.filename === 'design.pdf')).toBe(true);
  });
});
