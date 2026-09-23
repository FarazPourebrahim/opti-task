import type { NextFunction, Request, Response } from 'express';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/shared/auth/cookies';
import { logSecurityEventFromRequest } from '@/shared/logger';
import { CLIENT_HEADER, isAllowedOrigin } from '@/shared/middleware/cors';

/**
 * Rejects cross-site forged requests.
 *
 * The attack this prevents: a page on another origin makes the victim's browser
 * POST to this API, and the browser helpfully attaches the session cookie. The
 * `SameSite=Lax` cookie blocks the common shapes of that, but it is a single
 * control and a same-site subdomain takeover defeats it.
 *
 * Two additional checks apply, and both must pass:
 *
 * 1. `Origin`, when present, must be in the allowlist.
 * 2. A custom request header must be present. A cross-origin `<form>` cannot
 *    set one, and setting it from `fetch` forces a CORS preflight that the
 *    allowlist above will refuse. Its *value* is not checked — the security
 *    property is that a header was set at all, and checking the value would
 *    couple the API to a client version for no gain.
 *
 * Only cookie-authenticated requests are guarded. A request carrying
 * `Authorization: Bearer` is not forgeable (a cross-site form cannot set that
 * header either), and an unauthenticated request has no session to abuse — so
 * curl, scripts and server-to-server callers keep working unchanged.
 */
export function csrfGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    next();
    return;
  }

  const cookies = (req as Request & { cookies?: Record<string, string> })
    .cookies;
  const hasSessionCookie = Boolean(
    cookies?.[ACCESS_COOKIE] ?? cookies?.[REFRESH_COOKIE],
  );
  if (!hasSessionCookie) {
    next();
    return;
  }

  const origin = req.headers.origin;
  if (typeof origin === 'string' && !isAllowedOrigin(origin)) {
    reject(req, res, 'origin_not_allowed');
    return;
  }

  const clientHeader = req.headers[CLIENT_HEADER];
  const hasClientHeader =
    typeof clientHeader === 'string' && clientHeader.length > 0;
  if (!hasClientHeader) {
    reject(req, res, 'missing_client_header');
    return;
  }

  next();
}

function reject(req: Request, res: Response, reason: string): void {
  // The reason is a fixed token, never attacker-controlled text — logging the
  // raw Origin would put an arbitrary string into the log.
  logSecurityEventFromRequest(req, 'csrf.rejected', { reason });

  res.status(403).json({
    errors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN' } }],
  });
}
