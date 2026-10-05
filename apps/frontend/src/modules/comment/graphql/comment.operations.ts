import { graphql } from '@/shared/graphql/generated';

/**
 * Comment and attachment operations.
 *
 * `Task.comments` pages through top-level comments only, oldest first; a
 * comment's replies arrive with it as a plain list. The deepest path here is 8,
 * under the API's limit of 12.
 *
 * `Attachment.url` is deliberately never selected: the API stores a record of a
 * file, not the file, and the address it returns leads nowhere.
 */

export const CommentPersonFragment = graphql(`
  fragment CommentPerson on User {
    id
    name
    avatarUrl
  }
`);

export const AttachmentItemFragment = graphql(`
  fragment AttachmentItem on Attachment {
    id
    filename
    contentType
    sizeBytes
    createdAt
    uploadedBy {
      id
      name
    }
  }
`);

/*
 * `__typename` is selected explicitly wherever a comment is written to the
 * cache by hand: an optimistic comment cannot be filed unless the cache is told
 * what it is.
 */
export const CommentBodyFragment = graphql(`
  fragment CommentBody on Comment {
    __typename
    id
    body
    resolved
    edited
    editedAt
    taskId
    parentCommentId
    createdAt
    author {
      __typename
      ...CommentPerson
    }
    mentions {
      __typename
      id
      name
    }
    attachments {
      ...AttachmentItem
    }
  }
`);

export const CommentThreadFragment = graphql(`
  fragment CommentThread on Comment {
    ...CommentBody
    replies {
      ...CommentBody
    }
  }
`);

export const TaskCommentsQuery = graphql(`
  query TaskComments($taskId: UUID!, $first: Int, $after: String) {
    task(id: $taskId) {
      id
      comments(first: $first, after: $after) {
        edges {
          cursor
          node {
            ...CommentThread
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
    }
  }
`);

/** One comment by id: what a link to a comment opens. */
export const LinkedCommentQuery = graphql(`
  query LinkedComment($id: UUID!) {
    comment(id: $id) {
      ...CommentThread
    }
  }
`);

export const TaskAttachmentsQuery = graphql(`
  query TaskAttachments($taskId: UUID!) {
    task(id: $taskId) {
      id
      attachments {
        ...AttachmentItem
      }
    }
  }
`);

export const CreateCommentMutation = graphql(`
  mutation CreateComment($taskId: UUID!, $input: CreateCommentInput!) {
    createComment(taskId: $taskId, input: $input) {
      ...CommentThread
    }
  }
`);

export const EditCommentMutation = graphql(`
  mutation EditComment($id: UUID!, $input: UpdateCommentInput!) {
    editComment(id: $id, input: $input) {
      id
      body
      edited
      editedAt
    }
  }
`);

export const ResolveCommentMutation = graphql(`
  mutation ResolveComment($id: UUID!, $resolved: Boolean!) {
    resolveComment(id: $id, resolved: $resolved) {
      __typename
      id
      resolved
    }
  }
`);

export const DeleteCommentMutation = graphql(`
  mutation DeleteComment($id: UUID!) {
    deleteComment(id: $id)
  }
`);

export const AddTaskAttachmentMutation = graphql(`
  mutation AddTaskAttachment($taskId: UUID!, $input: AddAttachmentInput!) {
    addTaskAttachment(taskId: $taskId, input: $input) {
      ...AttachmentItem
    }
  }
`);

export const AddCommentAttachmentMutation = graphql(`
  mutation AddCommentAttachment(
    $commentId: UUID!
    $input: AddAttachmentInput!
  ) {
    addCommentAttachment(commentId: $commentId, input: $input) {
      ...AttachmentItem
    }
  }
`);

export const RemoveAttachmentMutation = graphql(`
  mutation RemoveAttachment($id: UUID!) {
    removeAttachment(id: $id)
  }
`);
