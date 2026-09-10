import type { Prisma } from '@prisma/client';
import { prisma } from './client.js';

/**
 * A database executor: either the root client or a transaction-scoped client.
 * Repositories accept an `Executor` so the same method runs inside or outside a
 * transaction (pass the `tx` from `withTransaction`).
 */
export type Executor = typeof prisma | Prisma.TransactionClient;

/**
 * Runs `fn` inside a single interactive transaction. Prisma commits on success
 * and rolls back if `fn` throws — the guarantee the spec requires for critical
 * operations (assignments, AI approvals, sprint moves).
 */
export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction((tx) => fn(tx));
}
