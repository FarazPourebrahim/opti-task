import rateLimit from 'express-rate-limit';
import { logSecurityEventFromRequest } from '@/shared/logger';

/**
 * Global request rate limiter. A coarse, generic guard applied in middleware
 * (docs/security.md: general checks belong in middleware). Per-operation limits
 * (e.g. login attempts) are added in their own modules.
 */
export const rateLimitMiddleware = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { errors: [{ message: 'Too many requests, please slow down.' }] },
  // A single request is never suspicious; the threshold being crossed is. This
  // handler runs only on the requests the limiter actually rejects.
  handler: (req, res, _next, options) => {
    logSecurityEventFromRequest(req, 'auth.rate_limited', {
      limit: options.limit,
      windowMs: options.windowMs,
    });
    res.status(options.statusCode).json(options.message);
  },
});
