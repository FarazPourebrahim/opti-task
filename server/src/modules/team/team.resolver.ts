import type { Project, Team, TeamMember, User } from '@prisma/client';
import type { GraphQLContext } from '@shared/graphql/context';
import { AuthError } from '@shared/errors';
import * as teamService from './team.service.js';

export const teamResolvers = {
  Query: {
    team: (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<Team> => teamService.getTeam(ctx, args.id),
  },

  Mutation: {
    createTeam: (
      _parent: unknown,
      args: { projectId: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<Team> => teamService.createTeam(ctx, args.projectId, args.input),

    updateTeam: (
      _parent: unknown,
      args: { id: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<Team> => teamService.updateTeam(ctx, args.id, args.input),

    deleteTeam: async (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      await teamService.deleteTeam(ctx, args.id);
      return true;
    },

    addTeamMember: (
      _parent: unknown,
      args: { teamId: string; userId: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<TeamMember> =>
      teamService.addMember(ctx, args.teamId, args.userId, args.input),

    updateTeamMember: (
      _parent: unknown,
      args: { teamId: string; userId: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<TeamMember> =>
      teamService.updateMember(ctx, args.teamId, args.userId, args.input),

    removeTeamMember: async (
      _parent: unknown,
      args: { teamId: string; userId: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      await teamService.removeMember(ctx, args.teamId, args.userId);
      return true;
    },
  },

  Project: {
    teams: (
      project: Project,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<Team[]> => ctx.loaders.teamsByProjectId.load(project.id),

    teamCount: (
      project: Project,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<number> =>
      ctx.prisma.team.count({ where: { projectId: project.id } }),
  },

  Team: {
    members: (
      team: Team,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<TeamMember[]> => ctx.loaders.teamMembersByTeamId.load(team.id),

    memberCount: (
      team: Team,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<number> =>
      ctx.prisma.teamMember.count({ where: { teamId: team.id } }),
  },

  TeamMember: {
    user: async (
      member: TeamMember,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<User> => {
      const user = await ctx.loaders.userById.load(member.userId);
      if (!user) {
        throw new AuthError('Member user not found');
      }
      return user;
    },
  },
};
