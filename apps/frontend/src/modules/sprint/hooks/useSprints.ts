import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { useCallback, useMemo } from 'react';
import { DEFAULT_PAGE_SIZE } from '@contracts';
import type { SprintState } from '@contracts';
import {
  SPRINT_TASKS_PAGE_SIZE,
  SPRINT_TASK_CANDIDATES_PAGE_SIZE,
} from '@/modules/sprint/constants/sprint.constants';
import {
  AddTaskToSprintMutation,
  ChangeSprintStateMutation,
  CreateSprintMutation,
  DeleteSprintMutation,
  ProjectSprintsQuery,
  RemoveTaskFromSprintMutation,
  SprintFiguresQuery,
  SprintQuery,
  SprintTaskCandidatesQuery,
  UpdateSprintMutation,
} from '@/modules/sprint/graphql/sprint.operations';
import type { SprintInput } from '@/modules/sprint/schemas/sprint.schema';
import type {
  SprintQuery as SprintQueryResult,
  SprintSummaryFragment,
  SprintTaskFragment,
} from '@/shared/graphql/generated/graphql';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { useRealtimeEvent } from '@/shared/hooks/useRealtime';
import { ApiError } from '@/shared/lib/apiError';
import { removeFromConnection } from '@/shared/utils/cache.utils';

export type SprintSummary = SprintSummaryFragment;
export type SprintDetail = SprintQueryResult['sprint'];
export type SprintMetricsData = SprintDetail['metrics'];
export type SprintWorkloadRow =
  SprintMetricsData['workloadDistribution'][number];
export type SprintTaskRow = SprintTaskFragment;

export function useProjectSprints(projectId: string) {
  const { data, loading, error, refetch, fetchMore } = useQuery(
    ProjectSprintsQuery,
    { variables: { projectId, first: DEFAULT_PAGE_SIZE } },
  );

  const connection = data?.project.sprints;

  const fetchAfter = useCallback(
    (after: string) => fetchMore({ variables: { after } }),
    [fetchMore],
  );
  const { hasMore, isLoadingMore, loadMore } = useLoadMore(
    connection?.pageInfo,
    fetchAfter,
  );

  const sprints = useMemo(
    () => connection?.edges.map((edge) => edge.node) ?? [],
    [connection],
  );

  return {
    sprints,
    totalCount: connection?.totalCount ?? 0,
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
    hasMore,
    isLoadingMore,
    loadMore,
  };
}

export function useCreateSprint(projectId: string) {
  const [create, { loading }] = useMutation(CreateSprintMutation, {
    update: (cache) => {
      // Where a new sprint sorts in the list is the server's call, so the
      // list is re-read rather than guessed at.
      const cacheId = cache.identify({ __typename: 'Project', id: projectId });
      if (cacheId) cache.evict({ id: cacheId, fieldName: 'sprints' });
    },
  });

  const createSprint = useCallback(
    async (input: SprintInput) => {
      const result = await create({ variables: { projectId, input } });
      return result.data?.createSprint ?? null;
    },
    [create, projectId],
  );

  return { createSprint, isCreating: loading };
}

export function useSprint(sprintId: string) {
  const client = useApolloClient();
  const { data, loading, error, refetch, fetchMore } = useQuery(SprintQuery, {
    variables: { id: sprintId, tasksFirst: SPRINT_TASKS_PAGE_SIZE },
  });

  const sprint = data?.sprint ?? null;
  const projectId = sprint?.projectId;

  /*
   * The figures are the server's to work out, so a change made elsewhere is
   * answered by reading them again. Them alone, which leaves the pages of
   * tasks already on screen where they are. A failure here is not shown: the
   * figures on screen are simply as old as the last successful read.
   */
  const refreshFigures = useCallback(() => {
    client
      .query({
        query: SprintFiguresQuery,
        variables: { id: sprintId },
        fetchPolicy: 'network-only',
      })
      .catch(() => undefined);
  }, [client, sprintId]);

  // Any task in the project may be in this sprint, or have just left it.
  useRealtimeEvent('taskUpdated', (event) => {
    if (event.projectId === projectId) refreshFigures();
  });
  useRealtimeEvent('sprintUpdated', (event) => {
    if (event.sprintId === sprintId) refreshFigures();
  });

  const tasks = useMemo(
    () => sprint?.tasks.edges.map((edge) => edge.node) ?? [],
    [sprint],
  );

  const fetchAfter = useCallback(
    (after: string) => fetchMore({ variables: { tasksAfter: after } }),
    [fetchMore],
  );
  const { hasMore, isLoadingMore, loadMore } = useLoadMore(
    sprint?.tasks.pageInfo,
    fetchAfter,
  );

  return {
    sprint,
    tasks,
    tasksTotal: sprint?.tasks.totalCount ?? 0,
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
    hasMoreTasks: hasMore,
    isLoadingMoreTasks: isLoadingMore,
    loadMoreTasks: loadMore,
  };
}

/** Tasks in the project that are not in this sprint, for the add picker. */
export function useSprintTaskCandidates(
  projectId: string,
  sprintId: string,
  enabled: boolean,
) {
  const { data, loading } = useQuery(SprintTaskCandidatesQuery, {
    variables: { projectId, first: SPRINT_TASK_CANDIDATES_PAGE_SIZE },
    skip: !enabled,
  });

  const candidates = useMemo(
    () =>
      data?.project.tasks.edges
        .map((edge) => edge.node)
        .filter((task) => task.sprintId !== sprintId) ?? [],
    [data, sprintId],
  );

  return { candidates, isLoading: loading && !data };
}

export function useSprintActions(sprintId: string) {
  // Each returns the sprint by id: the cache updates every screen showing it.
  const [update, { loading: isUpdating }] = useMutation(UpdateSprintMutation);
  const [changeState] = useMutation(ChangeSprintStateMutation);
  const [remove] = useMutation(DeleteSprintMutation);

  /*
   * Moving a task in or out changes the sprint's task list, its metrics and
   * its burndown, all computed by the server — so the sprint is re-read. The
   * task's own `sprintId` is written straight to the cache, so every other
   * screen showing that task follows without a request.
   */
  const refetchSprint = {
    refetchQueries: [SprintQuery],
    awaitRefetchQueries: true,
  };
  const [add, { loading: isAddingTask }] = useMutation(
    AddTaskToSprintMutation,
    refetchSprint,
  );
  const [removeTask] = useMutation(RemoveTaskFromSprintMutation, refetchSprint);

  const updateSprint = useCallback(
    async (input: SprintInput) => {
      await update({ variables: { id: sprintId, input } });
    },
    [update, sprintId],
  );

  // Not optimistic: starting or ending a sprint is a decision, and a refusal
  // should not flash the new state first.
  const changeSprintState = useCallback(
    async (state: SprintState) => {
      await changeState({ variables: { id: sprintId, state } });
    },
    [changeState, sprintId],
  );

  const deleteSprint = useCallback(
    async (projectId: string) => {
      await remove({
        variables: { id: sprintId },
        // The mutation returns only a boolean, so the sprint is taken out of
        // the cached list by hand.
        update: (cache) =>
          removeFromConnection(cache, {
            owner: { __typename: 'Project', id: projectId },
            connectionField: 'sprints',
            nodeId: sprintId,
          }),
      });
    },
    [remove, sprintId],
  );

  const addTask = useCallback(
    async (taskId: string) => {
      await add({
        variables: { sprintId, taskId },
        update: (cache) => {
          const cacheId = cache.identify({ __typename: 'Task', id: taskId });
          if (!cacheId) return;
          cache.modify({ id: cacheId, fields: { sprintId: () => sprintId } });
        },
      });
    },
    [add, sprintId],
  );

  const removeTaskFromSprint = useCallback(
    async (taskId: string) => {
      await removeTask({
        variables: { sprintId, taskId },
        update: (cache) => {
          const cacheId = cache.identify({ __typename: 'Task', id: taskId });
          if (!cacheId) return;
          cache.modify({ id: cacheId, fields: { sprintId: () => null } });
        },
      });
    },
    [removeTask, sprintId],
  );

  return {
    updateSprint,
    isUpdating,
    changeSprintState,
    deleteSprint,
    addTask,
    isAddingTask,
    removeTaskFromSprint,
  };
}
