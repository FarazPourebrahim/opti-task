import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback } from 'react';
import {
  RevokeSessionMutation,
  SessionsQuery,
} from '@/modules/auth/graphql/auth.operations';
import { ApiError } from '@/shared/lib/apiError';

/**
 * The signed-in devices on this account.
 *
 * Revoking refetches rather than patching the cache: the server decides which
 * session is `current`, and a locally-spliced list could disagree with it.
 */
export function useSessions() {
  const { data, loading, error, refetch } = useQuery(SessionsQuery, {
    fetchPolicy: 'cache-and-network',
  });

  const [revoke, { loading: isRevoking }] = useMutation(RevokeSessionMutation, {
    onCompleted: () => {
      void refetch();
    },
  });

  const revokeSession = useCallback(
    async (sessionId: string) => {
      await revoke({ variables: { sessionId } });
    },
    [revoke],
  );

  return {
    sessions: data?.sessions ?? [],
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    isRevoking,
    revokeSession,
    refetch,
  };
}
