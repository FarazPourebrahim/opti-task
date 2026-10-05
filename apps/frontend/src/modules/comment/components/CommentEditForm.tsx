import { Button, Textarea } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { commentEditSchema } from '@/modules/comment/schemas/comment.schema';
import type { CommentEditInput } from '@/modules/comment/schemas/comment.schema';
import { FormError, FormField } from '@/shared/components';
import { ApiError } from '@/shared/lib/apiError';
import { toFieldErrors } from '@/shared/utils/form.utils';

type CommentEditFormProps = {
  initialBody: string;
  /** Whether the comment mentions anyone: an edit cannot change that. */
  hasMentions: boolean;
  isPending: boolean;
  /** Rejects with the failure; the form turns it into a form-level error. */
  onSubmit: (input: CommentEditInput) => Promise<void>;
  onCancel: () => void;
};

/** Changes a comment's text. The API takes nothing else on an edit. */
export function CommentEditForm({
  initialBody,
  hasMentions,
  isPending,
  onSubmit,
  onCancel,
}: CommentEditFormProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState(initialBody);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = commentEditSchema.safeParse({ body });
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    try {
      await onSubmit(parsed.data);
    } catch (error) {
      setFormError(
        ApiError.is(error) ? t(error.messageKey as never) : t('error.unknown'),
      );
    }
  }

  const bodyError = fieldErrors['body'];

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
    >
      <FormError message={formError} />

      <FormField
        label={t('comment.edit.label')}
        hint={hasMentions ? t('comment.edit.mentionsKept') : undefined}
        error={bodyError ? t(bodyError as never) : undefined}
      >
        <Textarea
          name="body"
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          disabled={isPending}
        />
      </FormField>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isPending}
        >
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={isPending}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
