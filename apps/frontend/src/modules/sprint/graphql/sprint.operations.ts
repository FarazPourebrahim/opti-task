import { graphql } from '@/shared/graphql/generated';

/**
 * Sprint operations.
 *
 * A sprint's metrics and burndown are computed by the server from its tasks,
 * so anything that changes which tasks a sprint holds re-reads the sprint
 * rather than patching those figures by hand.
 */

export const SprintSummaryFragment = graphql(`
  fragment SprintSummary on Sprint {
    id
    name
    goal
    state
    startDate
    endDate
    capacity
    projectId
    taskCount
  }
`);

export const SprintTaskFragment = graphql(`
  fragment SprintTask on Task {
    id
    title
    status
    priority
    storyPoints
    sprintId
    assignee {
      id
      name
      avatarUrl
    }
  }
`);

/*
 * The figures the server works out from a sprint's tasks. Selected by the
 * sprint page, and re-read on their own when a task in the project changes.
 */
export const SprintFiguresFragment = graphql(`
  fragment SprintFigures on Sprint {
    metrics {
      totalStoryPoints
      completedStoryPoints
      remainingStoryPoints
      totalTasks
      completedTasks
      completionRate
      velocity
      capacity
      overCapacity
      workloadDistribution {
        assigneeId
        storyPoints
        taskCount
        user {
          id
          name
          avatarUrl
        }
      }
    }
    burndown {
      date
      idealRemaining
      actualRemaining
    }
  }
`);

export const ProjectSprintsQuery = graphql(`
  query ProjectSprints($projectId: UUID!, $first: Int, $after: String) {
    project(id: $projectId) {
      id
      sprints(first: $first, after: $after) {
        edges {
          cursor
          node {
            ...SprintSummary
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

export const SprintQuery = graphql(`
  query Sprint($id: UUID!, $tasksFirst: Int, $tasksAfter: String) {
    sprint(id: $id) {
      ...SprintSummary
      ...SprintFigures
      tasks(first: $tasksFirst, after: $tasksAfter) {
        edges {
          cursor
          node {
            ...SprintTask
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

/*
 * The project's most recent tasks, with the sprint each is in, so the sprint
 * page can offer the ones that are not in it yet. The same list, under the
 * same arguments, as the task module's dependency picker reads.
 */
export const SprintTaskCandidatesQuery = graphql(`
  query SprintTaskCandidates($projectId: UUID!, $first: Int) {
    project(id: $projectId) {
      id
      tasks(first: $first, sortField: CREATED_AT, sortDirection: DESC) {
        edges {
          cursor
          node {
            id
            title
            status
            sprintId
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

export const CreateSprintMutation = graphql(`
  mutation CreateSprint($projectId: UUID!, $input: CreateSprintInput!) {
    createSprint(projectId: $projectId, input: $input) {
      ...SprintSummary
    }
  }
`);

export const UpdateSprintMutation = graphql(`
  mutation UpdateSprint($id: UUID!, $input: UpdateSprintInput!) {
    updateSprint(id: $id, input: $input) {
      ...SprintSummary
    }
  }
`);

export const ChangeSprintStateMutation = graphql(`
  mutation ChangeSprintState($id: UUID!, $state: SprintState!) {
    changeSprintState(id: $id, state: $state) {
      id
      state
    }
  }
`);

export const DeleteSprintMutation = graphql(`
  mutation DeleteSprint($id: UUID!) {
    deleteSprint(id: $id)
  }
`);

export const AddTaskToSprintMutation = graphql(`
  mutation AddTaskToSprint($sprintId: UUID!, $taskId: UUID!) {
    addTaskToSprint(sprintId: $sprintId, taskId: $taskId) {
      id
    }
  }
`);

export const RemoveTaskFromSprintMutation = graphql(`
  mutation RemoveTaskFromSprint($sprintId: UUID!, $taskId: UUID!) {
    removeTaskFromSprint(sprintId: $sprintId, taskId: $taskId) {
      id
    }
  }
`);

/*
 * A sprint's state and figures alone, without its task list: what a change to
 * one of the project's tasks can move. Reading only these leaves the pages of
 * tasks already on screen where they are.
 */
export const SprintFiguresQuery = graphql(`
  query SprintFigures($id: UUID!) {
    sprint(id: $id) {
      id
      state
      taskCount
      ...SprintFigures
    }
  }
`);

/** A sprint in this project changed state. */
export const SprintUpdatedSubscription = graphql(`
  subscription SprintUpdated($projectId: UUID!) {
    sprintUpdated(projectId: $projectId) {
      sprintId
      projectId
      sprint {
        ...SprintSummary
      }
    }
  }
`);
