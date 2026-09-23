import type { Attachment, Comment, Task, User } from '@prisma/client';
import type { GraphQLContext } from '@/shared/graphql/context';
import type { Connection } from '@/shared/utils';
import { AuthError } from '@/shared/errors';
import { getStorageAdapter } from '@/shared/storage';
import * as commentService from '../comment.service.js';

export const commentResolvers = {
  Query: {
    comment: (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<Comment> => commentService.getComment(ctx, args.id),
  },

  Mutation: {
    createComment: (
      _parent: unknown,
      args: { taskId: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<Comment> => commentService.createComment(ctx, args.taskId, args.input),

    editComment: (
      _parent: unknown,
      args: { id: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<Comment> => commentService.editComment(ctx, args.id, args.input),

    resolveComment: (
      _parent: unknown,
      args: { id: string; resolved: boolean },
      ctx: GraphQLContext,
    ): Promise<Comment> =>
      commentService.resolveComment(ctx, args.id, args.resolved),

    deleteComment: async (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      await commentService.deleteComment(ctx, args.id);
      return true;
    },

    addTaskAttachment: (
      _parent: unknown,
      args: { taskId: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<Attachment> =>
      commentService.addTaskAttachment(ctx, args.taskId, args.input),

    addCommentAttachment: (
      _parent: unknown,
      args: { commentId: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<Attachment> =>
      commentService.addCommentAttachment(ctx, args.commentId, args.input),

    removeAttachment: async (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      await commentService.removeAttachment(ctx, args.id);
      return true;
    },
  },

  Task: {
    comments: (
      task: Task,
      args: { first?: number | null; after?: string | null },
      ctx: GraphQLContext,
    ): Promise<Connection<Comment>> =>
      commentService.listTaskComments(ctx, task.id, args),

    commentCount: (
      task: Task,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<number> =>
      ctx.prisma.comment.count({ where: { taskId: task.id, parentCommentId: null } }),

    attachments: (
      task: Task,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<Attachment[]> => ctx.loaders.attachmentsByTaskId.load(task.id),
  },

  Comment: {
    edited: (comment: Comment): boolean => comment.editedAt !== null,

    author: async (
      comment: Comment,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<User> => {
      const user = await ctx.loaders.userById.load(comment.authorId);
      if (!user) {
        throw new AuthError('Comment author not found');
      }
      return user;
    },

    mentions: (
      comment: Comment,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<User[]> => ctx.loaders.mentionedUsersByCommentId.load(comment.id),

    replies: (
      comment: Comment,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<Comment[]> => ctx.loaders.repliesByCommentId.load(comment.id),

    attachments: (
      comment: Comment,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<Attachment[]> => ctx.loaders.attachmentsByCommentId.load(comment.id),
  },

  Attachment: {
    sizeBytes: (attachment: Attachment): number | null =>
      attachment.sizeBytes === null ? null : Number(attachment.sizeBytes),

    url: (attachment: Attachment): string =>
      getStorageAdapter().getUrl(attachment.storageKey),

    uploadedBy: async (
      attachment: Attachment,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<User> => {
      const user = await ctx.loaders.userById.load(attachment.uploadedById);
      if (!user) {
        throw new AuthError('Uploader not found');
      }
      return user;
    },
  },
};
