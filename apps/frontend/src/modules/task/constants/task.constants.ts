import type { TaskPriority, TaskStatus } from '@contracts';

/** The alias each status has in `ProjectBoardQuery`. */
export const BOARD_COLUMN_FIELDS = {
  BACKLOG: 'backlog',
  TODO: 'todo',
  IN_PROGRESS: 'inProgress',
  IN_REVIEW: 'inReview',
  TESTING: 'testing',
  DONE: 'done',
  BLOCKED: 'blocked',
} as const satisfies Record<TaskStatus, string>;

/** Cards fetched per board column at a time; the API caps a page at 100. */
export const BOARD_PAGE_SIZE = 50;

/**
 * A column with more cards than this renders only the ones in view. Below it
 * the whole list is cheap, and a short column should not scroll on its own.
 */
export const BOARD_WINDOW_THRESHOLD = 30;

/** A card's height before it is measured, and the space between two, in px. */
export const BOARD_CARD_ESTIMATED_HEIGHT = 128;
export const BOARD_CARD_GAP = 8;

/** How far a pressed mouse must travel before a card is being dragged, in px. */
export const BOARD_DRAG_DISTANCE = 8;

/** How long a touch must rest on a card before it is being dragged, in ms. */
export const BOARD_DRAG_TOUCH_DELAY = 250;
export const BOARD_DRAG_TOUCH_TOLERANCE = 5;

/** How many sprints, epics and dependency candidates one request reads. */
export const TASK_OPTIONS_PAGE_SIZE = 100;

type BadgeTone =
  | 'neutral'
  | 'success'
  | 'danger'
  | 'indigo'
  | 'amber'
  | 'primary'
  | 'blue'
  | 'dark';

/* A tone only ever accompanies the status or priority name, never replaces it. */
export const TASK_STATUS_TONES: Record<TaskStatus, BadgeTone> = {
  BACKLOG: 'neutral',
  TODO: 'blue',
  IN_PROGRESS: 'indigo',
  IN_REVIEW: 'primary',
  TESTING: 'dark',
  DONE: 'success',
  BLOCKED: 'danger',
};

export const TASK_PRIORITY_TONES: Record<TaskPriority, BadgeTone> = {
  LOWEST: 'neutral',
  LOW: 'blue',
  MEDIUM: 'indigo',
  HIGH: 'amber',
  CRITICAL: 'danger',
};

/** Bounds mirrored from the backend's `task.validation.ts`. */
export const TASK_TITLE_MAX = 200;
export const TASK_DESCRIPTION_MAX = 10_000;
export const STORY_POINTS_MAX = 1000;
export const LOGGED_SECONDS_MAX = 1_000_000_000;
