import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { useCallback, useMemo } from 'react';
import { DEFAULT_PAGE_SIZE } from '@contracts';
import { EPIC_TASKS_PAGE_SIZE } from '@/modules/epic/constants/epic.constants';
import {
  CreateEpicMutation,
  CreateMilestoneMutation,
  DeleteEpicMutation,
  DeleteMilestoneMutation,
  EpicProgressQuery,
  EpicQuery,
  ProjectEpicsQuery,
  RefreshEpicProgressMutation,
  UpdateEpicMutation,
} from '@/modules/epic/graphql/epic.operations';
import type {
  EpicInput,
  MilestoneInput,
} from '@/modules/epic/schemas/epic.schema';
import type {
  EpicQuery as EpicQueryResult,
  EpicSummaryFragment,
} from '@/shared/graphql/generated/graphql';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { useRealtimeEvent } from '@/shared/hooks/useRealtime';
import { ApiError } from '@/shared/lib/apiError';
import { removeFromConnection } from '@/shared/utils/cache.utils';

export type EpicSummary = EpicSummaryFragment;
export type EpicDetail = EpicQueryResult['epic'];
export type MilestoneRow = EpicDetail['milestones'][number];
export type EpicTaskRow = EpicDetail['tasks']['edges'][number]['node'];

export function useProjectEpics(projectId: string) {
  const { data, loading, error, refetch, fetchMore } = useQuery(
    ProjectEpicsQuery,
    { variables: { projectId, first: DEFAULT_PAGE_SIZE } },
  );

  const connection = data?.project.epics;

  const fetchAfter = useCallback(
    (after: string) => fetchMore({ variables: { after } }),
    [fetchMore],
  );
  const { hasMore, isLoadingMore, loadMore } = useLoadMore(
    connection?.pageInfo,
    fetchAfter,
  );

  const epics = useMemo(
    () => connection?.edges.map((edge) => edge.node) ?? [],
    [connection],
  );

  return {
    epics,
    totalCount: connection?.totalCount ?? 0,
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
    hasMore,
    isLoadingMore,
    loadMore,
  };
}

export function useCreateEpic(projectId: string) {
  const [create, { loading }] = useMutation(CreateEpicMutation, {
    update: (cache) => {
      // Where a new epic sorts in the list is the server's call, so the list
      // is re-read rather than guessed at.
      const cacheId = cache.identify({ __typename: 'Project', id: projectId });
      if (cacheId) cache.evict({ id: cacheId, fieldName: 'epics' });
    },
  });

  const createEpic = useCallback(
    async (input: EpicInput) => {
      const result = await create({ variables: { projectId, input } });
      return result.data?.createEpic ?? null;
    },
    [create, projectId],
  );

  return { createEpic, isCreating: loading };
}

export function useEpic(epicId: string) {
  const client = useApolloClient();
  const { data, loading, error, refetch, fetchMore } = useQuery(EpicQuery, {
    variables: { id: epicId, tasksFirst: EPIC_TASKS_PAGE_SIZE },
  });

  const epic = data?.epic ?? null;
  const projectId = epic?.projectId;

  /*
   * Progress is worked out by the server from the epic's tasks, so when a
   * task in the project changes it is read again. Progress alone, which
   * leaves the task list on screen where it is.
   */
  useRealtimeEvent('taskUpdated', (event) => {
    if (event.projectId !== projectId) return;

    client
      .query({
        query: EpicProgressQuery,
        variables: { id: epicId },
        fetchPolicy: 'network-only',
      })
      .catch(() => undefined);
  });

  const tasks = useMemo(
    () => epic?.tasks.edges.map((edge) => edge.node) ?? [],
    [epic],
  );

  const fetchAfter = useCallback(
    (after: string) => fetchMore({ variables: { tasksAfter: after } }),
    [fetchMore],
  );
  const { hasMore, isLoadingMore, loadMore } = useLoadMore(
    epic?.tasks.pageInfo,
    fetchAfter,
  );

  return {
    epic,
    tasks,
    tasksTotal: epic?.tasks.totalCount ?? 0,
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
    hasMoreTasks: hasMore,
    isLoadingMoreTasks: isLoadingMore,
    loadMoreTasks: loadMore,
  };
}

export function useEpicActions(epicId: string) {
  // Both return the epic by id: the cache updates every screen showing it.
  const [update, { loading: isUpdating }] = useMutation(UpdateEpicMutation);
  const [refresh, { loading: isRefreshing }] = useMutation(
    RefreshEpicProgressMutation,
  );
  const [remove] = useMutation(DeleteEpicMutation);

  /*
   * An epic lists its milestones as a plain array, with no cursor to append
   * at, so adding or deleting one re-reads the epic.
   */
  const refetchEpic = {
    refetchQueries: [EpicQuery],
    awaitRefetchQueries: true,
  };
  const [addMilestone, { loading: isCreatingMilestone }] = useMutation(
    CreateMilestoneMutation,
    refetchEpic,
  );
  const [removeMilestone] = useMutation(DeleteMilestoneMutation, refetchEpic);

  const updateEpic = useCallback(
    async (input: EpicInput) => {
      await update({ variables: { id: epicId, input } });
    },
    [update, epicId],
  );

  const refreshProgress = useCallback(async () => {
    const result = await refresh({ variables: { id: epicId } });
    return result.data?.refreshEpicProgress ?? null;
  }, [refresh, epicId]);

  const deleteEpic = useCallback(
    async (projectId: string) => {
      await remove({
        variables: { id: epicId },
        // The mutation returns only a boolean, so the epic is taken out of
        // the cached list by hand.
        update: (cache) =>
          removeFromConnection(cache, {
            owner: { __typename: 'Project', id: projectId },
            connectionField: 'epics',
            nodeId: epicId,
          }),
      });
    },
    [remove, epicId],
  );

  const createMilestone = useCallback(
    async (projectId: string, input: MilestoneInput) => {
      // Always tied to this epic: a milestone with no epic cannot be listed
      // by any query, so one made here would vanish.
      await addMilestone({
        variables: { projectId, input: { ...input, epicId } },
      });
    },
    [addMilestone, epicId],
  );

  const deleteMilestone = useCallback(
    async (milestoneId: string) => {
      await removeMilestone({ variables: { id: milestoneId } });
    },
    [removeMilestone],
  );

  return {
    updateEpic,
    isUpdating,
    refreshProgress,
    isRefreshing,
    deleteEpic,
    createMilestone,
    isCreatingMilestone,
    deleteMilestone,
  };
}
