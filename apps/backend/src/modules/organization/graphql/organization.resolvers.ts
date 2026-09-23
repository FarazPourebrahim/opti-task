import type {
  Organization,
  OrganizationInvitation,
  OrganizationMember,
  User,
} from '@prisma/client';
import type { GraphQLContext } from '@/shared/graphql/context';
import type { Connection } from '@/shared/utils';
import { AuthError } from '@/shared/errors';
import * as orgService from '../organization.service.js';

export const organizationResolvers = {
  Query: {
    organization: (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<Organization> => orgService.getOrganization(ctx, args.id),

    myOrganizations: (
      _parent: unknown,
      args: { first?: number | null; after?: string | null },
      ctx: GraphQLContext,
    ): Promise<Connection<Organization>> =>
      orgService.listMyOrganizations(ctx, args),

    organizationInvitations: (
      _parent: unknown,
      args: { organizationId: string },
      ctx: GraphQLContext,
    ): Promise<OrganizationInvitation[]> =>
      orgService.listInvitations(ctx, args.organizationId),
  },

  Mutation: {
    createOrganization: (
      _parent: unknown,
      args: { input: unknown },
      ctx: GraphQLContext,
    ): Promise<Organization> => orgService.createOrganization(ctx, args.input),

    updateOrganization: (
      _parent: unknown,
      args: { id: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<Organization> =>
      orgService.updateOrganization(ctx, args.id, args.input),

    deleteOrganization: async (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      await orgService.deleteOrganization(ctx, args.id);
      return true;
    },

    inviteToOrganization: (
      _parent: unknown,
      args: { organizationId: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<OrganizationInvitation> =>
      orgService.inviteMember(ctx, args.organizationId, args.input),

    acceptInvitation: (
      _parent: unknown,
      args: { token: string },
      ctx: GraphQLContext,
    ): Promise<OrganizationMember> =>
      orgService.acceptInvitation(ctx, args.token),

    revokeInvitation: async (
      _parent: unknown,
      args: { invitationId: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      await orgService.revokeInvitation(ctx, args.invitationId);
      return true;
    },

    updateMemberRole: (
      _parent: unknown,
      args: { organizationId: string; userId: string; role: unknown },
      ctx: GraphQLContext,
    ): Promise<OrganizationMember> =>
      orgService.updateMemberRole(
        ctx,
        args.organizationId,
        args.userId,
        args.role,
      ),

    removeMember: async (
      _parent: unknown,
      args: { organizationId: string; userId: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      await orgService.removeMember(ctx, args.organizationId, args.userId);
      return true;
    },
  },

  Organization: {
    owner: async (
      org: Organization,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<User> => {
      const owner = await ctx.loaders.userById.load(org.ownerId);
      if (!owner) {
        throw new AuthError('Organization owner not found');
      }
      return owner;
    },

    members: (
      org: Organization,
      args: { first?: number | null; after?: string | null },
      ctx: GraphQLContext,
    ): Promise<Connection<OrganizationMember>> =>
      orgService.listMembers(ctx, org.id, args),

    memberCount: (
      org: Organization,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<number> =>
      ctx.prisma.organizationMember.count({
        where: { organizationId: org.id },
      }),

    projectCount: (
      org: Organization,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<number> =>
      ctx.prisma.project.count({ where: { organizationId: org.id } }),
  },

  OrganizationMember: {
    user: async (
      member: OrganizationMember,
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
