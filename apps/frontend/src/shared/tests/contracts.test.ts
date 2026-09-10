import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  ERROR_CODES,
  MAX_PAGE_SIZE,
  PERMISSIONS,
  ROLES,
  TASK_STATUSES,
} from '@contracts';

/**
 * `@contracts` is not a valid Node package specifier, so it resolves only
 * because it is mapped in BOTH `tsconfig.json` (for tsc) and `vite.config.ts`
 * (for the dev server, the production build and vitest). If either mapping is
 * dropped, imports keep type-checking but fail at runtime — this test is what
 * catches that (CLIENT_PLAN.md risk R7).
 */
describe('@contracts resolution', () => {
  it('resolves the shared package at runtime, not just at type level', () => {
    // Arrange / Act / Assert — values, not types, prove the runtime mapping.
    expect(Array.isArray(TASK_STATUSES)).toBe(true);
    expect(TASK_STATUSES).toContain('IN_PROGRESS');
  });

  it('exposes the pagination bounds the API enforces', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    expect(MAX_PAGE_SIZE).toBe(100);
  });

  it('exposes the error codes the client branches on', () => {
    expect(ERROR_CODES).toContain('FORBIDDEN');
    expect(ERROR_CODES).toContain('SERVICE_UNAVAILABLE');
  });

  it('exposes the RBAC vocabulary used for capability hints', () => {
    expect(ROLES).toContain('PROJECT_ADMIN');
    expect(PERMISSIONS).toContain('ai:approve');
  });
});
