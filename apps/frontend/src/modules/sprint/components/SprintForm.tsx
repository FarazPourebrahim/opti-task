import { Button, DatePicker, Input, Textarea } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { SPRINT_CAPACITY_MAX } from '@/modules/sprint/constants/sprint.constants';
import { sprintSchema } from '@/modules/sprint/schemas/sprint.schema';
import type { SprintInput } from '@/modules/sprint/schemas/sprint.schema';
import { FormError, FormField } from '@/shared/components';
import { ApiError } from '@/shared/lib/apiError';
import { apiToDateInput, dateInputToApi } from '@/shared/utils/date.utils';
import { toFieldErrors } from '@/shared/utils/form.utils';

type SprintFormProps = {
  initialValues?: {
    name: string;
    goal?: string | null | undefined;
    startDate?: string | null | undefined;
    endDate?: string | null | undefined;
    capacity?: number | null | undefined;
  };
  submitLabel: string;
  isPending: boolean;
  /** Rejects with the failure; the form turns it into a form-level error. */
  onSubmit: (input: SprintInput) => Promise<void>;
};

/** The create and the edit form: a sprint's name, goal, dates and capacity. */
export function SprintForm({
  initialValues,
  submitLabel,
  isPending,
  onSubmit,
}: SprintFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialValues?.name ?? '');
  const [goal, setGoal] = useState(initialValues?.goal ?? '');
  // As the date fields hold them: `YYYY-MM-DD`, or null when empty.
  const [startDay, setStartDay] = useState<string | null>(
    apiToDateInput(initialValues?.startDate),
  );
  const [endDay, setEndDay] = useState<string | null>(
    apiToDateInput(initialValues?.endDate),
  );
  const [capacity, setCapacity] = useState(
    initialValues?.capacity === null || initialValues?.capacity === undefined
      ? ''
      : String(initialValues.capacity),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = sprintSchema.safeParse({
      name,
      goal,
      // The API rejects a bare date; these are the full instants it accepts.
      startDate: dateInputToApi(startDay),
      endDate: dateInputToApi(endDay),
      // Empty means "no capacity"; anything else must be a whole number.
      capacity: capacity.trim() === '' ? null : Number(capacity),
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

      <FormField label={t('sprint.name')} error={errorFor('name')}>
        <Input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isPending}
        />
      </FormField>

      <FormField
        label={t('sprint.goal')}
        hint={t('common.optional')}
        error={errorFor('goal')}
      >
        <Textarea
          name="goal"
          rows={3}
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          disabled={isPending}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label={t('sprint.startDate')}
          hint={t('sprint.datesHint')}
          error={errorFor('startDate')}
        >
          <DatePicker
            value={startDay}
            onValueChange={setStartDay}
            disabled={isPending}
          />
        </FormField>
        <FormField label={t('sprint.endDate')} error={errorFor('endDate')}>
          <DatePicker
            value={endDay}
            onValueChange={setEndDay}
            disabled={isPending}
          />
        </FormField>
      </div>

      <FormField
        label={t('sprint.capacity')}
        hint={t('sprint.capacityHint')}
        error={errorFor('capacity')}
      >
        <Input
          type="number"
          name="capacity"
          inputMode="numeric"
          min={0}
          max={SPRINT_CAPACITY_MAX}
          step={1}
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          disabled={isPending}
        />
      </FormField>

      <div className="flex justify-end">
        <Button type="submit" loading={isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
