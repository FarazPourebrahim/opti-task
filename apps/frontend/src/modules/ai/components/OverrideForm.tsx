import { Button, Input } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import {
  overrideAssigneeSchema,
  overrideStoryPointsSchema,
} from '@/modules/ai/schemas/ai.schema';
import type { OverrideInput } from '@/modules/ai/schemas/ai.schema';
import type { MemberCandidate } from '@/modules/project/hooks/useProjectContext';
import { FormError, FormField, MemberPicker } from '@/shared/components';
import { ApiError } from '@/shared/lib/apiError';
import { toFieldErrors } from '@/shared/utils/form.utils';

type OverrideFormProps = {
  /** Which of the two things an override can set. */
  kind: 'storyPoints' | 'assignee';
  /** Project members: who a task can be given to instead. */
  members: readonly MemberCandidate[];
  isPending: boolean;
  /** Rejects with the failure; the form turns it into a form-level error. */
  onSubmit: (input: OverrideInput) => Promise<void>;
  onCancel: () => void;
};

/**
 * Puts a person's own value in place of a suggestion.
 *
 * The sentence under the field says exactly what saving will do to the task,
 * and follows the value as it is typed or picked.
 */
export function OverrideForm({
  kind,
  members,
  isPending,
  onSubmit,
  onCancel,
}: OverrideFormProps) {
  const { t } = useTranslation();
  const [storyPoints, setStoryPoints] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed =
      kind === 'storyPoints'
        ? overrideStoryPointsSchema.safeParse({
            // Blank is not a number: an override has to say something.
            storyPoints:
              storyPoints.trim() === '' ? Number.NaN : Number(storyPoints),
          })
        : overrideAssigneeSchema.safeParse({ assigneeId });
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

  const pickedName = members.find((member) => member.id === assigneeId)?.name;
  const typedPoints = storyPoints.trim() === '' ? null : Number(storyPoints);
  const effect =
    kind === 'storyPoints'
      ? typedPoints !== null && Number.isInteger(typedPoints)
        ? t('ai.override.effectStoryPoints', { count: typedPoints })
        : t('ai.override.effectStoryPointsBlank')
      : pickedName
        ? t('ai.override.effectAssignee', { name: pickedName })
        : t('ai.override.effectAssigneeBlank');

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
    >
      <FormError message={formError} />

      {kind === 'storyPoints' ? (
        <FormField
          label={t('ai.override.storyPoints')}
          error={errorFor('storyPoints')}
          disabled={isPending}
        >
          <Input
            name="storyPoints"
            inputMode="numeric"
            value={storyPoints}
            onChange={(event) => setStoryPoints(event.target.value)}
          />
        </FormField>
      ) : (
        <MemberPicker
          label={t('ai.override.assignee')}
          candidates={members}
          value={assigneeId}
          onValueChange={setAssigneeId}
          error={errorFor('assigneeId')}
          disabled={isPending}
        />
      )}

      {/* What saving does, said before it is done. */}
      <p className="text-text-subtle text-sm" role="status">
        {effect}
      </p>

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
          {t('ai.override.submit')}
        </Button>
      </div>
    </form>
  );
}
