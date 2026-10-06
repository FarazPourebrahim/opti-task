import type { SprintState } from '@contracts';
import { formatCalendarDate } from '@/shared/utils/date.utils';

/**
 * The sprint lifecycle, mirroring `SPRINT_STATE_TRANSITIONS` in the backend's
 * `sprint.model.ts`. The UI offers only these moves; the server still rejects
 * anything else, so a drift here hides or shows a button, never corrupts data.
 */
const SPRINT_STATE_TRANSITIONS: Record<SprintState, readonly SprintState[]> = {
  PLANNED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  // Terminal: a finished or cancelled sprint is not reopened.
  COMPLETED: [],
  CANCELLED: [],
};

export function nextSprintStates(from: SprintState): readonly SprintState[] {
  return SPRINT_STATE_TRANSITIONS[from];
}

export function canTransitionSprint(
  from: SprintState,
  to: SprintState,
): boolean {
  return SPRINT_STATE_TRANSITIONS[from].includes(to);
}

type BurndownPoint = {
  date: string;
  idealRemaining: number;
  actualRemaining: number;
};

export type BurndownRow = { day: string; ideal: number; actual: number };

/** One decimal at most: an ideal line falls by fractions of a point a day. */
function roundPoints(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The burndown series as the rows a chart and its data table both read. */
export function toBurndownRows(
  points: readonly BurndownPoint[],
  locale?: string,
): BurndownRow[] {
  return points.map((point) => ({
    day: formatCalendarDate(point.date, locale),
    ideal: roundPoints(point.idealRemaining),
    actual: roundPoints(point.actualRemaining),
  }));
}

/** A 0–1 rate as a whole percentage. */
export function toPercent(rate: number): number {
  return Math.round(rate * 100);
}
