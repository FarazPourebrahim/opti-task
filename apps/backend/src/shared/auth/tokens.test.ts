import { describe, expect, it } from 'vitest';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './tokens.js';
import { hashRefreshToken, refreshHashMatches } from './refreshHash.js';
import { AuthError } from '@/shared/errors';

describe('access tokens', () => {
  it('round-trips a signed access token', () => {
    const token = signAccessToken({
      userId: 'user-1',
      email: 'a@b.test',
      sessionId: 'sess-1',
    });
    const payload = verifyAccessToken(token);

    expect(payload.sub).toBe('user-1');
    expect(payload.email).toBe('a@b.test');
    expect(payload.sid).toBe('sess-1');
  });

  it('rejects a refresh token used as an access token', () => {
    const refresh = signRefreshToken({ userId: 'u', sessionId: 's' });
    expect(() => verifyAccessToken(refresh)).toThrow(AuthError);
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken({
      userId: 'u',
      email: 'a@b.test',
      sessionId: 's',
    });
    expect(() => verifyAccessToken(`${token}x`)).toThrow(AuthError);
  });
});

describe('refresh tokens', () => {
  it('produces a unique token on every call (jti)', () => {
    const a = signRefreshToken({ userId: 'u', sessionId: 's' });
    const b = signRefreshToken({ userId: 'u', sessionId: 's' });
    expect(a).not.toBe(b);
  });

  it('verifies and rejects an access token used as a refresh token', () => {
    const refresh = signRefreshToken({ userId: 'u', sessionId: 's' });
    expect(verifyRefreshToken(refresh).sid).toBe('s');

    const access = signAccessToken({
      userId: 'u',
      email: 'a@b.test',
      sessionId: 's',
    });
    expect(() => verifyRefreshToken(access)).toThrow(AuthError);
  });
});

describe('refresh hashing', () => {
  it('matches the same token and rejects a different one', () => {
    const token = signRefreshToken({ userId: 'u', sessionId: 's' });
    const hash = hashRefreshToken(token);

    expect(refreshHashMatches(token, hash)).toBe(true);
    expect(refreshHashMatches(`${token}x`, hash)).toBe(false);
  });
});
