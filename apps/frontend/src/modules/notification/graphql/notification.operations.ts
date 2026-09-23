import { graphql } from '@/shared/graphql/generated';

/**
 * Notification feed operations.
 *
 * Phase 11 builds the feed UI on these. They land here in Phase 3 because the
 * cache policies need a genuinely paginated, genuinely filtered connection to
 * be proven against — `myNotifications` is both.
 */
export const MyNotificationsQuery = graphql(`
  query MyNotifications($first: Int, $after: String, $unreadOnly: Boolean) {
    myNotifications(first: $first, after: $after, unreadOnly: $unreadOnly) {
      edges {
        cursor
        node {
          id
          type
          title
          body
          read
          createdAt
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

export const UnreadNotificationCountQuery = graphql(`
  query UnreadNotificationCount {
    unreadNotificationCount
  }
`);
