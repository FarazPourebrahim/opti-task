import type { User, UserExpertise } from '@prisma/client';
import type { GraphQLContext } from '@/shared/graphql/context';
import type { Connection, SortDirection } from '@/shared/utils';
import * as userService from '../user.service.js';
import type { UserFilter } from '../user.model.js';

type UserStatisticsView = {
  completedTasks: number;
  avgCompletionSeconds: number | null;
  velocity: number | null;
  historicalStoryPoints: number;
};

type UserTeamMembershipView = {
  teamId: string;
  teamName: string;
  role: string;
  availability: string;
  workload: number;
};

const EMPTY_STATISTICS: UserStatisticsView = {
  completedTasks: 0,
  avgCompletionSeconds: null,
  velocity: null,
  historicalStoryPoints: 0,
};

export const userResolvers = {
  Query: {
    user: (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<User> => userService.getUser(ctx, args.id),

    users: (
      _parent: unknown,
      args: {
        first?: number | null;
        after?: string | null;
        orderBy?: SortDirection | null;
        filter?: UserFilter | null;
      },
      ctx: GraphQLContext,
    ): Promise<Connection<User>> => userService.listUsers(ctx, args),
  },

  Mutation: {
    updateProfile: (
      _parent: unknown,
      args: { input: unknown },
      ctx: GraphQLContext,
    ): Promise<User> => userService.updateProfile(ctx, args.input),

    addSkill: (
      _parent: unknown,
      args: { skill: string },
      ctx: GraphQLContext,
    ): Promise<User> => userService.addSkill(ctx, args.skill),

    removeSkill: (
      _parent: unknown,
      args: { skill: string },
      ctx: GraphQLContext,
    ): Promise<User> => userService.removeSkill(ctx, args.skill),

    addExpertise: (
      _parent: unknown,
      args: { input: unknown },
      ctx: GraphQLContext,
    ): Promise<User> => userService.addExpertise(ctx, args.input),

    removeExpertise: (
      _parent: unknown,
      args: { tag: string },
      ctx: GraphQLContext,
    ): Promise<User> => userService.removeExpertise(ctx, args.tag),
  },

  User: {
    organizationCount: (
      user: User,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<number> => ctx.loaders.organizationCountByUserId.load(user.id),

    skills: (user: User, _args: unknown, ctx: GraphQLContext): Promise<string[]> =>
      ctx.loaders.skillsByUserId.load(user.id),

    expertise: (
      user: User,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<UserExpertise[]> => ctx.loaders.expertiseByUserId.load(user.id),

    statistics: async (
      user: User,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<UserStatisticsView> => {
      const stats = await ctx.loaders.statisticsByUserId.load(user.id);
      if (!stats) {
        return EMPTY_STATISTICS;
      }
      return {
        completedTasks: stats.completedTasks,
        avgCompletionSeconds:
          stats.avgCompletionSeconds === null
            ? null
            : Number(stats.avgCompletionSeconds),
        velocity: stats.velocity,
        historicalStoryPoints: stats.historicalStoryPoints,
      };
    },

    teamMemberships: async (
      user: User,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<UserTeamMembershipView[]> => {
      const memberships = await ctx.loaders.teamMembershipsByUserId.load(user.id);
      return memberships.map((membership) => ({
        teamId: membership.teamId,
        teamName: membership.team.name,
        role: membership.role,
        availability: membership.availability,
        workload: membership.workload,
      }));
    },
  },
};
