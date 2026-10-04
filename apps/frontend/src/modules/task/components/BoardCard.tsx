import { useDraggable } from '@dnd-kit/core';
import type { ReactNode } from 'react';

type BoardCardProps = {
  taskId: string;
  /** A hint only: the server refuses the move to anyone else. */
  canMove: boolean;
  children: ReactNode;
};

/**
 * Makes a card draggable with a mouse or a touch. The keyboard does not come
 * through here: it moves a card from the card's own move button, so none of
 * the drag library's button semantics are put on the card.
 */
export function BoardCard({ taskId, canMove, children }: BoardCardProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: taskId,
    disabled: !canMove,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className={`${canMove ? 'cursor-grab' : ''} ${isDragging ? 'opacity-40' : ''}`}
    >
      {children}
    </div>
  );
}
