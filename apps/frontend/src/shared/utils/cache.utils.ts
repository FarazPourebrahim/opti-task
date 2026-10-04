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
  /**
   * A plain count on the owner that mirrors the connection, e.g. `memberCount`.
   * Omitted when the owner keeps no such count.
   */
  countField?: string;
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
 *
 * A field cached under several argument sets (a task list per filter) is one
 * list each, and every one of them is edited. Only a list that actually held
 * the row has its total lowered: the others never counted it.
 */
export function removeFromConnection(
  cache: ApolloCache,
  { owner, connectionField, countField, nodeId }: RemoveFromConnectionOptions,
): void {
  const cacheId = cache.identify(owner);
  if (!cacheId) return;

  let wasListed = false;

  cache.modify<Record<string, CachedConnection | number>>({
    id: cacheId,
    fields: {
      [connectionField]: (existing, { readField, isReference }) => {
        // Not loaded, or not a connection: nothing here to edit.
        if (
          typeof existing === 'number' ||
          isReference(existing) ||
          !('edges' in existing)
        ) {
          return existing;
        }

        const edges = existing.edges.filter(
          (edge) => readField('id', edge.node) !== nodeId,
        );
        if (edges.length === existing.edges.length) return existing;

        wasListed = true;
        return {
          ...existing,
          totalCount: Math.max(0, existing.totalCount - 1),
          edges,
        };
      },
    },
  });

  if (!countField || !wasListed) return;

  cache.modify<Record<string, CachedConnection | number>>({
    id: cacheId,
    fields: {
      [countField]: (count) =>
        typeof count === 'number' ? Math.max(0, count - 1) : count,
    },
  });
}
