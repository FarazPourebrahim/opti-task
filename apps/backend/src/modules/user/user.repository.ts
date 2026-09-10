import type { Prisma, User } from '@prisma/client';
import { prisma, type Executor } from '@/shared/db';

/**
 * User data access. Pure persistence; validation/authorization live in the
 * service. The `User` row is the canonical profile; expertise/skills/statistics
 * live in their own tables and are batch-loaded via DataLoaders for reads.
 */
export function findUserById(
  id: string,
  db: Executor = prisma,
): Promise<User | null> {
  return db.user.findUnique({ where: { id } });
}

export function findUsersPage(
  args: {
    where: Prisma.UserWhereInput;
    orderBy: Prisma.UserOrderByWithRelationInput;
    take: number;
    cursor?: string;
  },
  db: Executor = prisma,
): Promise<User[]> {
  return db.user.findMany({
    where: args.where,
    orderBy: args.orderBy,
    take: args.take,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
  });
}

export function countUsers(
  where: Prisma.UserWhereInput,
  db: Executor = prisma,
): Promise<number> {
  return db.user.count({ where });
}

export function updateUser(
  id: string,
  data: Prisma.UserUpdateInput,
  db: Executor = prisma,
): Promise<User> {
  return db.user.update({ where: { id }, data });
}

export async function addSkill(
  userId: string,
  skill: string,
  db: Executor = prisma,
): Promise<void> {
  await db.userSkill.upsert({
    where: { userId_skill: { userId, skill } },
    update: {},
    create: { userId, skill },
  });
}

export async function removeSkill(
  userId: string,
  skill: string,
  db: Executor = prisma,
): Promise<void> {
  await db.userSkill.deleteMany({ where: { userId, skill } });
}

export async function upsertExpertise(
  userId: string,
  tag: string,
  confidenceScore: number,
  db: Executor = prisma,
): Promise<void> {
  await db.userExpertise.upsert({
    where: { userId_tag: { userId, tag } },
    update: { confidenceScore },
    create: { userId, tag, confidenceScore },
  });
}

export async function removeExpertise(
  userId: string,
  tag: string,
  db: Executor = prisma,
): Promise<void> {
  await db.userExpertise.deleteMany({ where: { userId, tag } });
}
