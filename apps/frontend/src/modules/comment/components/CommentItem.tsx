import { Avatar, Badge, Button } from '@averoui/react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { AttachmentList } from '@/modules/comment/components/AttachmentList';
import type { AttachmentData } from '@/modules/comment/hooks/useAttachments';
import type { CommentData } from '@/modules/comment/hooks/useComments';
import { isPendingComment } from '@/modules/comment/utils/comment.utils';
import { AppLink } from '@/shared/components';
import { userPath } from '@/shared/routes/route.constants';
import { formatRelativeTime } from '@/shared/utils/date.utils';

/**
 * What can be done to a comment. A control is shown only for a handler that is
 * given, so the caller decides who is offered what and this stays a view.
 */
export type CommentActions = {
  onReply?: (() => void) | undefined;
  /** Receives the state to move to: true resolves, false reopens. */
  onResolve?: ((resolved: boolean) => void) | undefined;
  onEdit?: (() => void) | undefined;
  onAttach?: (() => void) | undefined;
  onCopyLink?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
};

type CommentItemProps = {
  comment: CommentData;
  actions?: CommentActions | undefined;
  /** Shown in place of the text while the comment is being edited. */
  editor?: ReactNode;
  /** A hint, not a guard: whether the viewer may remove this record. */
  canRemoveAttachment: (attachment: AttachmentData) => boolean;
  /** Never rejects. */
  onRemoveAttachment: (attachment: AttachmentData) => Promise<void>;
  /** A form opened from one of the actions, shown under the comment. */
  children?: ReactNode;
};

/** One comment: who, when, what, whom it mentions and what is attached. */
export function CommentItem({
  comment,
  actions = {},
  editor,
  canRemoveAttachment,
  onRemoveAttachment,
  children,
}: CommentItemProps) {
  const { t, i18n } = useTranslation();
  const { author } = comment;

  // On screen ahead of the server's answer: there is no real comment to act on.
  const isPending = isPendingComment(comment.id);
  const offered = isPending ? {} : actions;

  const mentioned = new Intl.ListFormat(i18n.language, {
    type: 'conjunction',
  }).format(comment.mentions.map((person) => person.name));

  const hasActions = Object.values(offered).some(Boolean);

  return (
    <article
      className="flex gap-3"
      aria-label={t('comment.byAuthor', { name: author.name })}
    >
      <Avatar
        size="sm"
        name={author.name}
        {...(author.avatarUrl ? { src: author.avatarUrl } : {})}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <AppLink
            to={userPath(author.id)}
            variant="subtle"
            className="font-medium"
          >
            {author.name}
          </AppLink>
          {isPending ? (
            <span className="text-text-subtle text-xs" role="status">
              {t('comment.sending')}
            </span>
          ) : (
            <time
              dateTime={comment.createdAt}
              className="text-text-subtle text-xs"
            >
              {formatRelativeTime(comment.createdAt)}
            </time>
          )}
          {comment.edited ? (
            <span className="text-text-subtle text-xs">
              {t('comment.edited')}
            </span>
          ) : null}
          {comment.resolved ? (
            <Badge tone="success">{t('comment.resolved')}</Badge>
          ) : null}
        </div>

        {editor ?? (
          /* Plain text: a comment is never treated as markup. */
          <p
            className={
              comment.resolved
                ? 'text-text-subtle text-sm break-words whitespace-pre-wrap'
                : 'text-sm break-words whitespace-pre-wrap'
            }
          >
            {comment.body}
          </p>
        )}

        {comment.mentions.length > 0 ? (
          <p className="text-text-subtle text-xs">
            {t('comment.mentions', { names: mentioned })}
          </p>
        ) : null}

        {comment.attachments.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <h4 className="text-text-subtle text-xs font-medium">
              {t('attachment.recordsTitle')}
            </h4>
            <AttachmentList
              attachments={comment.attachments}
              canRemove={canRemoveAttachment}
              onRemove={onRemoveAttachment}
            />
          </div>
        ) : null}

        {hasActions ? (
          <div className="flex flex-wrap gap-1">
            {offered.onReply ? (
              <Button variant="ghost" size="sm" onClick={offered.onReply}>
                {t('comment.reply')}
              </Button>
            ) : null}
            {offered.onResolve ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => offered.onResolve?.(!comment.resolved)}
              >
                {comment.resolved ? t('comment.reopen') : t('comment.resolve')}
              </Button>
            ) : null}
            {offered.onEdit ? (
              <Button variant="ghost" size="sm" onClick={offered.onEdit}>
                {t('common.edit')}
              </Button>
            ) : null}
            {offered.onAttach ? (
              <Button variant="ghost" size="sm" onClick={offered.onAttach}>
                {t('attachment.recordShort')}
              </Button>
            ) : null}
            {offered.onCopyLink ? (
              <Button variant="ghost" size="sm" onClick={offered.onCopyLink}>
                {t('comment.copyLink')}
              </Button>
            ) : null}
            {offered.onDelete ? (
              <Button variant="ghost" size="sm" onClick={offered.onDelete}>
                {t('common.delete')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {children}
      </div>
    </article>
  );
}
