import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback } from 'react';
import {
  InviteToOrganizationMutation,
  OrganizationInvitationsQuery,
  RevokeInvitationMutation,
} from '@/modules/organization/graphql/organization.operations';
import type { InviteInput } from '@/modules/organization/schemas/organization.schema';
import type { OrganizationInvitationsQuery as InvitationsResult } from '@/shared/graphql/generated/graphql';
import { ApiError } from '@/shared/lib/apiError';

export type InvitationRow =
  InvitationsResult['organizationInvitations'][number];

/**
 * An organisation's invitations.
 *
 * Both mutations re-read the list: a revoke returns only a boolean, and the
 * list is short and unpaginated, so re-reading is simpler and always right.
 */
export function useOrganizationInvitations(organizationId: string) {
  const variables = { organizationId };

  const { data, loading, error, refetch } = useQuery(
    OrganizationInvitationsQuery,
    { variables },
  );

  const refetchQueries = [{ query: OrganizationInvitationsQuery, variables }];

  const [invite, { loading: isInviting }] = useMutation(
    InviteToOrganizationMutation,
    { refetchQueries, awaitRefetchQueries: true },
  );

  const [revoke, { loading: isRevoking }] = useMutation(
    RevokeInvitationMutation,
    { refetchQueries, awaitRefetchQueries: true },
  );

  const inviteMember = useCallback(
    async (input: InviteInput) => {
      await invite({ variables: { organizationId, input } });
    },
    [invite, organizationId],
  );

  const revokeInvitation = useCallback(
    async (invitationId: string) => {
      await revoke({ variables: { invitationId } });
    },
    [revoke],
  );

  return {
    invitations: data?.organizationInvitations ?? [],
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
    inviteMember,
    isInviting,
    revokeInvitation,
    isRevoking,
  };
}
