import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { useCallback, useMemo } from 'react';
import { DEFAULT_PAGE_SIZE } from '@contracts';
import type { ProjectRole, ProjectState } from '@contracts';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { useOrganization } from '@/modules/organization/hooks/useOrganization';
import {
  AddProjectMemberMutation,
  ChangeProjectStatusMutation,
  ConfigureWorkflowMutation,
  CreateProjectMutation,
  DeleteProjectMutation,
  ProjectQuery,
  RemoveProjectMemberMutation,
  UpdateProjectMemberRoleMutation,
  UpdateProjectMutation,
} from '@/modules/project/graphql/project.operations';
import type { ProjectInput } from '@/modules/project/schemas/project.schema';
import { resolveProjectRoles } from '@/modules/project/utils/project.utils';
import type { ProjectQuery as ProjectQueryResult } from '@/shared/graphql/generated/graphql';
import { useLoadMore } from '@/shared/hooks/useLoadMore';
import { ApiError } from '@/shared/lib/apiError';
import { removeFromConnection } from '@/shared/utils/cache.utils';

export type ProjectDetail = ProjectQueryResult['project'];
export type ProjectMemberRow =
  ProjectDetail['members']['edges'][number]['node'];
export type ProjectTeamSummary = ProjectDetail['teams'][number];

/**
 * One project with its members and teams, the organisation it belongs to, and
 * the viewer's roles on it.
 */
export function useProject(projectId: string) {
  const { user } = useAuth();
  const { data, loading, error, refetch, fetchMore } = useQuery(ProjectQuery, {
    variables: { id: projectId, first: DEFAULT_PAGE_SIZE },
  });

  const project = data?.project ?? null;

  /*
   * Organisation owners and admins hold project powers without being project
   * members, so the organisation is read too. A project member who is not in
   * the organisation is refused that read; they simply get no organisation
   * roles, which is the truth.
   */
  const {
    organization,
    roles: organizationRoles,
    members: organizationMembers,
  } = useOrganization(project?.organizationId ?? null);

  const members = useMemo(
    () => project?.members.edges.map((edge) => edge.node) ?? [],
    [project],
  );

  const roles = useMemo(
    () => resolveProjectRoles(user?.id, organizationRoles, members),
    [user?.id, organizationRoles, members],
  );

  const fetchAfter = useCallback(
    (after: string) => fetchMore({ variables: { after } }),
    [fetchMore],
  );
  const { hasMore, isLoadingMore, loadMore } = useLoadMore(
    project?.members.pageInfo,
    fetchAfter,
  );

  return {
    project,
    organization,
    organizationMembers,
    members,
    membersTotal: project?.members.totalCount ?? 0,
    roles,
    isLoading: loading && !data,
    error: ApiError.is(error) ? error : null,
    refetch,
    hasMoreMembers: hasMore,
    isLoadingMoreMembers: isLoadingMore,
    loadMoreMembers: loadMore,
  };
}

export function useCreateProject(organizationId: string) {
  const [create, { loading }] = useMutation(CreateProjectMutation, {
    update: (cache) => {
      // Every status filter is its own cached list; where the new project
      // belongs in each is the server's call, so they are all re-read.
      const cacheId = cache.identify({
        __typename: 'Organization',
        id: organizationId,
      });
      if (!cacheId) return;

      cache.evict({ id: cacheId, fieldName: 'projects' });
      cache.modify<{ projectCount: number }>({
        id: cacheId,
        fields: { projectCount: (count) => count + 1 },
      });
    },
  });

  const createProject = useCallback(
    async (input: ProjectInput) => {
      const result = await create({ variables: { organizationId, input } });
      return result.data?.createProject ?? null;
    },
    [create, organizationId],
  );

  return { createProject, isCreating: loading };
}

/*
 * Update, status and workflow each return the project by id, so the normalized
 * cache updates every screen showing it. None is optimistic: a rejected
 * transition must leave the cached status exactly as the server last stated it.
 */
export function useProjectActions(projectId: string) {
  const client = useApolloClient();
  const [update, { loading: isUpdating }] = useMutation(UpdateProjectMutation);
  const [changeStatus, { loading: isChangingStatus }] = useMutation(
    ChangeProjectStatusMutation,
  );
  const [configure, { loading: isConfiguring }] = useMutation(
    ConfigureWorkflowMutation,
  );
  const [remove, { loading: isDeleting }] = useMutation(DeleteProjectMutation);

  const updateProject = useCallback(
    async (input: ProjectInput) => {
      await update({ variables: { id: projectId, input } });
    },
    [update, projectId],
  );

  const changeProjectStatus = useCallback(
    async (status: ProjectState) => {
      await changeStatus({ variables: { id: projectId, status } });
    },
    [changeStatus, projectId],
  );

  const configureWorkflow = useCallback(
    async (workflow: Record<string, unknown>) => {
      await configure({ variables: { id: projectId, workflow } });
    },
    [configure, projectId],
  );

  const deleteProject = useCallback(async () => {
    await remove({ variables: { id: projectId } });
  }, [remove, projectId]);

  /*
   * Drops the project from the cache. Separate from the mutation so the caller
   * can navigate away first: evicting while the project's own screen is still
   * mounted would make it re-query and flash Not Found on the way out.
   */
  const forgetProject = useCallback(
    (organizationId: string) => {
      const projectCacheId = client.cache.identify({
        __typename: 'Project',
        id: projectId,
      });
      if (projectCacheId) client.cache.evict({ id: projectCacheId });

      const organizationCacheId = client.cache.identify({
        __typename: 'Organization',
        id: organizationId,
      });
      if (organizationCacheId) {
        client.cache.evict({ id: organizationCacheId, fieldName: 'projects' });
      }
      client.cache.gc();
    },
    [client, projectId],
  );

  return {
    updateProject,
    isUpdating,
    changeProjectStatus,
    isChangingStatus,
    configureWorkflow,
    isConfiguring,
    deleteProject,
    isDeleting,
    forgetProject,
  };
}

export function useProjectMemberActions(projectId: string) {
  const [add, { loading: isAdding }] = useMutation(AddProjectMemberMutation, {
    // The new row's place in the paginated list is the server's to decide.
    refetchQueries: [ProjectQuery],
    awaitRefetchQueries: true,
  });
  // Returns the member row by id: the cache updates the table in place.
  const [updateRole, { loading: isUpdatingRole }] = useMutation(
    UpdateProjectMemberRoleMutation,
  );
  const [remove, { loading: isRemoving }] = useMutation(
    RemoveProjectMemberMutation,
  );

  const addMember = useCallback(
    async (userId: string, role: ProjectRole) => {
      await add({ variables: { projectId, userId, role } });
    },
    [add, projectId],
  );

  const updateMemberRole = useCallback(
    async (userId: string, role: ProjectRole) => {
      await updateRole({ variables: { projectId, userId, role } });
    },
    [updateRole, projectId],
  );

  const removeMember = useCallback(
    async (member: ProjectMemberRow) => {
      await remove({
        variables: { projectId, userId: member.user.id },
        // The mutation returns only a boolean, so the row is removed by hand.
        update: (cache) =>
          removeFromConnection(cache, {
            owner: { __typename: 'Project', id: projectId },
            connectionField: 'members',
            countField: 'memberCount',
            nodeId: member.id,
          }),
      });
    },
    [remove, projectId],
  );

  return {
    addMember,
    isAdding,
    updateMemberRole,
    isUpdatingRole,
    removeMember,
    isRemoving,
  };
}
