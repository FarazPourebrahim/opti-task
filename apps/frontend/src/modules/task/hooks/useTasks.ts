import { useApolloClient, useQuery } from '@apollo/client/react';
import { useCallback, useMemo, useState } from 'react';
import { DEFAULT_PAGE_SIZE } from '@contracts';
import type { SortDirection, TaskStatus } from '@contracts';
import {
  BOARD_COLUMN_FIELDS,
  BOARD_PAGE_SIZE,
  TASK_OPTIONS_PAGE_SIZE,
} from '@/modules/task/constants/task.constants';
import {
  ProjectBoardColumnQuery,
  ProjectBoardQuery,
  ProjectPlanningQuery,
  ProjectTaskOptionsQuery,
  ProjectTasksQuery,
  TaskQuery,
} from '@/modules/task/graphql/task.operations';
import { buildBoardColumns } from '@/modules/task/utils/task.utils';
import type {
  TaskActivityFragment,
  TaskCardFragment,
  TaskDetailFragment,
  TaskFilter,
  TaskSortField,
} from '@/shared/graphql/generated/graphql';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { useRealtimeEvent } from '@/shared/hooks/useRealtime';
import { ApiError } from '@/shared/lib/apiError';

export type TaskCardData = TaskCardFragment;
export type TaskDetailData = TaskDetailFragment;
export type TaskActivityData = TaskActivityFragment;

/**
 * The board: seven columns, each with its own total and its own next page.
 */
export function useProjectBoard(projectId: string) {
  const client = useApolloClient();
  const { data, loading, error, refetch } = useQuery(ProjectBoardQuery, {
    variables: { projectId, first: BOARD_PAGE_SIZE },
  });
  const [loadingMore, setLoadingMore] = useState<TaskStatus | null>(null);

  const project = data?.project;

  const columns = useMemo(
    () =>
      buildBoardColumns<TaskCardData>({
        BACKLOG: project?.[BOARD_COLUMN_FIELDS.BACKLOG],
        TODO: project?.[BOARD_COLUMN_FIELDS.TODO],
        IN_PROGRESS: project?.[BOARD_COLUMN_FIELDS.IN_PROGRESS],
        IN_REVIEW: project?.[BOARD_COLUMN_FIELDS.IN_REVIEW],
        TESTING: project?.[BOARD_COLUMN_FIELDS.TESTING],
        DONE: project?.[BOARD_COLUMN_FIELDS.DONE],
        BLOCKED: project?.[BOARD_COLUMN_FIELDS.BLOCKED],
      }),
    [project],
  );

  /*
   * Pages one column forward. The result lands in the same cached list the
   * board reads (they share a filter), so the board re-renders with the new
   * cards appended. The cursor goes back exactly as it came.
   */
  const loadMoreInColumn = useCallback(
    async (status: TaskStatus) => {
      const column = columns.find((candidate) => candidate.status === status);
      if (!column?.hasMore || !column.endCursor) return;

      setLoadingMore(status);
      try {
        await client.query({
          query: ProjectBoardColumnQuery,
          variables: {
            projectId,
            status,
            first: BOARD_PAGE_SIZE,
            after: column.endCursor,
          },
          fetchPolicy: 'network-only',
        });
      } finally {
        setLoadingMore(null);
      }
    },
    [client, columns, projectId],
  );

  return {
    columns,
    totalCount: columns.reduce((sum, column) => sum + column.totalCount, 0),
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
    loadingMore,
    loadMoreInColumn,
  };
}

export type TaskListQuery = {
  filter: TaskFilter;
  sortField: TaskSortField;
  sortDirection: SortDirection;
};

/**
 * A project's tasks as one filtered, sorted list.
 *
 * Every combination of filter and sort is its own cached list, so changing one
 * never mixes rows from two of them.
 */
export function useProjectTasks(projectId: string, query: TaskListQuery) {
  const { data, previousData, loading, error, refetch, fetchMore } = useQuery(
    ProjectTasksQuery,
    {
      variables: {
        projectId,
        first: DEFAULT_PAGE_SIZE,
        // Always sent, even when empty: see `ProjectTaskOptionsQuery`.
        filter: query.filter,
        sortField: query.sortField,
        sortDirection: query.sortDirection,
      },
    },
  );

  // While a newly chosen filter loads, the previous rows stay on screen
  // rather than the list blanking.
  const connection = (data ?? previousData)?.project.tasks;

  const fetchAfter = useCallback(
    (after: string) => fetchMore({ variables: { after } }),
    [fetchMore],
  );
  const { hasMore, isLoadingMore, loadMore } = useLoadMore(
    connection?.pageInfo,
    fetchAfter,
  );

  return {
    tasks: connection?.edges.map((edge) => edge.node) ?? [],
    totalCount: connection?.totalCount ?? 0,
    isLoading: loading && !connection,
    isRefreshing: loading && Boolean(connection),
    error: ApiError.is(error) ? error : null,
    refetch,
    hasMore,
    isLoadingMore,
    loadMore,
  };
}

export type PlanningOption = { id: string; name: string };

/**
 * The project's sprints and epics, for naming the ids a task carries and for
 * offering them in a picker.
 */
export function useProjectPlanning(projectId: string) {
  const { data, loading } = useQuery(ProjectPlanningQuery, {
    variables: { projectId, first: TASK_OPTIONS_PAGE_SIZE },
  });

  const sprints = useMemo<PlanningOption[]>(
    () => data?.project.sprints.edges.map((edge) => edge.node) ?? [],
    [data],
  );
  const epics = useMemo<PlanningOption[]>(
    () => data?.project.epics.edges.map((edge) => edge.node) ?? [],
    [data],
  );

  const sprintName = useCallback(
    (id: string | null | undefined) =>
      sprints.find((sprint) => sprint.id === id)?.name ?? null,
    [sprints],
  );
  const epicName = useCallback(
    (id: string | null | undefined) =>
      epics.find((epic) => epic.id === id)?.name ?? null,
    [epics],
  );

  return { sprints, epics, sprintName, epicName, isLoading: loading && !data };
}

/** Tasks in the project that another task could depend on. */
export function useTaskOptions(projectId: string, enabled: boolean) {
  const { data, loading } = useQuery(ProjectTaskOptionsQuery, {
    variables: { projectId, first: TASK_OPTIONS_PAGE_SIZE },
    skip: !enabled,
  });

  const options = useMemo(
    () => data?.project.tasks.edges.map((edge) => edge.node) ?? [],
    [data],
  );

  return { options, isLoading: loading && !data };
}

export function useTask(taskId: string) {
  const { data, loading, error, refetch, fetchMore } = useQuery(TaskQuery, {
    variables: { id: taskId, activitiesFirst: DEFAULT_PAGE_SIZE },
  });

  const task = data?.task ?? null;

  // Someone else changed this task: the fields arrive with the event, but the
  // entry it added to the audit trail does not, so the task is re-read.
  useRealtimeEvent('taskUpdated', (event) => {
    if (event.taskId === taskId) void refetch();
  });

  const activities = useMemo(
    () => task?.activities.edges.map((edge) => edge.node) ?? [],
    [task],
  );

  const fetchAfter = useCallback(
    (after: string) => fetchMore({ variables: { activitiesAfter: after } }),
    [fetchMore],
  );
  const { hasMore, isLoadingMore, loadMore } = useLoadMore(
    task?.activities.pageInfo,
    fetchAfter,
  );

  return {
    task,
    activities,
    activitiesTotal: task?.activities.totalCount ?? 0,
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
    hasMoreActivities: hasMore,
    isLoadingMoreActivities: isLoadingMore,
    loadMoreActivities: loadMore,
  };
}
