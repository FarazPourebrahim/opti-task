import {
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
  useToast,
} from '@averoui/react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { SprintState } from '@contracts';
import { AiRequestPanel } from '@/modules/ai/components/AiRequestPanel';
import { AI_SPRINT_REQUESTS } from '@/modules/ai/constants/ai.constants';
import { useProjectContext } from '@/modules/project/hooks/useProjectContext';
import { SprintBurndown } from '@/modules/sprint/components/SprintBurndown';
import { SprintForm } from '@/modules/sprint/components/SprintForm';
import { SprintMetricsPanel } from '@/modules/sprint/components/SprintMetricsPanel';
import { SprintStateControl } from '@/modules/sprint/components/SprintStateControl';
import { SprintTasks } from '@/modules/sprint/components/SprintTasks';
import { SprintWorkload } from '@/modules/sprint/components/SprintWorkload';
import {
  useSprint,
  useSprintActions,
  useSprintTaskCandidates,
} from '@/modules/sprint/hooks/useSprints';
import type { SprintTaskRow } from '@/modules/sprint/hooks/useSprints';
import type { SprintInput } from '@/modules/sprint/schemas/sprint.schema';
import { ErrorState, PageSkeleton } from '@/shared/components';
import { useBreadcrumbLabel } from '@/shared/context/breadcrumb.context';
import { useEntityIdParam } from '@/shared/hooks/useEntityIdParam';
import { useErrorToast } from '@/shared/hooks/useErrorToast';
import { useEscalateRouteError } from '@/shared/hooks/useEscalateRouteError';
import { ApiError } from '@/shared/lib/apiError';
import { can } from '@/shared/lib/capabilities';
import {
  CRUMB_IDS,
  ROUTE_PARAMS,
  projectSprintsPath,
} from '@/shared/routes/route.constants';
import { formatCalendarDate } from '@/shared/utils/date.utils';

/** One sprint: its plan, its figures, its burndown and the tasks in it. */
export function SprintDetailPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const showError = useErrorToast();
  const navigate = useNavigate();
  const { project, roles, members } = useProjectContext();
  const people = useMemo(
    () =>
      members.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
      })),
    [members],
  );
  const sprintId = useEntityIdParam(ROUTE_PARAMS.sprintId);
  const {
    sprint,
    tasks,
    tasksTotal,
    isLoading,
    error,
    refetch,
    hasMoreTasks,
    isLoadingMoreTasks,
    loadMoreTasks,
  } = useSprint(sprintId);
  const {
    updateSprint,
    isUpdating,
    changeSprintState,
    deleteSprint,
    addTask,
    isAddingTask,
    removeTaskFromSprint,
  } = useSprintActions(sprintId);

  // Hints only: the server refuses each action to anyone else.
  const canUpdate = can(roles, 'sprint:update');
  const { candidates } = useSprintTaskCandidates(
    project.id,
    sprintId,
    canUpdate,
  );

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEscalateRouteError(error);
  useBreadcrumbLabel(CRUMB_IDS.sprint, sprint?.name);

  if (isLoading) return <PageSkeleton />;

  if (error || !sprint) {
    return (
      <ErrorState
        title={t('sprint.loadFailed')}
        description={error ? t(error.messageKey as never) : undefined}
        requestId={error?.requestId}
        onRetry={() => void refetch()}
      />
    );
  }

  const start = formatCalendarDate(sprint.startDate, i18n.language);
  const end = formatCalendarDate(sprint.endDate, i18n.language);

  async function handleUpdate(input: SprintInput) {
    await updateSprint(input);
    // Dates and capacity feed the burndown and the over-capacity flag, which
    // only the server computes.
    await refetch();
    toast({ tone: 'success', title: t('sprint.updated') });
    setIsEditOpen(false);
  }

  async function handleStateChange(state: SprintState) {
    try {
      await changeSprintState(state);
      toast({
        tone: 'success',
        title: t('sprint.stateChanged', {
          state: t(`enums.sprintState.${state}`),
        }),
      });
    } catch (stateError) {
      // The generic validation text points at a form; this is not one.
      if (ApiError.is(stateError) && stateError.kind === 'validation') {
        toast({ tone: 'danger', title: t('sprint.stateRejected') });
        return;
      }
      showError(stateError);
    }
  }

  /* Never rejects: ConfirmDialog stays open until this settles, and a failure
     is reported through the toast. */
  async function handleDelete() {
    if (!sprint) return;

    try {
      const { name } = sprint;
      await deleteSprint(project.id);
      toast({ tone: 'success', title: t('sprint.deleted', { name }) });
      await navigate(projectSprintsPath(project.id), { replace: true });
    } catch (deleteError) {
      showError(deleteError);
      setIsConfirmingDelete(false);
    }
  }

  async function handleAddTask(taskId: string) {
    const added = candidates.find((candidate) => candidate.id === taskId);

    try {
      await addTask(taskId);
      toast({
        tone: 'success',
        title: t('sprint.tasks.added', { title: added?.title ?? '' }),
      });
    } catch (addError) {
      showError(addError);
    }
  }

  async function handleRemoveTask(task: SprintTaskRow) {
    try {
      await removeTaskFromSprint(task.id);
      toast({
        tone: 'success',
        title: t('sprint.tasks.removed', { title: task.title }),
      });
    } catch (removeError) {
      showError(removeError);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-text-strong text-xl font-bold">{sprint.name}</h2>
          <p className="text-text-subtle text-sm">
            {sprint.goal ?? t('sprint.noGoal')}
          </p>
          <dl className="text-text-subtle mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-1.5">
              <dt>{t('sprint.startDate')}</dt>
              <dd className="text-text-strong">
                {start || t('sprint.notSet')}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt>{t('sprint.endDate')}</dt>
              <dd className="text-text-strong">{end || t('sprint.notSet')}</dd>
            </div>
          </dl>
        </div>
        <div className="flex shrink-0 gap-2">
          {canUpdate ? (
            <Button variant="outline" onClick={() => setIsEditOpen(true)}>
              {t('sprint.edit')}
            </Button>
          ) : null}
          {can(roles, 'sprint:delete') ? (
            <Button
              variant="danger"
              onClick={() => setIsConfirmingDelete(true)}
            >
              {t('sprint.delete')}
            </Button>
          ) : null}
        </div>
      </div>

      <SprintStateControl
        state={sprint.state}
        canChange={canUpdate}
        onChange={handleStateChange}
      />

      <SprintMetricsPanel metrics={sprint.metrics} />

      <Card>
        <CardHeader>
          <CardTitle as="h3">{t('ai.sprintTitle')}</CardTitle>
        </CardHeader>
        <AiRequestPanel
          projectId={project.id}
          subjectId={sprintId}
          kinds={AI_SPRINT_REQUESTS}
          roles={roles}
          members={people}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <SprintBurndown
          points={sprint.burndown}
          hasDates={Boolean(sprint.startDate && sprint.endDate)}
        />
        <SprintWorkload rows={sprint.metrics.workloadDistribution} />
      </div>

      <SprintTasks
        projectId={project.id}
        tasks={tasks}
        total={tasksTotal}
        hasMore={hasMoreTasks}
        isLoadingMore={isLoadingMoreTasks}
        onLoadMore={() => void loadMoreTasks()}
        canManage={canUpdate}
        candidates={candidates}
        isAdding={isAddingTask}
        onAdd={handleAddTask}
        onRemove={handleRemoveTask}
      />

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('sprint.editTitle')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <SprintForm
              initialValues={sprint}
              submitLabel={t('common.save')}
              isPending={isUpdating}
              onSubmit={handleUpdate}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isConfirmingDelete}
        onOpenChange={setIsConfirmingDelete}
        title={t('sprint.deleteConfirmTitle', { name: sprint.name })}
        description={t('sprint.deleteConfirmBody')}
        confirmLabel={t('sprint.delete')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={handleDelete}
      />
    </section>
  );
}
