import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/shared/db';
import { verifyAccessToken } from '@/shared/auth/tokens';
import { ACCESS_COOKIE } from '@/shared/auth/cookies';
import { createLoaders, type Loaders } from './loaders.js';

/**
 * The authenticated principal attached to a request, derived from a valid access
 * token. `null` for anonymous requests or invalid/expired tokens — protected
 * resolvers enforce presence via `requireAuth`.
 */
export type AuthenticatedUser = {
  id: string;
  email: string;
  sessionId: string;
};

export type GraphQLContext = {
  requestId: string;
  prisma: PrismaClient;
  loaders: Loaders;
  user: AuthenticatedUser | null;
  res: Response;
  cookies: Record<string, string>;
  userAgent: string | null;
  ipAddress: string | null;
};

function readAccessToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[ACCESS_COOKIE] ?? null;
}

function resolveUserFromToken(token: string | null): AuthenticatedUser | null {
  if (!token) {
    return null;
  }
  try {
    const payload = verifyAccessToken(token);
    return { id: payload.sub, email: payload.email, sessionId: payload.sid };
  } catch {
    // Invalid/expired tokens yield an anonymous context, not a hard error.
    return null;
  }
}

function resolveUser(req: Request): AuthenticatedUser | null {
  return resolveUserFromToken(readAccessToken(req));
}

/**
 * Builds the per-operation context for a WebSocket subscription. The socket
 * authenticates via `connectionParams.authorization` (a Bearer token). There is
 * no HTTP response to write to, so `res`/`cookies` are inert here — subscription
 * resolvers only read `user`, `prisma`, and `loaders`.
 */
export function createSubscriptionContext(connectionParams: unknown): GraphQLContext {
  const params = (connectionParams ?? {}) as Record<string, unknown>;
  const header = params.authorization ?? params.Authorization;
  const token =
    typeof header === 'string' && header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : null;

  return {
    requestId: randomUUID(),
    prisma,
    loaders: createLoaders(prisma),
    user: resolveUserFromToken(token),
    // BOUNDARY: no HTTP response object exists for a WS subscription; resolvers
    // in this path never touch `res`/`cookies`.
    res: undefined as unknown as Response,
    cookies: {},
    userAgent: null,
    ipAddress: null,
  };
}

export function createContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): GraphQLContext {
  // `requestLogger` assigns the request id (validating any client-supplied
  // `x-request-id` before trusting it) and echoes it in the response header.
  // Reusing it here means resolver-scoped lines correlate with the request log.
  // The fallback only applies to a synthetic context built without the logger.
  const assignedRequestId = (req as Request & { id?: string | number }).id;
  const requestId =
    assignedRequestId === undefined ? randomUUID() : String(assignedRequestId);

  const cookies =
    (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
  const userAgent = req.headers['user-agent'] ?? null;

  return {
    requestId,
    prisma,
    loaders: createLoaders(prisma),
    user: resolveUser(req),
    res,
    cookies,
    userAgent,
    ipAddress: req.ip ?? null,
  };
}
