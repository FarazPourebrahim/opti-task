import { Alert, Button, Input } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { attachmentSchema } from '@/modules/comment/schemas/comment.schema';
import type { AttachmentInput } from '@/modules/comment/schemas/comment.schema';
import { FormError, FormField } from '@/shared/components';
import { ApiError } from '@/shared/lib/apiError';
import { toFieldErrors } from '@/shared/utils/form.utils';

type AttachmentFormProps = {
  isPending: boolean;
  /** Rejects with the failure; the form turns it into a form-level error. */
  onSubmit: (input: AttachmentInput) => Promise<void>;
  onCancel?: (() => void) | undefined;
};

/**
 * Records an attachment: its name, and optionally its type and size.
 *
 * There is deliberately no file picker. The API stores the record and nothing
 * else, so choosing a file here would look like an upload that never happens.
 * The notice says what is and is not kept.
 */
export function AttachmentForm({
  isPending,
  onSubmit,
  onCancel,
}: AttachmentFormProps) {
  const { t } = useTranslation();
  const [filename, setFilename] = useState('');
  const [contentType, setContentType] = useState('');
  const [size, setSize] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = attachmentSchema.safeParse({
      filename,
      contentType,
      // Blank means "not known". Anything else must be a whole number.
      sizeBytes: size.trim() === '' ? null : Number(size),
    });
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    try {
      await onSubmit(parsed.data);
      setFilename('');
      setContentType('');
      setSize('');
    } catch (error) {
      setFormError(
        ApiError.is(error) ? t(error.messageKey as never) : t('error.unknown'),
      );
    }
  }

  function errorFor(field: string): string | undefined {
    const key = fieldErrors[field];
    return key ? t(key as never) : undefined;
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
    >
      <Alert tone="warning" title={t('attachment.noticeTitle')}>
        {t('attachment.noticeBody')}
      </Alert>

      <FormError message={formError} />

      <FormField
        label={t('attachment.filename')}
        error={errorFor('filename')}
        disabled={isPending}
      >
        <Input
          name="filename"
          value={filename}
          onChange={(event) => setFilename(event.target.value)}
        />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label={t('attachment.contentType')}
          hint={t('attachment.contentTypeHint')}
          error={errorFor('contentType')}
          disabled={isPending}
        >
          <Input
            name="contentType"
            value={contentType}
            onChange={(event) => setContentType(event.target.value)}
          />
        </FormField>

        <FormField
          label={t('attachment.size')}
          hint={t('common.optional')}
          error={errorFor('sizeBytes')}
          disabled={isPending}
        >
          <Input
            name="sizeBytes"
            inputMode="numeric"
            value={size}
            onChange={(event) => setSize(event.target.value)}
          />
        </FormField>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isPending}
          >
            {t('common.cancel')}
          </Button>
        ) : null}
        <Button type="submit" variant="outline" loading={isPending}>
          {t('attachment.record')}
        </Button>
      </div>
    </form>
  );
}
