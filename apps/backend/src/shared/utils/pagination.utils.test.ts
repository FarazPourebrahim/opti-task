import { describe, expect, it } from 'vitest';
import {
  buildConnection,
  clampFirst,
  decodeCursor,
  encodeCursor,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from './pagination.utils.js';

type Node = { id: string };

const getCursor = (node: Node): string => encodeCursor(node.id);

describe('cursor encoding', () => {
  it('round-trips a value through encode/decode', () => {
    const value = 'abc-123';
    expect(decodeCursor(encodeCursor(value))).toBe(value);
  });

  it('rejects an empty cursor', () => {
    expect(() => decodeCursor(encodeCursor(''))).toThrow();
  });
});

describe('clampFirst', () => {
  it('defaults when first is absent', () => {
    expect(clampFirst(null)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampFirst(undefined)).toBe(DEFAULT_PAGE_SIZE);
  });

  it('caps at MAX_PAGE_SIZE', () => {
    expect(clampFirst(10_000)).toBe(MAX_PAGE_SIZE);
  });

  it('rejects non-positive or non-integer values', () => {
    expect(() => clampFirst(0)).toThrow();
    expect(() => clampFirst(-5)).toThrow();
    expect(() => clampFirst(1.5)).toThrow();
  });
});

describe('buildConnection', () => {
  it('returns an explicit empty connection for zero rows', () => {
    // Arrange / Act
    const connection = buildConnection<Node>([], {
      pageSize: 10,
      after: null,
      totalCount: 0,
      getCursor,
    });

    // Assert
    expect(connection.edges).toEqual([]);
    expect(connection.totalCount).toBe(0);
    expect(connection.pageInfo.hasNextPage).toBe(false);
    expect(connection.pageInfo.hasPreviousPage).toBe(false);
    expect(connection.pageInfo.startCursor).toBeNull();
    expect(connection.pageInfo.endCursor).toBeNull();
  });

  it('reports no next page when rows fit a single page', () => {
    const rows: Node[] = [{ id: 'a' }, { id: 'b' }];

    const connection = buildConnection(rows, {
      pageSize: 5,
      after: null,
      totalCount: 2,
      getCursor,
    });

    expect(connection.edges).toHaveLength(2);
    expect(connection.pageInfo.hasNextPage).toBe(false);
    expect(connection.pageInfo.startCursor).toBe(encodeCursor('a'));
    expect(connection.pageInfo.endCursor).toBe(encodeCursor('b'));
  });

  it('detects a next page from the extra fetched row and trims it', () => {
    // pageSize 2, but 3 rows fetched (pageSize + 1) signals more pages.
    const rows: Node[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    const connection = buildConnection(rows, {
      pageSize: 2,
      after: encodeCursor('prev'),
      totalCount: 9,
      getCursor,
    });

    expect(connection.edges).toHaveLength(2);
    expect(connection.edges.map((edge) => edge.node.id)).toEqual(['a', 'b']);
    expect(connection.pageInfo.hasNextPage).toBe(true);
    expect(connection.pageInfo.hasPreviousPage).toBe(true);
    expect(connection.totalCount).toBe(9);
  });
});
