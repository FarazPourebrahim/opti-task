/**
 * Comment GraphQL contract: threaded comments on tasks with mentions, edit, and
 * resolve, plus file attachments (metadata behind a swappable storage adapter).
 * Adds `comments`/`attachments` to `Task`. `Attachment.url` is produced by the
 * active storage adapter.
 */
export const commentTypeDefs = /* GraphQL */ `
  type Attachment {
    id: UUID!
    filename: String!
    contentType: String
    sizeBytes: Float
    url: String!
    uploadedBy: User!
    createdAt: DateTime!
  }

  type Comment {
    id: UUID!
    body: String!
    resolved: Boolean!
    edited: Boolean!
    editedAt: DateTime
    taskId: UUID!
    parentCommentId: UUID
    author: User!
    mentions: [User!]!
    replies: [Comment!]!
    attachments: [Attachment!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type CommentEdge {
    cursor: String!
    node: Comment!
  }

  type CommentConnection {
    edges: [CommentEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input CreateCommentInput {
    body: String!
    parentCommentId: UUID
    mentionedUserIds: [UUID!]
  }

  input UpdateCommentInput {
    body: String!
  }

  input AddAttachmentInput {
    filename: String!
    contentType: String
    sizeBytes: Int
  }

  extend type Task {
    comments(first: Int, after: String): CommentConnection!
    commentCount: Int!
    attachments: [Attachment!]!
  }

  extend type Query {
    comment(id: UUID!): Comment!
  }

  extend type Mutation {
    createComment(taskId: UUID!, input: CreateCommentInput!): Comment!
    editComment(id: UUID!, input: UpdateCommentInput!): Comment!
    resolveComment(id: UUID!, resolved: Boolean!): Comment!
    deleteComment(id: UUID!): Boolean!
    addTaskAttachment(taskId: UUID!, input: AddAttachmentInput!): Attachment!
    addCommentAttachment(commentId: UUID!, input: AddAttachmentInput!): Attachment!
    removeAttachment(id: UUID!): Boolean!
  }
`;
