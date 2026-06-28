import { pino } from 'pino';
import { env, isProduction } from './config/index.js';

/**
 * Structured application logger. Redacts known secret-bearing fields so
 * passwords/tokens are never written to logs (docs/security.md).
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'password',
      '*.password',
      'token',
      '*.token',
      'authorization',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[redacted]',
  },
  ...(isProduction
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true } } }),
});
