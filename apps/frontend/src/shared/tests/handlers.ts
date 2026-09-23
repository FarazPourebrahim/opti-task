import type { RequestHandler } from 'msw';

/**
 * Default handlers applied to every test.
 *
 * Deliberately empty: an unhandled request is an error (see setup.ts), so each
 * test declares the traffic it expects with `server.use(...)`. Shared GraphQL
 * handler helpers arrive with the Apollo client in Phase 3 (F3.10).
 */
export const handlers: RequestHandler[] = [];
