import type { Request } from 'express';
import type { GraphQLContext } from '@/shared/graphql/context';
import { logger } from './logger.js';

/**
 * The closed list of suspicious-activity events this server reports.
 *
 * Names are a fixed vocabulary so alerting can match on them exactly — a new
 * kind of suspicious activity gets a NEW name here, never a close-enough
 * existing one. Everything goes out at `warn`: routine 4xx (a wrong password, an
 * expired token, a 404) is normal client behaviour and is deliberately absent.
 */
type SecurityEvent =
  /** A rotated/revoked refresh token was presented — treated as theft. */
  | 'auth.refresh_token_reused'
  /** The rate limiter tripped. The threshold crossing is the signal, not one request. */
  | 'auth.rate_limited'
  /** A permission check failed for an authenticated principal. */
  | 'authz.forbidden'
  /** A principal asked for a resource owned by someone else. */
  | 'authz.ownership_violation';

/**
 * Fields every security line carries. `security: true` gives log pipelines a
 * single predicate to route on, and `requestId` ties the event to the rest of
 * that request's lines.
 *
 * Never add the attempted credential, token, or payload here — see the logging
 * rules in the working agreement.
 */
type SecurityEventFields = {
  security: true;
  event: SecurityEvent;
  requestId: string;
  userId: string | null;
  ip: string | null;
};

function write(
  fields: SecurityEventFields,
  details: Record<string, unknown>,
): void {
  logger.warn({ ...details, ...fields }, 'Security event');
}

/**
 * Reports a security event from a resolver or service.
 *
 * Takes the GraphQL context rather than Express's `req` because this server has
 * no per-request `req.log` inside resolvers — the context is what carries the
 * request id, principal and client IP down to the layer where a check actually
 * happens.
 */
export function logSecurityEvent(
  ctx: GraphQLContext,
  event: SecurityEvent,
  details: Record<string, unknown> = {},
): void {
  write(
    {
      security: true,
      event,
      requestId: ctx.requestId,
      userId: ctx.user?.id ?? null,
      ip: ctx.ipAddress,
    },
    details,
  );
}

/**
 * Reports a security event from Express middleware, which runs before a GraphQL
 * context exists. `req.id` is the id pino-http assigned and echoed in the
 * `x-request-id` response header, so both paths correlate on the same value.
 */
export function logSecurityEventFromRequest(
  req: Request,
  event: SecurityEvent,
  details: Record<string, unknown> = {},
): void {
  const requestId = (req as Request & { id?: string | number }).id;

  write(
    {
      security: true,
      event,
      requestId: requestId === undefined ? 'unknown' : String(requestId),
      userId: null,
      ip: req.ip ?? null,
    },
    details,
  );
}
