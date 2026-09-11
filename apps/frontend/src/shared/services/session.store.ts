/**
 * The in-memory access token.
 *
 * HTTP requests authenticate with the HTTP-only `optitask_access` cookie, which
 * JavaScript cannot read — that is the point. But `graphql-ws` authenticates a
 * socket through `connectionParams`, which means the token must be readable by
 * the code opening the socket.
 *
 * So exactly one copy lives here, in a module-scoped variable: never
 * `localStorage`, never `sessionStorage`, never a cookie this code can read. It
 * dies with the tab, and a reload recovers the session from the refresh cookie
 * instead.
 *
 * Phase 4 wires the auth flow onto this; Phase 3 needs it because the socket
 * link is built here.
 */

let accessToken: string | null = null;

type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  for (const listener of listeners) listener(token);
}

export function clearAccessToken(): void {
  setAccessToken(null);
}

/**
 * Notifies on every change. The socket link uses this to reconnect with the
 * new token after a refresh, and to drop the connection on logout.
 */
export function onAccessTokenChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
