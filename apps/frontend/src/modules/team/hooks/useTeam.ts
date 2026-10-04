import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback } from 'react';
import { ProjectQuery } from '@/modules/project/graphql/project.operations';
import {
  AddTeamMemberMutation,
  CreateTeamMutation,
  DeleteTeamMutation,
  RemoveTeamMemberMutation,
  TeamQuery,
  UpdateTeamMemberMutation,
  UpdateTeamMutation,
} from '@/modules/team/graphql/team.operations';
import type {
  TeamInput,
  TeamMemberInput,
} from '@/modules/team/schemas/team.schema';
import type { TeamQuery as TeamQueryResult } from '@/shared/graphql/generated/graphql';
import { ApiError } from '@/shared/lib/apiError';

export type TeamDetail = TeamQueryResult['team'];
export type TeamMemberRow = TeamDetail['members'][number];

export function useTeam(teamId: string) {
  const { data, loading, error, refetch } = useQuery(TeamQuery, {
    variables: { id: teamId },
  });

  return {
    team: data?.team ?? null,
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
  };
}

/*
 * A project lists its teams as a plain array, with no cursor to append at, so
 * creating or deleting a team re-reads the project rather than editing the
 * list in place.
 */

export function useCreateTeam(projectId: string) {
  const [create, { loading }] = useMutation(CreateTeamMutation, {
    refetchQueries: [ProjectQuery],
    awaitRefetchQueries: true,
  });

  const createTeam = useCallback(
    async (input: TeamInput) => {
      const result = await create({ variables: { projectId, input } });
      return result.data?.createTeam ?? null;
    },
    [create, projectId],
  );

  return { createTeam, isCreating: loading };
}

export function useTeamActions(teamId: string) {
  // Returns the team by id: the cache updates every screen showing it.
  const [update, { loading: isUpdating }] = useMutation(UpdateTeamMutation);
  const [remove, { loading: isDeleting }] = useMutation(DeleteTeamMutation, {
    refetchQueries: [ProjectQuery],
    awaitRefetchQueries: true,
  });

  const updateTeam = useCallback(
    async (input: TeamInput) => {
      await update({ variables: { id: teamId, input } });
    },
    [update, teamId],
  );

  const deleteTeam = useCallback(async () => {
    await remove({ variables: { id: teamId } });
  }, [remove, teamId]);

  return { updateTeam, isUpdating, deleteTeam, isDeleting };
}

export function useTeamMemberActions(teamId: string) {
  /*
   * Adding and removing change which rows the team has, and the mutations do
   * not return the team — so the team is re-read. That also refreshes the
   * member count the project's team list shows, since both read the same
   * cached `Team`.
   */
  const refetchTeam = {
    refetchQueries: [{ query: TeamQuery, variables: { id: teamId } }],
    awaitRefetchQueries: true,
  };

  const [add, { loading: isAdding }] = useMutation(
    AddTeamMemberMutation,
    refetchTeam,
  );
  // Returns the member row by id: the cache updates the table in place.
  const [update, { loading: isUpdating }] = useMutation(
    UpdateTeamMemberMutation,
  );
  const [remove, { loading: isRemoving }] = useMutation(
    RemoveTeamMemberMutation,
    refetchTeam,
  );

  const addMember = useCallback(
    async (userId: string, input: TeamMemberInput) => {
      await add({ variables: { teamId, userId, input } });
    },
    [add, teamId],
  );

  const updateMember = useCallback(
    async (userId: string, input: TeamMemberInput) => {
      await update({ variables: { teamId, userId, input } });
    },
    [update, teamId],
  );

  const removeMember = useCallback(
    async (userId: string) => {
      await remove({ variables: { teamId, userId } });
    },
    [remove, teamId],
  );

  return {
    addMember,
    isAdding,
    updateMember,
    isUpdating,
    removeMember,
    isRemoving,
  };
}
