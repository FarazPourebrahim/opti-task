import { graphql } from '@/shared/graphql/generated';

/**
 * Team operations.
 *
 * A team member's `availability` and `workload` are inputs to the AI assignment
 * engine, so they are selected wherever a member is shown.
 */

export const TeamQuery = graphql(`
  query Team($id: UUID!) {
    team(id: $id) {
      id
      name
      description
      projectId
      memberCount
      members {
        id
        role
        responsibilities
        availability
        workload
        createdAt
        user {
          id
          name
          email
          avatarUrl
        }
      }
    }
  }
`);

export const CreateTeamMutation = graphql(`
  mutation CreateTeam($projectId: UUID!, $input: CreateTeamInput!) {
    createTeam(projectId: $projectId, input: $input) {
      id
      name
      description
      memberCount
    }
  }
`);

export const UpdateTeamMutation = graphql(`
  mutation UpdateTeam($id: UUID!, $input: UpdateTeamInput!) {
    updateTeam(id: $id, input: $input) {
      id
      name
      description
    }
  }
`);

export const DeleteTeamMutation = graphql(`
  mutation DeleteTeam($id: UUID!) {
    deleteTeam(id: $id)
  }
`);

export const AddTeamMemberMutation = graphql(`
  mutation AddTeamMember(
    $teamId: UUID!
    $userId: UUID!
    $input: AddTeamMemberInput!
  ) {
    addTeamMember(teamId: $teamId, userId: $userId, input: $input) {
      id
      role
      responsibilities
      availability
      workload
    }
  }
`);

export const UpdateTeamMemberMutation = graphql(`
  mutation UpdateTeamMember(
    $teamId: UUID!
    $userId: UUID!
    $input: UpdateTeamMemberInput!
  ) {
    updateTeamMember(teamId: $teamId, userId: $userId, input: $input) {
      id
      role
      responsibilities
      availability
      workload
    }
  }
`);

export const RemoveTeamMemberMutation = graphql(`
  mutation RemoveTeamMember($teamId: UUID!, $userId: UUID!) {
    removeTeamMember(teamId: $teamId, userId: $userId)
  }
`);
