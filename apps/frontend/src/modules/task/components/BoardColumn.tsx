import { Badge, Button, EmptyState } from '@averoui/react';
import { useDroppable } from '@dnd-kit/core';
import { Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import type { TaskStatus } from '@contracts';
import { BoardCardList } from '@/modules/task/components/BoardCardList';
import { BOARD_DROP_ATTRIBUTE } from '@/modules/task/components/TaskMoveButton';
import { TASK_STATUS_TONES } from '@/modules/task/constants/task.constants';

type BoardColumnProps<Task extends { id: string }> = {
  status: TaskStatus;
  tasks: Task[];
  renderCard: (task: Task) => ReactNode;
  /** A card that has just landed here and must be on screen. */
  revealTaskId: string | null;
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  /** A card is being moved and this column can take it. */
  isTarget: boolean;
  /** The column the arrow keys currently point at. */
  isActiveTarget: boolean;
  /** A card is being dragged, so a column is entered rather than tapped. */
  isDragging: boolean;
  onDropHere: () => void;
};

/** One status on the board: its name, its count and its cards. */
export function BoardColumn<Task extends { id: string }>({
  status,
  tasks,
  renderCard,
  revealTaskId,
  total,
  hasMore,
  isLoadingMore,
  onLoadMore,
  isTarget,
  isActiveTarget,
  isDragging,
  onDropHere,
}: BoardColumnProps<Task>) {
  const { t } = useTranslation();
  // Only a column the card may enter can be dropped on at all.
  const { setNodeRef } = useDroppable({ id: status, disabled: !isTarget });
  const shown = tasks.length;
  const name = t(`enums.taskStatus.${status}`);
  const headingId = `board-column-${status}`;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={`bg-surface-muted flex w-72 shrink-0 flex-col gap-3 rounded-2xl p-3 ${
        isActiveTarget
          ? 'ring-primary ring-2'
          : isDragging && isTarget
            ? 'ring-primary/40 ring-2'
            : isDragging
              ? 'opacity-60'
              : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} className="text-text-strong text-sm font-semibold">
          <Badge tone={TASK_STATUS_TONES[status]}>{name}</Badge>
        </h2>
        <span className="text-text-subtle text-xs tabular-nums">
          {t('task.board.columnCount', { shown, total })}
        </span>
      </div>

      {/* A drag is dropped on the column itself; a button appearing under
          the pointer would only shift the cards. */}
      {isTarget && !isDragging ? (
        <Button
          variant={isActiveTarget ? 'primary' : 'outline'}
          size="sm"
          block
          // The keyboard drops from the card's own button; this is for a tap.
          tabIndex={-1}
          {...{ [BOARD_DROP_ATTRIBUTE]: '' }}
          onClick={onDropHere}
        >
          {t('task.board.moveHere')}
        </Button>
      ) : null}

      {shown === 0 ? (
        <EmptyState variant="icon" icon={<Inbox />}>
          {t('task.board.columnEmpty', { status: name })}
        </EmptyState>
      ) : (
        <BoardCardList
          tasks={tasks}
          renderCard={renderCard}
          revealTaskId={revealTaskId}
        />
      )}

      {hasMore ? (
        <Button
          variant="ghost"
          size="sm"
          loading={isLoadingMore}
          onClick={onLoadMore}
        >
          {t('task.board.loadMore', { status: name })}
        </Button>
      ) : null}
    </section>
  );
}
