/**
 * Sprint GraphQL contract: sprints under projects, a validated state machine,
 * task membership, and computed metrics (velocity, completion, remaining points,
 * workload distribution, burndown). Adds the `sprints` relation to `Project`.
 */
export const sprintTypeDefs = /* GraphQL */ `
  enum SprintState {
    PLANNED
    ACTIVE
    COMPLETED
    CANCELLED
  }

  type SprintWorkload {
    assigneeId: UUID
    user: User
    storyPoints: Int!
    taskCount: Int!
  }

  type SprintMetrics {
    totalStoryPoints: Int!
    completedStoryPoints: Int!
    remainingStoryPoints: Int!
    totalTasks: Int!
    completedTasks: Int!
    completionRate: Float!
    velocity: Int!
    capacity: Int
    overCapacity: Boolean!
    workloadDistribution: [SprintWorkload!]!
  }

  type BurndownPoint {
    date: DateTime!
    idealRemaining: Float!
    actualRemaining: Float!
  }

  type Sprint {
    id: UUID!
    name: String!
    goal: String
    state: SprintState!
    startDate: DateTime
    endDate: DateTime
    capacity: Int
    projectId: UUID!
    tasks(
      first: Int
      after: String
      filter: TaskFilter
      sortField: TaskSortField
      sortDirection: SortDirection
    ): TaskConnection!
    taskCount: Int!
    metrics: SprintMetrics!
    burndown: [BurndownPoint!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type SprintEdge {
    cursor: String!
    node: Sprint!
  }

  type SprintConnection {
    edges: [SprintEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input CreateSprintInput {
    name: String!
    goal: String
    startDate: DateTime
    endDate: DateTime
    capacity: Int
  }

  input UpdateSprintInput {
    name: String
    goal: String
    startDate: DateTime
    endDate: DateTime
    capacity: Int
  }

  extend type Project {
    sprints(first: Int, after: String): SprintConnection!
  }

  extend type Query {
    sprint(id: UUID!): Sprint!
  }

  extend type Mutation {
    createSprint(projectId: UUID!, input: CreateSprintInput!): Sprint!
    updateSprint(id: UUID!, input: UpdateSprintInput!): Sprint!
    changeSprintState(id: UUID!, state: SprintState!): Sprint!
    deleteSprint(id: UUID!): Boolean!
    addTaskToSprint(sprintId: UUID!, taskId: UUID!): Sprint!
    removeTaskFromSprint(sprintId: UUID!, taskId: UUID!): Sprint!
  }
`;
