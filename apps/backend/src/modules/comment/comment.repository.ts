import type { Attachment, Comment, Prisma } from '@prisma/client';
import { prisma, type Executor } from '@/shared/db';

/** Comment, mention & attachment data access. Pure persistence. */
export function findCommentById(
  id: string,
  db: Executor = prisma,
): Promise<Comment | null> {
  return db.comment.findUnique({ where: { id } });
}

export function createComment(
  data: { taskId: string; authorId: string; body: string; parentCommentId: string | null },
  db: Executor = prisma,
): Promise<Comment> {
  return db.comment.create({ data });
}

export function updateComment(
  id: string,
  data: Prisma.CommentUncheckedUpdateInput,
  db: Executor = prisma,
): Promise<Comment> {
  return db.comment.update({ where: { id }, data });
}

export async function deleteComment(
  id: string,
  db: Executor = prisma,
): Promise<void> {
  await db.comment.delete({ where: { id } });
}

export function listTaskCommentsPage(
  args: { taskId: string; take: number; cursor?: string },
  db: Executor = prisma,
): Promise<Comment[]> {
  return db.comment.findMany({
    where: { taskId: args.taskId, parentCommentId: null },
    orderBy: { createdAt: 'asc' },
    take: args.take,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
  });
}

export function countTaskComments(
  taskId: string,
  db: Executor = prisma,
): Promise<number> {
  return db.comment.count({ where: { taskId, parentCommentId: null } });
}

export async function createMentions(
  commentId: string,
  userIds: string[],
  db: Executor = prisma,
): Promise<void> {
  if (userIds.length === 0) {
    return;
  }
  await db.mention.createMany({
    data: userIds.map((mentionedUserId) => ({ commentId, mentionedUserId })),
    skipDuplicates: true,
  });
}

// --- Attachments ---

export function createAttachment(
  data: Prisma.AttachmentUncheckedCreateInput,
  db: Executor = prisma,
): Promise<Attachment> {
  return db.attachment.create({ data });
}

export function findAttachmentById(
  id: string,
  db: Executor = prisma,
): Promise<Attachment | null> {
  return db.attachment.findUnique({ where: { id } });
}

export async function deleteAttachment(
  id: string,
  db: Executor = prisma,
): Promise<void> {
  await db.attachment.delete({ where: { id } });
}
