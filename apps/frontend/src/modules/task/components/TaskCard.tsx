import { Avatar, Badge, Chip } from '@averoui/react';
import { Ban, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import type { ReactNode } from 'react';
import { TASK_PRIORITY_TONES } from '@/modules/task/constants/task.constants';
import type { TaskCardData } from '@/modules/task/hooks/useTasks';
import { taskPath } from '@/shared/routes/route.constants';
import {
  formatCalendarDate,
  isPastCalendarDate,
} from '@/shared/utils/date.utils';

type TaskCardProps = {
  task: TaskCardData;
  /** A control placed beside the title, e.g. the board's move button. */
  action?: ReactNode;
  /** Marks the card as the one being moved. */
  isGrabbed?: boolean;
};

/** One task as the board shows it. Props in, markup out. */
export function TaskCard({ task, action, isGrabbed = false }: TaskCardProps) {
  const { t, i18n } = useTranslation();
  const dueDate = formatCalendarDate(task.dueDate, i18n.language);
  // A finished task is not late, whatever its date says.
  const isOverdue = task.status !== 'DONE' && isPastCalendarDate(task.dueDate);

  return (
    <article
      className={`border-border-subtle bg-surface flex flex-col gap-2 rounded-xl border p-3 ${
        isGrabbed ? 'ring-primary ring-2' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <RouterLink
          to={taskPath(task.projectId, task.id)}
          className="text-text-strong line-clamp-3 min-w-0 text-sm font-medium hover:underline"
        >
          {task.title}
        </RouterLink>
        {action}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={TASK_PRIORITY_TONES[task.priority]}>
          {t(`enums.taskPriority.${task.priority}`)}
        </Badge>
        {task.status === 'BLOCKED' ? (
          <Badge tone="danger">
            <Ban aria-hidden className="size-3" />
            {t('task.blocked')}
          </Badge>
        ) : null}
        {task.labels.map((label) => (
          <Chip key={label.id} variant="mini">
            {label.name}
          </Chip>
        ))}
      </div>

      <div className="text-text-subtle flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          {task.storyPoints === null || task.storyPoints === undefined
            ? t('task.unestimated')
            : t('task.points', { count: task.storyPoints })}
        </span>
        {dueDate ? (
          <span
            className={`flex items-center gap-1 ${isOverdue ? 'font-medium text-red-700' : ''}`}
          >
            <CalendarDays aria-hidden className="size-3" />
            {isOverdue
              ? t('task.overdue', { date: dueDate })
              : t('task.due', { date: dueDate })}
          </span>
        ) : null}
        {task.assignee ? (
          <span className="flex items-center gap-1.5">
            <Avatar
              size="xs"
              name={task.assignee.name}
              {...(task.assignee.avatarUrl
                ? { src: task.assignee.avatarUrl }
                : {})}
            />
            <span className="sr-only">
              {t('task.assignedTo', { name: task.assignee.name })}
            </span>
          </span>
        ) : (
          <span>{t('task.unassigned')}</span>
        )}
      </div>
    </article>
  );
}
