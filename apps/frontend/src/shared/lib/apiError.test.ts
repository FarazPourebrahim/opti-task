import {
  CombinedGraphQLErrors,
  ServerError,
  ServerParseError,
} from '@apollo/client/errors';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ERROR_CODES } from '@contracts';
import { i18n } from '@/shared/i18n';
import { ApiError, messageKeyFor, toApiError } from './apiError';
import type { ApiErrorKind } from './apiError';

function graphqlError(code: string, message = 'boom') {
  return new CombinedGraphQLErrors(
    { data: null, errors: [{ message, extensions: { code } }] },
    [{ message, extensions: { code } }] as never,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('server error codes', () => {
  const expected: Record<string, ApiErrorKind> = {
    UNAUTHENTICATED: 'unauthorized',
    FORBIDDEN: 'forbidden',
    NOT_FOUND: 'not_found',
    BAD_USER_INPUT: 'validation',
    CONFLICT: 'conflict',
    SERVICE_UNAVAILABLE: 'service_unavailable',
    INTERNAL_SERVER_ERROR: 'server',
  };

  it('maps every code the API can return', () => {
    // If the backend adds a code, this fails rather than silently
    // degrading it to "unknown".
    for (const code of ERROR_CODES) {
      expect(expected[code], `${code} is unmapped`).toBeDefined();
      expect(toApiError(graphqlError(code)).kind).toBe(expected[code]);
    }
  });

  it('keeps the server message as diagnostic detail, not as UI copy', () => {
    const error = toApiError(graphqlError('FORBIDDEN', 'Missing task:update'));

    expect(error.detail).toBe('Missing task:update');
    expect(error.messageKey).toBe('error.forbidden');
  });

  it('falls back to unknown for an unrecognised code', () => {
    expect(toApiError(graphqlError('WAT')).kind).toBe('unknown');
  });
});

describe('transport failures', () => {
  it('maps a network failure by error type, never by message text', () => {
    // Browsers phrase this differently per locale; the TYPE is the signal.
    const error = toApiError(new TypeError('Failed to fetch'));

    expect(error.kind).toBe('network');
  });

  it('treats an offline navigator as a network failure', () => {
    vi.stubGlobal('navigator', { onLine: false });

    expect(toApiError(new Error('anything')).kind).toBe('network');
  });

  it('distinguishes a timeout from an abort', () => {
    const timeout = new DOMException('timed out', 'TimeoutError');
    const abort = new DOMException('aborted', 'AbortError');

    expect(toApiError(timeout).kind).toBe('timeout');
    expect(toApiError(abort).kind).toBe('aborted');
  });

  it('maps HTTP statuses that never reached a resolver', () => {
    const cases: Array<[number, ApiErrorKind]> = [
      [401, 'unauthorized'],
      [403, 'forbidden'],
      [404, 'not_found'],
      [409, 'conflict'],
      [429, 'rate_limited'],
      [503, 'service_unavailable'],
      [500, 'server'],
    ];

    for (const [status, kind] of cases) {
      const error = new ServerError('server error', {
        response: new Response(null, { status }),
        bodyText: '',
      });

      expect(toApiError(error).kind, `status ${status}`).toBe(kind);
    }
  });

  it('does not let a parse failure hide the HTTP status', () => {
    // A proxy's HTML error page: unparseable, but the status is the real story.
    const error = new ServerParseError(new Error('Unexpected token <'), {
      response: new Response(null, { status: 502 }),
      bodyText: '<html></html>',
    });

    const mapped = toApiError(error);
    expect(mapped.status).toBe(502);
    expect(mapped.kind).toBe('server');
  });
});

describe('ApiError', () => {
  it('carries the request id so a user can quote it', () => {
    const error = toApiError(graphqlError('INTERNAL_SERVER_ERROR'), {
      requestId: 'req-42',
    });

    expect(error.requestId).toBe('req-42');
  });

  it('passes an existing ApiError through unchanged', () => {
    const original = new ApiError({ kind: 'conflict', messageKey: 'error.conflict' });

    expect(toApiError(original)).toBe(original);
  });

  it('is identifiable with instanceof and with is()', () => {
    const error = toApiError(new TypeError('x'));

    expect(error).toBeInstanceOf(Error);
    expect(ApiError.is(error)).toBe(true);
    expect(ApiError.is(new Error('x'))).toBe(false);
  });

  it('never carries a literal user-facing message', () => {
    // The UI renders messageKey through i18n; `message` is for logs only.
    const error = toApiError(graphqlError('FORBIDDEN', 'Missing task:update'));

    expect(error.messageKey).toMatch(/^error\./);
  });
});

describe('i18n coverage', () => {
  const kinds: ApiErrorKind[] = [
    'network',
    'timeout',
    'aborted',
    'unauthorized',
    'forbidden',
    'not_found',
    'conflict',
    'validation',
    'rate_limited',
    'service_unavailable',
    'server',
    'unknown',
  ];

  it.each(kinds)('%s resolves to a real translation', (kind) => {
    const key = messageKeyFor(kind);
    const translated = i18n.t(key as never);

    expect(translated).toBeTruthy();
    // A key echoed back means it is missing from the catalogue.
    expect(translated).not.toBe(key);
  });
});
