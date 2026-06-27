import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@shared/db';
import { verifyAccessToken } from '@shared/auth/tokens';
import { ACCESS_COOKIE } from '@shared/auth/cookies';
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

function resolveUser(req: Request): AuthenticatedUser | null {
  const token = readAccessToken(req);
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

export function createContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): GraphQLContext {
  const headerRequestId = req.headers['x-request-id'];
  const requestId =
    typeof headerRequestId === 'string' ? headerRequestId : randomUUID();

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
