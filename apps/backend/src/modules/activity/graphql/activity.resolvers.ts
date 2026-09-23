import type { ActivityLog, Task, User } from '@prisma/client';
import type { GraphQLContext } from '@/shared/graphql/context';
import type { Connection } from '@/shared/utils';
import * as activityService from '../activity.service.js';

export const activityResolvers = {
  Task: {
    activities: (
      task: Task,
      args: { first?: number | null; after?: string | null },
      ctx: GraphQLContext,
    ): Promise<Connection<ActivityLog>> =>
      activityService.listTaskActivities(ctx, task.id, args),
  },

  ActivityLog: {
    actor: (
      activity: ActivityLog,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<User | null> | null =>
      activity.actorId ? ctx.loaders.userById.load(activity.actorId) : null,
  },
};
