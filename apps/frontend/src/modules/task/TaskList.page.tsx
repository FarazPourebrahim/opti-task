import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@averoui/react';
import { ListTodo, Plus, SearchX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectContext } from '@/modules/project/hooks/useProjectContext';
import { CreateTaskDialog } from '@/modules/task/components/CreateTaskDialog';
import {
  ANY,
  DEFAULT_TASK_FILTERS,
  TaskFilters,
} from '@/modules/task/components/TaskFilters';
import type { TaskFilterValues } from '@/modules/task/components/TaskFilters';
import {
  TASK_PRIORITY_TONES,
  TASK_STATUS_TONES,
} from '@/modules/task/constants/task.constants';
import {
  useProjectPlanning,
  useProjectTasks,
} from '@/modules/task/hooks/useTasks';
import {
  AppLink,
  ErrorState,
  LoadMore,
  PageSkeleton,
} from '@/shared/components';
import type { TaskFilter } from '@/shared/graphql/generated/graphql';
import { can } from '@/shared/lib/capabilities';
import { taskPath } from '@/shared/routes/route.constants';
import { formatCalendarDate } from '@/shared/utils/date.utils';

/** Only the filters actually chosen are sent; "any" is the absence of one. */
function toTaskFilter(values: TaskFilterValues): TaskFilter {
  return {
    ...(values.status !== ANY ? { status: values.status } : {}),
    ...(values.priority !== ANY ? { priority: values.priority } : {}),
    ...(values.assigneeId !== ANY ? { assigneeId: values.assigneeId } : {}),
    ...(values.sprintId !== ANY ? { sprintId: values.sprintId } : {}),
    ...(values.epicId !== ANY ? { epicId: values.epicId } : {}),
    ...(values.labelId !== ANY ? { labelId: values.labelId } : {}),
  };
}

/** The project's tasks as a table, filtered and sorted by the server. */
export function TaskListPage() {
  const { t, i18n } = useTranslation();
  const { project, roles, members } = useProjectContext();
  const [values, setValues] = useState(DEFAULT_TASK_FILTERS);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  // The API has no list of a project's labels; these are the ones met so far.
  const [seenLabels, setSeenLabels] = useState<Record<string, string>>({});

  const filter = useMemo(() => toTaskFilter(values), [values]);
  const isFiltered = Object.keys(filter).length > 0;

  const {
    tasks,
    totalCount,
    isLoading,
    isRefreshing,
    error,
    refetch,
    hasMore,
    isLoadingMore,
    loadMore,
  } = useProjectTasks(project.id, {
    filter,
    sortField: values.sortField,
    sortDirection: values.sortDirection,
  });
  const { sprints, epics, sprintName, epicName } = useProjectPlanning(
    project.id,
  );

  useEffect(() => {
    setSeenLabels((current) => {
      const fresh = tasks
        .flatMap((task) => task.labels)
        .filter((label) => current[label.id] === undefined);
      if (fresh.length === 0) return current;

      return {
        ...current,
        ...Object.fromEntries(fresh.map((label) => [label.id, label.name])),
      };
    });
  }, [tasks]);

  const assignees = useMemo(
    () =>
      members.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
      })),
    [members],
  );
  const labels = useMemo(
    () => Object.entries(seenLabels).map(([id, name]) => ({ id, name })),
    [seenLabels],
  );

  const createButton = can(roles, 'task:create') ? (
    <Button onClick={() => setIsCreateOpen(true)}>
      <Plus aria-hidden className="size-4" />
      {t('task.new')}
    </Button>
  ) : undefined;

  return (
    <section className="flex flex-col gap-4">
      {createButton ? (
        <div className="flex justify-end">{createButton}</div>
      ) : null}

      <TaskFilters
        values={values}
        onChange={setValues}
        assignees={assignees}
        sprints={sprints}
        epics={epics}
        labels={labels}
        isFiltered={isFiltered}
      />

      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState
          title={t('task.listLoadFailed')}
          description={t(error.messageKey as never)}
          requestId={error.requestId}
          onRetry={() => void refetch()}
        />
      ) : tasks.length === 0 ? (
        <Card>
          {/* Two different absences: nothing here at all, or nothing in this
              filter. The second is not a reason to create a task. */}
          {isFiltered ? (
            <EmptyState variant="circle" icon={<SearchX />}>
              {t('task.list.emptyFiltered')}
            </EmptyState>
          ) : (
            <EmptyState variant="circle" icon={<ListTodo />}>
              {t('task.list.empty')}
            </EmptyState>
          )}
        </Card>
      ) : (
        <>
          {/* Scrolls sideways on its own, so the page body never does. */}
          <div className="overflow-x-auto">
            <Table aria-busy={isRefreshing}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('task.list.columns.task')}</TableHead>
                  <TableHead>{t('task.list.columns.status')}</TableHead>
                  <TableHead>{t('task.list.columns.priority')}</TableHead>
                  <TableHead>{t('task.list.columns.assignee')}</TableHead>
                  <TableHead>{t('task.list.columns.sprint')}</TableHead>
                  <TableHead>{t('task.list.columns.epic')}</TableHead>
                  <TableHead>{t('task.list.columns.points')}</TableHead>
                  <TableHead>{t('task.list.columns.due')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <AppLink
                        to={taskPath(project.id, task.id)}
                        variant="subtle"
                        className="block font-medium"
                      >
                        {task.title}
                      </AppLink>
                      {task.labels.length > 0 ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {task.labels.map((label) => (
                            <Chip key={label.id} variant="mini">
                              {label.name}
                            </Chip>
                          ))}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge tone={TASK_STATUS_TONES[task.status]}>
                        {t(`enums.taskStatus.${task.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge tone={TASK_PRIORITY_TONES[task.priority]}>
                        {t(`enums.taskPriority.${task.priority}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.assignee ? (
                        <span className="flex items-center gap-2">
                          <Avatar
                            size="xs"
                            name={task.assignee.name}
                            {...(task.assignee.avatarUrl
                              ? { src: task.assignee.avatarUrl }
                              : {})}
                          />
                          <span className="truncate">{task.assignee.name}</span>
                        </span>
                      ) : (
                        <span className="text-text-subtle">
                          {t('task.unassigned')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {/* The API gives an id; the name comes from the
                          project's own list. */}
                      {task.sprintId
                        ? (sprintName(task.sprintId) ?? t('task.unknownSprint'))
                        : t('task.noSprint')}
                    </TableCell>
                    <TableCell>
                      {task.epicId
                        ? (epicName(task.epicId) ?? t('task.unknownEpic'))
                        : t('task.noEpic')}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {task.storyPoints ?? t('task.unestimated')}
                    </TableCell>
                    <TableCell>
                      {formatCalendarDate(task.dueDate, i18n.language) ||
                        t('task.noDueDate')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <LoadMore
            shown={tasks.length}
            total={totalCount}
            hasMore={hasMore}
            isLoading={isLoadingMore}
            onLoadMore={() => void loadMore()}
          />
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
