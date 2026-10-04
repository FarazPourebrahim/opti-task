import { graphql } from '@/shared/graphql/generated';

/**
 * Epic and milestone operations.
 *
 * An epic's progress is computed by the server from its tasks on every read.
 * `refreshEpicProgress` only stores that figure on the epic; it does not
 * change what a read returns.
 */

export const EpicSummaryFragment = graphql(`
  fragment EpicSummary on Epic {
    id
    name
    description
    projectId
    progress
    completedTasks
    totalTasks
  }
`);

export const ProjectEpicsQuery = graphql(`
  query ProjectEpics($projectId: UUID!, $first: Int, $after: String) {
    project(id: $projectId) {
      id
      epics(first: $first, after: $after) {
        edges {
          cursor
          node {
            ...EpicSummary
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
    }
  }
`);

export const EpicQuery = graphql(`
  query Epic($id: UUID!, $tasksFirst: Int, $tasksAfter: String) {
    epic(id: $id) {
      ...EpicSummary
      milestones {
        id
        name
        description
        dueDate
        epicId
      }
      tasks(first: $tasksFirst, after: $tasksAfter) {
        edges {
          cursor
          node {
            id
            title
            status
            storyPoints
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
    }
  }
`);

export const CreateEpicMutation = graphql(`
  mutation CreateEpic($projectId: UUID!, $input: CreateEpicInput!) {
    createEpic(projectId: $projectId, input: $input) {
      ...EpicSummary
    }
  }
`);

export const UpdateEpicMutation = graphql(`
  mutation UpdateEpic($id: UUID!, $input: UpdateEpicInput!) {
    updateEpic(id: $id, input: $input) {
      id
      name
      description
    }
  }
`);

export const DeleteEpicMutation = graphql(`
  mutation DeleteEpic($id: UUID!) {
    deleteEpic(id: $id)
  }
`);

export const RefreshEpicProgressMutation = graphql(`
  mutation RefreshEpicProgress($id: UUID!) {
    refreshEpicProgress(id: $id) {
      id
      progress
      completedTasks
      totalTasks
    }
  }
`);

export const CreateMilestoneMutation = graphql(`
  mutation CreateMilestone($projectId: UUID!, $input: CreateMilestoneInput!) {
    createMilestone(projectId: $projectId, input: $input) {
      id
      name
      description
      dueDate
      epicId
    }
  }
`);

export const DeleteMilestoneMutation = graphql(`
  mutation DeleteMilestone($id: UUID!) {
    deleteMilestone(id: $id)
  }
`);
