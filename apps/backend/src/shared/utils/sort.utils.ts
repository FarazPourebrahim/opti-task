import type { SortDirection } from '@contracts';

/**
 * Server side of the sort contract. `SortDirection` is the vocabulary every
 * client speaks (defined in `@contracts`); mapping it onto the store's own
 * ordering keywords is the server's business and stays here.
 */

export type { SortDirection };

export function toPrismaSortOrder(
  direction: SortDirection | null | undefined,
): 'asc' | 'desc' {
  return direction === 'DESC' ? 'desc' : 'asc';
}
