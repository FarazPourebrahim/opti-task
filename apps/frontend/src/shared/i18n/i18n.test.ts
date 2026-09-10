import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, i18n, resources } from '@/shared/i18n';

/**
 * i18n is load-bearing rather than cosmetic: `ApiError` carries keys instead of
 * messages, so a missing key surfaces to a user as a raw dotted string.
 */
function flatten(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (value === null || typeof value !== 'object') return [];

  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  );
}

const keys = flatten(resources.en.translation);

/**
 * BOUNDARY: i18next types `t` to the literal keys in the catalog — which is
 * exactly what we want at call sites. This suite walks the catalog
 * dynamically to prove no key is missing, so the cast is confined here.
 */
const translate = i18n.t.bind(i18n) as (
  key: string,
  options?: Record<string, unknown>,
) => string;

describe('i18n', () => {
  it('initializes with the default locale', () => {
    expect(i18n.language).toBe(DEFAULT_LOCALE);
  });

  it('resolves every key in the catalog to a non-empty string', () => {
    expect(keys.length).toBeGreaterThan(0);

    for (const key of keys) {
      const value = translate(key);
      expect(value, `${key} resolved to nothing`).toBeTruthy();
      // A key echoed back means it was not found.
      expect(value, `${key} is missing from the catalog`).not.toBe(key);
    }
  });

  it('covers every ApiError kind the client can produce', () => {
    // These map 1:1 onto the error kinds normalized in Phase 3. A gap here
    // becomes an untranslated error toast in production.
    const kinds = [
      'network',
      'timeout',
      'unauthorized',
      'forbidden',
      'notFound',
      'conflict',
      'validation',
      'rateLimited',
      'serviceUnavailable',
      'server',
      'unknown',
    ];

    for (const kind of kinds) {
      expect(keys, `error.${kind} is missing`).toContain(`error.${kind}`);
    }
  });

  it('interpolates without escaping, since React escapes on render', () => {
    expect(translate('error.requestId', { requestId: 'abc & 123' })).toContain(
      'abc & 123',
    );
  });

  it('does not silently return an empty string for an unknown key', () => {
    // @ts-expect-error — proving an unknown key is a compile error too.
    expect(i18n.t('nope.not.a.key')).toBe('nope.not.a.key');
  });
});
