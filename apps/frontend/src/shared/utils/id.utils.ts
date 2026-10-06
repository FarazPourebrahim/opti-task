const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a route parameter could be an entity id at all.
 *
 * The API's `UUID` scalar rejects anything else as a validation error, which
 * would surface as "check your input" on a page the user reached by a bad
 * link. Checking first lets that case be what it is: not found.
 */
export function isUuid(value: string | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
