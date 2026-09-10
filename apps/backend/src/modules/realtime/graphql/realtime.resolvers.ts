import type {
  AiRecommendation,
  Comment,
  Notification,
  Sprint,
  Task,
} from '@prisma/client';
import type { GraphQLContext } from '@/shared/graphql/context';
import { authorize, requireAuth } from '@/shared/auth';
import { NotFoundError } from '@/shared/errors';
import { subscribe, type RealtimeEvents } from '@/shared/pubsub';

/**
 * Resolves the project a task belongs to, for scoping `commentAdded` (which is
 * keyed by task) onto a project-level permission check.
 */
async function taskProjectId(ctx: GraphQLContext, taskId: string): Promise<string> {
  const task = await ctx.prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) {
    throw new NotFoundError('Task not found');
  }
  return task.projectId;
}

export const realtimeResolvers = {
  Subscription: {
    taskUpdated: {
      subscribe: async (
        _parent: unknown,
        args: { projectId: string },
        ctx: GraphQLContext,
      ): Promise<AsyncIterableIterator<RealtimeEvents['TASK_UPDATED']>> => {
        await authorize(ctx, 'task:read', { projectId: args.projectId });
        return subscribe('TASK_UPDATED', (payload) => payload.projectId === args.projectId);
      },
      resolve: (payload: RealtimeEvents['TASK_UPDATED']): RealtimeEvents['TASK_UPDATED'] =>
        payload,
    },

    commentAdded: {
      subscribe: async (
        _parent: unknown,
        args: { taskId: string },
        ctx: GraphQLContext,
      ): Promise<AsyncIterableIterator<RealtimeEvents['COMMENT_ADDED']>> => {
        const projectId = await taskProjectId(ctx, args.taskId);
        await authorize(ctx, 'task:read', { projectId });
        return subscribe('COMMENT_ADDED', (payload) => payload.taskId === args.taskId);
      },
      resolve: (payload: RealtimeEvents['COMMENT_ADDED']): RealtimeEvents['COMMENT_ADDED'] =>
        payload,
    },

    sprintUpdated: {
      subscribe: async (
        _parent: unknown,
        args: { projectId: string },
        ctx: GraphQLContext,
      ): Promise<AsyncIterableIterator<RealtimeEvents['SPRINT_UPDATED']>> => {
        await authorize(ctx, 'sprint:read', { projectId: args.projectId });
        return subscribe('SPRINT_UPDATED', (payload) => payload.projectId === args.projectId);
      },
      resolve: (payload: RealtimeEvents['SPRINT_UPDATED']): RealtimeEvents['SPRINT_UPDATED'] =>
        payload,
    },

    notificationReceived: {
      subscribe: (
        _parent: unknown,
        _args: unknown,
        ctx: GraphQLContext,
      ): AsyncIterableIterator<RealtimeEvents['NOTIFICATION_CREATED']> => {
        const user = requireAuth(ctx);
        return subscribe('NOTIFICATION_CREATED', (payload) => payload.recipientId === user.id);
      },
      resolve: (
        payload: RealtimeEvents['NOTIFICATION_CREATED'],
      ): RealtimeEvents['NOTIFICATION_CREATED'] => payload,
    },

    aiRecommendationUpdated: {
      subscribe: async (
        _parent: unknown,
        args: { projectId: string },
        ctx: GraphQLContext,
      ): Promise<AsyncIterableIterator<RealtimeEvents['AI_RECOMMENDATION_UPDATED']>> => {
        await authorize(ctx, 'task:read', { projectId: args.projectId });
        return subscribe(
          'AI_RECOMMENDATION_UPDATED',
          (payload) => payload.projectId === args.projectId,
        );
      },
      resolve: (
        payload: RealtimeEvents['AI_RECOMMENDATION_UPDATED'],
      ): RealtimeEvents['AI_RECOMMENDATION_UPDATED'] => payload,
    },
  },

  TaskEvent: {
    task: (
      event: RealtimeEvents['TASK_UPDATED'],
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<Task | null> => ctx.prisma.task.findUnique({ where: { id: event.taskId } }),
  },

  CommentEvent: {
    comment: (
      event: RealtimeEvents['COMMENT_ADDED'],
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<Comment | null> =>
      ctx.prisma.comment.findUnique({ where: { id: event.commentId } }),
  },

  SprintEvent: {
    sprint: (
      event: RealtimeEvents['SPRINT_UPDATED'],
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<Sprint | null> => ctx.prisma.sprint.findUnique({ where: { id: event.sprintId } }),
  },

  NotificationEvent: {
    notification: (
      event: RealtimeEvents['NOTIFICATION_CREATED'],
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<Notification | null> =>
      ctx.prisma.notification.findUnique({ where: { id: event.notificationId } }),
  },

  AiRecommendationEvent: {
    recommendation: (
      event: RealtimeEvents['AI_RECOMMENDATION_UPDATED'],
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<AiRecommendation | null> =>
      ctx.prisma.aiRecommendation.findUnique({ where: { id: event.recommendationId } }),
  },
};
