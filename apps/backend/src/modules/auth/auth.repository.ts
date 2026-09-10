import type { Session, User } from '@prisma/client';
import { prisma, type Executor } from '@/shared/db';

/**
 * Auth data access. Pure persistence — no hashing, token, or policy logic
 * (those live in the service). Every method accepts an `Executor` so it can run
 * inside a transaction.
 */
export function findUserByEmail(
  email: string,
  db: Executor = prisma,
): Promise<User | null> {
  return db.user.findUnique({ where: { email } });
}

export function findUserById(
  id: string,
  db: Executor = prisma,
): Promise<User | null> {
  return db.user.findUnique({ where: { id } });
}

export function createUser(
  data: { email: string; name: string; passwordHash: string },
  db: Executor = prisma,
): Promise<User> {
  return db.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      statistics: { create: {} },
    },
  });
}

export function updateUserPassword(
  userId: string,
  passwordHash: string,
  db: Executor = prisma,
): Promise<User> {
  return db.user.update({ where: { id: userId }, data: { passwordHash } });
}

export function createSession(
  data: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
    ipAddress: string | null;
  },
  db: Executor = prisma,
): Promise<Session> {
  return db.session.create({ data });
}

export function findSessionById(
  id: string,
  db: Executor = prisma,
): Promise<Session | null> {
  return db.session.findUnique({ where: { id } });
}

export function updateSessionRefreshHash(
  id: string,
  refreshTokenHash: string,
  db: Executor = prisma,
): Promise<Session> {
  return db.session.update({ where: { id }, data: { refreshTokenHash } });
}

export async function revokeSession(
  id: string,
  db: Executor = prisma,
): Promise<void> {
  await db.session.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessionsExcept(
  userId: string,
  exceptSessionId: string | null,
  db: Executor = prisma,
): Promise<void> {
  await db.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

export function listActiveSessions(
  userId: string,
  db: Executor = prisma,
): Promise<Session[]> {
  return db.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
}
