/**
 * Typed application errors. Every error a resolver/service intentionally throws
 * is an `AppError` subclass carrying a stable `code` (surfaced as
 * `extensions.code`) and `expose: true`, meaning its message is safe to return
 * to clients. Anything that is NOT an AppError is treated as unexpected and
 * sanitized before leaving the server (see format-error.ts / docs/security.md).
 */
export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'BAD_USER_INPUT'
  | 'CONFLICT'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_SERVER_ERROR';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly expose: boolean;

  constructor(message: string, code: ErrorCode, httpStatus: number) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.expose = true;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHENTICATED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid input') {
    super(message, 'BAD_USER_INPUT', 400);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 'CONFLICT', 409);
  }
}

/**
 * A dependency the request relies on (e.g. the external AI provider) is
 * unavailable. Safe to expose: tells the client to retry without leaking
 * internals. Used when the provider times out or fails after retries.
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 'SERVICE_UNAVAILABLE', 503);
  }
}
