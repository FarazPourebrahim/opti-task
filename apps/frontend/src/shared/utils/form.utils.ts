import type { z } from 'zod';

/**
 * Collapses a zod error into the per-field shape a form renders.
 *
 * Messages are i18n keys, never literals — the same rule `ApiError` follows.
 */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !fields[field]) {
      fields[field] = issue.message;
    }
  }

  return fields;
}

/** An optional text field: blank means "not set", which the API takes as null. */
export function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
