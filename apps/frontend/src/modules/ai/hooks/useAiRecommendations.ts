import {
  useApolloClient,
  useFragment,
  useMutation,
  useQuery,
} from '@apollo/client/react';
import { useCallback, useMemo, useState } from 'react';
import type { ApolloCache } from '@apollo/client';
import { DEFAULT_PAGE_SIZE } from '@contracts';
import type { AiApprovalStatus, AiRecommendationType } from '@contracts';
import type { AiRequestKind } from '@/modules/ai/constants/ai.constants';
import {
  AiAppliedTaskQuery,
  AiRecommendationItemFragment,
  AiRecommendationQuery,
  ApproveRecommendationMutation,
  AssignmentContextQuery,
  OverrideRecommendationMutation,
  ProjectAiRecommendationsQuery,
  RejectRecommendationMutation,
  RequestAssignmentRecommendationMutation,
  RequestProgressTrackingMutation,
  RequestSprintHealthAnalysisMutation,
  RequestStoryPointEstimateMutation,
} from '@/modules/ai/graphql/ai.operations';
import type { OverrideInput } from '@/modules/ai/schemas/ai.schema';
import { changesTask, readSuggestion } from '@/modules/ai/utils/ai.utils';
import type {
  AiRecommendationItemFragment as AiRecommendationItemData,
  AssignmentContextQuery as AssignmentContextResult,
} from '@/shared/graphql/generated/graphql';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { ApiError } from '@/shared/lib/apiError';
import { announceRealtimeEvent } from '@/shared/services/realtime.events';

export type AiRecommendationData = AiRecommendationItemData;
export type AssignmentCandidateRow =
  AssignmentContextResult['assignmentContext']['candidates'][number];

export type AiRecommendationFilter = {
  /** Null for any. */
  type: AiRecommendationType | null;
  approvalStatus: AiApprovalStatus | null;
};

/*
 * A recommendation is cached once per combination of filters. Which lists a
 * new one, or a decided one, now belongs in is the server's to say — so they
 * are all dropped and the one on screen is read again.
 */
function forgetRecommendationLists(cache: ApolloCache, projectId: string) {
  const cacheId = cache.identify({ __typename: 'Project', id: projectId });
  if (cacheId) cache.evict({ id: cacheId, fieldName: 'aiRecommendations' });
}

/** A project's recommendations, newest first. */
export function useProjectAiRecommendations(
  projectId: string,
  filter: AiRecommendationFilter,
) {
  const { data, previousData, loading, error, refetch, fetchMore } = useQuery(
    ProjectAiRecommendationsQuery,
    {
      variables: {
        projectId,
        first: DEFAULT_PAGE_SIZE,
        // Always sent, null for "any", so each choice is its own cached list.
        type: filter.type,
        approvalStatus: filter.approvalStatus,
      },
    },
  );

  // While another filter loads, or the list is re-read after a decision, the
  // rows already on screen stay there.
  const connection = (data ?? previousData)?.project.aiRecommendations;

  const fetchAfter = useCallback(
    (after: string) => fetchMore({ variables: { after } }),
    [fetchMore],
  );
  const { hasMore, isLoadingMore, loadMore } = useLoadMore(
    connection?.pageInfo,
    fetchAfter,
  );

  const recommendations = useMemo(
    () => connection?.edges.map((edge) => edge.node) ?? [],
    [connection],
  );

  return {
    recommendations,
    totalCount: connection?.totalCount ?? 0,
    isLoading: loading && !connection,
    error: ApiError.is(error) ? error : null,
    refetch,
    hasMore,
    isLoadingMore,
    loadMore,
  };
}

/**
 * One recommendation, as the cache holds it now.
 *
 * A panel that has just requested a suggestion shows it from here rather than
 * from the mutation's answer, so a decision made on it — by the viewer, or by
 * someone else and heard over the socket — is on screen the moment it lands.
 */
export function useAiRecommendation(
  recommendationId: string,
): AiRecommendationData | null {
  const result = useFragment({
    fragment: AiRecommendationItemFragment,
    from: { __typename: 'AiRecommendation', id: recommendationId },
  });

  return result.complete ? result.data : null;
}

/**
 * Asks the AI service for a suggestion.
 *
 * A request stores the suggestion and changes nothing else. It can take as
 * long as the provider's timeout, twice over when the first attempt fails, so
 * `pendingKind` is there for the whole wait.
 */
export function useAiRequests(projectId: string) {
  const update = useCallback(
    (cache: ApolloCache) => forgetRecommendationLists(cache, projectId),
    [projectId],
  );
  const [estimate] = useMutation(RequestStoryPointEstimateMutation, { update });
  const [assignment] = useMutation(RequestAssignmentRecommendationMutation, {
    update,
  });
  const [health] = useMutation(RequestSprintHealthAnalysisMutation, { update });
  const [progress] = useMutation(RequestProgressTrackingMutation, { update });
  const [pendingKind, setPendingKind] = useState<AiRequestKind | null>(null);

  /** Resolves with the new recommendation's id. */
  const request = useCallback(
    async (kind: AiRequestKind, subjectId: string): Promise<string | null> => {
      setPendingKind(kind);
      try {
        switch (kind) {
          case 'storyPoints': {
            const result = await estimate({ variables: { taskId: subjectId } });
            return result.data?.requestStoryPointEstimate.id ?? null;
          }
          case 'assignment': {
            const result = await assignment({
              variables: { taskId: subjectId },
            });
            return result.data?.requestAssignmentRecommendation.id ?? null;
          }
          case 'sprintHealth': {
            const result = await health({ variables: { sprintId: subjectId } });
            return result.data?.requestSprintHealthAnalysis.id ?? null;
          }
          case 'progress': {
            const result = await progress({
              variables: { sprintId: subjectId },
            });
            return result.data?.requestProgressTracking.id ?? null;
          }
        }
      } finally {
        setPendingKind(null);
      }
    },
    [assignment, estimate, health, progress],
  );

  return { request, pendingKind };
}

type Decidable = Pick<
  AiRecommendationData,
  'id' | 'type' | 'metadata' | 'taskId' | 'projectId'
>;

/**
 * Decides on a suggestion: approve it, reject it, or override it with a value
 * of one's own.
 *
 * Each returns the recommendation by id, so every screen showing it follows.
 * Approving or overriding an estimate or an assignment also changes its task,
 * which the mutation does not return and no event announces — so the task's
 * two fields are read again, and the change is passed on inside the app for
 * the screens that show the task's audit trail and a sprint's figures.
 *
 * A decision that arrives after someone else's is a `CONFLICT`: the
 * recommendation is read again so the screen shows how it now stands, and the
 * failure is rethrown for the caller to explain.
 */
export function useAiDecisions(projectId: string) {
  const client = useApolloClient();
  const update = useCallback(
    (cache: ApolloCache) => forgetRecommendationLists(cache, projectId),
    [projectId],
  );
  const [approve, { loading: isApproving }] = useMutation(
    ApproveRecommendationMutation,
    { update },
  );
  const [reject, { loading: isRejecting }] = useMutation(
    RejectRecommendationMutation,
    { update },
  );
  const [override, { loading: isOverriding }] = useMutation(
    OverrideRecommendationMutation,
    { update },
  );

  const followTask = useCallback(
    async (recommendation: Decidable) => {
      const { taskId } = recommendation;
      if (!taskId || !changesTask(readSuggestion(recommendation))) return;

      // A failure here is not the decision's: that has been made and saved.
      await client
        .query({
          query: AiAppliedTaskQuery,
          variables: { id: taskId },
          fetchPolicy: 'network-only',
        })
        .catch(() => undefined);
      announceRealtimeEvent('taskUpdated', { taskId, projectId });
    },
    [client, projectId],
  );

  const settle = useCallback(
    async (recommendation: Decidable, decide: () => Promise<unknown>) => {
      try {
        await decide();
      } catch (error) {
        if (ApiError.is(error) && error.kind === 'conflict') {
          await client
            .query({
              query: AiRecommendationQuery,
              variables: { id: recommendation.id },
              fetchPolicy: 'network-only',
            })
            .catch(() => undefined);
        }
        throw error;
      }
    },
    [client],
  );

  const approveRecommendation = useCallback(
    async (recommendation: Decidable) => {
      await settle(recommendation, () =>
        approve({ variables: { id: recommendation.id } }),
      );
      await followTask(recommendation);
    },
    [approve, followTask, settle],
  );

  /** Rejecting records the decision and changes nothing else. */
  const rejectRecommendation = useCallback(
    async (recommendation: Decidable) => {
      await settle(recommendation, () =>
        reject({ variables: { id: recommendation.id } }),
      );
    },
    [reject, settle],
  );

  const overrideRecommendation = useCallback(
    async (recommendation: Decidable, input: OverrideInput) => {
      await settle(recommendation, () =>
        override({ variables: { id: recommendation.id, input } }),
      );
      await followTask(recommendation);
    },
    [followTask, override, settle],
  );

  return {
    approveRecommendation,
    rejectRecommendation,
    overrideRecommendation,
    isDeciding: isApproving || isRejecting || isOverriding,
  };
}

/** Who an assignment suggestion for this task chooses among. */
export function useAssignmentContext(taskId: string, enabled: boolean) {
  const { data, loading, error, refetch } = useQuery(AssignmentContextQuery, {
    variables: { taskId },
    skip: !enabled,
  });

  return {
    candidates: data?.assignmentContext.candidates ?? [],
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
  };
}
