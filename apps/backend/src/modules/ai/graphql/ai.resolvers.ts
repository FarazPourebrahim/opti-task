import type {
  AiApprovalStatus,
  AiRecommendation,
  AiRecommendationType,
  Project,
  User,
} from '@prisma/client';
import type { GraphQLContext } from '@/shared/graphql/context';
import type { Connection } from '@/shared/utils';
import * as aiService from '../ai.service.js';
import type {
  AssignmentCandidate,
  OverrideRecommendationInput,
} from '../ai.model.js';

export const aiResolvers = {
  Query: {
    aiRecommendation: (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<AiRecommendation> => aiService.getRecommendation(ctx, args.id),

    assignmentContext: (
      _parent: unknown,
      args: { taskId: string },
      ctx: GraphQLContext,
    ): Promise<{ taskId: string; candidates: AssignmentCandidate[] }> =>
      aiService.getAssignmentContext(ctx, args.taskId),
  },

  Mutation: {
    requestStoryPointEstimate: (
      _parent: unknown,
      args: { taskId: string },
      ctx: GraphQLContext,
    ): Promise<AiRecommendation> =>
      aiService.requestStoryPointEstimate(ctx, args.taskId),

    requestAssignmentRecommendation: (
      _parent: unknown,
      args: { taskId: string },
      ctx: GraphQLContext,
    ): Promise<AiRecommendation> =>
      aiService.requestAssignmentRecommendation(ctx, args.taskId),

    requestSprintHealthAnalysis: (
      _parent: unknown,
      args: { sprintId: string },
      ctx: GraphQLContext,
    ): Promise<AiRecommendation> =>
      aiService.requestSprintHealthAnalysis(ctx, args.sprintId),

    requestProgressTracking: (
      _parent: unknown,
      args: { sprintId: string },
      ctx: GraphQLContext,
    ): Promise<AiRecommendation> =>
      aiService.requestProgressTracking(ctx, args.sprintId),

    approveRecommendation: (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<AiRecommendation> => aiService.approveRecommendation(ctx, args.id),

    rejectRecommendation: (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<AiRecommendation> => aiService.rejectRecommendation(ctx, args.id),

    overrideRecommendation: (
      _parent: unknown,
      args: { id: string; input: OverrideRecommendationInput },
      ctx: GraphQLContext,
    ): Promise<AiRecommendation> =>
      aiService.overrideRecommendation(ctx, args.id, args.input),
  },

  Project: {
    aiRecommendations: (
      project: Project,
      args: {
        first?: number | null;
        after?: string | null;
        type?: AiRecommendationType | null;
        approvalStatus?: AiApprovalStatus | null;
      },
      ctx: GraphQLContext,
    ): Promise<Connection<AiRecommendation>> =>
      aiService.listProjectRecommendations(ctx, project.id, args),
  },

  AiRecommendation: {
    requestedBy: (
      rec: AiRecommendation,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<User | null> | null =>
      rec.requestedById ? ctx.loaders.userById.load(rec.requestedById) : null,

    approvedBy: (
      rec: AiRecommendation,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<User | null> | null =>
      rec.approvedById ? ctx.loaders.userById.load(rec.approvedById) : null,
  },

  AssignmentCandidate: {
    user: async (
      candidate: AssignmentCandidate,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<User | null> => ctx.loaders.userById.load(candidate.userId),
  },
};
