import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from './client.js';
import { withTransaction } from './transaction.js';

/**
 * Integration tests — require a migrated Postgres reachable via DATABASE_URL.
 * They prove the commit and rollback guarantees of `withTransaction`.
 */
const uniqueEmail = (suffix: string): string =>
  `tx-test+${suffix}-${Date.now()}@optitask.test`;

describe('withTransaction', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: '@optitask.test' } },
    });
    await prisma.$disconnect();
  });

  it('commits all writes when the callback succeeds', async () => {
    // Arrange
    const email = uniqueEmail('commit');

    // Act
    const created = await withTransaction(async (tx) => {
      return tx.user.create({
        data: { email, name: 'Commit User', passwordHash: 'x' },
      });
    });

    // Assert
    const found = await prisma.user.findUnique({ where: { id: created.id } });
    expect(found).not.toBeNull();
    expect(found?.email).toBe(email);
  });

  it('rolls back all writes when the callback throws', async () => {
    // Arrange
    const email = uniqueEmail('rollback');

    // Act
    const attempt = withTransaction(async (tx) => {
      await tx.user.create({
        data: { email, name: 'Rollback User', passwordHash: 'x' },
      });
      throw new Error('forced failure after write');
    });

    // Assert
    await expect(attempt).rejects.toThrow('forced failure after write');
    const found = await prisma.user.findUnique({ where: { email } });
    expect(found).toBeNull();
  });
});
