import type { ApolloCache, Reference } from '@apollo/client';

/** A connection as the cache stores it: edges pointing at normalized rows. */
type CachedConnection = {
  edges: ReadonlyArray<{
    cursor: string;
    node: Reference;
    __typename?: string;
  }>;
  totalCount: number;
};

/** An entity as the cache files it: by type and id. */
type CachedEntity = { __typename: string; id: string };

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

type AppendToConnectionOptions = {
  /** The entity that owns the connection, e.g. a `Task`. */
  owner: CachedEntity;
  /** The connection field on the owner, e.g. `comments`. */
  connectionField: string;
  /** The type of one edge, e.g. `CommentEdge`. */
  edgeTypename: string;
  /** The row to add. It must already be in the cache. */
  node: CachedEntity;
};

/**
 * Adds a row to the end of a cached connection that lists oldest first.
 *
 * For a create mutation: the new row is the newest, so it belongs after the
 * last one, and whoever made it should see it at once.
 *
 * The edge has no cursor. Cursors are the server's, and nothing here invents
 * one. That is also what keeps the list honest when later pages have not been
 * loaded: fetching the next page keeps the rows up to the last real cursor and
 * drops this one, which then arrives in its true place with its own page.
 */
export function appendToConnection(
  cache: ApolloCache,
  { owner, connectionField, edgeTypename, node }: AppendToConnectionOptions,
): void {
  const cacheId = cache.identify(owner);
  if (!cacheId) return;

  cache.modify<Record<string, CachedConnection>>({
    id: cacheId,
    fields: {
      [connectionField]: (
        existing,
        { readField, isReference, toReference },
      ) => {
        if (isReference(existing) || !('edges' in existing)) return existing;

        const isListed = existing.edges.some(
          (edge) => readField('id', edge.node) === node.id,
        );
        if (isListed) return existing;

        const reference = toReference(node);
        if (!reference) return existing;

        return {
          ...existing,
          totalCount: existing.totalCount + 1,
          edges: [
            ...existing.edges,
            { __typename: edgeTypename, cursor: '', node: reference },
          ],
        };
      },
    },
  });
}

type ListEditOptions = {
  /** The entity that owns the list, e.g. a `Comment`. */
  owner: CachedEntity;
  /** A field holding a plain list of entities, e.g. `replies`. */
  listField: string;
  node: CachedEntity;
};

/** Adds a row to the end of a cached plain list. It must be in the cache. */
export function appendToList(
  cache: ApolloCache,
  { owner, listField, node }: ListEditOptions,
): void {
  const cacheId = cache.identify(owner);
  if (!cacheId) return;

  cache.modify<Record<string, readonly Reference[]>>({
    id: cacheId,
    fields: {
      [listField]: (existing, { readField, toReference }) => {
        if (!Array.isArray(existing)) return existing;

        const reference = toReference(node);
        const isListed = existing.some(
          (item) => readField('id', item) === node.id,
        );
        return isListed || !reference ? existing : [...existing, reference];
      },
    },
  });
}

/** Takes a row out of a cached plain list. */
export function removeFromList(
  cache: ApolloCache,
  { owner, listField, node }: ListEditOptions,
): void {
  const cacheId = cache.identify(owner);
  if (!cacheId) return;

  cache.modify<Record<string, readonly Reference[]>>({
    id: cacheId,
    fields: {
      [listField]: (existing, { readField }) =>
        Array.isArray(existing)
          ? existing.filter((item) => readField('id', item) !== node.id)
          : existing,
    },
  });
}
