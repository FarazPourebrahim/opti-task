/**
 * The cursor-pagination contract shared by every list query in the API.
 *
 * Every paginated field returns this exact `Connection` shape — one definition
 * imported by both sides, never re-modeled per feature. Cursors are opaque
 * base64 strings: clients pass them back verbatim and must not decode or
 * construct them. Encoding/decoding is the server's business and deliberately
 * stays out of this package.
 */

/** Page size used when a caller supplies no `first`. */
export const DEFAULT_PAGE_SIZE = 20;

/** Upper bound a caller's `first` is clamped to, protecting the API from
 * unbounded result sets. */
export const MAX_PAGE_SIZE = 100;

export type PageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
};

export type Edge<T> = {
  cursor: string;
  node: T;
};

export type Connection<T> = {
  edges: Edge<T>[];
  pageInfo: PageInfo;
  totalCount: number;
};

export type ConnectionArgs = {
  first?: number | null;
  after?: string | null;
};

/** Sort direction accepted by every sortable list query. */
export const SORT_DIRECTIONS = ['ASC', 'DESC'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];
