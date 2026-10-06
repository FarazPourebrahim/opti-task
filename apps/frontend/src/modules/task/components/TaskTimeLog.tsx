import { Button, Input } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { timeLogSchema } from '@/modules/task/schemas/task.schema';
import { formatDuration } from '@/modules/task/utils/task.utils';
import { FormField } from '@/shared/components';

type TaskTimeLogProps = {
  loggedSeconds: number;
  /** A hint, not a guard. */
  canLog: boolean;
  isPending: boolean;
  /** Resolves true when the time was recorded. */
  onLog: (seconds: number) => Promise<boolean>;
};

/** Time logged against the task. Logging adds to the total; it never sets it. */
export function TaskTimeLog({
  loggedSeconds,
  canLog,
  isPending,
  onLog,
}: TaskTimeLogProps) {
  const { t, i18n } = useTranslation();
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = timeLogSchema.safeParse({
      // An empty box is zero of that unit.
      hours: hours.trim() === '' ? 0 : Number(hours),
      minutes: minutes.trim() === '' ? 0 : Number(minutes),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setError(null);

    if (await onLog(parsed.data)) {
      setHours('');
      setMinutes('');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-sm">
        <span className="text-text-subtle">{t('task.timeLogged')}</span>
        <span className="text-text-strong font-semibold tabular-nums">
          {formatDuration(loggedSeconds, i18n.language)}
        </span>
      </p>

      {canLog ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
        >
          <div className="flex items-end gap-2">
            <FormField
              label={t('task.timeHours')}
              error={error ? t(error as never) : undefined}
              disabled={isPending}
            >
              <Input
                type="number"
                name="hours"
                inputMode="numeric"
                min={0}
                step={1}
                value={hours}
                onChange={(event) => setHours(event.target.value)}
              />
            </FormField>
            <FormField label={t('task.timeMinutes')} disabled={isPending}>
              <Input
                type="number"
                name="minutes"
                inputMode="numeric"
                min={0}
                max={59}
                step={1}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
              />
            </FormField>
            <Button type="submit" variant="outline" loading={isPending}>
              {t('task.timeLog')}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
