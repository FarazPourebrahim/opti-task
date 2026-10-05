import { Button, EmptyState, SkeletonText, useToast } from '@averoui/react';
import { Paperclip } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Role } from '@contracts';
import { AttachmentForm } from '@/modules/comment/components/AttachmentForm';
import { AttachmentList } from '@/modules/comment/components/AttachmentList';
import {
  useAttachmentActions,
  useTaskAttachments,
} from '@/modules/comment/hooks/useAttachments';
import type { AttachmentData } from '@/modules/comment/hooks/useAttachments';
import type { AttachmentInput } from '@/modules/comment/schemas/comment.schema';
import {
  discussionCapabilities,
  ownsOrModerates,
} from '@/modules/comment/utils/comment.utils';
import { ErrorState } from '@/shared/components';
import { useErrorToast } from '@/shared/hooks/useErrorToast';

type TaskAttachmentsProps = {
  taskId: string;
  /** The viewer's roles on the project — capability hints only. */
  roles: readonly Role[];
  viewerId: string | undefined;
};

/**
 * The attachment records on a task.
 *
 * What is kept is a record — a name, a type, a size — and never the file. That
 * is said here whether or not anything is listed, so nobody takes a record for
 * a file they can come back for.
 */
export function TaskAttachments({
  taskId,
  roles,
  viewerId,
}: TaskAttachmentsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const showError = useErrorToast();
  const { attachments, isLoading, error, refetch } = useTaskAttachments(taskId);
  const { addTaskAttachment, isAddingToTask, removeAttachment } =
    useAttachmentActions(taskId);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Hints only: the server refuses each action to anyone else.
  const { canComment, canModerate } = discussionCapabilities(roles);

  async function handleAdd(input: AttachmentInput) {
    await addTaskAttachment(input);
    toast({
      tone: 'success',
      title: t('attachment.recorded', { name: input.filename }),
    });
    setIsFormOpen(false);
  }

  async function handleRemove(attachment: AttachmentData) {
    try {
      await removeAttachment(attachment.id, { __typename: 'Task', id: taskId });
      toast({
        tone: 'success',
        title: t('attachment.removed', { name: attachment.filename }),
      });
    } catch (removeError) {
      showError(removeError);
    }
  }

  if (isLoading) {
    return (
      <div aria-busy="true" aria-label={t('attachment.loading')}>
        <SkeletonText lines={2} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title={t('attachment.loadFailed')}
        description={t(error.messageKey as never)}
        requestId={error.requestId}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-text-subtle text-sm">{t('attachment.recordsOnly')}</p>

      {attachments.length === 0 ? (
        <EmptyState variant="icon" icon={<Paperclip />}>
          {t('attachment.empty')}
        </EmptyState>
      ) : (
        <AttachmentList
          attachments={attachments}
          canRemove={(attachment) =>
            ownsOrModerates(canModerate, viewerId, attachment.uploadedBy.id)
          }
          onRemove={handleRemove}
        />
      )}

      {canComment && isFormOpen ? (
        <AttachmentForm
          isPending={isAddingToTask}
          onSubmit={handleAdd}
          onCancel={() => setIsFormOpen(false)}
        />
      ) : null}

      {canComment && !isFormOpen ? (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFormOpen(true)}
          >
            {t('attachment.recordNew')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
