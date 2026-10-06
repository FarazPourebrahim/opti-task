import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback } from 'react';
import {
  AddExpertiseMutation,
  AddSkillMutation,
  MyProfileQuery,
  RemoveExpertiseMutation,
  RemoveSkillMutation,
  UpdateProfileMutation,
  UserProfileQuery,
} from '@/modules/user/graphql/user.operations';
import type { ProfileInput } from '@/modules/user/schemas/user.schema';
import { ApiError } from '@/shared/lib/apiError';

/** The signed-in user's own profile. */
export function useMyProfile() {
  const { data, loading, error, refetch } = useQuery(MyProfileQuery);

  return {
    profile: data?.me ?? null,
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
  };
}

/** Another user's profile, as far as the viewer is allowed to see it. */
export function useUserProfile(userId: string) {
  const { data, loading, error, refetch } = useQuery(UserProfileQuery, {
    variables: { id: userId },
  });

  return {
    profile: data?.user ?? null,
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
  };
}

/*
 * Each mutation returns the `User` with the fields it changed, keyed by id, so
 * the normalized cache updates the profile without a refetch.
 */

export function useUpdateProfile() {
  const [update, { loading }] = useMutation(UpdateProfileMutation);

  const updateProfile = useCallback(
    async (input: ProfileInput) => {
      await update({ variables: { input } });
    },
    [update],
  );

  return { updateProfile, isUpdating: loading };
}

export function useSkills() {
  const [add, { loading: isAdding }] = useMutation(AddSkillMutation);
  const [remove, { loading: isRemoving }] = useMutation(RemoveSkillMutation);

  const addSkill = useCallback(
    async (skill: string) => {
      await add({ variables: { skill } });
    },
    [add],
  );

  const removeSkill = useCallback(
    async (skill: string) => {
      await remove({ variables: { skill } });
    },
    [remove],
  );

  return { addSkill, removeSkill, isAdding, isRemoving };
}

export function useExpertise() {
  const [add, { loading: isAdding }] = useMutation(AddExpertiseMutation);
  const [remove, { loading: isRemoving }] = useMutation(
    RemoveExpertiseMutation,
  );

  const addExpertise = useCallback(
    async (tag: string, confidenceScore: number) => {
      await add({ variables: { input: { tag, confidenceScore } } });
    },
    [add],
  );

  const removeExpertise = useCallback(
    async (tag: string) => {
      await remove({ variables: { tag } });
    },
    [remove],
  );

  return { addExpertise, removeExpertise, isAdding, isRemoving };
}
