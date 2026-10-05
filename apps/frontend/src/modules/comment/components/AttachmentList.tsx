import { Button, ConfirmDialog } from '@averoui/react';
import { Paperclip } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AttachmentData } from '@/modules/comment/hooks/useAttachments';
import { formatFileSize } from '@/modules/comment/utils/comment.utils';
import { formatRelativeTime } from '@/shared/utils/date.utils';

type AttachmentListProps = {
  attachments: readonly AttachmentData[];
  /** A hint, not a guard: whether the viewer may remove this record. */
  canRemove: (attachment: AttachmentData) => boolean;
  /** Never rejects: a failure is reported by the caller. */
  onRemove: (attachment: AttachmentData) => Promise<void>;
};

/**
 * Attachment records: a name, a type and a size.
 *
 * A file name here is text, never a link. The API keeps no file behind a
 * record, so there is nothing to open or download, and nothing on screen may
 * suggest otherwise.
 */
export function AttachmentList({
  attachments,
  canRemove,
  onRemove,
}: AttachmentListProps) {
  const { t, i18n } = useTranslation();
  const [pending, setPending] = useState<AttachmentData | null>(null);

  async function handleConfirm() {
    if (!pending) return;

    try {
      await onRemove(pending);
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <ul className="divide-border-subtle flex flex-col divide-y">
        {attachments.map((attachment) => {
          const details = [
            attachment.contentType,
            attachment.sizeBytes === null || attachment.sizeBytes === undefined
              ? null
              : formatFileSize(attachment.sizeBytes, i18n.language),
          ].filter(Boolean);

          return (
            <li
              key={attachment.id}
              className="flex flex-wrap items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 items-start gap-2">
                <Paperclip
                  aria-hidden
                  className="text-text-subtle mt-0.5 size-4 shrink-0"
                />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-text-strong text-sm font-medium break-all">
                    {attachment.filename}
                  </span>
                  {details.length > 0 ? (
                    <span className="text-text-subtle text-xs">
                      {details.join(' · ')}
                    </span>
                  ) : null}
                  <span className="text-text-subtle text-xs">
                    {t('attachment.recordedBy', {
                      name: attachment.uploadedBy.name,
                      when: formatRelativeTime(attachment.createdAt),
                    })}
                  </span>
                </div>
              </div>
              {canRemove(attachment) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('attachment.removeNamed', {
                    name: attachment.filename,
                  })}
                  onClick={() => setPending(attachment)}
                >
                  {t('attachment.remove')}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={t('attachment.removeConfirmTitle', {
          name: pending?.filename ?? '',
        })}
        description={t('attachment.removeConfirmBody')}
        confirmLabel={t('attachment.remove')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={handleConfirm}
      />
    </>
  );
}
