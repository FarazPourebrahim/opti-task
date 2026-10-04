import { useCallback, useMemo, useState } from 'react';
import { TASK_STATUSES } from '@contracts';
import type { TaskStatus } from '@contracts';
import { nextTaskStatuses } from '@/modules/task/utils/task.utils';

type MovableTask = { id: string; title: string; status: TaskStatus };

export type BoardAnnouncement =
  | { kind: 'grabbed'; task: MovableTask; target: TaskStatus }
  | { kind: 'target'; target: TaskStatus; position: number; count: number }
  | { kind: 'dropped'; task: MovableTask; target: TaskStatus }
  | { kind: 'cancelled'; task: MovableTask }
  | { kind: 'noMoves'; task: MovableTask };

type Grab = { task: MovableTask; targets: TaskStatus[]; index: number };

/**
 * Picking a card up, choosing where it goes, and putting it down.
 *
 * The same three steps serve the keyboard (arrow keys choose the column) and a
 * pointer (tap the column). Only the columns the workflow allows from the
 * card's status are ever targets, so an illegal move cannot be made — it is
 * not rejected, it is not offered.
 */
export function useBoardMove(
  onMove: (task: MovableTask, status: TaskStatus) => void,
) {
  const [grab, setGrab] = useState<Grab | null>(null);
  const [announcement, setAnnouncement] = useState<BoardAnnouncement | null>(
    null,
  );
  /*
   * The card whose move button takes focus once it lands in its new column.
   * The column is part of it: until the card has actually moved, the button
   * still in the old column must not claim the focus and use the request up.
   */
  const [focusTarget, setFocusTarget] = useState<{
    taskId: string;
    status: TaskStatus;
  } | null>(null);

  const pickUp = useCallback((task: MovableTask) => {
    const legal = nextTaskStatuses(task.status);
    // In board order, so the arrow keys travel the way the columns read.
    const targets = TASK_STATUSES.filter((status) => legal.includes(status));
    const first = targets[0];

    if (!first) {
      setAnnouncement({ kind: 'noMoves', task });
      return;
    }

    setGrab({ task, targets, index: 0 });
    setAnnouncement({ kind: 'grabbed', task, target: first });
  }, []);

  const cancel = useCallback(() => {
    if (!grab) return;

    // The card stays where it is, and so does focus.
    setGrab(null);
    setAnnouncement({ kind: 'cancelled', task: grab.task });
  }, [grab]);

  const step = useCallback(
    (delta: 1 | -1) => {
      if (!grab) return;

      const count = grab.targets.length;
      const index = (grab.index + delta + count) % count;
      const target = grab.targets[index];
      if (!target) return;

      setGrab({ ...grab, index });
      setAnnouncement({ kind: 'target', target, position: index + 1, count });
    },
    [grab],
  );

  const dropOn = useCallback(
    (status: TaskStatus) => {
      if (!grab || !grab.targets.includes(status)) return;

      setGrab(null);
      setFocusTarget({ taskId: grab.task.id, status });
      setAnnouncement({ kind: 'dropped', task: grab.task, target: status });
      onMove(grab.task, status);
    },
    [grab, onMove],
  );

  const drop = useCallback(() => {
    const target = grab?.targets[grab.index];
    if (target) dropOn(target);
  }, [grab, dropOn]);

  const clearFocusTarget = useCallback(() => setFocusTarget(null), []);

  return useMemo(
    () => ({
      grabbedTaskId: grab?.task.id ?? null,
      targets: grab?.targets ?? [],
      activeTarget: grab ? (grab.targets[grab.index] ?? null) : null,
      announcement,
      focusTarget,
      clearFocusTarget,
      pickUp,
      cancel,
      step,
      drop,
      dropOn,
    }),
    [
      grab,
      announcement,
      focusTarget,
      clearFocusTarget,
      pickUp,
      cancel,
      step,
      drop,
      dropOn,
    ],
  );
}
