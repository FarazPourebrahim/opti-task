import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback } from 'react';
import {
  MyStatisticsQuery,
  ProjectAnalyticsQuery,
  RecomputeUserStatisticsMutation,
  UserAnalyticsQuery,
} from '@/modules/analytics/graphql/analytics.operations';
import type {
  MyStatisticsQuery as MyStatisticsQueryResult,
  ProjectAnalyticsQuery as ProjectAnalyticsQueryResult,
  UserAnalyticsQuery as UserAnalyticsQueryResult,
} from '@/shared/graphql/generated/graphql';
import { useRealtimeEvent } from '@/shared/hooks/useRealtime';
import { ApiError } from '@/shared/lib/apiError';

export type ProjectAnalyticsData =
  ProjectAnalyticsQueryResult['projectAnalytics'];
export type IndividualWorkloadRow =
  ProjectAnalyticsData['individualWorkloads'][number];
export type UserAnalyticsData = UserAnalyticsQueryResult['userAnalytics'];
export type SavedStatistics = MyStatisticsQueryResult['me']['statistics'];

export function useProjectAnalytics(projectId: string) {
  const { data, loading, error, refetch } = useQuery(ProjectAnalyticsQuery, {
    variables: { projectId },
    // The figures change with every task, on any other tab: what the cache
    // holds is shown at once and read again behind it.
    fetchPolicy: 'cache-and-network',
  });

  /*
   * Someone else's change is answered by reading the figures again. A failure
   * here is not shown: the figures on screen are simply as old as the last
   * successful read.
   */
  const refresh = useCallback(() => {
    refetch().catch(() => undefined);
  }, [refetch]);

  useRealtimeEvent('taskUpdated', (event) => {
    if (event.projectId === projectId) refresh();
  });
  useRealtimeEvent('sprintUpdated', (event) => {
    if (event.projectId === projectId) refresh();
  });

  return {
    analytics: data?.projectAnalytics ?? null,
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
  };
}

/**
 * One person's figures, worked out live. The server answers for the person
 * themselves and for administrators of an organisation they belong to; `skip`
 * holds the request back until it is wanted.
 */
export function useUserAnalytics(
  userId: string,
  { skip = false }: { skip?: boolean } = {},
) {
  const { data, loading, error, refetch } = useQuery(UserAnalyticsQuery, {
    variables: { userId },
    fetchPolicy: 'cache-and-network',
    skip,
  });

  return {
    analytics: data?.userAnalytics ?? null,
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
  };
}

/** The saved copy of the signed-in user's figures. */
export function useMyStatistics() {
  const { data, loading, error, refetch } = useQuery(MyStatisticsQuery);

  return {
    statistics: data?.me.statistics ?? null,
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
  };
}

/**
 * Saves the live figures as the stored copy. The mutation returns the `User`
 * with its statistics, keyed by id, so the saved column updates by itself.
 */
export function useRecomputeUserStatistics(userId: string) {
  const [recompute, { loading }] = useMutation(RecomputeUserStatisticsMutation);

  const recomputeStatistics = useCallback(async () => {
    await recompute({ variables: { userId } });
  }, [recompute, userId]);

  return { recomputeStatistics, isRecomputing: loading };
}
