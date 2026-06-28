/**
 * Notification GraphQL contract: a per-recipient in-app feed with read/unread
 * state. Notifications are created by domain event handlers (assignment,
 * mention, …), never by a client mutation — clients only read and mark them.
 */
export const notificationTypeDefs = /* GraphQL */ `
  enum NotificationType {
    TASK_ASSIGNED
    MENTION
    SPRINT_UPDATE
    DEADLINE_REMINDER
    AI_RECOMMENDATION
    APPROVAL_REQUEST
  }

  type Notification {
    id: UUID!
    type: NotificationType!
    title: String!
    body: String
    entityType: String
    entityId: UUID
    metadata: JSON!
    read: Boolean!
    readAt: DateTime
    createdAt: DateTime!
  }

  type NotificationEdge {
    cursor: String!
    node: Notification!
  }

  type NotificationConnection {
    edges: [NotificationEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  extend type Query {
    myNotifications(first: Int, after: String, unreadOnly: Boolean): NotificationConnection!
    unreadNotificationCount: Int!
  }

  extend type Mutation {
    markNotificationRead(id: UUID!): Notification!
    markAllNotificationsRead: Int!
  }
`;
