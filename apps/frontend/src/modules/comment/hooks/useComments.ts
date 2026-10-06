import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback, useMemo } from 'react';
import { DEFAULT_PAGE_SIZE } from '@contracts';
import {
  CommentAddedSubscription,
  CommentThreadFragment as CommentThreadDocument,
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
import {
  hasOwnCommentInFlight,
  nextPendingCommentId,
  trackOwnComment,
} from '@/modules/comment/utils/comment.utils';
import type {
  CommentBodyFragment,
  CommentThreadFragment,
} from '@/shared/graphql/generated/graphql';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { useRealtimeSubscription } from '@/shared/hooks/useRealtime';
import { ApiError } from '@/shared/lib/apiError';
import {
  appendToConnection,
  appendToList,
  isCached,
  removeFromConnection,
  removeFromList,
  writeEntity,
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
      await trackOwnComment(
        create({
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
        }),
      );
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

/**
 * Brings other people's comments into an open thread as they are written.
 *
 * Write source of truth: `createComment`. This only reconciles: the comment
 * the event carries is filed where a fetch would have put it, at the end of
 * the thread or under the comment it replies to. One that is already there is
 * left alone, and so is a reply whose thread this client has not loaded.
 */
export function useCommentRealtime(
  taskId: string,
  viewerId: string | undefined,
): void {
  useRealtimeSubscription(CommentAddedSubscription, {
    variables: { taskId },
    onEvent: (data, client) => {
      const comment = data.commentAdded.comment;
      if (!comment) return;
      // The viewer's own comment, still being sent: see `trackOwnComment`.
      if (comment.author.id === viewerId && hasOwnCommentInFlight()) return;

      const { cache } = client;
      const node = { __typename: 'Comment', id: comment.id };
      if (isCached(cache, node)) return;

      const parent = comment.parentCommentId
        ? { __typename: 'Comment', id: comment.parentCommentId }
        : null;
      const home = parent ?? { __typename: 'Task', id: taskId };
      if (!isCached(cache, home)) return;

      writeEntity(cache, {
        entity: node,
        fragment: CommentThreadDocument,
        fragmentName: 'CommentThread',
        data: comment,
      });

      if (parent) {
        appendToList(cache, { owner: parent, listField: 'replies', node });
        return;
      }

      appendToConnection(cache, {
        owner: home,
        connectionField: 'comments',
        edgeTypename: 'CommentEdge',
        node,
      });
    },
  });
}
