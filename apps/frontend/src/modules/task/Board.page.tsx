import { Button, Card, EmptyState, useToast } from '@averoui/react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { ListTodo, Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TASK_STATUSES } from '@contracts';
import type { TaskStatus } from '@contracts';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { useProjectContext } from '@/modules/project/hooks/useProjectContext';
import { BoardCard } from '@/modules/task/components/BoardCard';
import { BoardColumn } from '@/modules/task/components/BoardColumn';
import { CreateTaskDialog } from '@/modules/task/components/CreateTaskDialog';
import { TaskCard } from '@/modules/task/components/TaskCard';
import { TaskMoveButton } from '@/modules/task/components/TaskMoveButton';
import {
  BOARD_DRAG_DISTANCE,
  BOARD_DRAG_TOUCH_DELAY,
  BOARD_DRAG_TOUCH_TOLERANCE,
} from '@/modules/task/constants/task.constants';
import { useBoardMove } from '@/modules/task/hooks/useBoardMove';
import type { BoardAnnouncement } from '@/modules/task/hooks/useBoardMove';
import { useTaskQuickActions } from '@/modules/task/hooks/useTaskActions';
import { useProjectBoard } from '@/modules/task/hooks/useTasks';
import type { TaskCardData } from '@/modules/task/hooks/useTasks';
import { taskCapabilities } from '@/modules/task/utils/task.utils';
import { ErrorState, PageSkeleton } from '@/shared/components';
import { useErrorToast } from '@/shared/hooks/useErrorToast';
import { ApiError } from '@/shared/lib/apiError';
import { can } from '@/shared/lib/capabilities';

const INSTRUCTIONS_ID = 'board-move-instructions';

// The board announces a move itself, in the user's language, whichever way it
// is made. The drag library's own English announcements stay silent.
const SILENT_ANNOUNCEMENTS = {
  onDragStart: () => undefined,
  onDragOver: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => undefined,
};

function columnStatus(id: unknown): TaskStatus | null {
  return TASK_STATUSES.find((status) => status === id) ?? null;
}

/**
 * The project's tasks as one column per status. A card is moved by picking it
 * up and choosing a column — by dragging it, with the keyboard or by tapping —
 * and only the columns the workflow allows are offered.
 */
export function BoardPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const showError = useErrorToast();
  const { user } = useAuth();
  const { project, roles } = useProjectContext();
  const {
    columns,
    totalCount,
    isLoading,
    error,
    refetch,
    loadingMore,
    loadMoreInColumn,
  } = useProjectBoard(project.id);
  const { changeTaskStatus } = useTaskQuickActions();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleMove = useCallback(
    (task: { id: string }, status: TaskStatus) => {
      // Optimistic: the card is already in its new column. A refusal puts it
      // back, and this says why.
      changeTaskStatus(task.id, status).catch((moveError: unknown) => {
        if (ApiError.is(moveError) && moveError.kind === 'validation') {
          toast({ tone: 'danger', title: t('task.statusRejected') });
          return;
        }
        showError(moveError);
      });
    },
    [changeTaskStatus, showError, t, toast],
  );

  const move = useBoardMove(handleMove);

  // A mouse drags once it has travelled; a touch once it has rested, so a
  // swipe still scrolls the board. The keyboard has its own path.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: BOARD_DRAG_DISTANCE },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: BOARD_DRAG_TOUCH_DELAY,
        tolerance: BOARD_DRAG_TOUCH_TOLERANCE,
      },
    }),
  );
  // Where the drag library's own (silenced) live region goes: out of sight
  // and out of the accessibility tree, so there is one announcer, not two.
  const [dragAnnouncer, setDragAnnouncer] = useState<HTMLDivElement | null>(
    null,
  );
  const dragAccessibility = useMemo(
    () => ({
      announcements: SILENT_ANNOUNCEMENTS,
      ...(dragAnnouncer ? { container: dragAnnouncer } : {}),
    }),
    [dragAnnouncer],
  );

  const draggedTask = move.isDragging
    ? columns
        .flatMap((column) => column.tasks)
        .find((task) => task.id === move.grabbedTaskId)
    : undefined;

  function handleDragStart(event: DragStartEvent) {
    const task = columns
      .flatMap((column) => column.tasks)
      .find((candidate) => candidate.id === event.active.id);
    if (task) move.startDrag(task);
  }

  function handleDragOver(event: DragOverEvent) {
    move.aim(columnStatus(event.over?.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const status = columnStatus(event.over?.id);
    // Released over a column the card may not enter, or over none: let go.
    if (status && move.targets.includes(status)) move.dropOn(status);
    else move.cancel();
  }

  function renderCard(task: TaskCardData, status: TaskStatus) {
    const isGrabbed = move.grabbedTaskId === task.id;
    // A hint only: the server refuses the move to anyone else.
    const { canUpdate } = taskCapabilities(roles, user?.id, task);

    return (
      <BoardCard taskId={task.id} canMove={canUpdate}>
        <TaskCard
          task={task}
          isGrabbed={isGrabbed}
          action={
            canUpdate ? (
              <TaskMoveButton
                label={t('task.board.move', { title: task.title })}
                instructionsId={INSTRUCTIONS_ID}
                isGrabbed={isGrabbed}
                shouldFocus={
                  move.focusTarget?.taskId === task.id &&
                  move.focusTarget.status === status
                }
                onFocused={move.clearFocusTarget}
                onToggle={() => (isGrabbed ? move.drop() : move.pickUp(task))}
                onStep={move.step}
                onCancel={move.cancel}
              />
            ) : undefined
          }
        />
      </BoardCard>
    );
  }

  function describe(announcement: BoardAnnouncement | null): string {
    if (!announcement) return '';

    const status = (value: TaskStatus) => t(`enums.taskStatus.${value}`);

    switch (announcement.kind) {
      case 'grabbed':
        return t('task.board.grabbed', {
          title: announcement.task.title,
          status: status(announcement.target),
        });
      case 'target':
        return t('task.board.target', {
          status: status(announcement.target),
          position: announcement.position,
          count: announcement.count,
        });
      case 'dropped':
        return t('task.board.dropped', {
          title: announcement.task.title,
          status: status(announcement.target),
        });
      case 'cancelled':
        return t('task.board.cancelled', {
          title: announcement.task.title,
          status: status(announcement.task.status),
        });
      case 'noMoves':
        return t('task.board.noMoves', {
          title: announcement.task.title,
          status: status(announcement.task.status),
        });
    }
  }

  const createButton = can(roles, 'task:create') ? (
    <Button onClick={() => setIsCreateOpen(true)}>
      <Plus aria-hidden className="size-4" />
      {t('task.new')}
    </Button>
  ) : undefined;

  return (
    <section className="flex flex-col gap-4">
      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState
          title={t('task.boardLoadFailed')}
          description={t(error.messageKey as never)}
          requestId={error.requestId}
          onRetry={() => void refetch()}
        />
      ) : totalCount === 0 ? (
        <Card>
          <EmptyState
            variant="circle"
            icon={<ListTodo />}
            action={createButton}
          >
            {t('task.board.empty')}
          </EmptyState>
        </Card>
      ) : (
        <>
          {createButton ? (
            <div className="flex justify-end">{createButton}</div>
          ) : null}

          <p id={INSTRUCTIONS_ID} className="sr-only">
            {t('task.board.instructions')}
          </p>
          <p role="status" aria-live="polite" className="sr-only">
            {describe(move.announcement)}
          </p>

          <div ref={setDragAnnouncer} hidden />

          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            accessibility={dragAccessibility}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={move.cancel}
          >
            {/* Scrolls sideways on its own, so the page body never does. */}
            <div
              role="region"
              aria-label={t('task.board.label')}
              // Focusable so the keyboard can scroll it.
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              className="flex items-start gap-3 overflow-x-auto pb-2"
            >
              {columns.map((column) => (
                <BoardColumn
                  key={column.status}
                  status={column.status}
                  tasks={column.tasks}
                  renderCard={(task) => renderCard(task, column.status)}
                  revealTaskId={
                    move.focusTarget?.status === column.status
                      ? move.focusTarget.taskId
                      : null
                  }
                  total={column.totalCount}
                  hasMore={column.hasMore}
                  isLoadingMore={loadingMore === column.status}
                  onLoadMore={() => void loadMoreInColumn(column.status)}
                  isTarget={move.targets.includes(column.status)}
                  isActiveTarget={move.activeTarget === column.status}
                  isDragging={move.isDragging}
                  onDropHere={() => move.dropOn(column.status)}
                />
              ))}
            </div>

            {/* The card under the pointer. It lands at once, with no glide
                back: the move is already made, or already refused. */}
            <DragOverlay dropAnimation={null}>
              {draggedTask ? (
                <div inert className="cursor-grabbing">
                  <TaskCard task={draggedTask} isGrabbed />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}

      <CreateTaskDialog
        projectId={project.id}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </section>
  );
}
