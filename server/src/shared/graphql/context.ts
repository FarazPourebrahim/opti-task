import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@shared/db';
import { createLoaders, type Loaders } from './loaders.js';

/**
 * The authenticated principal attached to a request. Populated by the auth
 * middleware in Phase 3; `null` until then (and for anonymous operations).
 */
export type AuthenticatedUser = {
  id: string;
  email: string;
};

export type GraphQLContext = {
  requestId: string;
  prisma: PrismaClient;
  loaders: Loaders;
  user: AuthenticatedUser | null;
};

/**
 * Builds the per-request context. Loaders are instantiated here so each request
 * gets its own batching/caching window. `user` resolution is wired in Phase 3.
 */
export function createContext({
  req,
}: {
  req: IncomingMessage;
}): GraphQLContext {
  const headerRequestId = req.headers['x-request-id'];
  const requestId =
    typeof headerRequestId === 'string' ? headerRequestId : randomUUID();

  return {
    requestId,
    prisma,
    loaders: createLoaders(prisma),
    user: null,
  };
}
