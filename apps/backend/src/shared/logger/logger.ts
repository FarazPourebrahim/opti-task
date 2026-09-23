import { pino } from 'pino';
import { env, isProduction } from '../config/index.js';

/**
 * The single application logger — no other file constructs a pino instance.
 *
 * `redact` is a safety net, not the plan: its wildcards match exactly one level
 * (`*.token` catches `body.token` but not `body.user.token`), so the real
 * protection is never putting a secret-bearing object into a log call. When a
 * new sensitive field appears, add its path here in the same change
 * (docs/security.md).
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'password',
      '*.password',
      'passwordHash',
      '*.passwordHash',
      'token',
      '*.token',
      'accessToken',
      '*.accessToken',
      'refreshToken',
      '*.refreshToken',
      'authorization',
      'req.headers.authorization',
      'req.headers.cookie',
      // Auth rides in HTTP-only cookies: an unredacted Set-Cookie would write
      // live access/refresh tokens straight into the logs.
      'res.headers["set-cookie"]',
    ],
    censor: '[redacted]',
  },
  ...(isProduction
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true } } }),
});
