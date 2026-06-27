import DataLoader from 'dataloader';
import type {
  Label,
  PrismaClient,
  ProjectSettings,
  Task,
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
  teamsByProjectId: DataLoader<string, Team[]>;
  teamMembersByTeamId: DataLoader<string, TeamMember[]>;
  projectSettingsByProjectId: DataLoader<string, ProjectSettings | null>;
  labelsByTaskId: DataLoader<string, Label[]>;
  watchersByTaskId: DataLoader<string, User[]>;
  dependsOnByTaskId: DataLoader<string, Task[]>;
};

function groupBy<K, T>(keys: ReadonlyArray<K>, rows: T[], keyOf: (row: T) => K): T[][] {
  const buckets = new Map<K, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      buckets.set(key, [row]);
    }
  }
  return keys.map((key) => buckets.get(key) ?? []);
}

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

    teamsByProjectId: new DataLoader<string, Team[]>(async (ids) => {
      const rows = await prisma.team.findMany({
        where: { projectId: { in: [...ids] } },
        orderBy: { createdAt: 'asc' },
      });
      const byProject = new Map<string, Team[]>();
      for (const row of rows) {
        const bucket = byProject.get(row.projectId);
        if (bucket) {
          bucket.push(row);
        } else {
          byProject.set(row.projectId, [row]);
        }
      }
      return ids.map((id) => byProject.get(id) ?? []);
    }),

    teamMembersByTeamId: new DataLoader<string, TeamMember[]>(async (ids) => {
      const rows = await prisma.teamMember.findMany({
        where: { teamId: { in: [...ids] } },
        orderBy: { createdAt: 'asc' },
      });
      const byTeam = new Map<string, TeamMember[]>();
      for (const row of rows) {
        const bucket = byTeam.get(row.teamId);
        if (bucket) {
          bucket.push(row);
        } else {
          byTeam.set(row.teamId, [row]);
        }
      }
      return ids.map((id) => byTeam.get(id) ?? []);
    }),

    projectSettingsByProjectId: new DataLoader<string, ProjectSettings | null>(
      async (ids) => {
        const rows = await prisma.projectSettings.findMany({
          where: { projectId: { in: [...ids] } },
        });
        const byProject = new Map(rows.map((row) => [row.projectId, row]));
        return ids.map((id) => byProject.get(id) ?? null);
      },
    ),

    labelsByTaskId: new DataLoader<string, Label[]>(async (ids) => {
      const rows = await prisma.taskLabel.findMany({
        where: { taskId: { in: [...ids] } },
        include: { label: true },
        orderBy: { label: { name: 'asc' } },
      });
      return groupBy(ids, rows, (row) => row.taskId).map((group) =>
        group.map((row) => row.label),
      );
    }),

    watchersByTaskId: new DataLoader<string, User[]>(async (ids) => {
      const rows = await prisma.taskWatcher.findMany({
        where: { taskId: { in: [...ids] } },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      });
      return groupBy(ids, rows, (row) => row.taskId).map((group) =>
        group.map((row) => row.user),
      );
    }),

    dependsOnByTaskId: new DataLoader<string, Task[]>(async (ids) => {
      const rows = await prisma.taskDependency.findMany({
        where: { taskId: { in: [...ids] } },
        include: { dependsOn: true },
        orderBy: { createdAt: 'asc' },
      });
      return groupBy(ids, rows, (row) => row.taskId).map((group) =>
        group.map((row) => row.dependsOn),
      );
    }),
  };
}
