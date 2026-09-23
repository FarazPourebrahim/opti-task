import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger } from '@/shared/logger';
import { isTest } from '@/shared/config';

/**
 * A caller-supplied `x-request-id` is echoed back and stamped on every log line
 * for the request, so it must be proven to be a UUID before it is trusted —
 * otherwise a client controls the contents of a log field.
 */
const REQUEST_ID_PATTERN = /^[0-9a-f-]{36}$/i;

/**
 * Per-request structured logging. Mounted first so every downstream line
 * (including security events) can be correlated by request id.
 *
 * Routine requests log at `debug`, which is off in production: a 200 or a 404 is
 * not news. Only a 5xx or a thrown error is an `error`, and the central error
 * path is what attaches it — one failure, one log line.
 */
export const requestLogger = pinoHttp({
  logger,
  autoLogging: !isTest,
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id'];
    const id =
      typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
        ? incoming
        : randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  customLogLevel: (_req, res, err) =>
    err || res.statusCode >= 500 ? 'error' : 'debug',
});
