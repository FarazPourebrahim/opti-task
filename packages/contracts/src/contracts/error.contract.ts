/**
 * The error contract every client codes against.
 *
 * The API returns a stable machine-readable `code` in `extensions.code` on each
 * GraphQL error; clients branch on that code (redirect on UNAUTHENTICATED, show
 * a field error on BAD_USER_INPUT) and never on the human-readable message,
 * which is free to change. Unexpected failures are sanitized to
 * INTERNAL_SERVER_ERROR before leaving the server, so no internal detail is
 * reachable through this contract.
 */
export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'BAD_USER_INPUT',
  'CONFLICT',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_SERVER_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * The `extensions` block carried by every GraphQL error the API emits.
 * `requestId` ties a user-visible failure to its single server-side log line,
 * so a support report can be traced without asking for a reproduction.
 */
export type ApiErrorExtensions = {
  code: ErrorCode;
  requestId?: string;
};
