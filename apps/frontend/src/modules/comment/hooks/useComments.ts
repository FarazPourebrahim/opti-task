import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback, useMemo } from 'react';
import { DEFAULT_PAGE_SIZE } from '@contracts';
import {
  CreateCommentMutation,
  DeleteCommentMutation,
  EditCommentMutation,
  LinkedCommentQuery,
  ResolveCommentMutation,
  TaskCommentsQuery,
} from '@/modules/comment/graphql/comment.operations';
import type {
  CommentEditInput,
  CommentInput,
} from '@/modules/comment/schemas/comment.schema';
import { nextPendingCommentId } from '@/modules/comment/utils/comment.utils';
import type {
  CommentBodyFragment,
  CommentThreadFragment,
} from '@/shared/graphql/generated/graphql';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { ApiError } from '@/shared/lib/apiError';
import {
  appendToConnection,
  appendToList,
  removeFromConnection,
  removeFromList,
} from '@/shared/utils/cache.utils';

/** One comment, without its replies. */
export type CommentData = CommentBodyFragment;
/** A top-level comment and the replies under it. */
export type CommentThreadData = CommentThreadFragment;

export type CommentPerson = {
  id: string;
  name: string;
  avatarUrl?: string | null | undefined;
};

/** A task's discussion: top-level comments, oldest first, replies inside. */
export function useTaskComments(taskId: string) {
  const { data, loading, error, refetch, fetchMore } = useQuery(
    TaskCommentsQuery,
    { variables: { taskId, first: DEFAULT_PAGE_SIZE } },
  );

  const connection = data?.task.comments;

  const fetchAfter = useCallback(
    (after: string) => fetchMore({ variables: { after } }),
    [fetchMore],
  );
  const { hasMore, isLoadingMore, loadMore } = useLoadMore(
    connection?.pageInfo,
    fetchAfter,
  );

  const threads = useMemo(
    () => connection?.edges.map((edge) => edge.node) ?? [],
    [connection],
  );

  return {
    threads,
    totalCount: connection?.totalCount ?? 0,
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
    hasMore,
    isLoadingMore,
    loadMore,
  };
}

/** The one comment a link points at. Asks nothing when there is no link. */
export function useLinkedComment(commentId: string | null) {
  const { data, loading, error, refetch } = useQuery(LinkedCommentQuery, {
    variables: { id: commentId ?? '' },
    skip: commentId === null,
  });

  return {
    comment: data?.comment ?? null,
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
  };
}

export type NewComment = {
  input: CommentInput;
  /** The comment being replied to, or null for a new thread. */
  parentCommentId: string | null;
  /** The viewer, as the comment will show them until the server answers. */
  author: CommentPerson;
  /** The people behind `input.mentionedUserIds`, for the same reason. */
  mentions: ReadonlyArray<{ id: string; name: string }>;
};

export function useCommentActions(taskId: string) {
  const [create] = useMutation(CreateCommentMutation);
  const [edit, { loading: isEditing }] = useMutation(EditCommentMutation);
  const [resolve] = useMutation(ResolveCommentMutation);
  const [remove] = useMutation(DeleteCommentMutation);

  /*
   * Optimistic: the comment is on screen at once, under an id of its own, and
   * Apollo takes it away again if the server refuses. The same `update` runs
   * for the stand-in and for the real comment, so both land in the same place.
   */
  const createComment = useCallback(
    async ({ input, parentCommentId, author, mentions }: NewComment) => {
      await create({
        variables: {
          taskId,
          input: {
            body: input.body,
            mentionedUserIds: input.mentionedUserIds,
            ...(parentCommentId ? { parentCommentId } : {}),
          },
        },
        optimisticResponse: {
          createComment: {
            __typename: 'Comment',
            id: nextPendingCommentId(),
            body: input.body,
            resolved: false,
            edited: false,
            editedAt: null,
            taskId,
            parentCommentId,
            createdAt: new Date().toISOString(),
            author: {
              __typename: 'User',
              id: author.id,
              name: author.name,
              avatarUrl: author.avatarUrl ?? null,
            },
            mentions: mentions.map((person) => ({
              __typename: 'User' as const,
              id: person.id,
              name: person.name,
            })),
            attachments: [],
            replies: [],
          },
        },
        update: (cache, { data }) => {
          const created = data?.createComment;
          if (!created) return;

          const node = { __typename: 'Comment', id: created.id };

          if (created.parentCommentId) {
            appendToList(cache, {
              owner: { __typename: 'Comment', id: created.parentCommentId },
              listField: 'replies',
              node,
            });
            return;
          }

          appendToConnection(cache, {
            owner: { __typename: 'Task', id: taskId },
            connectionField: 'comments',
            edgeTypename: 'CommentEdge',
            node,
          });
        },
      });
    },
    [create, taskId],
  );

  const editComment = useCallback(
    async (commentId: string, input: CommentEditInput) => {
      await edit({ variables: { id: commentId, input } });
    },
    [edit],
  );

  /** Optimistic: the thread is marked at once and put back on a refusal. */
  const resolveComment = useCallback(
    async (commentId: string, resolved: boolean) => {
      await resolve({
        variables: { id: commentId, resolved },
        optimisticResponse: {
          resolveComment: { __typename: 'Comment', id: commentId, resolved },
        },
      });
    },
    [resolve],
  );

  const deleteComment = useCallback(
    async (comment: { id: string; parentCommentId?: string | null }) => {
      await remove({
        variables: { id: comment.id },
        // The mutation returns only a boolean, so the comment is taken out of
        // the list that holds it by hand.
        update: (cache) => {
          if (comment.parentCommentId) {
            removeFromList(cache, {
              owner: { __typename: 'Comment', id: comment.parentCommentId },
              listField: 'replies',
              node: { __typename: 'Comment', id: comment.id },
            });
            return;
          }

          removeFromConnection(cache, {
            owner: { __typename: 'Task', id: taskId },
            connectionField: 'comments',
            nodeId: comment.id,
          });
        },
      });
    },
    [remove, taskId],
  );

  return {
    createComment,
    editComment,
    isEditing,
    resolveComment,
    deleteComment,
  };
}
