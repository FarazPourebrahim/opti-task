import cors from 'cors';
import type { CorsOptions } from 'cors';
import { env } from '@/shared/config';

/** The header a browser client must send; see `csrfGuard`. */
export const CLIENT_HEADER = 'x-optitask-client';

/**
 * The request id echoed on every response. Exposed so a browser client can
 * read it and quote it in a support request — without this, `fetch` can only
 * see a short list of "simple" response headers and the id is invisible.
 */
export const REQUEST_ID_HEADER = 'x-request-id';

export function isAllowedOrigin(origin: string): boolean {
  return env.CORS_ORIGINS.includes(origin);
}

/**
 * CORS for a cookie-authenticated API.
 *
 * The browser refuses a credentialed response whose `Access-Control-Allow-Origin`
 * is the `*` wildcard, so the allowed origins must be listed explicitly and
 * reflected one at a time. Sending `credentials: true` alongside the default
 * wildcard — the previous configuration — meant every credentialed request
 * from the web client was rejected by the browser.
 */
export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // No Origin header: a non-browser client (curl, a server-to-server call,
    // a health probe). CORS is a browser mechanism and does not apply.
    if (!origin) {
      callback(null, true);
      return;
    }

    // Reflect the origin only when it is allowed. Rejecting by omitting the
    // header — rather than throwing — lets the request complete and the
    // browser block it, instead of turning a policy decision into a 500.
    callback(null, isAllowedOrigin(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['content-type', 'authorization', CLIENT_HEADER],
  exposedHeaders: [REQUEST_ID_HEADER],
  // Cache the preflight so an interactive client is not re-asking constantly.
  maxAge: 600,
};

export const corsMiddleware = cors(corsOptions);
