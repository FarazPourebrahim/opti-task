import { TASK_STATUSES } from '@contracts';
import type { Role, TaskStatus } from '@contracts';
import { can, canUpdateOwnTask } from '@/shared/lib/capabilities';

/**
 * The task workflow, mirroring `TASK_STATUS_TRANSITIONS` in the backend's
 * `task.model.ts`. The UI offers only these moves; the server still rejects
 * anything else, so a drift here hides or shows a move, never corrupts data.
 */
const TASK_STATUS_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  BACKLOG: ['TODO', 'BLOCKED'],
  TODO: ['BACKLOG', 'IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['TODO', 'IN_REVIEW', 'BLOCKED'],
  IN_REVIEW: ['IN_PROGRESS', 'TESTING', 'BLOCKED'],
  TESTING: ['IN_PROGRESS', 'DONE', 'BLOCKED'],
  // Reopening is the only way out of done.
  DONE: ['IN_PROGRESS'],
  BLOCKED: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING'],
};

export function nextTaskStatuses(from: TaskStatus): readonly TaskStatus[] {
  return TASK_STATUS_TRANSITIONS[from];
}

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_STATUS_TRANSITIONS[from].includes(to);
}

type TaskOwnership = {
  assigneeId?: string | null | undefined;
  reporterId?: string | null | undefined;
};

/** Hints for what the viewer may do to one task. The server decides. */
export function taskCapabilities(
  roles: readonly Role[],
  viewerId: string | undefined,
  task: TaskOwnership,
) {
  const canUpdate =
    viewerId !== undefined &&
    canUpdateOwnTask(roles, viewerId, [task.assigneeId, task.reporterId]);

  return {
    canUpdate,
    canAssign: can(roles, 'task:assign'),
    // A reporter may delete their own task whatever their role.
    canDelete:
      can(roles, 'task:delete') ||
      (viewerId !== undefined && task.reporterId === viewerId),
  };
}

type BoardTask = { id: string; status: TaskStatus };

type BoardConnection<Task extends BoardTask> = {
  edges: ReadonlyArray<{ node: Task }>;
  pageInfo: { hasNextPage: boolean; endCursor?: string | null };
  totalCount: number;
};

export type BoardColumn<Task extends BoardTask> = {
  status: TaskStatus;
  tasks: Task[];
  /** How many tasks hold this status, including pages not loaded yet. */
  totalCount: number;
  hasMore: boolean;
  endCursor: string | null;
};

/**
 * Arranges the board from the seven per-status lists.
 *
 * A card is placed by the status the task has NOW, not by the list it arrived
 * in. A status change rewrites only the task in the cache, so the card moves
 * the moment the change is made — and moves back if the server refuses it —
 * without any list being edited by hand. Each count is corrected for the cards
 * that have left or joined since the lists were fetched.
 */
export function buildBoardColumns<Task extends BoardTask>(
  connections: Readonly<
    Record<TaskStatus, BoardConnection<Task> | null | undefined>
  >,
): Array<BoardColumn<Task>> {
  const placed = new Map<string, Task>();
  const movedOut = new Map<TaskStatus, number>();
  const movedIn = new Map<TaskStatus, number>();

  for (const fetchedAs of TASK_STATUSES) {
    for (const edge of connections[fetchedAs]?.edges ?? []) {
      const task = edge.node;
      if (placed.has(task.id)) continue;
      placed.set(task.id, task);

      if (task.status !== fetchedAs) {
        movedOut.set(fetchedAs, (movedOut.get(fetchedAs) ?? 0) + 1);
        movedIn.set(task.status, (movedIn.get(task.status) ?? 0) + 1);
      }
    }
  }

  const tasks = [...placed.values()];

  return TASK_STATUSES.map((status) => {
    const connection = connections[status];
    const fetchedTotal = connection?.totalCount ?? 0;

    return {
      status,
      tasks: tasks.filter((task) => task.status === status),
      totalCount: Math.max(
        0,
        fetchedTotal - (movedOut.get(status) ?? 0) + (movedIn.get(status) ?? 0),
      ),
      hasMore: Boolean(
        connection?.pageInfo.hasNextPage && connection.pageInfo.endCursor,
      ),
      endCursor: connection?.pageInfo.endCursor ?? null,
    };
  });
}

/**
 * Logged time as a duration ("3h 20m"), in the viewer's locale.
 *
 * Whole minutes only: time is logged in hours and minutes, and a stray second
 * would be noise.
 */
export function formatDuration(seconds: number, locale?: string): string {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const unit = (value: number, name: 'hour' | 'minute') =>
    new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: name,
      unitDisplay: 'narrow',
    }).format(value);

  if (hours === 0) return unit(minutes, 'minute');
  if (minutes === 0) return unit(hours, 'hour');
  return `${unit(hours, 'hour')} ${unit(minutes, 'minute')}`;
}

export function toSeconds(hours: number, minutes: number): number {
  return hours * 3600 + minutes * 60;
}

export type ActivityChange = {
  from: string | number | null;
  to: string | number | null;
};

function readChangeValue(value: unknown): string | number | null {
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

/**
 * Reads the `from`/`to` pair an activity records.
 *
 * `metadata` is free-form JSON, so nothing about its shape is assumed: a
 * missing or oddly typed value reads as null rather than being cast.
 */
export function readActivityChange(
  metadata: Readonly<Record<string, unknown>>,
): ActivityChange {
  return {
    from: readChangeValue(metadata['from']),
    to: readChangeValue(metadata['to']),
  };
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === 'string' &&
    (TASK_STATUSES as readonly string[]).includes(value)
  );
}
