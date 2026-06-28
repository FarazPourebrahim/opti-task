import type { Project, User } from '@prisma/client';
import type { GraphQLContext } from '@shared/graphql/context';
import { AuthError } from '@shared/errors';
import * as analyticsService from './analytics.service.js';
import type {
  IndividualWorkload,
  ProjectAnalytics,
  UserAnalytics,
} from './analytics.model.js';

export const analyticsResolvers = {
  Query: {
    projectAnalytics: (
      _parent: unknown,
      args: { projectId: string },
      ctx: GraphQLContext,
    ): Promise<ProjectAnalytics> =>
      analyticsService.getProjectAnalytics(ctx, args.projectId),

    userAnalytics: (
      _parent: unknown,
      args: { userId: string },
      ctx: GraphQLContext,
    ): Promise<UserAnalytics> => analyticsService.getUserAnalytics(ctx, args.userId),
  },

  Mutation: {
    recomputeUserStatistics: (
      _parent: unknown,
      args: { userId: string },
      ctx: GraphQLContext,
    ): Promise<User> => analyticsService.recomputeUserStatistics(ctx, args.userId),
  },

  Project: {
    analytics: (
      project: Project,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<ProjectAnalytics> =>
      analyticsService.getProjectAnalytics(ctx, project.id),
  },

  User: {
    analytics: (
      user: User,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<UserAnalytics> => analyticsService.getUserAnalytics(ctx, user.id),
  },

  IndividualWorkload: {
    user: async (
      workload: IndividualWorkload,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<User> => {
      const user = await ctx.loaders.userById.load(workload.assigneeId);
      if (!user) {
        throw new AuthError('Workload user not found');
      }
      return user;
    },
  },
};
