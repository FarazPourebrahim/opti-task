import { Button, DatePicker, Input, Textarea } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { milestoneSchema } from '@/modules/epic/schemas/epic.schema';
import type { MilestoneInput } from '@/modules/epic/schemas/epic.schema';
import { FormError, FormField } from '@/shared/components';
import { ApiError } from '@/shared/lib/apiError';
import { dateInputToApi } from '@/shared/utils/date.utils';
import { toFieldErrors } from '@/shared/utils/form.utils';

type MilestoneFormProps = {
  isPending: boolean;
  /** Rejects with the failure; the form turns it into a form-level error. */
  onSubmit: (input: MilestoneInput) => Promise<void>;
};

/**
 * Creates a milestone. There is no edit counterpart: the API can create and
 * delete a milestone, not change one.
 */
export function MilestoneForm({ isPending, onSubmit }: MilestoneFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // As the date field holds it: `YYYY-MM-DD`, or null when empty.
  const [dueDay, setDueDay] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = milestoneSchema.safeParse({
      name,
      description,
      // The API rejects a bare date; this is the full instant it accepts.
      dueDate: dateInputToApi(dueDay),
    });
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

  function errorFor(field: string): string | undefined {
    const key = fieldErrors[field];
    return key ? t(key as never) : undefined;
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <FormError message={formError} />

      <FormField label={t('epic.milestone.name')} error={errorFor('name')}>
        <Input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isPending}
        />
      </FormField>

      <FormField
        label={t('epic.milestone.description')}
        hint={t('common.optional')}
        error={errorFor('description')}
      >
        <Textarea
          name="description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={isPending}
        />
      </FormField>

      <FormField
        label={t('epic.milestone.dueDate')}
        hint={t('common.optional')}
        error={errorFor('dueDate')}
      >
        <DatePicker
          value={dueDay}
          onValueChange={setDueDay}
          disabled={isPending}
        />
      </FormField>

      <div className="flex justify-end">
        <Button type="submit" loading={isPending}>
          {t('epic.milestone.create')}
        </Button>
      </div>
    </form>
  );
}
