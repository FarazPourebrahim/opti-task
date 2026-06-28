import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GraphQLFormattedError } from 'graphql';
import { NotFoundError } from '@shared/errors';
import { formatError } from './format-error.js';

/**
 * Unit tests for the formatter's branch logic. Errors are passed directly as the
 * second arg — `unwrapResolverError` returns non-GraphQLErrors unchanged, so this
 * mirrors a fully-unwrapped resolver error without depending on graphql's
 * cross-package `instanceof` checks. The end-to-end unwrap path (real Apollo) is
 * covered by the BAD_USER_INPUT case in schema.test.ts.
 *
 * `isProduction` is read at module-load time, so the production scenario
 * re-imports the formatter under a mocked config. Non-production scenarios use
 * the statically imported formatter (test env is non-production).
 */
const formatted = (message: string): GraphQLFormattedError => ({
  message,
  path: ['users'],
});

async function loadProductionFormatter() {
  vi.resetModules();
  vi.doMock('@shared/config', () => ({
    isProduction: true,
    isTest: true,
    env: { NODE_ENV: 'production', LOG_LEVEL: 'silent' },
  }));
  const mod = await import('./format-error.js');
  return mod.formatError;
}

afterEach(() => {
  vi.doUnmock('@shared/config');
  vi.resetModules();
});

describe('formatError', () => {
  it('exposes AppError message and code to the client', () => {
    const result = formatError(
      formatted('Task not found'),
      new NotFoundError('Task not found'),
    );

    expect(result.message).toBe('Task not found');
    expect(result.extensions?.code).toBe('NOT_FOUND');
  });

  it('keeps the real message for unexpected errors in development', () => {
    const result = formatError(
      formatted('detailed dev error'),
      new Error('detailed dev error'),
    );

    expect(result.message).toBe('detailed dev error');
    expect(result.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('hides internal details for unexpected errors in production', async () => {
    const productionFormatError = await loadProductionFormatter();

    const result = productionFormatError(
      formatted('boom'),
      new Error('connection string postgres://secret@db'),
    );

    expect(result.message).toBe('Internal server error');
    expect(result.message).not.toContain('postgres');
    expect(result.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
  });
});
