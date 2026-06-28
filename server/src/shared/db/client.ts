import { PrismaClient } from '@prisma/client';
import { isProduction } from '@shared/config';

/**
 * Singleton Prisma client. In dev, `tsx watch` reloads the module graph on every
 * change; caching the client on `globalThis` prevents exhausting DB connections
 * with a new client per reload.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error'] : ['error', 'warn'],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
