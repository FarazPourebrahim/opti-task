import type { ApolloCache, Reference } from '@apollo/client';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';

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

/**
 * What owns a list: an entity, or the query root for a top-level field such as
 * `myNotifications`.
 */
export type CacheOwner = CachedEntity | typeof QUERY_ROOT;

export const QUERY_ROOT = 'ROOT_QUERY';

function ownerId(cache: ApolloCache, owner: CacheOwner): string | undefined {
  return owner === QUERY_ROOT ? QUERY_ROOT : cache.identify(owner);
}

/**
 * Whether an entity is in the cache at all.
 *
 * A realtime event about something this client never loaded is dropped rather
 * than written: a half-known entity would satisfy no query, and would be read
 * back as if it were the whole thing.
 */
export function isCached(cache: ApolloCache, entity: CachedEntity): boolean {
  const cacheId = cache.identify(entity);
  if (!cacheId) return false;

  let found = false;
  cache.modify<Record<string, string>>({
    id: cacheId,
    fields: {
      // Every normalized entity stores its type; nothing is changed here.
      __typename: (value) => {
        found = true;
        return value;
      },
    },
  });
  return found;
}

/**
 * Chooses among the lists one field is cached as.
 *
 * A field cached under several argument sets (a task list per filter, the
 * notification feed with and without `unreadOnly`) is one list each. The name
 * given here is the cache's own, arguments included — for example
 * `myNotifications:{"unreadOnly":true}`.
 */
type ListFilter = (storeFieldName: string) => boolean;

type RemoveFromConnectionOptions = {
  /** What owns the connection, e.g. an `Organization`. */
  owner: CacheOwner;
  /** The connection field on the owner, e.g. `members`. */
  connectionField: string;
  /**
   * A plain count on the owner that mirrors the connection, e.g. `memberCount`.
   * Omitted when the owner keeps no such count.
   */
  countField?: string;
  /** The `id` of the row to take out. */
  nodeId: string;
  /** Limits the edit to some of the field's cached lists. All, if omitted. */
  only?: ListFilter;
};

/**
 * Takes one row out of a cached connection.
 *
 * For a delete mutation that returns only a boolean: there is nothing for the
 * normalized cache to merge, so the row is removed by hand. Evicting the row's
 * own cache entry instead would leave a dangling edge, which Apollo answers by
 * refetching the whole page.
 *
 * Every cached list of the field is edited, unless `only` narrows them. Only a
 * list that actually held the row has its total lowered: the others never
 * counted it.
 */
export function removeFromConnection(
  cache: ApolloCache,
  {
    owner,
    connectionField,
    countField,
    nodeId,
    only,
  }: RemoveFromConnectionOptions,
): void {
  const cacheId = ownerId(cache, owner);
  if (!cacheId) return;

  let wasListed = false;

  cache.modify<Record<string, CachedConnection | number>>({
    id: cacheId,
    fields: {
      [connectionField]: (
        existing,
        { readField, isReference, storeFieldName },
      ) => {
        // Not loaded, or not a connection: nothing here to edit.
        if (
          typeof existing === 'number' ||
          isReference(existing) ||
          !('edges' in existing)
        ) {
          return existing;
        }
        if (only && !only(storeFieldName)) return existing;

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

type AddToConnectionOptions = {
  /** What owns the connection, e.g. a `Task`. */
  owner: CacheOwner;
  /** The connection field on the owner, e.g. `comments`. */
  connectionField: string;
  /** The type of one edge, e.g. `CommentEdge`. */
  edgeTypename: string;
  /** The row to add. It must already be in the cache. */
  node: CachedEntity;
  /** Limits the edit to some of the field's cached lists. All, if omitted. */
  only?: ListFilter;
};

function addToConnection(
  cache: ApolloCache,
  { owner, connectionField, edgeTypename, node, only }: AddToConnectionOptions,
  position: 'start' | 'end',
): void {
  const cacheId = ownerId(cache, owner);
  if (!cacheId) return;

  cache.modify<Record<string, CachedConnection>>({
    id: cacheId,
    fields: {
      [connectionField]: (
        existing,
        { readField, isReference, toReference, storeFieldName },
      ) => {
        if (isReference(existing) || !('edges' in existing)) return existing;
        if (only && !only(storeFieldName)) return existing;

        // Already there: a mutation's own result and the realtime event for
        // the same change both arrive, in either order, and add it once.
        const isListed = existing.edges.some(
          (edge) => readField('id', edge.node) === node.id,
        );
        if (isListed) return existing;

        const reference = toReference(node);
        if (!reference) return existing;

        const edge = { __typename: edgeTypename, cursor: '', node: reference };

        return {
          ...existing,
          totalCount: existing.totalCount + 1,
          edges:
            position === 'start'
              ? [edge, ...existing.edges]
              : [...existing.edges, edge],
        };
      },
    },
  });
}

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
  options: AddToConnectionOptions,
): void {
  addToConnection(cache, options, 'end');
}

/**
 * Adds a row to the start of a cached connection that lists newest first.
 *
 * As with `appendToConnection`, the edge carries no cursor: the next page is
 * asked for from the last real one, which this row sits before.
 */
export function prependToConnection(
  cache: ApolloCache,
  options: AddToConnectionOptions,
): void {
  addToConnection(cache, options, 'start');
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

/** Adds to a plain number on the query root, e.g. an unread count. */
export function adjustRootCount(
  cache: ApolloCache,
  field: string,
  delta: number,
): void {
  cache.modify<Record<string, number>>({
    id: QUERY_ROOT,
    fields: {
      [field]: (count) =>
        typeof count === 'number' ? Math.max(0, count + delta) : count,
    },
  });
}

type WriteEntityOptions<TData> = {
  /** The entity's place in the cache. */
  entity: CachedEntity;
  fragment: TypedDocumentNode<TData, unknown>;
  /** Needed when the fragment document spreads other fragments. */
  fragmentName?: string;
  data: TData;
};

/**
 * Writes an entity a realtime event carried, in the shape of one fragment.
 *
 * The data is the server's, as a query would have returned it, so this is what
 * a refetch would have written — without the request.
 */
export function writeEntity<TData>(
  cache: ApolloCache,
  { entity, fragment, fragmentName, data }: WriteEntityOptions<TData>,
): void {
  const id = cache.identify(entity);
  if (!id) return;

  cache.writeFragment({
    id,
    fragment,
    data,
    ...(fragmentName ? { fragmentName } : {}),
  });
}
