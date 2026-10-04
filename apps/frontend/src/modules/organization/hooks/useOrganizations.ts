import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback } from 'react';
import { DEFAULT_PAGE_SIZE } from '@contracts';
import {
  CreateOrganizationMutation,
  MyOrganizationsQuery,
} from '@/modules/organization/graphql/organization.operations';
import type { OrganizationInput } from '@/modules/organization/schemas/organization.schema';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { ApiError } from '@/shared/lib/apiError';

/** The organisations the signed-in user belongs to, one page at a time. */
export function useOrganizations() {
  const { data, loading, error, refetch, fetchMore } = useQuery(
    MyOrganizationsQuery,
    { variables: { first: DEFAULT_PAGE_SIZE } },
  );

  const connection = data?.myOrganizations;

  const fetchAfter = useCallback(
    (after: string) => fetchMore({ variables: { after } }),
    [fetchMore],
  );
  const { hasMore, isLoadingMore, loadMore } = useLoadMore(
    connection?.pageInfo,
    fetchAfter,
  );

  return {
    organizations: connection?.edges.map((edge) => edge.node) ?? [],
    totalCount: connection?.totalCount ?? 0,
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
    hasMore,
    isLoadingMore,
    loadMore,
  };
}

export function useCreateOrganization() {
  const [create, { loading }] = useMutation(CreateOrganizationMutation, {
    // The list is cursor-ordered by the server; where a new row belongs in it
    // is the server's call, so the list is re-read rather than patched.
    refetchQueries: [MyOrganizationsQuery],
    awaitRefetchQueries: true,
  });

  const createOrganization = useCallback(
    async (input: OrganizationInput) => {
      const result = await create({ variables: { input } });
      return result.data?.createOrganization ?? null;
    },
    [create],
  );

  return { createOrganization, isCreating: loading };
}
