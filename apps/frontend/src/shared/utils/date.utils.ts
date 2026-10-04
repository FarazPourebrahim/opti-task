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

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converts a date field's value (`YYYY-MM-DD`, which is what Avero's
 * `DatePicker` reports) into the instant the API accepts, or null when the
 * field is empty or holds something that is not a real calendar day.
 */
export function dateInputToApi(
  value: string | null | undefined,
): string | null {
  if (!value || !DATE_INPUT_PATTERN.test(value)) return null;

  const instant = `${value}T00:00:00.000Z`;
  const parsed = new Date(instant);
  // `2026-02-31` parses to March; only a day that round-trips is real.
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === instant
    ? instant
    : null;
}

/** The calendar day of an API instant, as a date field holds it. */
export function apiToDateInput(
  value: string | null | undefined,
): string | null {
  const date = fromApiDateTime(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

/**
 * A calendar day for display ("Mar 15, 2026").
 *
 * Read in UTC, because that is how a picked day is stored: formatting it in the
 * viewer's zone would show the day before to anyone west of Greenwich.
 */
export function formatCalendarDate(
  value: string | null | undefined,
  locale?: string,
): string {
  const date = fromApiDateTime(value);
  if (!date) return '';

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}

/** True when a calendar day has passed, compared in UTC as it is stored. */
export function isPastCalendarDate(
  value: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const day = apiToDateInput(value);
  return day !== null && day < now.toISOString().slice(0, 10);
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

/**
 * A short relative description of an instant ("3 days ago").
 *
 * Uses `Intl.RelativeTimeFormat` so the wording follows the viewer's locale
 * rather than being hard-coded English assembled from numbers.
 */
export function formatRelativeTime(
  value: string | null | undefined,
  now: Date = new Date(),
): string {
  const date = fromApiDateTime(value);
  if (!date) return '';

  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  const divisions: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.34524],
    ['month', 12],
    ['year', Number.POSITIVE_INFINITY],
  ];

  let amount = seconds;
  for (const [unit, size] of divisions) {
    if (Math.abs(amount) < size) {
      return formatter.format(Math.round(amount), unit);
    }
    amount /= size;
  }

  return formatter.format(Math.round(amount), 'year');
}
