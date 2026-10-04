import { Badge, Button, EmptyState } from '@averoui/react';
import { Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import type { TaskStatus } from '@contracts';
import { BOARD_DROP_ATTRIBUTE } from '@/modules/task/components/TaskMoveButton';
import { TASK_STATUS_TONES } from '@/modules/task/constants/task.constants';

type BoardColumnProps = {
  status: TaskStatus;
  shown: number;
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  /** A card is being moved and this column can take it. */
  isTarget: boolean;
  /** The column the arrow keys currently point at. */
  isActiveTarget: boolean;
  onDropHere: () => void;
  /** The cards, one `<li>` each. */
  children: ReactNode;
};

/** One status on the board: its name, its count and its cards. */
export function BoardColumn({
  status,
  shown,
  total,
  hasMore,
  isLoadingMore,
  onLoadMore,
  isTarget,
  isActiveTarget,
  onDropHere,
  children,
}: BoardColumnProps) {
  const { t } = useTranslation();
  const name = t(`enums.taskStatus.${status}`);
  const headingId = `board-column-${status}`;

  return (
    <section
      aria-labelledby={headingId}
      className={`bg-surface-muted flex w-72 shrink-0 flex-col gap-3 rounded-2xl p-3 ${
        isActiveTarget ? 'ring-primary ring-2' : ''
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

      {isTarget ? (
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
        /* Off-screen cards skip layout and paint, so a long column stays
           cheap to scroll; the size hint keeps the scrollbar honest. */
        <ul className="flex flex-col gap-2 *:[contain-intrinsic-size:auto_8rem] *:[content-visibility:auto]">
          {children}
        </ul>
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
