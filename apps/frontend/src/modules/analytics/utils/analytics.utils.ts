import { TASK_PRIORITIES, TASK_STATUSES } from '@contracts';
import type { TaskPriority, TaskStatus } from '@contracts';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;

/**
 * A length of time between creating a task and finishing it, which runs from
 * minutes to weeks: the two largest units that apply ("3d 4h", "5h 20m").
 */
export function formatElapsed(seconds: number, locale?: string): string {
  const total = Math.max(0, Math.round(seconds));
  const days = Math.floor(total / SECONDS_PER_DAY);
  const hours = Math.floor((total % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

  const unit = (value: number, name: 'day' | 'hour' | 'minute') =>
    new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: name,
      unitDisplay: 'narrow',
    }).format(value);

  if (days > 0) {
    return hours === 0
      ? unit(days, 'day')
      : `${unit(days, 'day')} ${unit(hours, 'hour')}`;
  }
  if (hours > 0) {
    return minutes === 0
      ? unit(hours, 'hour')
      : `${unit(hours, 'hour')} ${unit(minutes, 'minute')}`;
  }
  return unit(minutes, 'minute');
}

/** A velocity: story points per sprint, to one decimal at most. */
export function formatPoints(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    value,
  );
}

export type DistributionRow<Key extends string> = { key: Key; count: number };

function fillDistribution<Key extends string>(
  keys: readonly Key[],
  counts: ReadonlyMap<Key, number>,
): DistributionRow<Key>[] {
  return keys.map((key) => ({ key, count: counts.get(key) ?? 0 }));
}

/**
 * The server reports only the statuses that hold a task. Every status is
 * listed here, in workflow order, so an empty one reads as zero and not as
 * missing.
 */
export function toStatusDistribution(
  rows: ReadonlyArray<{ status: TaskStatus; count: number }>,
): DistributionRow<TaskStatus>[] {
  return fillDistribution(
    TASK_STATUSES,
    new Map(rows.map((row) => [row.status, row.count])),
  );
}

export function toPriorityDistribution(
  rows: ReadonlyArray<{ priority: TaskPriority; count: number }>,
): DistributionRow<TaskPriority>[] {
  return fillDistribution(
    TASK_PRIORITIES,
    new Map(rows.map((row) => [row.priority, row.count])),
  );
}

type TrendPoint = {
  name: string;
  committedStoryPoints: number;
  completedStoryPoints: number;
};

export type TrendRow = { sprint: string; committed: number; completed: number };

/** The per-sprint series as the rows a chart and its data table both read. */
export function toTrendRows(points: readonly TrendPoint[]): TrendRow[] {
  return points.map((point) => ({
    sprint: point.name,
    committed: point.committedStoryPoints,
    completed: point.completedStoryPoints,
  }));
}

/** The whole series in three figures, for the sentence beside the chart. */
export function summarizeTrends(points: readonly TrendPoint[]): {
  sprints: number;
  committed: number;
  completed: number;
} {
  return {
    sprints: points.length,
    committed: points.reduce(
      (sum, point) => sum + point.committedStoryPoints,
      0,
    ),
    completed: points.reduce(
      (sum, point) => sum + point.completedStoryPoints,
      0,
    ),
  };
}
