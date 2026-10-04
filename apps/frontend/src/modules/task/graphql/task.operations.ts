import { graphql } from '@/shared/graphql/generated';

/**
 * Task operations.
 *
 * Fragments come first and every document is built from them, so a task looks
 * the same wherever it is cached and no screen nests deeper than the API's
 * limit of 12 (the deepest path here is 6).
 *
 * A mutation selects exactly the fields it changes. The cache merges them into
 * the task by id, so the board, the list and the detail page all follow.
 */

export const TaskPersonFragment = graphql(`
  fragment TaskPerson on User {
    id
    name
    avatarUrl
  }
`);

export const TaskCardFragment = graphql(`
  fragment TaskCard on Task {
    id
    title
    priority
    status
    storyPoints
    projectId
    assigneeId
    reporterId
    sprintId
    epicId
    dueDate
    createdAt
    assignee {
      ...TaskPerson
    }
    labels {
      id
      name
    }
  }
`);

export const TaskPageFragment = graphql(`
  fragment TaskPage on TaskConnection {
    edges {
      cursor
      node {
        ...TaskCard
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
`);

export const TaskDetailFragment = graphql(`
  fragment TaskDetail on Task {
    ...TaskCard
    description
    loggedSeconds
    updatedAt
    reporter {
      ...TaskPerson
    }
    watchers {
      ...TaskPerson
    }
    dependencies {
      id
      title
      status
    }
  }
`);

export const TaskActivityFragment = graphql(`
  fragment TaskActivity on ActivityLog {
    id
    type
    metadata
    createdAt
    actor {
      id
      name
    }
  }
`);

/*
 * One connection per status, so every column has its own count and its own
 * next page. The status is a literal in each alias: the cache keys a task list
 * by its filter, and these must match the key `ProjectBoardColumn` pages into.
 */
export const ProjectBoardQuery = graphql(`
  query ProjectBoard($projectId: UUID!, $first: Int) {
    project(id: $projectId) {
      id
      backlog: tasks(first: $first, filter: { status: BACKLOG }) {
        ...TaskPage
      }
      todo: tasks(first: $first, filter: { status: TODO }) {
        ...TaskPage
      }
      inProgress: tasks(first: $first, filter: { status: IN_PROGRESS }) {
        ...TaskPage
      }
      inReview: tasks(first: $first, filter: { status: IN_REVIEW }) {
        ...TaskPage
      }
      testing: tasks(first: $first, filter: { status: TESTING }) {
        ...TaskPage
      }
      done: tasks(first: $first, filter: { status: DONE }) {
        ...TaskPage
      }
      blocked: tasks(first: $first, filter: { status: BLOCKED }) {
        ...TaskPage
      }
    }
  }
`);

/** The next page of one board column. */
export const ProjectBoardColumnQuery = graphql(`
  query ProjectBoardColumn(
    $projectId: UUID!
    $status: TaskStatus!
    $first: Int
    $after: String
  ) {
    project(id: $projectId) {
      id
      tasks(first: $first, after: $after, filter: { status: $status }) {
        ...TaskPage
      }
    }
  }
`);

export const ProjectTasksQuery = graphql(`
  query ProjectTasks(
    $projectId: UUID!
    $first: Int
    $after: String
    $filter: TaskFilter
    $sortField: TaskSortField
    $sortDirection: SortDirection
  ) {
    project(id: $projectId) {
      id
      tasks(
        first: $first
        after: $after
        filter: $filter
        sortField: $sortField
        sortDirection: $sortDirection
      ) {
        ...TaskPage
      }
    }
  }
`);

/*
 * Tasks a dependency can point at. It never sends `filter`, and the task list
 * always does, so the two are separate cached lists even when sorted alike.
 */
export const ProjectTaskOptionsQuery = graphql(`
  query ProjectTaskOptions($projectId: UUID!, $first: Int) {
    project(id: $projectId) {
      id
      tasks(first: $first, sortField: CREATED_AT, sortDirection: DESC) {
        edges {
          cursor
          node {
            id
            title
            status
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
 * A task carries only `sprintId` and `epicId`; the names are read from these
 * lists. The sprint and epic screens of Phase 9 take over the same fields.
 */
export const ProjectPlanningQuery = graphql(`
  query ProjectPlanning($projectId: UUID!, $first: Int) {
    project(id: $projectId) {
      id
      sprints(first: $first) {
        edges {
          cursor
          node {
            id
            name
            state
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
      epics(first: $first) {
        edges {
          cursor
          node {
            id
            name
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

export const TaskQuery = graphql(`
  query Task($id: UUID!, $activitiesFirst: Int, $activitiesAfter: String) {
    task(id: $id) {
      ...TaskDetail
      activities(first: $activitiesFirst, after: $activitiesAfter) {
        edges {
          cursor
          node {
            ...TaskActivity
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

export const CreateTaskMutation = graphql(`
  mutation CreateTask($projectId: UUID!, $input: CreateTaskInput!) {
    createTask(projectId: $projectId, input: $input) {
      ...TaskCard
    }
  }
`);

export const UpdateTaskMutation = graphql(`
  mutation UpdateTask($id: UUID!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      id
      title
      description
      priority
      dueDate
      updatedAt
    }
  }
`);

/*
 * The three optimistic mutations select `__typename` explicitly: an optimistic
 * response is written to the cache by hand, and the cache cannot file a task
 * it is not told is a `Task`.
 */
export const ChangeTaskStatusMutation = graphql(`
  mutation ChangeTaskStatus($id: UUID!, $status: TaskStatus!) {
    changeTaskStatus(id: $id, status: $status) {
      __typename
      id
      status
    }
  }
`);

export const AssignTaskMutation = graphql(`
  mutation AssignTask($id: UUID!, $assigneeId: UUID) {
    assignTask(id: $id, assigneeId: $assigneeId) {
      __typename
      id
      assigneeId
      assignee {
        __typename
        ...TaskPerson
      }
    }
  }
`);

export const SetTaskStoryPointsMutation = graphql(`
  mutation SetTaskStoryPoints($id: UUID!, $storyPoints: Int) {
    setTaskStoryPoints(id: $id, storyPoints: $storyPoints) {
      __typename
      id
      storyPoints
    }
  }
`);

export const MoveTaskToSprintMutation = graphql(`
  mutation MoveTaskToSprint($id: UUID!, $sprintId: UUID) {
    moveTaskToSprint(id: $id, sprintId: $sprintId) {
      id
      sprintId
    }
  }
`);

export const DeleteTaskMutation = graphql(`
  mutation DeleteTask($id: UUID!) {
    deleteTask(id: $id)
  }
`);

export const LogTaskTimeMutation = graphql(`
  mutation LogTaskTime($id: UUID!, $seconds: Int!) {
    logTaskTime(id: $id, seconds: $seconds) {
      id
      loggedSeconds
    }
  }
`);

export const AddTaskDependencyMutation = graphql(`
  mutation AddTaskDependency($taskId: UUID!, $dependsOnTaskId: UUID!) {
    addTaskDependency(taskId: $taskId, dependsOnTaskId: $dependsOnTaskId) {
      id
      dependencies {
        id
        title
        status
      }
    }
  }
`);

export const RemoveTaskDependencyMutation = graphql(`
  mutation RemoveTaskDependency($taskId: UUID!, $dependsOnTaskId: UUID!) {
    removeTaskDependency(taskId: $taskId, dependsOnTaskId: $dependsOnTaskId) {
      id
      dependencies {
        id
        title
        status
      }
    }
  }
`);

export const WatchTaskMutation = graphql(`
  mutation WatchTask($taskId: UUID!) {
    watchTask(taskId: $taskId) {
      id
      watchers {
        ...TaskPerson
      }
    }
  }
`);

export const UnwatchTaskMutation = graphql(`
  mutation UnwatchTask($taskId: UUID!) {
    unwatchTask(taskId: $taskId) {
      id
      watchers {
        ...TaskPerson
      }
    }
  }
`);

export const AddTaskLabelMutation = graphql(`
  mutation AddTaskLabel($taskId: UUID!, $name: String!) {
    addTaskLabel(taskId: $taskId, name: $name) {
      id
      labels {
        id
        name
      }
    }
  }
`);

export const RemoveTaskLabelMutation = graphql(`
  mutation RemoveTaskLabel($taskId: UUID!, $name: String!) {
    removeTaskLabel(taskId: $taskId, name: $name) {
      id
      labels {
        id
        name
      }
    }
  }
`);
