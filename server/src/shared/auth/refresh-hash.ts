import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Refresh tokens are high-entropy JWTs, so a fast SHA-256 (not a password hash)
 * is sufficient for at-rest storage. Only the hash is persisted; the raw token
 * lives solely in the client's cookie.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshHashMatches(token: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashRefreshToken(token), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length) {
    return false;
  }
  return timingSafeEqual(candidate, stored);
}
