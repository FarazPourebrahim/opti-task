import type { GraphQLFormattedError } from 'graphql';
import { unwrapResolverError } from '@apollo/server/errors';
import { AppError } from '@/shared/errors';
import { isProduction } from '@/shared/config';
import { logger } from '@/shared/logger';

/**
 * Apollo error formatter. Known `AppError`s are safe to expose: their message
 * and stable `code` pass through. Anything else is unexpected — it is logged in
 * full server-side, but the client only ever sees a generic message with no
 * stack trace, DB error, or internal detail (docs/security.md).
 */
export function formatError(
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const originalError = unwrapResolverError(error);

  if (originalError instanceof AppError) {
    return {
      message: originalError.message,
      ...(formattedError.locations ? { locations: formattedError.locations } : {}),
      ...(formattedError.path ? { path: formattedError.path } : {}),
      extensions: { code: originalError.code },
    };
  }

  // GraphQL validation/parse errors (no originalError) are safe and useful.
  const isClientOperationError =
    originalError === undefined || originalError === null;
  if (isClientOperationError) {
    return formattedError;
  }

  logger.error({ err: originalError, path: formattedError.path }, 'Unhandled GraphQL error');

  if (isProduction) {
    return {
      message: 'Internal server error',
      ...(formattedError.path ? { path: formattedError.path } : {}),
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    };
  }

  return {
    message: formattedError.message,
    ...(formattedError.locations ? { locations: formattedError.locations } : {}),
    ...(formattedError.path ? { path: formattedError.path } : {}),
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
  };
}
