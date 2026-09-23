import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type Connection,
  type ConnectionArgs,
  type Edge,
  type PageInfo,
} from '@contracts';
import { ValidationError } from '@/shared/errors';

/**
 * Server side of the cursor-pagination contract.
 *
 * The wire shapes and the page-size bounds are defined once in `@contracts` and
 * shared with every client, so neither side can drift. What stays here is the
 * part that is the server's alone: cursors are opaque base64 strings that only
 * this process encodes and decodes, and callers must treat them as black boxes.
 * They are re-exported so app code keeps importing pagination from one place.
 */

export { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };
export type { PageInfo, Edge, Connection, ConnectionArgs };

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
