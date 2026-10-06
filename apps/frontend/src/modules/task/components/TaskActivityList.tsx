import { Button, EmptyState } from '@averoui/react';
import {
  ArrowRightLeft,
  CalendarRange,
  CheckCheck,
  Gauge,
  History,
  MessageSquare,
  PlusCircle,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import type { ActivityType } from '@contracts';
import type { TaskActivityData } from '@/modules/task/hooks/useTasks';
import {
  isTaskStatus,
  readActivityChange,
} from '@/modules/task/utils/task.utils';
import { formatRelativeTime } from '@/shared/utils/date.utils';

const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  TASK_CREATED: PlusCircle,
  STATUS_CHANGED: ArrowRightLeft,
  ASSIGNED: UserRound,
  STORY_POINTS_UPDATED: Gauge,
  SPRINT_MOVED: CalendarRange,
  AI_RECOMMENDATION: Sparkles,
  USER_APPROVAL: CheckCheck,
  COMMENT_ADDED: MessageSquare,
};

type TaskActivityListProps = {
  activities: readonly TaskActivityData[];
  /** Names a person from their id, or null when they are not known here. */
  personName: (id: string) => string | null;
  /** Names a sprint from its id, or null when it is not listed. */
  sprintName: (id: string) => string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
};

/** The task's audit trail, newest first, one sentence per entry. */
export function TaskActivityList({
  activities,
  personName,
  sprintName,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: TaskActivityListProps) {
  const { t } = useTranslation();

  /*
   * What an entry changed, in words. The record holds ids and raw values; an
   * id that cannot be named here is described rather than shown.
   */
  function describeChange(activity: TaskActivityData) {
    const { from, to } = readActivityChange(activity.metadata);

    switch (activity.type) {
      case 'STATUS_CHANGED': {
        const status = (value: string | number | null) =>
          isTaskStatus(value)
            ? t(`enums.taskStatus.${value}`)
            : t('task.activity.noValue');
        return { from: status(from), to: status(to) };
      }
      case 'ASSIGNED': {
        const person = (value: string | number | null) =>
          typeof value === 'string'
            ? (personName(value) ?? t('task.activity.someone'))
            : t('task.activity.nobody');
        return { from: person(from), to: person(to) };
      }
      case 'SPRINT_MOVED': {
        const sprint = (value: string | number | null) =>
          typeof value === 'string'
            ? (sprintName(value) ?? t('task.unknownSprint'))
            : t('task.activity.noSprint');
        return { from: sprint(from), to: sprint(to) };
      }
      default: {
        const plain = (value: string | number | null) =>
          value === null ? t('task.activity.noValue') : String(value);
        return { from: plain(from), to: plain(to) };
      }
    }
  }

  if (activities.length === 0) {
    return (
      <EmptyState variant="icon" icon={<History />}>
        {t('task.activityEmpty')}
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {activities.map((activity) => {
          const Icon = ACTIVITY_ICONS[activity.type];

          return (
            <li key={activity.id} className="flex items-start gap-3 text-sm">
              <Icon
                aria-hidden
                className="text-text-subtle mt-0.5 size-4 shrink-0"
              />
              <span className="flex min-w-0 flex-col">
                <span>
                  {t(`task.activity.${activity.type}`, {
                    actor: activity.actor?.name ?? t('task.activity.someone'),
                    ...describeChange(activity),
                  })}
                </span>
                <time
                  dateTime={activity.createdAt}
                  className="text-text-subtle text-xs"
                >
                  {formatRelativeTime(activity.createdAt)}
                </time>
              </span>
            </li>
          );
        })}
      </ol>

      {hasMore ? (
        <div>
          <Button
            variant="outline"
            size="sm"
            loading={isLoadingMore}
            onClick={onLoadMore}
          >
            {t('task.activityLoadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
