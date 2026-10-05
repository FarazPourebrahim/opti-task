import { HttpResponse } from 'msw';
import type { Person } from '@/modules/project/project.fixtures';
import { graphql } from '@/shared/tests/graphql';

/**
 * Test fixtures for a task's discussion: comments, replies and attachment
 * records, with handlers for the two queries the task page makes for them.
 *
 * Nothing here imports the task fixtures — the task fixtures import this, so
 * every task page test has a discussion to load. The task id is passed in.
 */

export const COMMENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const REPLY_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const NEW_COMMENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const ATTACHMENT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
export const NEW_ATTACHMENT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

type AttachmentOverrides = Partial<{
  id: string;
  filename: string;
  contentType: string | null;
  sizeBytes: number | null;
  uploadedBy: Person;
}>;

export function attachmentNode(
  uploadedBy: Person,
  overrides: AttachmentOverrides = {},
) {
  return {
    __typename: 'Attachment',
    id: overrides.id ?? ATTACHMENT_ID,
    filename: overrides.filename ?? 'wireframes.pdf',
    contentType:
      overrides.contentType === undefined
        ? 'application/pdf'
        : overrides.contentType,
    sizeBytes: overrides.sizeBytes === undefined ? 1536 : overrides.sizeBytes,
    createdAt: '2026-09-07T10:00:00.000Z',
    uploadedBy: {
      __typename: 'User',
      id: uploadedBy.id,
      name: uploadedBy.name,
    },
  };
}

export type CommentOverrides = Partial<{
  id: string;
  body: string;
  resolved: boolean;
  edited: boolean;
  parentCommentId: string | null;
  mentions: Person[];
  attachments: Array<ReturnType<typeof attachmentNode>>;
}>;

/** A comment with every field the comment fragments select, bar replies. */
export function commentNode(
  taskId: string,
  author: Person,
  overrides: CommentOverrides = {},
) {
  const edited = overrides.edited ?? false;

  return {
    __typename: 'Comment',
    id: overrides.id ?? COMMENT_ID,
    body: overrides.body ?? 'Is the copy final?',
    resolved: overrides.resolved ?? false,
    edited,
    editedAt: edited ? '2026-09-08T10:00:00.000Z' : null,
    taskId,
    parentCommentId: overrides.parentCommentId ?? null,
    createdAt: '2026-09-07T09:00:00.000Z',
    author: {
      __typename: 'User',
      id: author.id,
      name: author.name,
      avatarUrl: null,
    },
    mentions: (overrides.mentions ?? []).map((person) => ({
      __typename: 'User',
      id: person.id,
      name: person.name,
    })),
    attachments: overrides.attachments ?? [],
  };
}

type CommentNode = ReturnType<typeof commentNode>;

/** A top-level comment and the replies under it. */
export function threadNode(
  taskId: string,
  author: Person,
  overrides: CommentOverrides = {},
  replies: CommentNode[] = [],
) {
  return { ...commentNode(taskId, author, overrides), replies };
}

type ThreadNode = ReturnType<typeof threadNode>;

export function commentsData(
  taskId: string,
  threads: ThreadNode[] = [],
  page: {
    hasNextPage?: boolean;
    endCursor?: string | null;
    total?: number;
  } = {},
) {
  return {
    task: {
      __typename: 'Task',
      id: taskId,
      comments: {
        __typename: 'CommentConnection',
        edges: threads.map((node) => ({
          __typename: 'CommentEdge',
          cursor: `cursor-${node.id}`,
          node,
        })),
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: page.hasNextPage ?? false,
          endCursor: page.endCursor ?? null,
        },
        totalCount: page.total ?? threads.length,
      },
    },
  };
}

export function attachmentsData(
  taskId: string,
  attachments: Array<ReturnType<typeof attachmentNode>> = [],
) {
  return { task: { __typename: 'Task', id: taskId, attachments } };
}

/** Handlers for a task's discussion. Empty unless a test says otherwise. */
export function discussionScenario(
  taskId: string,
  discussion: {
    threads?: ThreadNode[];
    attachments?: Array<ReturnType<typeof attachmentNode>>;
  } = {},
) {
  return [
    graphql.query('TaskComments', () =>
      HttpResponse.json({ data: commentsData(taskId, discussion.threads) }),
    ),
    graphql.query('TaskAttachments', () =>
      HttpResponse.json({
        data: attachmentsData(taskId, discussion.attachments),
      }),
    ),
  ];
}
