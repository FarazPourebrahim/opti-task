import type { Response } from 'express';
import { env, isProduction } from '@/shared/config';
import { durationToMs } from '@/shared/utils';

/**
 * HTTP-only auth cookies (docs/security.md). Tokens are also returned in the
 * GraphQL payload for non-browser clients, but browsers should rely on these
 * cookies so tokens never touch JS-accessible storage.
 */
export const ACCESS_COOKIE = 'optitask_access';
export const REFRESH_COOKIE = 'optitask_refresh';

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
};

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
): void {
  // Cookie lifetimes must track the configured token/session TTLs — otherwise a
  // longer JWT_REFRESH_TTL is silently truncated by the browser deleting the
  // cookie early, forcing re-login despite a still-valid server session.
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseCookieOptions,
    maxAge: durationToMs(env.JWT_ACCESS_TTL),
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions,
    maxAge: durationToMs(env.JWT_REFRESH_TTL),
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseCookieOptions);
  res.clearCookie(REFRESH_COOKIE, baseCookieOptions);
}
