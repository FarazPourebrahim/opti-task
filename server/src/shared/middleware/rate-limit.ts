import rateLimit from 'express-rate-limit';

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
});
