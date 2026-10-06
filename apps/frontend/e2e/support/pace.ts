/**
 * Keeps the suite under the backend's rate limit.
 *
 * The API allows 300 requests a minute from one address, and a suite that
 * seeds a workspace per test and then loads every screen passes that easily.
 * A refused request would fail a test for a reason that has nothing to do
 * with the client, so every request the suite makes — its own and the
 * browser's — is counted here, and the suite waits when the minute is nearly
 * spent.
 */

const WINDOW_MS = 60_000;
/** Below the server's 300, to leave room for requests still in flight. */
const HARD_LIMIT = 260;

const sent: number[] = [];

function used(now: number): number {
  while (sent.length > 0 && now - (sent[0] ?? 0) > WINDOW_MS) sent.shift();
  return sent.length;
}

export function noteRequest(): void {
  sent.push(Date.now());
}

/** Resolves once fewer than `limit` requests were made in the last minute. */
export async function waitForBudget(limit: number = HARD_LIMIT): Promise<void> {
  for (;;) {
    const now = Date.now();
    if (used(now) < limit) return;

    // Until enough of the oldest requests have left the window.
    const releaseAt = (sent[sent.length - limit] ?? now) + WINDOW_MS;
    await new Promise((resolve) => {
      setTimeout(resolve, Math.max(250, releaseAt - now));
    });
  }
}
