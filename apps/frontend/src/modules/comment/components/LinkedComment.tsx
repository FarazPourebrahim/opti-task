import { Button, EmptyState, SkeletonText } from '@averoui/react';
import { Link2Off } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { CommentItem } from '@/modules/comment/components/CommentItem';
import { useLinkedComment } from '@/modules/comment/hooks/useComments';
import { ErrorState } from '@/shared/components';
import { ROUTE_SEARCH } from '@/shared/routes/route.constants';
import { isUuid } from '@/shared/utils/id.utils';

type LinkedCommentProps = {
  /** The task on screen: a comment from another task is not shown here. */
  taskId: string;
};

const neverRemovable = () => false;
const nothingToRemove = () => Promise.resolve();

/**
 * The comment a link points at, shown above the discussion.
 *
 * A link can name a comment on a page of the thread that has not been loaded,
 * or a reply, so it is fetched on its own rather than looked for in the list.
 * It is shown read-only; the same comment in the thread below has its actions.
 */
export function LinkedComment({ taskId }: LinkedCommentProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const linked = searchParams.get(ROUTE_SEARCH.comment);
  // A value that cannot be an id is not asked about: it is simply not here.
  const commentId = isUuid(linked ?? undefined) ? linked : null;
  const { comment, isLoading, error, refetch } = useLinkedComment(commentId);

  if (linked === null) return null;

  function dismiss() {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(ROUTE_SEARCH.comment);
        return next;
      },
      { replace: true },
    );
  }

  const isGone =
    commentId === null ||
    error?.kind === 'not_found' ||
    error?.kind === 'forbidden' ||
    (comment !== null && comment.taskId !== taskId);

  function renderBody() {
    if (isGone) {
      return (
        <EmptyState variant="icon" icon={<Link2Off />}>
          {t('comment.linked.gone')}
        </EmptyState>
      );
    }

    if (isLoading) {
      return (
        <div aria-busy="true" aria-label={t('comment.loading')}>
          <SkeletonText lines={2} />
        </div>
      );
    }

    if (error || !comment) {
      return (
        <ErrorState
          title={t('comment.linked.loadFailed')}
          description={error ? t(error.messageKey as never) : undefined}
          requestId={error?.requestId}
          onRetry={() => void refetch()}
        />
      );
    }

    return (
      <CommentItem
        comment={comment}
        canRemoveAttachment={neverRemovable}
        onRemoveAttachment={nothingToRemove}
      />
    );
  }

  return (
    <section
      className="border-border-subtle bg-surface-muted flex flex-col gap-3 rounded-xl border p-4"
      aria-labelledby="linked-comment-title"
    >
      <div className="flex items-center justify-between gap-3">
        <h4
          id="linked-comment-title"
          className="text-text-strong text-sm font-semibold"
        >
          {t('comment.linked.title')}
        </h4>
        <Button variant="ghost" size="sm" onClick={dismiss}>
          {t('comment.linked.dismiss')}
        </Button>
      </div>
      {renderBody()}
    </section>
  );
}
