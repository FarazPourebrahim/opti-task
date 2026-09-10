import type { Notification } from '@prisma/client';
import type { GraphQLContext } from '@/shared/graphql/context';
import type { Connection } from '@/shared/utils';
import * as notificationService from '../notification.service.js';

export const notificationResolvers = {
  Query: {
    myNotifications: (
      _parent: unknown,
      args: { first?: number | null; after?: string | null; unreadOnly?: boolean | null },
      ctx: GraphQLContext,
    ): Promise<Connection<Notification>> =>
      notificationService.listMyNotifications(ctx, args),

    unreadNotificationCount: (
      _parent: unknown,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<number> => notificationService.unreadCount(ctx),
  },

  Mutation: {
    markNotificationRead: (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<Notification> => notificationService.markRead(ctx, args.id),

    markAllNotificationsRead: (
      _parent: unknown,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<number> => notificationService.markAllRead(ctx),
  },

  Notification: {
    read: (notification: Notification): boolean => notification.readAt !== null,
  },
};
