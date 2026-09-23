import { randomUUID } from 'node:crypto';
import { Prisma, type Session, type User } from '@prisma/client';
import { prisma, withTransaction, type Executor } from '@/shared/db';
import { env } from '@/shared/config';
import { logger, logSecurityEvent } from '@/shared/logger';
import {
  AuthError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  refreshHashMatches,
} from '@/shared/auth';
import { durationToMs } from '@/shared/utils';
import type { GraphQLContext } from '@/shared/graphql/context';
import * as repo from './auth.repository.js';
import {
  validateChangePassword,
  validateLogin,
  validateRegister,
  normalizeEmail,
} from './auth.validation.js';
import type {
  AuthResult,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  SessionMetadata,
} from './auth.model.js';

function refreshTtlMs(): number {
  return durationToMs(env.JWT_REFRESH_TTL);
}

/**
 * Creates a fresh session row and the access/refresh token pair bound to it.
 * Only the refresh token's hash is persisted.
 */
async function createSessionAndTokens(
  user: User,
  meta: SessionMetadata,
  db: Executor = prisma,
): Promise<AuthResult> {
  const sessionId = randomUUID();
  const refreshToken = signRefreshToken({ userId: user.id, sessionId });
  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    sessionId,
  });

  await repo.createSession(
    {
      id: sessionId,
      userId: user.id,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTtlMs()),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    },
    db,
  );

  return { accessToken, refreshToken, user };
}

export async function register(
  rawInput: RegisterInput,
  meta: SessionMetadata,
): Promise<AuthResult> {
  const input = validateRegister(rawInput);

  const existing = await repo.findUserByEmail(input.email);
  if (existing) {
    throw new ConflictError('Email is already registered');
  }

  const passwordHash = await hashPassword(input.password);

  try {
    return await withTransaction(async (tx) => {
      const user = await repo.createUser(
        { email: input.email, name: input.name, passwordHash },
        tx,
      );
      return createSessionAndTokens(user, meta, tx);
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictError('Email is already registered');
    }
    throw error;
  }
}

export async function login(
  rawInput: LoginInput,
  meta: SessionMetadata,
): Promise<AuthResult> {
  const input = validateLogin(rawInput);

  const user = await repo.findUserByEmail(input.email);
  // Same message for unknown email and wrong password — no account enumeration.
  if (!user) {
    throw new AuthError('Invalid email or password');
  }

  const passwordOk = await verifyPassword(user.passwordHash, input.password);
  if (!passwordOk) {
    throw new AuthError('Invalid email or password');
  }

  return createSessionAndTokens(user, meta);
}

export async function refresh(
  refreshToken: string | null | undefined,
  ctx: GraphQLContext,
): Promise<AuthResult> {
  if (!refreshToken) {
    throw new AuthError('Refresh token is required');
  }

  const payload = verifyRefreshToken(refreshToken);
  const session = await repo.findSessionById(payload.sid);

  if (!isSessionActive(session) || session.userId !== payload.sub) {
    throw new AuthError('Session is no longer valid');
  }

  if (!refreshHashMatches(refreshToken, session.refreshTokenHash)) {
    // A valid JWT whose hash no longer matches = a rotated/stolen token.
    // Treat as compromise and revoke the session.
    logSecurityEvent(ctx, 'auth.refresh_token_reused', {
      sessionId: session.id,
      sessionUserId: session.userId,
    });
    await repo.revokeSession(session.id);
    throw new AuthError('Refresh token has already been used; session revoked');
  }

  const user = await repo.findUserById(session.userId);
  if (!user) {
    throw new AuthError('User no longer exists');
  }

  const newRefreshToken = signRefreshToken({
    userId: user.id,
    sessionId: session.id,
  });
  const newAccessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    sessionId: session.id,
  });

  await repo.updateSessionRefreshHash(
    session.id,
    hashRefreshToken(newRefreshToken),
  );

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, user };
}

export async function logout(sessionId: string): Promise<void> {
  await repo.revokeSession(sessionId);
}

export async function changePassword(
  userId: string,
  currentSessionId: string,
  rawInput: ChangePasswordInput,
): Promise<void> {
  const input = validateChangePassword(rawInput);

  const user = await repo.findUserById(userId);
  if (!user) {
    throw new AuthError();
  }

  const currentOk = await verifyPassword(
    user.passwordHash,
    input.currentPassword,
  );
  if (!currentOk) {
    throw new ValidationError('Current password is incorrect');
  }

  const passwordHash = await hashPassword(input.newPassword);

  await withTransaction(async (tx) => {
    await repo.updateUserPassword(userId, passwordHash, tx);
    // Force re-login everywhere else; keep the current session alive.
    await repo.revokeAllUserSessionsExcept(userId, currentSessionId, tx);
  });
}

/**
 * STUB (ROADMAP Phase 3 / email in Phase 9): a real flow would persist a
 * single-use reset token and email a link. For now it only validates the email
 * shape and returns silently — never revealing whether the account exists.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  const user = await repo.findUserByEmail(normalized);
  if (user) {
    logger.info({ userId: user.id }, 'Password reset requested (stub, no email sent)');
  }
}

export function listSessions(userId: string): Promise<Session[]> {
  return repo.listActiveSessions(userId);
}

export async function revokeSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  const session = await repo.findSessionById(sessionId);
  if (!session || session.userId !== userId) {
    throw new NotFoundError('Session not found');
  }
  await repo.revokeSession(sessionId);
}

function isSessionActive(session: Session | null): session is Session {
  return (
    session !== null &&
    session.revokedAt === null &&
    session.expiresAt > new Date()
  );
}
