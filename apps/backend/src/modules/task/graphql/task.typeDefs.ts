/**
 * Task GraphQL contract: the core work unit. Full lifecycle (status state
 * machine, assignment, story points, sprint moves) with field resolvers for
 * assignee/reporter/labels/watchers/dependencies, plus filtered/sorted/paginated
 * listing under a project. `sprintId`/`epicId` are exposed as IDs; the object
 * relations land with the sprint/epic modules (Phase 8). The `activities`
 * connection is added by the activity module.
 */
export const taskTypeDefs = /* GraphQL */ `
  enum TaskPriority {
    LOWEST
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum TaskStatus {
    BACKLOG
    TODO
    IN_PROGRESS
    IN_REVIEW
    TESTING
    DONE
    BLOCKED
  }

  enum TaskSortField {
    CREATED_AT
    PRIORITY
    DUE_DATE
  }

  type Label {
    id: UUID!
    name: String!
    color: String
  }

  type Task {
    id: UUID!
    title: String!
    description: String
    priority: TaskPriority!
    status: TaskStatus!
    storyPoints: Int
    projectId: UUID!
    assigneeId: UUID
    reporterId: UUID
    sprintId: UUID
    epicId: UUID
    dueDate: DateTime
    estimatedSeconds: Float
    loggedSeconds: Float!
    assignee: User
    reporter: User
    labels: [Label!]!
    watchers: [User!]!
    dependencies: [Task!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type TaskEdge {
    cursor: String!
    node: Task!
  }

  type TaskConnection {
    edges: [TaskEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input CreateTaskInput {
    title: String!
    description: String
    priority: TaskPriority
    storyPoints: Int
    assigneeId: UUID
    sprintId: UUID
    epicId: UUID
    dueDate: DateTime
  }

  input UpdateTaskInput {
    title: String
    description: String
    priority: TaskPriority
    dueDate: DateTime
  }

  input TaskFilter {
    status: TaskStatus
    priority: TaskPriority
    assigneeId: UUID
    sprintId: UUID
    epicId: UUID
    labelId: UUID
  }

  extend type Project {
    tasks(
      first: Int
      after: String
      filter: TaskFilter
      sortField: TaskSortField
      sortDirection: SortDirection
    ): TaskConnection!
  }

  extend type Query {
    task(id: UUID!): Task!
  }

  extend type Mutation {
    createTask(projectId: UUID!, input: CreateTaskInput!): Task!
    updateTask(id: UUID!, input: UpdateTaskInput!): Task!
    changeTaskStatus(id: UUID!, status: TaskStatus!): Task!
    assignTask(id: UUID!, assigneeId: UUID): Task!
    setTaskStoryPoints(id: UUID!, storyPoints: Int): Task!
    moveTaskToSprint(id: UUID!, sprintId: UUID): Task!
    deleteTask(id: UUID!): Boolean!
    logTaskTime(id: UUID!, seconds: Int!): Task!
    addTaskDependency(taskId: UUID!, dependsOnTaskId: UUID!): Task!
    removeTaskDependency(taskId: UUID!, dependsOnTaskId: UUID!): Task!
    watchTask(taskId: UUID!): Task!
    unwatchTask(taskId: UUID!): Task!
    addTaskLabel(taskId: UUID!, name: String!): Task!
    removeTaskLabel(taskId: UUID!, name: String!): Task!
  }
`;
