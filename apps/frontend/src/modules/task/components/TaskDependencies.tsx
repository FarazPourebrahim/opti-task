import {
  Badge,
  Button,
  Combobox,
  EmptyState,
  IconButton,
} from '@averoui/react';
import { Link2Off, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import type { TaskStatus } from '@contracts';
import { TASK_STATUS_TONES } from '@/modules/task/constants/task.constants';
import { AppLink, FormError, FormField } from '@/shared/components';
import { taskPath } from '@/shared/routes/route.constants';

type TaskSummary = { id: string; title: string; status: TaskStatus };

type TaskDependenciesProps = {
  projectId: string;
  dependencies: readonly TaskSummary[];
  /** Tasks this one could depend on: not itself, not one it already does. */
  candidates: readonly TaskSummary[];
  /** A hint, not a guard. */
  canChange: boolean;
  isAdding: boolean;
  /** Already translated; says why the last add was refused. */
  addError: string | null;
  onAdd: (taskId: string) => Promise<boolean>;
  onRemove: (task: TaskSummary) => void;
};

/** The tasks this one waits on. */
export function TaskDependencies({
  projectId,
  dependencies,
  candidates,
  canChange,
  isAdding,
  addError,
  onAdd,
  onRemove,
}: TaskDependenciesProps) {
  const { t } = useTranslation();
  const [pickedId, setPickedId] = useState('');
  const [isMissing, setIsMissing] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pickedId === '') {
      setIsMissing(true);
      return;
    }
    setIsMissing(false);

    if (await onAdd(pickedId)) setPickedId('');
  }

  return (
    <div className="flex flex-col gap-4">
      {dependencies.length === 0 ? (
        <EmptyState variant="icon" icon={<Link2Off />}>
          {t('task.dependenciesEmpty')}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {dependencies.map((dependency) => (
            <li
              key={dependency.id}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Badge tone={TASK_STATUS_TONES[dependency.status]}>
                  {t(`enums.taskStatus.${dependency.status}`)}
                </Badge>
                <AppLink
                  to={taskPath(projectId, dependency.id)}
                  variant="subtle"
                  className="truncate text-sm font-medium"
                >
                  {dependency.title}
                </AppLink>
              </span>
              {canChange ? (
                <IconButton
                  variant="ghost"
                  size="sm"
                  label={t('task.dependencyRemove', {
                    title: dependency.title,
                  })}
                  onClick={() => onRemove(dependency)}
                >
                  <X aria-hidden className="size-4" />
                </IconButton>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canChange ? (
        candidates.length === 0 ? (
          <p className="text-text-subtle text-sm">
            {t('task.dependencyNoCandidates')}
          </p>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => void handleSubmit(event)}
            noValidate
          >
            <FormError message={addError} />
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <FormField
                  label={t('task.dependencyPicker')}
                  hint={t('task.dependencyPickerHint')}
                  error={isMissing ? t('task.dependencyRequired') : undefined}
                  disabled={isAdding}
                >
                  <Combobox
                    value={pickedId}
                    onValueChange={setPickedId}
                    emptyMessage={t('task.dependencyNoMatch')}
                    options={candidates.map((candidate) => ({
                      value: candidate.id,
                      label: candidate.title,
                    }))}
                  />
                </FormField>
              </div>
              <Button type="submit" variant="outline" loading={isAdding}>
                {t('task.dependencyAdd')}
              </Button>
            </div>
          </form>
        )
      ) : null}
    </div>
  );
}
