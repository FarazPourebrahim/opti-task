import { Button, Card, EmptyState, useToast } from '@averoui/react';
import { ListTodo, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TaskStatus } from '@contracts';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { useProjectContext } from '@/modules/project/hooks/useProjectContext';
import { BoardColumn } from '@/modules/task/components/BoardColumn';
import { CreateTaskDialog } from '@/modules/task/components/CreateTaskDialog';
import { TaskCard } from '@/modules/task/components/TaskCard';
import { TaskMoveButton } from '@/modules/task/components/TaskMoveButton';
import { useBoardMove } from '@/modules/task/hooks/useBoardMove';
import type { BoardAnnouncement } from '@/modules/task/hooks/useBoardMove';
import { useTaskQuickActions } from '@/modules/task/hooks/useTaskActions';
import { useProjectBoard } from '@/modules/task/hooks/useTasks';
import { taskCapabilities } from '@/modules/task/utils/task.utils';
import { ErrorState, PageSkeleton } from '@/shared/components';
import { useErrorToast } from '@/shared/hooks/useErrorToast';
import { ApiError } from '@/shared/lib/apiError';
import { can } from '@/shared/lib/capabilities';

const INSTRUCTIONS_ID = 'board-move-instructions';

/**
 * The project's tasks as one column per status. A card is moved by picking it
 * up and choosing a column — with the keyboard or by tapping — and only the
 * columns the workflow allows are offered.
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
                shown={column.tasks.length}
                total={column.totalCount}
                hasMore={column.hasMore}
                isLoadingMore={loadingMore === column.status}
                onLoadMore={() => void loadMoreInColumn(column.status)}
                isTarget={move.targets.includes(column.status)}
                isActiveTarget={move.activeTarget === column.status}
                onDropHere={() => move.dropOn(column.status)}
              >
                {column.tasks.map((task) => {
                  const isGrabbed = move.grabbedTaskId === task.id;
                  const { canUpdate } = taskCapabilities(roles, user?.id, task);

                  return (
                    <li key={task.id}>
                      <TaskCard
                        task={task}
                        isGrabbed={isGrabbed}
                        action={
                          // A hint only: the server refuses the move to
                          // anyone else.
                          canUpdate ? (
                            <TaskMoveButton
                              label={t('task.board.move', {
                                title: task.title,
                              })}
                              instructionsId={INSTRUCTIONS_ID}
                              isGrabbed={isGrabbed}
                              shouldFocus={
                                move.focusTarget?.taskId === task.id &&
                                move.focusTarget.status === column.status
                              }
                              onFocused={move.clearFocusTarget}
                              onToggle={() =>
                                isGrabbed ? move.drop() : move.pickUp(task)
                              }
                              onStep={move.step}
                              onCancel={move.cancel}
                            />
                          ) : undefined
                        }
                      />
                    </li>
                  );
                })}
              </BoardColumn>
            ))}
          </div>
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
