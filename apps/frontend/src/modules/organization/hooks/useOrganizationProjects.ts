import { useQuery } from '@apollo/client/react';
import { useCallback } from 'react';
import { DEFAULT_PAGE_SIZE } from '@contracts';
import type { ProjectState } from '@contracts';
import { OrganizationProjectsQuery } from '@/modules/organization/graphql/organization.operations';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { ApiError } from '@/shared/lib/apiError';

/**
 * An organisation's projects, optionally narrowed to one status.
 *
 * Each status is its own cached list (`keyArgs: ['status']`), so switching the
 * filter never mixes rows from two of them.
 */
export function useOrganizationProjects(
  organizationId: string,
  status: ProjectState | null,
) {
  const { data, previousData, loading, error, refetch, fetchMore } = useQuery(
    OrganizationProjectsQuery,
    { variables: { id: organizationId, status, first: DEFAULT_PAGE_SIZE } },
  );

  // While a newly chosen filter loads, the previous rows stay on screen
  // rather than the list blanking.
  const connection = (data ?? previousData)?.organization.projects;

  const fetchAfter = useCallback(
    (after: string) => fetchMore({ variables: { after } }),
    [fetchMore],
  );
  const { hasMore, isLoadingMore, loadMore } = useLoadMore(
    connection?.pageInfo,
    fetchAfter,
  );

  return {
    projects: connection?.edges.map((edge) => edge.node) ?? [],
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
