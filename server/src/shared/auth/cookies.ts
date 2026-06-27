import type { Response } from 'express';
import { isProduction } from '@shared/config';

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
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseCookieOptions,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseCookieOptions);
  res.clearCookie(REFRESH_COOKIE, baseCookieOptions);
}
