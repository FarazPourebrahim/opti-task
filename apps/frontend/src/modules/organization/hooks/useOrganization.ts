import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { useCallback, useMemo } from 'react';
import type { Reference } from '@apollo/client';
import { DEFAULT_PAGE_SIZE } from '@contracts';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import {
  DeleteOrganizationMutation,
  OrganizationQuery,
  RemoveMemberMutation,
  UpdateMemberRoleMutation,
  UpdateOrganizationMutation,
} from '@/modules/organization/graphql/organization.operations';
import type {
  AssignableOrgRole,
  OrganizationInput,
} from '@/modules/organization/schemas/organization.schema';
import { resolveOrganizationRoles } from '@/modules/organization/utils/organization.utils';
import type { OrganizationQuery as OrganizationQueryResult } from '@/shared/graphql/generated/graphql';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { ApiError } from '@/shared/lib/apiError';

export type OrganizationDetail = OrganizationQueryResult['organization'];
export type OrganizationMemberRow =
  OrganizationDetail['members']['edges'][number]['node'];

/**
 * One organisation with its member list, plus the viewer's roles on it.
 *
 * Members ride along with the organisation because the viewer's role — which
 * decides what every tab may offer — can only be read from that list.
 */
export function useOrganization(organizationId: string) {
  const { user } = useAuth();
  const { data, loading, error, refetch, fetchMore } = useQuery(
    OrganizationQuery,
    { variables: { id: organizationId, first: DEFAULT_PAGE_SIZE } },
  );

  const organization = data?.organization ?? null;

  const members = useMemo(
    () => organization?.members.edges.map((edge) => edge.node) ?? [],
    [organization],
  );

  const roles = useMemo(
    () =>
      organization
        ? resolveOrganizationRoles(user?.id, organization.owner.id, members)
        : [],
    [user?.id, organization, members],
  );

  const fetchAfter = useCallback(
    (after: string) => fetchMore({ variables: { after } }),
    [fetchMore],
  );
  const { hasMore, isLoadingMore, loadMore } = useLoadMore(
    organization?.members.pageInfo,
    fetchAfter,
  );

  return {
    organization,
    members,
    membersTotal: organization?.members.totalCount ?? 0,
    roles,
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
    hasMoreMembers: hasMore,
    isLoadingMoreMembers: isLoadingMore,
    loadMoreMembers: loadMore,
  };
}

export function useUpdateOrganization(organizationId: string) {
  // The mutation returns the organisation by id, so the normalized cache
  // updates every screen showing it.
  const [update, { loading }] = useMutation(UpdateOrganizationMutation);

  const updateOrganization = useCallback(
    async (input: OrganizationInput) => {
      await update({ variables: { id: organizationId, input } });
    },
    [update, organizationId],
  );

  return { updateOrganization, isUpdating: loading };
}

export function useDeleteOrganization(organizationId: string) {
  const client = useApolloClient();
  const [remove, { loading }] = useMutation(DeleteOrganizationMutation);

  const deleteOrganization = useCallback(async () => {
    await remove({ variables: { id: organizationId } });
  }, [remove, organizationId]);

  /*
   * Drops the organisation from the cache. Separate from the mutation on
   * purpose: the caller navigates away first. Evicting while the organisation's
   * own screen is still mounted would make it re-query, get NOT_FOUND, and
   * flash the Not Found screen on the way out.
   */
  const forgetOrganization = useCallback(() => {
    const cacheId = client.cache.identify({
      __typename: 'Organization',
      id: organizationId,
    });
    if (cacheId) client.cache.evict({ id: cacheId });
    // The list's total and order are the server's to restate.
    client.cache.evict({ fieldName: 'myOrganizations' });
    client.cache.gc();
  }, [client, organizationId]);

  return { deleteOrganization, forgetOrganization, isDeleting: loading };
}

/** The member connection as the cache stores it: edges pointing at rows. */
type CachedMemberConnection = {
  edges: ReadonlyArray<{ cursor: string; node: Reference }>;
  totalCount: number;
};

export function useOrganizationMemberActions(organizationId: string) {
  // Returns the member row by id: the cache updates the table in place.
  const [updateRole, { loading: isUpdatingRole }] = useMutation(
    UpdateMemberRoleMutation,
  );

  const [remove, { loading: isRemoving }] = useMutation(RemoveMemberMutation);

  const updateMemberRole = useCallback(
    async (userId: string, role: AssignableOrgRole) => {
      await updateRole({ variables: { organizationId, userId, role } });
    },
    [updateRole, organizationId],
  );

  const removeMember = useCallback(
    async (member: OrganizationMemberRow) => {
      await remove({
        variables: { organizationId, userId: member.user.id },
        update: (cache) => {
          /*
           * The mutation returns only a boolean, so the row is taken out of the
           * cached connection by hand. Evicting the member object instead would
           * leave a dangling edge and force a refetch of the whole page.
           */
          const cacheId = cache.identify({
            __typename: 'Organization',
            id: organizationId,
          });
          if (!cacheId) return;

          cache.modify<{
            memberCount: number;
            members: CachedMemberConnection;
          }>({
            id: cacheId,
            fields: {
              memberCount: (count) => Math.max(0, count - 1),
              members: (existing, { readField, isReference }) => {
                // Not loaded, or held as a reference: nothing here to edit.
                if (isReference(existing) || !('edges' in existing)) {
                  return existing;
                }

                return {
                  ...existing,
                  totalCount: Math.max(0, existing.totalCount - 1),
                  edges: existing.edges.filter(
                    (edge) => readField('id', edge.node) !== member.id,
                  ),
                };
              },
            },
          });
        },
      });
    },
    [remove, organizationId],
  );

  return { updateMemberRole, removeMember, isUpdatingRole, isRemoving };
}
