import type { Attachment, Comment, Task } from '@prisma/client';
import type { GraphQLContext } from '@/shared/graphql/context';
import { prisma, withTransaction } from '@/shared/db';
import {
  authorize,
  authorizeOwnerOrPermission,
  requireAuth,
} from '@/shared/auth';
import { NotFoundError, ValidationError } from '@/shared/errors';
import {
  buildConnection,
  clampFirst,
  decodeCursor,
  encodeCursor,
  type Connection,
} from '@/shared/utils';
import { emit } from '@/shared/events';
import { publish } from '@/shared/pubsub';
import { getStorageAdapter } from '@/shared/storage';
import * as activityRepo from '@/modules/activity/activity.repository';
import * as repo from './comment.repository.js';
import {
  validateAttachment,
  validateCreateComment,
  validateUpdateComment,
} from './comment.validation.js';

async function getTaskOrThrow(taskId: string): Promise<Task> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new NotFoundError('Task not found');
  }
  return task;
}

async function getCommentOrThrow(id: string): Promise<Comment> {
  const comment = await repo.findCommentById(id);
  if (!comment) {
    throw new NotFoundError('Comment not found');
  }
  return comment;
}

/** Validates that all mentioned ids reference real users. */
async function resolveMentions(userIds: string[]): Promise<string[]> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) {
    return [];
  }
  const found = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  if (found.length !== unique.length) {
    throw new ValidationError('One or more mentioned users do not exist');
  }
  return unique;
}

export async function getComment(
  ctx: GraphQLContext,
  id: string,
): Promise<Comment> {
  const comment = await getCommentOrThrow(id);
  const task = await getTaskOrThrow(comment.taskId);
  await authorize(ctx, 'task:read', { projectId: task.projectId });
  return comment;
}

export async function listTaskComments(
  ctx: GraphQLContext,
  taskId: string,
  args: { first?: number | null; after?: string | null },
): Promise<Connection<Comment>> {
  const task = await getTaskOrThrow(taskId);
  await authorize(ctx, 'task:read', { projectId: task.projectId });

  const pageSize = clampFirst(args.first);
  const after = args.after ? decodeCursor(args.after) : null;

  const [rows, totalCount] = await Promise.all([
    repo.listTaskCommentsPage({
      taskId,
      take: pageSize + 1,
      ...(after ? { cursor: after } : {}),
    }),
    repo.countTaskComments(taskId),
  ]);

  return buildConnection(rows, {
    pageSize,
    after,
    totalCount,
    getCursor: (comment) => encodeCursor(comment.id),
  });
}

export async function createComment(
  ctx: GraphQLContext,
  taskId: string,
  input: unknown,
): Promise<Comment> {
  const task = await getTaskOrThrow(taskId);
  const principal = requireAuth(ctx);
  await authorize(ctx, 'task:comment', { projectId: task.projectId });
  const data = validateCreateComment(input);

  if (data.parentCommentId) {
    const parent = await repo.findCommentById(data.parentCommentId);
    if (!parent || parent.taskId !== taskId) {
      throw new ValidationError('Parent comment does not belong to this task');
    }
  }
  const mentionIds = await resolveMentions(data.mentionedUserIds ?? []);

  const comment = await withTransaction(async (tx) => {
    const created = await repo.createComment(
      {
        taskId,
        authorId: principal.id,
        body: data.body,
        parentCommentId: data.parentCommentId ?? null,
      },
      tx,
    );
    await repo.createMentions(created.id, mentionIds, tx);
    await activityRepo.createActivity(
      {
        projectId: task.projectId,
        taskId,
        actorId: principal.id,
        type: 'COMMENT_ADDED',
        metadata: { commentId: created.id },
      },
      tx,
    );
    return created;
  });

  publish('COMMENT_ADDED', {
    commentId: comment.id,
    taskId,
    projectId: task.projectId,
  });
  // Best-effort, post-commit fan-out (see shared/events).
  await emit('comment.mentioned', {
    commentId: comment.id,
    taskId,
    projectId: task.projectId,
    mentionedUserIds: mentionIds,
    actorId: principal.id,
  });

  return comment;
}

export async function editComment(
  ctx: GraphQLContext,
  id: string,
  input: unknown,
): Promise<Comment> {
  const comment = await getCommentOrThrow(id);
  const task = await getTaskOrThrow(comment.taskId);
  await authorizeOwnerOrPermission(ctx, 'task:update', { projectId: task.projectId }, [
    comment.authorId,
  ]);
  const data = validateUpdateComment(input);
  return repo.updateComment(id, { body: data.body, editedAt: new Date() });
}

export async function resolveComment(
  ctx: GraphQLContext,
  id: string,
  resolved: boolean,
): Promise<Comment> {
  const comment = await getCommentOrThrow(id);
  const task = await getTaskOrThrow(comment.taskId);
  await authorizeOwnerOrPermission(ctx, 'task:update', { projectId: task.projectId }, [
    comment.authorId,
  ]);
  return repo.updateComment(id, { resolved });
}

export async function deleteComment(
  ctx: GraphQLContext,
  id: string,
): Promise<void> {
  const comment = await getCommentOrThrow(id);
  const task = await getTaskOrThrow(comment.taskId);
  await authorizeOwnerOrPermission(ctx, 'task:update', { projectId: task.projectId }, [
    comment.authorId,
  ]);
  await repo.deleteComment(id);
}

// --- Attachments ---

async function createAttachment(
  ctx: GraphQLContext,
  projectId: string,
  scope: string,
  input: unknown,
  target: { taskId: string | null; commentId: string | null },
): Promise<Attachment> {
  const principal = requireAuth(ctx);
  await authorize(ctx, 'task:comment', { projectId });
  const data = validateAttachment(input);
  const storageKey = getStorageAdapter().generateKey({ scope, filename: data.filename });

  return repo.createAttachment({
    taskId: target.taskId,
    commentId: target.commentId,
    uploadedById: principal.id,
    filename: data.filename,
    contentType: data.contentType ?? null,
    sizeBytes: data.sizeBytes ?? null,
    storageKey,
  });
}

export async function addTaskAttachment(
  ctx: GraphQLContext,
  taskId: string,
  input: unknown,
): Promise<Attachment> {
  const task = await getTaskOrThrow(taskId);
  return createAttachment(ctx, task.projectId, `task/${taskId}`, input, {
    taskId,
    commentId: null,
  });
}

export async function addCommentAttachment(
  ctx: GraphQLContext,
  commentId: string,
  input: unknown,
): Promise<Attachment> {
  const comment = await getCommentOrThrow(commentId);
  const task = await getTaskOrThrow(comment.taskId);
  return createAttachment(ctx, task.projectId, `comment/${commentId}`, input, {
    taskId: null,
    commentId,
  });
}

export async function removeAttachment(
  ctx: GraphQLContext,
  id: string,
): Promise<void> {
  const attachment = await repo.findAttachmentById(id);
  if (!attachment) {
    throw new NotFoundError('Attachment not found');
  }
  const relatedTaskId =
    attachment.taskId ??
    (attachment.commentId
      ? (await getCommentOrThrow(attachment.commentId)).taskId
      : null);
  if (!relatedTaskId) {
    throw new NotFoundError('Attachment is not linked to a task');
  }
  const task = await getTaskOrThrow(relatedTaskId);
  await authorizeOwnerOrPermission(ctx, 'task:update', { projectId: task.projectId }, [
    attachment.uploadedById,
  ]);
  await repo.deleteAttachment(id);
}
