import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Progress,
  useToast,
} from '@averoui/react';
import { Flag, ListTodo } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { EpicForm } from '@/modules/epic/components/EpicForm';
import { MilestoneForm } from '@/modules/epic/components/MilestoneForm';
import { useEpic, useEpicActions } from '@/modules/epic/hooks/useEpics';
import type { MilestoneRow } from '@/modules/epic/hooks/useEpics';
import type {
  EpicInput,
  MilestoneInput,
} from '@/modules/epic/schemas/epic.schema';
import { useProjectContext } from '@/modules/project/hooks/useProjectContext';
import { TASK_STATUS_TONES } from '@/modules/task/constants/task.constants';
import {
  AppLink,
  ErrorState,
  LoadMore,
  PageSkeleton,
} from '@/shared/components';
import { useBreadcrumbLabel } from '@/shared/context/breadcrumb.context';
import { useEntityIdParam } from '@/shared/hooks/useEntityIdParam';
import { useErrorToast } from '@/shared/hooks/useErrorToast';
import { useEscalateRouteError } from '@/shared/hooks/useEscalateRouteError';
import { can } from '@/shared/lib/capabilities';
import {
  CRUMB_IDS,
  ROUTE_PARAMS,
  projectEpicsPath,
  taskPath,
} from '@/shared/routes/route.constants';
import { formatCalendarDate } from '@/shared/utils/date.utils';

/** One epic: its progress, its tasks and its milestones. */
export function EpicDetailPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const showError = useErrorToast();
  const navigate = useNavigate();
  const { project, roles } = useProjectContext();
  const epicId = useEntityIdParam(ROUTE_PARAMS.epicId);
  const {
    epic,
    tasks,
    tasksTotal,
    isLoading,
    error,
    refetch,
    hasMoreTasks,
    isLoadingMoreTasks,
    loadMoreTasks,
  } = useEpic(epicId);
  const {
    updateEpic,
    isUpdating,
    refreshProgress,
    isRefreshing,
    deleteEpic,
    createMilestone,
    isCreatingMilestone,
    deleteMilestone,
  } = useEpicActions(epicId);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isMilestoneOpen, setIsMilestoneOpen] = useState(false);
  const [pendingMilestone, setPendingMilestone] = useState<MilestoneRow | null>(
    null,
  );

  useEscalateRouteError(error);
  useBreadcrumbLabel(CRUMB_IDS.epic, epic?.name);

  if (isLoading) return <PageSkeleton />;

  if (error || !epic) {
    return (
      <ErrorState
        title={t('epic.loadFailed')}
        description={error ? t(error.messageKey as never) : undefined}
        requestId={error?.requestId}
        onRetry={() => void refetch()}
      />
    );
  }

  // Hints only: the server refuses each action to anyone else.
  const canUpdate = can(roles, 'epic:update');
  const canCreateMilestone = can(roles, 'epic:create');
  const canDelete = can(roles, 'epic:delete');
  const percent = Math.round(epic.progress);

  async function handleUpdate(input: EpicInput) {
    await updateEpic(input);
    toast({ tone: 'success', title: t('epic.updated') });
    setIsEditOpen(false);
  }

  async function handleRefresh() {
    try {
      const refreshed = await refreshProgress();
      if (!refreshed) return;

      toast({
        tone: 'success',
        title: t('epic.progressSaved', {
          value: Math.round(refreshed.progress),
        }),
      });
    } catch (refreshError) {
      showError(refreshError);
    }
  }

  /* Never rejects: ConfirmDialog stays open until this settles, and a failure
     is reported through the toast. */
  async function handleDelete() {
    if (!epic) return;

    try {
      const { name } = epic;
      await deleteEpic(project.id);
      toast({ tone: 'success', title: t('epic.deleted', { name }) });
      await navigate(projectEpicsPath(project.id), { replace: true });
    } catch (deleteError) {
      showError(deleteError);
      setIsConfirmingDelete(false);
    }
  }

  async function handleCreateMilestone(input: MilestoneInput) {
    await createMilestone(project.id, input);
    toast({
      tone: 'success',
      title: t('epic.milestone.created', { name: input.name }),
    });
    setIsMilestoneOpen(false);
  }

  async function handleDeleteMilestone() {
    if (!pendingMilestone) return;

    try {
      await deleteMilestone(pendingMilestone.id);
      toast({
        tone: 'success',
        title: t('epic.milestone.deleted', { name: pendingMilestone.name }),
      });
    } catch (deleteError) {
      showError(deleteError);
    } finally {
      setPendingMilestone(null);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-text-strong text-xl font-bold">{epic.name}</h2>
          <p className="text-text-subtle text-sm whitespace-pre-line">
            {epic.description ?? t('epic.noDescription')}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {canUpdate ? (
            <Button variant="outline" onClick={() => setIsEditOpen(true)}>
              {t('epic.edit')}
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              variant="danger"
              onClick={() => setIsConfirmingDelete(true)}
            >
              {t('epic.delete')}
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h3">{t('epic.progress')}</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3">
          <p className="text-text-subtle flex items-center justify-between text-sm tabular-nums">
            <span id="epic-progress-label">
              {t('epic.tasksDone', {
                completed: epic.completedTasks,
                total: epic.totalTasks,
              })}
            </span>
            <span className="text-text-strong font-semibold">
              {t('epic.percent', { value: percent })}
            </span>
          </p>
          <Progress
            value={percent}
            tone="success"
            aria-labelledby="epic-progress-label"
          />
          {/* The figure above is always live. Saving it changes nothing on
              this screen, and the interface has to say so. */}
          <p className="text-text-subtle text-sm">{t('epic.progressLive')}</p>
          {canUpdate ? (
            <div>
              <Button
                variant="outline"
                size="sm"
                loading={isRefreshing}
                onClick={() => void handleRefresh()}
              >
                {t('epic.progressSave')}
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h3">{t('epic.milestone.title')}</CardTitle>
          {canCreateMilestone ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMilestoneOpen(true)}
            >
              {t('epic.milestone.new')}
            </Button>
          ) : null}
        </CardHeader>
        {epic.milestones.length === 0 ? (
          <EmptyState variant="icon" icon={<Flag />}>
            {t('epic.milestone.empty')}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="divide-border-subtle flex flex-col divide-y">
              {epic.milestones.map((milestone) => (
                <li
                  key={milestone.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-text-strong font-medium">
                      {milestone.name}
                    </span>
                    {milestone.description ? (
                      <span className="text-text-subtle text-sm">
                        {milestone.description}
                      </span>
                    ) : null}
                    <span className="text-text-subtle text-xs">
                      {milestone.dueDate
                        ? t('epic.milestone.due', {
                            date: formatCalendarDate(
                              milestone.dueDate,
                              i18n.language,
                            ),
                          })
                        : t('epic.milestone.noDueDate')}
                    </span>
                  </div>
                  {canDelete ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('epic.milestone.deleteNamed', {
                        name: milestone.name,
                      })}
                      onClick={() => setPendingMilestone(milestone)}
                    >
                      {t('common.delete')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {/* No edit button exists because no edit operation does. */}
            {canCreateMilestone || canDelete ? (
              <p className="text-text-subtle text-xs">
                {t('epic.milestone.noEdit')}
              </p>
            ) : null}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h3">{t('epic.tasks.title')}</CardTitle>
        </CardHeader>
        {tasks.length === 0 ? (
          <EmptyState variant="icon" icon={<ListTodo />}>
            {t('epic.tasks.empty')}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            <ul className="divide-border-subtle flex flex-col divide-y">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <AppLink
                    to={taskPath(project.id, task.id)}
                    variant="subtle"
                    className="min-w-0 font-medium"
                  >
                    {task.title}
                  </AppLink>
                  <span className="flex items-center gap-3">
                    <span className="text-text-subtle text-xs tabular-nums">
                      {task.storyPoints === null ||
                      task.storyPoints === undefined
                        ? t('task.unestimated')
                        : t('task.points', { count: task.storyPoints })}
                    </span>
                    <Badge tone={TASK_STATUS_TONES[task.status]}>
                      {t(`enums.taskStatus.${task.status}`)}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
            <LoadMore
              shown={tasks.length}
              total={tasksTotal}
              hasMore={hasMoreTasks}
              isLoading={isLoadingMoreTasks}
              onLoadMore={() => void loadMoreTasks()}
            />
          </div>
        )}
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('epic.editTitle')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <EpicForm
              initialValues={epic}
              submitLabel={t('common.save')}
              isPending={isUpdating}
              onSubmit={handleUpdate}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={isMilestoneOpen} onOpenChange={setIsMilestoneOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('epic.milestone.createTitle')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <MilestoneForm
              isPending={isCreatingMilestone}
              onSubmit={handleCreateMilestone}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isConfirmingDelete}
        onOpenChange={setIsConfirmingDelete}
        title={t('epic.deleteConfirmTitle', { name: epic.name })}
        description={t('epic.deleteConfirmBody')}
        confirmLabel={t('epic.delete')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={pendingMilestone !== null}
        onOpenChange={(open) => {
          if (!open) setPendingMilestone(null);
        }}
        title={t('epic.milestone.deleteConfirmTitle', {
          name: pendingMilestone?.name ?? '',
        })}
        description={t('epic.milestone.deleteConfirmBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={handleDeleteMilestone}
      />
    </section>
  );
}
