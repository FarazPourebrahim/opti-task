import argon2 from 'argon2';

/**
 * Password hashing via argon2id. The hash string embeds its own salt and
 * parameters, so no separate salt column is needed. Raw passwords are never
 * stored or logged (docs/security.md).
 */
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // A malformed hash should fail verification, not crash the request.
    return false;
  }
}
