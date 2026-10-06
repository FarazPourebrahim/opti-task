import { Button, Textarea } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent, KeyboardEvent } from 'react';
import { MentionPicker } from '@/modules/comment/components/MentionPicker';
import { commentSchema } from '@/modules/comment/schemas/comment.schema';
import type { CommentInput } from '@/modules/comment/schemas/comment.schema';
import type { MemberCandidate } from '@/modules/project/hooks/useProjectContext';
import { FormError, FormField } from '@/shared/components';
import { ApiError } from '@/shared/lib/apiError';
import { toFieldErrors } from '@/shared/utils/form.utils';

type CommentComposerProps = {
  /** Names the text field: "Add a comment", "Reply to …". */
  label: string;
  submitLabel: string;
  /** Who can be mentioned. */
  mentionCandidates: readonly MemberCandidate[];
  /** Rejects with the failure; the composer turns it into a form error. */
  onSubmit: (input: CommentInput) => Promise<void>;
  onCancel?: (() => void) | undefined;
};

/**
 * Writes a comment or a reply.
 *
 * The comment is shown in the thread the moment it is sent, so the field
 * empties at once. If the server refuses it, the text and the mentions come
 * back with the reason, and nothing typed is lost.
 */
export function CommentComposer({
  label,
  submitLabel,
  mentionCandidates,
  onSubmit,
  onCancel,
}: CommentComposerProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    setFormError(null);

    const parsed = commentSchema.safeParse({ body, mentionedUserIds });
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    const draft = { body, mentionedUserIds };
    setBody('');
    setMentionedUserIds([]);

    try {
      await onSubmit(parsed.data);
    } catch (error) {
      setBody(draft.body);
      setMentionedUserIds(draft.mentionedUserIds);
      setFormError(
        ApiError.is(error) ? t(error.messageKey as never) : t('error.unknown'),
      );
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;

    event.preventDefault();
    void submit();
  }

  function errorFor(field: string): string | undefined {
    const key = fieldErrors[field];
    return key ? t(key as never) : undefined;
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
      <FormError message={formError} />

      <FormField
        label={label}
        hint={t('comment.composer.shortcut')}
        error={errorFor('body')}
      >
        <Textarea
          name="body"
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </FormField>

      <MentionPicker
        candidates={mentionCandidates}
        selectedIds={mentionedUserIds}
        onChange={setMentionedUserIds}
        error={errorFor('mentionedUserIds')}
      />

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        ) : null}
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
