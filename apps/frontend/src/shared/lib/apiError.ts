import {
  CombinedGraphQLErrors,
  ServerError,
  ServerParseError,
} from '@apollo/client/errors';
import { ERROR_CODES } from '@contracts';
import type { ErrorCode } from '@contracts';

/**
 * The single error shape every feature sees.
 *
 * Services and hooks never handle a raw `Response`, a `CombinedGraphQLErrors`
 * or a network exception — the link chain normalizes all of them into this.
 */
export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'rate_limited'
  | 'service_unavailable'
  | 'server'
  | 'unknown';

type ApiErrorInit = {
  kind: ApiErrorKind;
  messageKey: string;
  /** The server's own message. Diagnostic only — never rendered to a user. */
  detail?: string | undefined;
  status?: number | undefined;
  requestId?: string | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** An i18n key, never a literal message (the working agreement's rule). */
  readonly messageKey: string;
  readonly detail: string | undefined;
  readonly status: number | undefined;
  readonly requestId: string | undefined;
  /**
   * Per-field messages for a form.
   *
   * The API does **not** populate this: its `extensions` carries `code` and
   * nothing else. Client-side zod validation fills it instead, and a server
   * `BAD_USER_INPUT` surfaces as a form-level error.
   */
  readonly fieldErrors: Record<string, string[]> | undefined;

  constructor(init: ApiErrorInit) {
    // The Error message is for logs and stack traces; the UI reads messageKey.
    super(init.detail ?? init.messageKey);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.messageKey = init.messageKey;
    this.detail = init.detail;
    this.status = init.status;
    this.requestId = init.requestId;
    this.fieldErrors = init.fieldErrors;
  }

  static is(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }
}

/** The server's stable `extensions.code` → the kind features branch on. */
const CODE_TO_KIND: Record<ErrorCode, ApiErrorKind> = {
  UNAUTHENTICATED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  BAD_USER_INPUT: 'validation',
  CONFLICT: 'conflict',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  INTERNAL_SERVER_ERROR: 'server',
};

/** Each kind's i18n key. `aborted` has none — it is never shown to a user. */
const KIND_TO_MESSAGE_KEY: Record<ApiErrorKind, string> = {
  network: 'error.network',
  timeout: 'error.timeout',
  aborted: 'error.unknown',
  unauthorized: 'error.unauthorized',
  forbidden: 'error.forbidden',
  not_found: 'error.notFound',
  conflict: 'error.conflict',
  validation: 'error.validation',
  rate_limited: 'error.rateLimited',
  service_unavailable: 'error.serviceUnavailable',
  server: 'error.server',
  unknown: 'error.unknown',
};

export function messageKeyFor(kind: ApiErrorKind): string {
  return KIND_TO_MESSAGE_KEY[kind];
}

function isErrorCode(value: unknown): value is ErrorCode {
  return (
    typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value)
  );
}

/** HTTP status → kind, for failures that never reached a GraphQL resolver. */
function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'service_unavailable';
  if (status >= 500) return 'server';
  return 'unknown';
}

/**
 * Distinguishes a lost connection from every other failure.
 *
 * Detected by error *type* plus `navigator.onLine` — never by matching message
 * text, which differs between browsers and locales.
 */
function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  // `fetch` rejects with a TypeError when the request never completed.
  return error instanceof TypeError;
}

function isAbort(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

/**
 * Normalizes anything thrown by the link chain into an `ApiError`.
 *
 * Exported separately from the link so the mapping is unit-testable without
 * standing up a client.
 */
export function toApiError(
  error: unknown,
  context?: { requestId?: string | undefined },
): ApiError {
  const requestId = context?.requestId;

  if (ApiError.is(error)) return error;

  // An aborted or timed-out request. A timeout is a real failure; an abort is
  // the app's own doing (unmount, superseded query) and is never shown.
  if (isAbort(error)) {
    const kind: ApiErrorKind =
      error instanceof DOMException && error.name === 'TimeoutError'
        ? 'timeout'
        : 'aborted';
    return new ApiError({ kind, messageKey: messageKeyFor(kind), requestId });
  }

  // Resolver-level failures: the server answered, with a stable code.
  if (CombinedGraphQLErrors.is(error)) {
    const first = error.errors[0];
    const code = first?.extensions?.['code'];
    const kind = isErrorCode(code) ? CODE_TO_KIND[code] : 'unknown';

    return new ApiError({
      kind,
      messageKey: messageKeyFor(kind),
      detail: first?.message,
      requestId,
    });
  }

  // A non-2xx response, or a body that was not GraphQL at all (a proxy's HTML
  // error page). A parse failure must not hide the HTTP status.
  if (ServerError.is(error) || ServerParseError.is(error)) {
    const status = error.statusCode;
    const kind = kindForStatus(status);

    return new ApiError({
      kind,
      messageKey: messageKeyFor(kind),
      detail: error.message,
      status,
      requestId,
    });
  }

  if (isNetworkFailure(error)) {
    return new ApiError({
      kind: 'network',
      messageKey: messageKeyFor('network'),
      requestId,
    });
  }

  return new ApiError({
    kind: 'unknown',
    messageKey: messageKeyFor('unknown'),
    detail: error instanceof Error ? error.message : undefined,
    requestId,
  });
}
