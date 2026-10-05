import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback } from 'react';
import {
  AddCommentAttachmentMutation,
  AddTaskAttachmentMutation,
  RemoveAttachmentMutation,
  TaskAttachmentsQuery,
} from '@/modules/comment/graphql/comment.operations';
import type { AttachmentInput } from '@/modules/comment/schemas/comment.schema';
import type { AttachmentItemFragment } from '@/shared/graphql/generated/graphql';
import { ApiError } from '@/shared/lib/apiError';
import { appendToList, removeFromList } from '@/shared/utils/cache.utils';

export type AttachmentData = AttachmentItemFragment;

/** What an attachment hangs off: the task itself, or one of its comments. */
export type AttachmentOwner = { __typename: 'Task' | 'Comment'; id: string };

/** The attachment records on the task itself (not those on its comments). */
export function useTaskAttachments(taskId: string) {
  const { data, loading, error, refetch } = useQuery(TaskAttachmentsQuery, {
    variables: { taskId },
  });

  return {
    attachments: data?.task.attachments ?? [],
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
  };
}

/*
 * An attachment is a record of a file — its name, type and size — and nothing
 * more: the API neither receives nor serves the file itself. Each mutation
 * returns the record (or a boolean), so the owner's list is edited by hand.
 */
export function useAttachmentActions(taskId: string) {
  const [addToTask, { loading: isAddingToTask }] = useMutation(
    AddTaskAttachmentMutation,
  );
  const [addToComment, { loading: isAddingToComment }] = useMutation(
    AddCommentAttachmentMutation,
  );
  const [remove] = useMutation(RemoveAttachmentMutation);

  const addTaskAttachment = useCallback(
    async (input: AttachmentInput) => {
      await addToTask({
        variables: { taskId, input },
        update: (cache, { data }) => {
          if (!data) return;

          appendToList(cache, {
            owner: { __typename: 'Task', id: taskId },
            listField: 'attachments',
            node: { __typename: 'Attachment', id: data.addTaskAttachment.id },
          });
        },
      });
    },
    [addToTask, taskId],
  );

  const addCommentAttachment = useCallback(
    async (commentId: string, input: AttachmentInput) => {
      await addToComment({
        variables: { commentId, input },
        update: (cache, { data }) => {
          if (!data) return;

          appendToList(cache, {
            owner: { __typename: 'Comment', id: commentId },
            listField: 'attachments',
            node: {
              __typename: 'Attachment',
              id: data.addCommentAttachment.id,
            },
          });
        },
      });
    },
    [addToComment],
  );

  const removeAttachment = useCallback(
    async (attachmentId: string, owner: AttachmentOwner) => {
      await remove({
        variables: { id: attachmentId },
        update: (cache) =>
          removeFromList(cache, {
            owner,
            listField: 'attachments',
            node: { __typename: 'Attachment', id: attachmentId },
          }),
      });
    },
    [remove],
  );

  return {
    addTaskAttachment,
    isAddingToTask,
    addCommentAttachment,
    isAddingToComment,
    removeAttachment,
  };
}
