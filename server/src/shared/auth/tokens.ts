import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { env } from '@shared/config';
import { AuthError } from '@shared/errors';

/**
 * JWT issuing/verification for access and refresh tokens. Access tokens are
 * short-lived and trusted on every request; refresh tokens are long-lived,
 * carry a session id (`sid`), and are validated against server-side session
 * state on rotation (see auth.service).
 */
export type AccessTokenPayload = {
  sub: string;
  email: string;
  sid: string;
  type: 'access';
};

export type RefreshTokenPayload = {
  sub: string;
  sid: string;
  type: 'refresh';
};

function requireSecret(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function accessSecret(): string {
  return requireSecret(env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET');
}

function refreshSecret(): string {
  return requireSecret(env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');
}

export function signAccessToken(payload: {
  userId: string;
  email: string;
  sessionId: string;
}): string {
  const claims: Omit<AccessTokenPayload, 'sub'> & { sub: string } = {
    sub: payload.userId,
    email: payload.email,
    sid: payload.sessionId,
    type: 'access',
  };
  // jti makes every issued token unique so re-signing within the same second
  // (rotation) never produces an identical token.
  const options = { expiresIn: env.JWT_ACCESS_TTL, jwtid: randomUUID() } as SignOptions;
  return jwt.sign(claims, accessSecret(), options);
}

export function signRefreshToken(payload: {
  userId: string;
  sessionId: string;
}): string {
  const claims: RefreshTokenPayload = {
    sub: payload.userId,
    sid: payload.sessionId,
    type: 'refresh',
  };
  const options = { expiresIn: env.JWT_REFRESH_TTL, jwtid: randomUUID() } as SignOptions;
  return jwt.sign(claims, refreshSecret(), options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = safeVerify(token, accessSecret());
  if (decoded.type !== 'access' || typeof decoded.email !== 'string') {
    throw new AuthError('Invalid access token');
  }
  return {
    sub: decoded.sub,
    email: decoded.email,
    sid: decoded.sid,
    type: 'access',
  };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = safeVerify(token, refreshSecret());
  if (decoded.type !== 'refresh') {
    throw new AuthError('Invalid refresh token');
  }
  return { sub: decoded.sub, sid: decoded.sid, type: 'refresh' };
}

type DecodedClaims = {
  sub: string;
  sid: string;
  type?: string;
  email?: string;
};

function safeVerify(token: string, secret: string): DecodedClaims {
  try {
    const decoded = jwt.verify(token, secret);
    if (
      typeof decoded === 'string' ||
      typeof decoded.sub !== 'string' ||
      typeof (decoded as { sid?: unknown }).sid !== 'string'
    ) {
      throw new AuthError('Malformed token');
    }
    return decoded as DecodedClaims;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError('Invalid or expired token');
  }
}
