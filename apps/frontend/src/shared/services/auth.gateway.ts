import { env } from '@/shared/config';
import { setAccessToken } from '@/shared/services/session.store';

export const CLIENT_HEADER = 'x-optitask-client';
export const CLIENT_HEADER_VALUE = 'optitask-web';

const REFRESH_MUTATION = `mutation Refresh {
  refreshToken {
    accessToken
  }
}`;

/**
 * Refreshes the session outside the Apollo link chain.
 *
 * Deliberately a plain `fetch` rather than a client operation: a refresh
 * triggered *by* an authentication failure would re-enter the same link that
 * triggered it, and any bug there becomes an infinite loop. A direct request
 * cannot recurse.
 *
 * The refresh token is sent as an HTTP-only cookie, so no argument is passed —
 * the mutation's `refreshToken` argument is optional and falls back to it.
 */
async function requestRefresh(): Promise<boolean> {
  try {
    const response = await fetch(env.VITE_API_URL, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        [CLIENT_HEADER]: CLIENT_HEADER_VALUE,
      },
      body: JSON.stringify({ query: REFRESH_MUTATION }),
    });

    if (!response.ok) return false;

    const body: unknown = await response.json();
    const token = readAccessToken(body);
    if (!token) return false;

    setAccessToken(token);
    return true;
  } catch {
    // A failed refresh is not exceptional — it means "not signed in".
    return false;
  }
}

function readAccessToken(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;

  const data = (body as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return null;

  const payload = (data as { refreshToken?: unknown }).refreshToken;
  if (typeof payload !== 'object' || payload === null) return null;

  const token = (payload as { accessToken?: unknown }).accessToken;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

/**
 * In-flight refresh, shared by every caller.
 *
 * Three requests failing at once must produce ONE refresh, not three — three
 * would rotate the refresh token three times and the backend's reuse detection
 * would revoke the session (see the backend's refresh rotation).
 */
let inFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  inFlight ??= requestRefresh().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/** Test seam: drops any shared in-flight refresh between cases. */
export function resetRefreshState(): void {
  inFlight = null;
}
