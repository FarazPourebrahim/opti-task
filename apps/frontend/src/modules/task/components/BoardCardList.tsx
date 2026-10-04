import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  BOARD_CARD_ESTIMATED_HEIGHT,
  BOARD_CARD_GAP,
  BOARD_WINDOW_THRESHOLD,
} from '@/modules/task/constants/task.constants';

type BoardCardListProps<Task extends { id: string }> = {
  tasks: Task[];
  renderCard: (task: Task) => ReactNode;
  /** A card that must be on screen: it has just landed and takes focus. */
  revealTaskId: string | null;
};

/** A column's cards. A long column renders only the ones in view. */
export function BoardCardList<Task extends { id: string }>(
  props: BoardCardListProps<Task>,
) {
  if (props.tasks.length > BOARD_WINDOW_THRESHOLD) {
    return <WindowedCardList {...props} />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {props.tasks.map((task) => (
        <li key={task.id}>{props.renderCard(task)}</li>
      ))}
    </ul>
  );
}

function WindowedCardList<Task extends { id: string }>({
  tasks,
  renderCard,
  revealTaskId,
}: BoardCardListProps<Task>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => BOARD_CARD_ESTIMATED_HEIGHT,
    gap: BOARD_CARD_GAP,
    getItemKey: (index) => tasks[index]?.id ?? index,
  });

  // A card outside the window does not exist, so it could never take focus.
  useEffect(() => {
    if (!revealTaskId) return;

    const index = tasks.findIndex((task) => task.id === revealTaskId);
    if (index !== -1) virtualizer.scrollToIndex(index);
  }, [revealTaskId, tasks, virtualizer]);

  return (
    // The padding keeps a card's focus ring from being clipped by the scroll.
    <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto p-0.5">
      <ul className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const task = tasks[item.index];
          if (!task) return null;

          return (
            <li
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              // The list is partial, so each card says where it stands in it.
              aria-setsize={tasks.length}
              aria-posinset={item.index + 1}
              className="absolute inset-x-0 top-0"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              {renderCard(task)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
