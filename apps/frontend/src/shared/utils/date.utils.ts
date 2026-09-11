/**
 * Date conversion for the API boundary.
 *
 * The GraphQL `DateTime` scalar **rejects date-only strings** — `2026-03-01`
 * is an error, `2026-03-01T00:00:00.000Z` is not. Every date the client sends
 * passes through here so that constraint is enforced in one place rather than
 * remembered at each call site.
 */

/** Converts a picked calendar day into the instant the API accepts. */
export function toApiDateTime(date: Date): string {
  // UTC midnight: a due date is a calendar day, so the local time of day must
  // not leak into the stored instant (and shift the day across time zones).
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  ).toISOString();
}

/** Parses an API instant back into a Date, or null when absent/invalid. */
export function fromApiDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** True when the string is a full RFC-3339 instant rather than a bare date. */
export function isApiDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(
    value,
  );
}
