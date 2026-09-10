/**
 * Shared sort convention. Resolvers accept a `SortDirection` and map it to the
 * underlying store's ordering. Kept tiny and store-agnostic so every list query
 * speaks the same vocabulary.
 */
export type SortDirection = 'ASC' | 'DESC';

export function toPrismaSortOrder(
  direction: SortDirection | null | undefined,
): 'asc' | 'desc' {
  return direction === 'DESC' ? 'desc' : 'asc';
}
