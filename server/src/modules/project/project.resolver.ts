import type {
  Organization,
  Project,
  ProjectMember,
  ProjectState,
  User,
} from '@prisma/client';
import type { GraphQLContext } from '@shared/graphql/context';
import type { Connection } from '@shared/utils';
import { AuthError } from '@shared/errors';
import * as projectService from './project.service.js';

const EMPTY_SETTINGS = { workflow: {}, settings: {} };

export const projectResolvers = {
  Query: {
    project: (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<Project> => projectService.getProject(ctx, args.id),
  },

  Mutation: {
    createProject: (
      _parent: unknown,
      args: { organizationId: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<Project> =>
      projectService.createProject(ctx, args.organizationId, args.input),

    updateProject: (
      _parent: unknown,
      args: { id: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<Project> => projectService.updateProject(ctx, args.id, args.input),

    changeProjectStatus: (
      _parent: unknown,
      args: { id: string; status: ProjectState },
      ctx: GraphQLContext,
    ): Promise<Project> =>
      projectService.changeProjectStatus(ctx, args.id, args.status),

    deleteProject: async (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      await projectService.deleteProject(ctx, args.id);
      return true;
    },

    configureWorkflow: (
      _parent: unknown,
      args: { id: string; workflow: unknown },
      ctx: GraphQLContext,
    ): Promise<Project> =>
      projectService.configureWorkflow(ctx, args.id, args.workflow),

    addProjectMember: (
      _parent: unknown,
      args: { projectId: string; userId: string; role: unknown },
      ctx: GraphQLContext,
    ): Promise<ProjectMember> =>
      projectService.addMember(ctx, args.projectId, args.userId, args.role),

    updateProjectMemberRole: (
      _parent: unknown,
      args: { projectId: string; userId: string; role: unknown },
      ctx: GraphQLContext,
    ): Promise<ProjectMember> =>
      projectService.updateMemberRole(
        ctx,
        args.projectId,
        args.userId,
        args.role,
      ),

    removeProjectMember: async (
      _parent: unknown,
      args: { projectId: string; userId: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      await projectService.removeMember(ctx, args.projectId, args.userId);
      return true;
    },
  },

  Organization: {
    projects: (
      org: Organization,
      args: { first?: number | null; after?: string | null; status?: ProjectState | null },
      ctx: GraphQLContext,
    ): Promise<Connection<Project>> =>
      projectService.listOrganizationProjects(ctx, org.id, args),
  },

  Project: {
    settings: async (
      project: Project,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<{ workflow: unknown; settings: unknown }> => {
      const row = await ctx.loaders.projectSettingsByProjectId.load(project.id);
      if (!row) {
        return EMPTY_SETTINGS;
      }
      return { workflow: row.workflow, settings: row.settings };
    },

    members: (
      project: Project,
      args: { first?: number | null; after?: string | null },
      ctx: GraphQLContext,
    ): Promise<Connection<ProjectMember>> =>
      projectService.listMembers(ctx, project.id, args),

    memberCount: (
      project: Project,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<number> =>
      ctx.prisma.projectMember.count({ where: { projectId: project.id } }),
  },

  ProjectMember: {
    user: async (
      member: ProjectMember,
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
