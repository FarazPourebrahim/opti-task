import { Badge, Button } from '@averoui/react';
import { useTranslation } from 'react-i18next';
import type { TaskStatus } from '@contracts';
import { TASK_STATUS_TONES } from '@/modules/task/constants/task.constants';
import { nextTaskStatuses } from '@/modules/task/utils/task.utils';

type TaskStatusControlProps = {
  status: TaskStatus;
  /** Whether the viewer may move the task at all — a hint, not a guard. */
  canChange: boolean;
  onChange: (status: TaskStatus) => void;
};

/**
 * Shows the task's status and offers only the moves the workflow allows from
 * it. The change is optimistic, so no button waits on the server.
 */
export function TaskStatusControl({
  status,
  canChange,
  onChange,
}: TaskStatusControlProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-sm">
        <span className="text-text-subtle">{t('task.status')}</span>
        <Badge tone={TASK_STATUS_TONES[status]}>
          {t(`enums.taskStatus.${status}`)}
        </Badge>
      </p>

      {canChange ? (
        <div
          role="group"
          aria-label={t('task.statusChange')}
          className="flex flex-wrap gap-2"
        >
          {nextTaskStatuses(status).map((next) => (
            <Button
              key={next}
              variant={next === 'BLOCKED' ? 'ghost' : 'outline'}
              size="sm"
              onClick={() => onChange(next)}
            >
              {t('task.statusMove', {
                status: t(`enums.taskStatus.${next}`),
              })}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
