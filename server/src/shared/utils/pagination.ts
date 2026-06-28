import { ValidationError } from '@shared/errors';

/**
 * Canonical cursor-pagination contract. Every list query returns a `Connection`
 * with this exact shape — one definition imported everywhere, never re-modeled
 * per feature. Cursors are opaque base64 strings; callers must treat them as
 * black boxes.
 */

export const DEFAULT_PAGE_SIZE = 20;
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

export function encodeCursor(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): string {
  const value = Buffer.from(cursor, 'base64url').toString('utf8');
  if (!value) {
    throw new ValidationError('Invalid pagination cursor');
  }
  return value;
}

/**
 * Clamps a client-supplied `first` into [1, MAX_PAGE_SIZE], defaulting when
 * absent. Returned value is the page size repositories should request — fetch
 * `clampFirst(first) + 1` rows to detect `hasNextPage`.
 */
export function clampFirst(first: number | null | undefined): number {
  if (first === null || first === undefined) {
    return DEFAULT_PAGE_SIZE;
  }
  if (!Number.isInteger(first) || first < 1) {
    throw new ValidationError('`first` must be a positive integer');
  }
  return Math.min(first, MAX_PAGE_SIZE);
}

/**
 * Builds a `Connection` from rows fetched with one extra row (`pageSize + 1`)
 * so `hasNextPage` is known without a second query. `hasPreviousPage` is true
 * whenever an `after` cursor was supplied.
 */
export function buildConnection<T>(
  rows: ReadonlyArray<T>,
  options: {
    pageSize: number;
    after: string | null | undefined;
    totalCount: number;
    getCursor: (node: T) => string;
  },
): Connection<T> {
  const { pageSize, after, totalCount, getCursor } = options;

  const hasNextPage = rows.length > pageSize;
  const nodes = hasNextPage ? rows.slice(0, pageSize) : rows.slice();

  const edges: Edge<T>[] = nodes.map((node) => ({
    cursor: getCursor(node),
    node,
  }));

  return {
    edges,
    totalCount,
    pageInfo: {
      hasNextPage,
      hasPreviousPage: Boolean(after),
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges[edges.length - 1]?.cursor ?? null,
    },
  };
}
