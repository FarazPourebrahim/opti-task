import type {
  AiApprovalStatus,
  AiRecommendation,
  AiRecommendationType,
  AiResolutionStatus,
  Prisma,
} from '@prisma/client';
import { prisma, type Executor } from '@shared/db';

/** AI recommendation data access. Pure persistence; rules live in the service. */
export function createRecommendation(
  data: Prisma.AiRecommendationUncheckedCreateInput,
  db: Executor = prisma,
): Promise<AiRecommendation> {
  return db.aiRecommendation.create({ data });
}

export function findById(
  id: string,
  db: Executor = prisma,
): Promise<AiRecommendation | null> {
  return db.aiRecommendation.findUnique({ where: { id } });
}

export function updateRecommendation(
  id: string,
  data: {
    approvalStatus: AiApprovalStatus;
    resolutionStatus: AiResolutionStatus;
    approvedById: string;
  },
  db: Executor = prisma,
): Promise<AiRecommendation> {
  return db.aiRecommendation.update({ where: { id }, data });
}

export function listProjectRecommendationsPage(
  args: {
    projectId: string;
    take: number;
    cursor?: string;
    type?: AiRecommendationType;
    approvalStatus?: AiApprovalStatus;
  },
  db: Executor = prisma,
): Promise<AiRecommendation[]> {
  return db.aiRecommendation.findMany({
    where: {
      projectId: args.projectId,
      ...(args.type ? { type: args.type } : {}),
      ...(args.approvalStatus ? { approvalStatus: args.approvalStatus } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: args.take,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
  });
}

export function countProjectRecommendations(
  projectId: string,
  filter: { type?: AiRecommendationType; approvalStatus?: AiApprovalStatus },
  db: Executor = prisma,
): Promise<number> {
  return db.aiRecommendation.count({
    where: {
      projectId,
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.approvalStatus ? { approvalStatus: filter.approvalStatus } : {}),
    },
  });
}
