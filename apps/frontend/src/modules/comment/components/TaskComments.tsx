import {
  ConfirmDialog,
  EmptyState,
  SkeletonText,
  useToast,
} from '@averoui/react';
import { MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Role } from '@contracts';
import { AttachmentForm } from '@/modules/comment/components/AttachmentForm';
import { CommentComposer } from '@/modules/comment/components/CommentComposer';
import { CommentEditForm } from '@/modules/comment/components/CommentEditForm';
import { CommentItem } from '@/modules/comment/components/CommentItem';
import type { CommentActions } from '@/modules/comment/components/CommentItem';
import { LinkedComment } from '@/modules/comment/components/LinkedComment';
import { useAttachmentActions } from '@/modules/comment/hooks/useAttachments';
import type { AttachmentData } from '@/modules/comment/hooks/useAttachments';
import {
  useCommentActions,
  useTaskComments,
} from '@/modules/comment/hooks/useComments';
import type {
  CommentData,
  CommentPerson,
} from '@/modules/comment/hooks/useComments';
import type {
  AttachmentInput,
  CommentEditInput,
  CommentInput,
} from '@/modules/comment/schemas/comment.schema';
import {
  discussionCapabilities,
  ownsOrModerates,
} from '@/modules/comment/utils/comment.utils';
import type { MemberCandidate } from '@/modules/project/hooks/useProjectContext';
import { ErrorState, LoadMore } from '@/shared/components';
import { useErrorToast } from '@/shared/hooks/useErrorToast';
import { taskCommentPath } from '@/shared/routes/route.constants';

type TaskCommentsProps = {
  projectId: string;
  taskId: string;
  /** The viewer's roles on the project — capability hints only. */
  roles: readonly Role[];
  viewer: CommentPerson | null;
  /** Project members: who a comment can mention. */
  members: readonly MemberCandidate[];
  /** A new comment also adds an entry to the task's audit trail. */
  onCommentAdded: () => void;
};

/** The one form open under a comment at a time. */
type OpenForm = { kind: 'reply' | 'edit' | 'attach'; commentId: string };

/**
 * A task's discussion: threads oldest first, replies inside their thread, and
 * a composer at the end.
 *
 * Replies go one level deep. A reply is always filed under the thread's first
 * comment, so every comment written here is one this screen can show.
 */
export function TaskComments({
  projectId,
  taskId,
  roles,
  viewer,
  members,
  onCommentAdded,
}: TaskCommentsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const showError = useErrorToast();
  const {
    threads,
    totalCount,
    isLoading,
    error,
    refetch,
    hasMore,
    isLoadingMore,
    loadMore,
  } = useTaskComments(taskId);
  const {
    createComment,
    editComment,
    isEditing,
    resolveComment,
    deleteComment,
  } = useCommentActions(taskId);
  const { addCommentAttachment, isAddingToComment, removeAttachment } =
    useAttachmentActions(taskId);

  const [openForm, setOpenForm] = useState<OpenForm | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CommentData | null>(null);

  // Hints only: the server refuses each action to anyone else.
  const { canComment, canModerate } = discussionCapabilities(roles);
  const mentionCandidates = members.filter(
    (member) => member.id !== viewer?.id,
  );

  function isOpen(kind: OpenForm['kind'], commentId: string) {
    return openForm?.kind === kind && openForm.commentId === commentId;
  }

  async function handleCreate(
    input: CommentInput,
    parentCommentId: string | null,
  ) {
    if (!viewer) return;

    await createComment({
      input,
      parentCommentId,
      author: viewer,
      mentions: members.filter((member) =>
        input.mentionedUserIds.includes(member.id),
      ),
    });
    if (parentCommentId) setOpenForm(null);
    onCommentAdded();
  }

  async function handleEdit(comment: CommentData, input: CommentEditInput) {
    await editComment(comment.id, input);
    toast({ tone: 'success', title: t('comment.updated') });
    setOpenForm(null);
  }

  function handleResolve(comment: CommentData, resolved: boolean) {
    // Optimistic: the badge has already changed. A refusal puts it back.
    resolveComment(comment.id, resolved).catch(showError);
  }

  async function handleAttach(comment: CommentData, input: AttachmentInput) {
    await addCommentAttachment(comment.id, input);
    toast({
      tone: 'success',
      title: t('attachment.recorded', { name: input.filename }),
    });
    setOpenForm(null);
  }

  async function handleRemoveAttachment(
    comment: CommentData,
    attachment: AttachmentData,
  ) {
    try {
      await removeAttachment(attachment.id, {
        __typename: 'Comment',
        id: comment.id,
      });
      toast({
        tone: 'success',
        title: t('attachment.removed', { name: attachment.filename }),
      });
    } catch (removeError) {
      showError(removeError);
    }
  }

  async function handleCopyLink(comment: CommentData) {
    const link = new URL(
      taskCommentPath(projectId, taskId, comment.id),
      window.location.origin,
    );

    try {
      await navigator.clipboard.writeText(link.toString());
      toast({ tone: 'success', title: t('comment.linkCopied') });
    } catch {
      // No clipboard access (an insecure page, or permission refused).
      toast({ tone: 'danger', title: t('comment.linkCopyFailed') });
    }
  }

  /* Never rejects: ConfirmDialog stays open until this settles, and a failure
     is reported through the toast. */
  async function handleDelete() {
    if (!pendingDelete) return;

    try {
      await deleteComment(pendingDelete);
      toast({ tone: 'success', title: t('comment.deleted') });
    } catch (deleteError) {
      showError(deleteError);
    } finally {
      setPendingDelete(null);
    }
  }

  function actionsFor(comment: CommentData, isReply: boolean): CommentActions {
    const isOwnOrModerated = ownsOrModerates(
      canModerate,
      viewer?.id,
      comment.author.id,
    );
    const toggle = (kind: OpenForm['kind']) => () =>
      setOpenForm(
        isOpen(kind, comment.id) ? null : { kind, commentId: comment.id },
      );

    return {
      onReply: canComment && !isReply ? toggle('reply') : undefined,
      // A thread is resolved as a whole, from its first comment.
      onResolve:
        isOwnOrModerated && !isReply
          ? (resolved) => handleResolve(comment, resolved)
          : undefined,
      onEdit: isOwnOrModerated ? toggle('edit') : undefined,
      onAttach: canComment ? toggle('attach') : undefined,
      onCopyLink: () => void handleCopyLink(comment),
      onDelete: isOwnOrModerated ? () => setPendingDelete(comment) : undefined,
    };
  }

  function renderComment(comment: CommentData, isReply: boolean) {
    return (
      <CommentItem
        comment={comment}
        actions={actionsFor(comment, isReply)}
        editor={
          isOpen('edit', comment.id) ? (
            <CommentEditForm
              initialBody={comment.body}
              hasMentions={comment.mentions.length > 0}
              isPending={isEditing}
              onSubmit={(input) => handleEdit(comment, input)}
              onCancel={() => setOpenForm(null)}
            />
          ) : undefined
        }
        canRemoveAttachment={(attachment) =>
          ownsOrModerates(canModerate, viewer?.id, attachment.uploadedBy.id)
        }
        onRemoveAttachment={(attachment) =>
          handleRemoveAttachment(comment, attachment)
        }
      >
        {isOpen('attach', comment.id) ? (
          <AttachmentForm
            isPending={isAddingToComment}
            onSubmit={(input) => handleAttach(comment, input)}
            onCancel={() => setOpenForm(null)}
          />
        ) : null}
      </CommentItem>
    );
  }

  if (isLoading) {
    return (
      <div aria-busy="true" aria-label={t('comment.loading')}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title={t('comment.loadFailed')}
        description={t(error.messageKey as never)}
        requestId={error.requestId}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <LinkedComment taskId={taskId} />

      {threads.length === 0 ? (
        <EmptyState variant="icon" icon={<MessageSquare />}>
          {canComment ? t('comment.emptyCanComment') : t('comment.empty')}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <ol className="divide-border-subtle flex flex-col divide-y">
            {threads.map((thread) => (
              <li
                key={thread.id}
                className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0"
              >
                {renderComment(thread, false)}

                {thread.replies.length > 0 ? (
                  <ol
                    className="border-border-subtle ms-4 flex flex-col gap-4 border-s ps-4"
                    aria-label={t('comment.repliesLabel', {
                      name: thread.author.name,
                    })}
                  >
                    {thread.replies.map((reply) => (
                      <li key={reply.id}>{renderComment(reply, true)}</li>
                    ))}
                  </ol>
                ) : null}

                {isOpen('reply', thread.id) ? (
                  <div className="ms-4 ps-4">
                    <CommentComposer
                      label={t('comment.replyTo', {
                        name: thread.author.name,
                      })}
                      submitLabel={t('comment.reply')}
                      mentionCandidates={mentionCandidates}
                      onSubmit={(input) => handleCreate(input, thread.id)}
                      onCancel={() => setOpenForm(null)}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          <LoadMore
            shown={threads.length}
            total={totalCount}
            hasMore={hasMore}
            isLoading={isLoadingMore}
            onLoadMore={() => void loadMore()}
          />
        </div>
      )}

      {canComment && viewer ? (
        <CommentComposer
          label={t('comment.add')}
          submitLabel={t('comment.submit')}
          mentionCandidates={mentionCandidates}
          onSubmit={(input) => handleCreate(input, null)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t('comment.deleteConfirmTitle', {
          name: pendingDelete?.author.name ?? '',
        })}
        description={
          pendingDelete?.parentCommentId
            ? t('comment.deleteReplyConfirmBody')
            : t('comment.deleteConfirmBody')
        }
        confirmLabel={t('comment.delete')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={handleDelete}
      />
    </div>
  );
}
