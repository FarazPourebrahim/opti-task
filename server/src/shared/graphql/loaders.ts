import DataLoader from 'dataloader';
import type {
  PrismaClient,
  Team,
  TeamMember,
  User,
  UserExpertise,
  UserStatistics,
} from '@prisma/client';

/**
 * Per-request DataLoaders. Created fresh for every request (never shared across
 * requests, to avoid leaking data between users) and attached to the GraphQL
 * context. Batch functions must return results in the SAME order as the input
 * keys — that ordering contract is what lets DataLoader collapse N+1 queries.
 */
export type TeamMembershipWithTeam = TeamMember & { team: Team };

export type Loaders = {
  userById: DataLoader<string, User | null>;
  organizationCountByUserId: DataLoader<string, number>;
  expertiseByUserId: DataLoader<string, UserExpertise[]>;
  skillsByUserId: DataLoader<string, string[]>;
  statisticsByUserId: DataLoader<string, UserStatistics | null>;
  teamMembershipsByUserId: DataLoader<string, TeamMembershipWithTeam[]>;
};

function groupByUserId<T extends { userId: string }>(
  ids: ReadonlyArray<string>,
  rows: T[],
): T[][] {
  const byUser = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = byUser.get(row.userId);
    if (bucket) {
      bucket.push(row);
    } else {
      byUser.set(row.userId, [row]);
    }
  }
  return ids.map((id) => byUser.get(id) ?? []);
}

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

    expertiseByUserId: new DataLoader<string, UserExpertise[]>(async (ids) => {
      const rows = await prisma.userExpertise.findMany({
        where: { userId: { in: [...ids] } },
        orderBy: { confidenceScore: 'desc' },
      });
      return groupByUserId(ids, rows);
    }),

    skillsByUserId: new DataLoader<string, string[]>(async (ids) => {
      const rows = await prisma.userSkill.findMany({
        where: { userId: { in: [...ids] } },
        orderBy: { skill: 'asc' },
      });
      return groupByUserId(ids, rows).map((skills) =>
        skills.map((row) => row.skill),
      );
    }),

    statisticsByUserId: new DataLoader<string, UserStatistics | null>(
      async (ids) => {
        const rows = await prisma.userStatistics.findMany({
          where: { userId: { in: [...ids] } },
        });
        const byId = new Map(rows.map((row) => [row.userId, row]));
        return ids.map((id) => byId.get(id) ?? null);
      },
    ),

    teamMembershipsByUserId: new DataLoader<string, TeamMembershipWithTeam[]>(
      async (ids) => {
        const rows = await prisma.teamMember.findMany({
          where: { userId: { in: [...ids] } },
          include: { team: true },
          orderBy: { createdAt: 'desc' },
        });
        return groupByUserId(ids, rows);
      },
    ),
  };
}
