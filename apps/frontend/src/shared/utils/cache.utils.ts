import type { ApolloCache, Reference } from '@apollo/client';

/** A connection as the cache stores it: edges pointing at normalized rows. */
type CachedConnection = {
  edges: ReadonlyArray<{ cursor: string; node: Reference }>;
  totalCount: number;
};

type RemoveFromConnectionOptions = {
  /** The entity that owns the connection, e.g. an `Organization`. */
  owner: { __typename: string; id: string };
  /** The connection field on the owner, e.g. `members`. */
  connectionField: string;
  /** A plain count on the owner that mirrors the connection, e.g. `memberCount`. */
  countField: string;
  /** The `id` of the row to take out. */
  nodeId: string;
};

/**
 * Takes one row out of a cached connection.
 *
 * For a delete mutation that returns only a boolean: there is nothing for the
 * normalized cache to merge, so the row is removed by hand. Evicting the row's
 * own cache entry instead would leave a dangling edge, which Apollo answers by
 * refetching the whole page.
 */
export function removeFromConnection(
  cache: ApolloCache,
  { owner, connectionField, countField, nodeId }: RemoveFromConnectionOptions,
): void {
  const cacheId = cache.identify(owner);
  if (!cacheId) return;

  cache.modify<Record<string, CachedConnection | number>>({
    id: cacheId,
    fields: {
      [countField]: (count) =>
        typeof count === 'number' ? Math.max(0, count - 1) : count,
      [connectionField]: (existing, { readField, isReference }) => {
        // Not loaded, or not a connection: nothing here to edit.
        if (
          typeof existing === 'number' ||
          isReference(existing) ||
          !('edges' in existing)
        ) {
          return existing;
        }

        return {
          ...existing,
          totalCount: Math.max(0, existing.totalCount - 1),
          edges: existing.edges.filter(
            (edge) => readField('id', edge.node) !== nodeId,
          ),
        };
      },
    },
  });
}
