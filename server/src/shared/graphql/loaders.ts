import DataLoader from 'dataloader';
import type { PrismaClient, User } from '@prisma/client';

/**
 * Per-request DataLoaders. Created fresh for every request (never shared across
 * requests, to avoid leaking data between users) and attached to the GraphQL
 * context. Batch functions must return results in the SAME order as the input
 * keys — that ordering contract is what lets DataLoader collapse N+1 queries.
 */
export type Loaders = {
  userById: DataLoader<string, User | null>;
  organizationCountByUserId: DataLoader<string, number>;
};

export function createLoaders(prisma: PrismaClient): Loaders {
  return {
    userById: new DataLoader<string, User | null>(async (ids) => {
      const users = await prisma.user.findMany({
        where: { id: { in: [...ids] } },
      });
      const byId = new Map(users.map((user) => [user.id, user]));
      return ids.map((id) => byId.get(id) ?? null);
    }),

    organizationCountByUserId: new DataLoader<string, number>(async (ids) => {
      const grouped = await prisma.organizationMember.groupBy({
        by: ['userId'],
        where: { userId: { in: [...ids] } },
        _count: { userId: true },
      });
      const byId = new Map(grouped.map((row) => [row.userId, row._count.userId]));
      return ids.map((id) => byId.get(id) ?? 0);
    }),
  };
}
