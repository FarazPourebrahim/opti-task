import { graphql } from '@/shared/graphql/generated';

/**
 * Notification operations.
 *
 * A notification is created by the server (an assignment, a mention); a client
 * only reads its feed and marks entries read. `myNotifications` is newest
 * first. The feed always sends `unreadOnly`: the cache keeps one list per value.
 */

export const NotificationItemFragment = graphql(`
  fragment NotificationItem on Notification {
    __typename
    id
    type
    title
    body
    entityType
    entityId
    metadata
    read
    readAt
    createdAt
  }
`);

export const UnreadNotificationCountQuery = graphql(`
  query UnreadNotificationCount {
    unreadNotificationCount
  }
`);

export const MyNotificationsQuery = graphql(`
  query MyNotifications($first: Int, $after: String, $unreadOnly: Boolean) {
    myNotifications(first: $first, after: $after, unreadOnly: $unreadOnly) {
      edges {
        cursor
        node {
          ...NotificationItem
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`);

export const MarkNotificationReadMutation = graphql(`
  mutation MarkNotificationRead($id: UUID!) {
    markNotificationRead(id: $id) {
      __typename
      id
      read
      readAt
    }
  }
`);

export const MarkAllNotificationsReadMutation = graphql(`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`);

/** Scoped by the server to the signed-in person: it takes no arguments. */
export const NotificationReceivedSubscription = graphql(`
  subscription NotificationReceived {
    notificationReceived {
      notificationId
      notification {
        ...NotificationItem
      }
    }
  }
`);
