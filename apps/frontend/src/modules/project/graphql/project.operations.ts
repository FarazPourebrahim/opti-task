import { graphql } from '@/shared/graphql/generated';

/**
 * Project operations.
 *
 * The project is fetched with its members and its teams (each with their own
 * members) because the viewer's roles — which decide what every tab may offer —
 * can only be read from those lists.
 */

export const ProjectQuery = graphql(`
  query Project($id: UUID!, $first: Int, $after: String) {
    project(id: $id) {
      id
      name
      description
      status
      organizationId
      memberCount
      teamCount
      settings {
        workflow
      }
      members(first: $first, after: $after) {
        edges {
          cursor
          node {
            id
            role
            createdAt
            user {
              id
              name
              email
              avatarUrl
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
      teams {
        id
        name
        description
        memberCount
        members {
          id
          role
          user {
            id
          }
        }
      }
    }
  }
`);

export const CreateProjectMutation = graphql(`
  mutation CreateProject($organizationId: UUID!, $input: CreateProjectInput!) {
    createProject(organizationId: $organizationId, input: $input) {
      id
      name
      description
      status
      memberCount
    }
  }
`);

export const UpdateProjectMutation = graphql(`
  mutation UpdateProject($id: UUID!, $input: UpdateProjectInput!) {
    updateProject(id: $id, input: $input) {
      id
      name
      description
    }
  }
`);

export const ChangeProjectStatusMutation = graphql(`
  mutation ChangeProjectStatus($id: UUID!, $status: ProjectState!) {
    changeProjectStatus(id: $id, status: $status) {
      id
      status
    }
  }
`);

export const DeleteProjectMutation = graphql(`
  mutation DeleteProject($id: UUID!) {
    deleteProject(id: $id)
  }
`);

export const ConfigureWorkflowMutation = graphql(`
  mutation ConfigureWorkflow($id: UUID!, $workflow: JSON!) {
    configureWorkflow(id: $id, workflow: $workflow) {
      id
      settings {
        workflow
      }
    }
  }
`);

export const AddProjectMemberMutation = graphql(`
  mutation AddProjectMember(
    $projectId: UUID!
    $userId: UUID!
    $role: ProjectRole!
  ) {
    addProjectMember(projectId: $projectId, userId: $userId, role: $role) {
      id
      role
    }
  }
`);

export const UpdateProjectMemberRoleMutation = graphql(`
  mutation UpdateProjectMemberRole(
    $projectId: UUID!
    $userId: UUID!
    $role: ProjectRole!
  ) {
    updateProjectMemberRole(
      projectId: $projectId
      userId: $userId
      role: $role
    ) {
      id
      role
    }
  }
`);

export const RemoveProjectMemberMutation = graphql(`
  mutation RemoveProjectMember($projectId: UUID!, $userId: UUID!) {
    removeProjectMember(projectId: $projectId, userId: $userId)
  }
`);
