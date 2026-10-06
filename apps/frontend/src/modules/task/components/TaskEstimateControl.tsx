import { Button, Input } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { STORY_POINTS_MAX } from '@/modules/task/constants/task.constants';
import { storyPointsSchema } from '@/modules/task/schemas/task.schema';
import { FormField } from '@/shared/components';

type TaskEstimateControlProps = {
  storyPoints: number | null;
  /** A hint, not a guard. */
  canChange: boolean;
  /** `null` clears the estimate. */
  onChange: (storyPoints: number | null) => void;
};

/** The task's story points. An empty field means "not estimated". */
export function TaskEstimateControl({
  storyPoints,
  canChange,
  onChange,
}: TaskEstimateControlProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(storyPoints?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);

  if (!canChange) {
    return (
      <p className="flex items-center gap-2 text-sm">
        <span className="text-text-subtle">{t('task.storyPoints')}</span>
        <span className="font-medium">
          {storyPoints === null
            ? t('task.unestimated')
            : t('task.points', { count: storyPoints })}
        </span>
      </p>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = storyPointsSchema.safeParse(
      value.trim() === '' ? null : Number(value),
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }

    setError(null);
    if (parsed.data !== storyPoints) onChange(parsed.data);
  }

  return (
    <form className="flex items-end gap-2" onSubmit={handleSubmit} noValidate>
      <div className="min-w-0 flex-1">
        <FormField
          label={t('task.storyPoints')}
          hint={t('task.storyPointsHint')}
          error={error ? t(error as never) : undefined}
        >
          <Input
            type="number"
            name="storyPoints"
            inputMode="numeric"
            min={0}
            max={STORY_POINTS_MAX}
            step={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </FormField>
      </div>
      <Button type="submit" variant="outline">
        {t('task.storyPointsSave')}
      </Button>
    </form>
  );
}
