import { Button, Chip, EmptyState, Input } from '@averoui/react';
import { Tag, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { labelSchema } from '@/modules/task/schemas/task.schema';
import { FormField } from '@/shared/components';

type TaskLabelsProps = {
  labels: ReadonlyArray<{ id: string; name: string }>;
  /** A hint, not a guard. */
  canChange: boolean;
  isAdding: boolean;
  /** Resolves true when the label was added. */
  onAdd: (name: string) => Promise<boolean>;
  onRemove: (name: string) => void;
};

/** The task's labels. A label is created the first time its name is used. */
export function TaskLabels({
  labels,
  canChange,
  isAdding,
  onAdd,
  onRemove,
}: TaskLabelsProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = labelSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setError(null);

    if (await onAdd(parsed.data)) setName('');
  }

  return (
    <div className="flex flex-col gap-4">
      {labels.length === 0 ? (
        <EmptyState variant="icon" icon={<Tag />}>
          {t('task.labelsEmpty')}
        </EmptyState>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {labels.map((label) => (
            <li key={label.id}>
              <Chip variant="skill" className="gap-1">
                {label.name}
                {canChange ? (
                  <button
                    type="button"
                    className="rounded-full focus-visible:outline-2"
                    aria-label={t('task.labelRemove', { name: label.name })}
                    onClick={() => onRemove(label.name)}
                  >
                    <X aria-hidden className="size-3" />
                  </button>
                ) : null}
              </Chip>
            </li>
          ))}
        </ul>
      )}

      {canChange ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
        >
          <div className="min-w-0 flex-1">
            <FormField
              label={t('task.labelAddLabel')}
              error={error ? t(error as never) : undefined}
              disabled={isAdding}
            >
              <Input
                name="label"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>
          </div>
          <Button type="submit" variant="outline" loading={isAdding}>
            {t('task.labelAdd')}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
