import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback, useMemo } from 'react';
import { DEFAULT_PAGE_SIZE } from '@contracts';
import { UNREAD_FEED_MARKER } from '@/modules/notification/constants/notification.constants';
import {
  MarkAllNotificationsReadMutation,
  MarkNotificationReadMutation,
  MyNotificationsQuery,
  NotificationItemFragment,
  NotificationReceivedSubscription,
  UnreadNotificationCountQuery,
} from '@/modules/notification/graphql/notification.operations';
import type { NotificationItemFragment as NotificationItemData } from '@/shared/graphql/generated/graphql';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { useRealtimeSubscription } from '@/shared/hooks/useRealtime';
import { ApiError } from '@/shared/lib/apiError';
import {
  QUERY_ROOT,
  adjustRootCount,
  isCached,
  prependToConnection,
  removeFromConnection,
  writeEntity,
} from '@/shared/utils/cache.utils';

export type NotificationData = NotificationItemData;

const FEED_FIELD = 'myNotifications';
const COUNT_FIELD = 'unreadNotificationCount';

/** How many notifications the signed-in person has not read. */
export function useUnreadNotificationCount(): number {
  const { data } = useQuery(UnreadNotificationCountQuery);

  // A count that cannot be read is shown as none: the bell still opens the
  // feed, which reports its own failure.
  return data?.unreadNotificationCount ?? 0;
}

type FeedOptions = {
  unreadOnly: boolean;
  /** Holds the request back, e.g. until the bell's popover is opened. */
  skip?: boolean;
};

/** The signed-in person's notifications, newest first. */
export function useNotificationFeed({ unreadOnly, skip = false }: FeedOptions) {
  const { data, previousData, loading, error, refetch, fetchMore } = useQuery(
    MyNotificationsQuery,
    { variables: { first: DEFAULT_PAGE_SIZE, unreadOnly }, skip },
  );

  // While the other filter loads, the rows already on screen stay there.
  const connection = (data ?? previousData)?.myNotifications;

  const fetchAfter = useCallback(
    (after: string) => fetchMore({ variables: { after } }),
    [fetchMore],
  );
  const { hasMore, isLoadingMore, loadMore } = useLoadMore(
    connection?.pageInfo,
    fetchAfter,
  );

  const notifications = useMemo(
    () => connection?.edges.map((edge) => edge.node) ?? [],
    [connection],
  );

  return {
    notifications,
    totalCount: connection?.totalCount ?? 0,
    isLoading: loading && !connection,
    error: ApiError.is(error) ? error : null,
    refetch,
    hasMore,
    isLoadingMore,
    loadMore,
  };
}

export function useNotificationActions() {
  const [markRead] = useMutation(MarkNotificationReadMutation);
  const [markAll, { loading: isMarkingAll }] = useMutation(
    MarkAllNotificationsReadMutation,
  );

  /*
   * The mutation returns the notification by id, so every list showing it
   * follows. What it cannot do is lower the count or take the row out of the
   * unread-only list. Both are corrected here, once, and only when the
   * notification really was unread.
   */
  const markNotificationRead = useCallback(
    async (notification: { id: string; read: boolean }) => {
      if (notification.read) return;

      await markRead({
        variables: { id: notification.id },
        update: (cache) => {
          adjustRootCount(cache, COUNT_FIELD, -1);
          removeFromConnection(cache, {
            owner: QUERY_ROOT,
            connectionField: FEED_FIELD,
            nodeId: notification.id,
            only: (name) => name.includes(UNREAD_FEED_MARKER),
          });
        },
      });
    },
    [markRead],
  );

  /** Resolves with how many were marked. */
  const markAllNotificationsRead = useCallback(async () => {
    const result = await markAll({
      update: (cache) => {
        // Which rows changed is the server's to say: the feeds are re-read,
        // and the count is known to be none.
        cache.evict({ id: QUERY_ROOT, fieldName: FEED_FIELD });
        cache.gc();
        adjustRootCount(cache, COUNT_FIELD, Number.NEGATIVE_INFINITY);
      },
    });
    return result.data?.markAllNotificationsRead ?? 0;
  }, [markAll]);

  return { markNotificationRead, markAllNotificationsRead, isMarkingAll };
}

/**
 * Keeps the feed and the count current as notifications arrive.
 *
 * The server is the only writer of notifications. This files a new one where a
 * fetch would have put it: first in each cached feed, and one more unread. A
 * notification this client already holds is left alone, so an event that
 * repeats changes nothing.
 */
export function useNotificationRealtime(
  onReceived?: (notification: NotificationData) => void,
): void {
  useRealtimeSubscription(NotificationReceivedSubscription, {
    variables: {},
    onEvent: (data, client) => {
      const notification = data.notificationReceived.notification;
      if (!notification) return;

      const { cache } = client;
      const node = { __typename: 'Notification', id: notification.id };
      if (isCached(cache, node)) return;

      writeEntity(cache, {
        entity: node,
        fragment: NotificationItemFragment,
        data: notification,
      });
      prependToConnection(cache, {
        owner: QUERY_ROOT,
        connectionField: FEED_FIELD,
        edgeTypename: 'NotificationEdge',
        node,
        // A notification that arrives read belongs to the full feed only.
        ...(notification.read
          ? { only: (name: string) => !name.includes(UNREAD_FEED_MARKER) }
          : {}),
      });
      if (!notification.read) adjustRootCount(cache, COUNT_FIELD, 1);

      onReceived?.(notification);
    },
  });
}
