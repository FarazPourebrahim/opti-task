import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  useToast,
} from '@averoui/react';
import { EyeOff } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { TaskStatus } from '@contracts';
import { AiRequestPanel } from '@/modules/ai/components/AiRequestPanel';
import { AssignmentContextPanel } from '@/modules/ai/components/AssignmentContextPanel';
import { AI_TASK_REQUESTS } from '@/modules/ai/constants/ai.constants';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { TaskAttachments } from '@/modules/comment/components/TaskAttachments';
import { TaskComments } from '@/modules/comment/components/TaskComments';
import { useProjectContext } from '@/modules/project/hooks/useProjectContext';
import { TaskActivityList } from '@/modules/task/components/TaskActivityList';
import { TaskAssigneeControl } from '@/modules/task/components/TaskAssigneeControl';
import { TaskDependencies } from '@/modules/task/components/TaskDependencies';
import { TaskEstimateControl } from '@/modules/task/components/TaskEstimateControl';
import { TaskForm } from '@/modules/task/components/TaskForm';
import { TaskLabels } from '@/modules/task/components/TaskLabels';
import { TaskStatusControl } from '@/modules/task/components/TaskStatusControl';
import { TaskTimeLog } from '@/modules/task/components/TaskTimeLog';
import { TASK_PRIORITY_TONES } from '@/modules/task/constants/task.constants';
import {
  useTaskActions,
  useTaskQuickActions,
} from '@/modules/task/hooks/useTaskActions';
import type { TaskAssignee } from '@/modules/task/hooks/useTaskActions';
import {
  useProjectPlanning,
  useTask,
  useTaskOptions,
} from '@/modules/task/hooks/useTasks';
import type { TaskDetailsInput } from '@/modules/task/schemas/task.schema';
import {
  formatDuration,
  taskCapabilities,
} from '@/modules/task/utils/task.utils';
import {
  AppLink,
  ErrorState,
  PageSkeleton,
  SelectField,
} from '@/shared/components';
import { useBreadcrumbLabel } from '@/shared/context/breadcrumb.context';
import { useEntityIdParam } from '@/shared/hooks/useEntityIdParam';
import { useErrorToast } from '@/shared/hooks/useErrorToast';
import { useEscalateRouteError } from '@/shared/hooks/useEscalateRouteError';
import { ApiError } from '@/shared/lib/apiError';
import {
  CRUMB_IDS,
  ROUTE_PARAMS,
  projectTasksPath,
  userPath,
} from '@/shared/routes/route.constants';
import { formatCalendarDate } from '@/shared/utils/date.utils';

/** A select cannot hold an empty value, so "no sprint" has a name. */
const NO_SPRINT = 'NONE';

export function TaskDetailPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const showError = useErrorToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { project, roles, members } = useProjectContext();
  const taskId = useEntityIdParam(ROUTE_PARAMS.taskId);
  const {
    task,
    activities,
    isLoading,
    error,
    refetch,
    hasMoreActivities,
    isLoadingMoreActivities,
    loadMoreActivities,
  } = useTask(taskId);
  const { sprints, sprintName, epicName } = useProjectPlanning(project.id);
  const { changeTaskStatus, assignTask, setTaskStoryPoints } =
    useTaskQuickActions();
  const actions = useTaskActions(taskId);

  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [dependencyError, setDependencyError] = useState<string | null>(null);

  useEscalateRouteError(error);
  useBreadcrumbLabel(CRUMB_IDS.task, task?.title);

  const capabilities = taskCapabilities(roles, user?.id, task ?? {});
  const { options: taskOptions } = useTaskOptions(
    project.id,
    capabilities.canUpdate,
  );

  const assignees = useMemo(
    () =>
      members.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
      })),
    [members],
  );

  const personName = useCallback(
    (id: string) =>
      members.find((member) => member.user.id === id)?.user.name ?? null,
    [members],
  );

  // The audit trail gains an entry with every audited change.
  const refreshActivity = useCallback(() => void refetch(), [refetch]);

  if (isLoading) return <PageSkeleton />;

  if (error || !task) {
    return (
      <ErrorState
        title={t('task.loadFailed')}
        description={error ? t(error.messageKey as never) : undefined}
        requestId={error?.requestId}
        onRetry={() => void refetch()}
      />
    );
  }

  const isWatching = task.watchers.some((watcher) => watcher.id === user?.id);
  const dependencyIds = new Set(task.dependencies.map((item) => item.id));
  const dependencyCandidates = taskOptions.filter(
    (option) => option.id !== task.id && !dependencyIds.has(option.id),
  );

  function handleStatusChange(status: TaskStatus) {
    // Optimistic: the badge has already changed. A refusal puts it back.
    changeTaskStatus(taskId, status)
      .then(refreshActivity)
      .catch((statusError: unknown) => {
        if (ApiError.is(statusError) && statusError.kind === 'validation') {
          toast({ tone: 'danger', title: t('task.statusRejected') });
          return;
        }
        showError(statusError);
      });
  }

  function handleAssign(assignee: TaskAssignee | null) {
    assignTask(taskId, assignee)
      .then(() => {
        toast({
          tone: 'success',
          title: assignee
            ? t('task.assigned', { name: assignee.name })
            : t('task.unassignedDone'),
        });
        refreshActivity();
      })
      .catch(showError);
  }

  function handleEstimate(storyPoints: number | null) {
    setTaskStoryPoints(taskId, storyPoints)
      .then(() => {
        toast({
          tone: 'success',
          title:
            storyPoints === null
              ? t('task.storyPointsCleared')
              : t('task.storyPointsSaved'),
        });
        refreshActivity();
      })
      .catch(showError);
  }

  async function handleSprint(value: string) {
    const sprintId = value === NO_SPRINT ? null : value;

    try {
      await actions.moveTaskToSprint(sprintId);
      toast({
        tone: 'success',
        title: sprintId
          ? t('task.sprintMoved', { sprint: sprintName(sprintId) ?? '' })
          : t('task.sprintRemoved'),
      });
      refreshActivity();
    } catch (sprintError) {
      showError(sprintError);
    }
  }

  async function handleUpdate(input: TaskDetailsInput) {
    await actions.updateTask(input);
    toast({ tone: 'success', title: t('task.updated') });
    setIsEditing(false);
  }

  async function handleAddDependency(dependsOnTaskId: string) {
    setDependencyError(null);

    try {
      await actions.addTaskDependency(dependsOnTaskId);
      toast({ tone: 'success', title: t('task.dependencyAdded') });
      return true;
    } catch (addError) {
      /*
       * The picker never offers the task itself or one already depended on,
       * so a rejected input here is the loop the server checks for. The
       * generic "fix the details below" would explain nothing.
       */
      if (ApiError.is(addError) && addError.kind === 'validation') {
        setDependencyError(t('task.dependencyCycle'));
      } else if (ApiError.is(addError) && addError.kind === 'conflict') {
        setDependencyError(t('task.dependencyExists'));
      } else {
        showError(addError);
      }
      return false;
    }
  }

  async function handleLogTime(seconds: number) {
    try {
      await actions.logTaskTime(seconds);
      toast({
        tone: 'success',
        title: t('task.timeLoggedDone', {
          duration: formatDuration(seconds, i18n.language),
        }),
      });
      return true;
    } catch (logError) {
      showError(logError);
      return false;
    }
  }

  async function handleAddLabel(name: string) {
    try {
      await actions.addTaskLabel(name);
      return true;
    } catch (labelError) {
      showError(labelError);
      return false;
    }
  }

  async function handleWatch() {
    try {
      await actions.setWatching(!isWatching);
      toast({
        tone: 'success',
        title: isWatching ? t('task.unwatched') : t('task.watching'),
      });
    } catch (watchError) {
      showError(watchError);
    }
  }

  /* Never rejects: ConfirmDialog stays open until this settles, and a failure
     is reported through the toast. */
  async function handleDelete() {
    if (!task) return;

    try {
      await actions.deleteTask(project.id);
      toast({
        tone: 'success',
        title: t('task.deleted', { title: task.title }),
      });
      await navigate(projectTasksPath(project.id), { replace: true });
    } catch (deleteError) {
      showError(deleteError);
      setIsConfirmingDelete(false);
    }
  }

  const dueDate = formatCalendarDate(task.dueDate, i18n.language);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-text-strong min-w-0 text-xl font-bold">
          {task.title}
        </h2>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            aria-pressed={isWatching}
            loading={actions.isTogglingWatch}
            onClick={() => void handleWatch()}
          >
            {isWatching ? t('task.unwatch') : t('task.watch')}
          </Button>
          {capabilities.canUpdate && !isEditing ? (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              {t('task.edit')}
            </Button>
          ) : null}
          {capabilities.canDelete ? (
            <Button
              variant="danger"
              onClick={() => setIsConfirmingDelete(true)}
            >
              {t('task.delete')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle as="h3">
                {isEditing ? t('task.editTitle') : t('task.detailsTitle')}
              </CardTitle>
            </CardHeader>
            {isEditing ? (
              <TaskForm
                mode="edit"
                initialValues={task}
                submitLabel={t('common.save')}
                isPending={actions.isUpdating}
                onSubmit={handleUpdate}
                onCancel={() => setIsEditing(false)}
              />
            ) : (
              <div className="flex flex-col gap-4">
                {/* Plain text: the description is never treated as markup. */}
                <p className="text-sm whitespace-pre-wrap">
                  {task.description ?? (
                    <span className="text-text-subtle">
                      {t('task.noDescription')}
                    </span>
                  )}
                </p>
                <dl className="grid gap-4 text-sm sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <dt className="text-text-subtle">{t('task.priority')}</dt>
                    <dd>
                      <Badge tone={TASK_PRIORITY_TONES[task.priority]}>
                        {t(`enums.taskPriority.${task.priority}`)}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-text-subtle">{t('task.dueDate')}</dt>
                    <dd className="font-medium">
                      {dueDate || t('task.noDueDate')}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-text-subtle">{t('task.epic')}</dt>
                    <dd className="font-medium">
                      {task.epicId
                        ? (epicName(task.epicId) ?? t('task.unknownEpic'))
                        : t('task.noEpic')}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h3">{t('task.dependenciesTitle')}</CardTitle>
            </CardHeader>
            <TaskDependencies
              projectId={project.id}
              dependencies={task.dependencies}
              candidates={dependencyCandidates}
              canChange={capabilities.canUpdate}
              isAdding={actions.isAddingDependency}
              addError={dependencyError}
              onAdd={handleAddDependency}
              onRemove={(dependency) => {
                actions
                  .removeTaskDependency(dependency.id)
                  .then(() =>
                    toast({
                      tone: 'success',
                      title: t('task.dependencyRemoved'),
                    }),
                  )
                  .catch(showError);
              }}
            />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h3">{t('ai.taskTitle')}</CardTitle>
            </CardHeader>
            <AiRequestPanel
              projectId={project.id}
              subjectId={taskId}
              kinds={AI_TASK_REQUESTS}
              roles={roles}
              members={assignees}
            >
              <AssignmentContextPanel taskId={taskId} />
            </AiRequestPanel>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h3">{t('comment.title')}</CardTitle>
            </CardHeader>
            <TaskComments
              projectId={project.id}
              taskId={taskId}
              roles={roles}
              viewer={user}
              members={assignees}
              onCommentAdded={refreshActivity}
            />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h3">{t('task.activityTitle')}</CardTitle>
            </CardHeader>
            <TaskActivityList
              activities={activities}
              personName={personName}
              sprintName={sprintName}
              hasMore={hasMoreActivities}
              isLoadingMore={isLoadingMoreActivities}
              onLoadMore={() => void loadMoreActivities()}
            />
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle as="h3">{t('task.planningTitle')}</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-5">
              <TaskStatusControl
                status={task.status}
                canChange={capabilities.canUpdate}
                onChange={handleStatusChange}
              />
              <TaskEstimateControl
                // Re-seeds the field when the estimate changes elsewhere.
                key={task.storyPoints ?? 'none'}
                storyPoints={task.storyPoints ?? null}
                canChange={capabilities.canUpdate}
                onChange={handleEstimate}
              />
              {capabilities.canUpdate ? (
                <SelectField
                  label={t('task.sprint')}
                  value={task.sprintId ?? NO_SPRINT}
                  onValueChange={(value) => void handleSprint(value)}
                  disabled={actions.isMoving}
                  options={[
                    { value: NO_SPRINT, label: t('task.noSprint') },
                    ...sprints.map((sprint) => ({
                      value: sprint.id,
                      label: sprint.name,
                    })),
                    // A sprint beyond the loaded list still needs a name, or
                    // the field would show nothing at all.
                    ...(task.sprintId && sprintName(task.sprintId) === null
                      ? [
                          {
                            value: task.sprintId,
                            label: t('task.unknownSprint'),
                          },
                        ]
                      : []),
                  ]}
                />
              ) : (
                <p className="flex items-center gap-2 text-sm">
                  <span className="text-text-subtle">{t('task.sprint')}</span>
                  <span className="font-medium">
                    {task.sprintId
                      ? (sprintName(task.sprintId) ?? t('task.unknownSprint'))
                      : t('task.noSprint')}
                  </span>
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h3">{t('task.peopleTitle')}</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-5">
              <TaskAssigneeControl
                assignee={task.assignee ?? null}
                candidates={assignees}
                canAssign={capabilities.canAssign}
                onAssign={handleAssign}
              />
              <p className="flex items-center gap-2 text-sm">
                <span className="text-text-subtle">{t('task.reporter')}</span>
                {task.reporter ? (
                  <AppLink
                    to={userPath(task.reporter.id)}
                    variant="subtle"
                    className="font-medium"
                  >
                    {task.reporter.name}
                  </AppLink>
                ) : (
                  <span className="font-medium">{t('task.noReporter')}</span>
                )}
              </p>
              <div className="flex flex-col gap-2">
                <h4 className="text-text-subtle text-sm">
                  {t('task.watchersTitle')}
                </h4>
                {task.watchers.length === 0 ? (
                  <EmptyState variant="icon" icon={<EyeOff />}>
                    {t('task.watchersEmpty')}
                  </EmptyState>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {task.watchers.map((watcher) => (
                      <li
                        key={watcher.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Avatar
                          size="xs"
                          name={watcher.name}
                          {...(watcher.avatarUrl
                            ? { src: watcher.avatarUrl }
                            : {})}
                        />
                        {watcher.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h3">{t('task.timeTitle')}</CardTitle>
            </CardHeader>
            <TaskTimeLog
              loggedSeconds={task.loggedSeconds}
              canLog={capabilities.canUpdate}
              isPending={actions.isLoggingTime}
              onLog={handleLogTime}
            />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h3">{t('task.labels')}</CardTitle>
            </CardHeader>
            <TaskLabels
              labels={task.labels}
              canChange={capabilities.canUpdate}
              isAdding={actions.isAddingLabel}
              onAdd={handleAddLabel}
              onRemove={(name) => {
                actions.removeTaskLabel(name).catch(showError);
              }}
            />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h3">{t('attachment.title')}</CardTitle>
            </CardHeader>
            <TaskAttachments
              taskId={taskId}
              roles={roles}
              viewerId={user?.id}
            />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={isConfirmingDelete}
        onOpenChange={setIsConfirmingDelete}
        title={t('task.deleteConfirmTitle', { title: task.title })}
        description={t('task.deleteConfirmBody')}
        confirmLabel={t('task.delete')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={handleDelete}
      />
    </section>
  );
}
