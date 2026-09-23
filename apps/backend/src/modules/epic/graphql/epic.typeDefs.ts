/**
 * Epic GraphQL contract: epics group tasks under a project, with milestones and
 * live progress aggregation derived from child-task completion. Reuses the task
 * module's `TaskConnection` for related tasks (dependency-visualization data is
 * available through each task's `dependencies`). Adds the `epics` relation to
 * `Project`.
 */
export const epicTypeDefs = /* GraphQL */ `
  type Milestone {
    id: UUID!
    name: String!
    description: String
    dueDate: DateTime
    epicId: UUID
    projectId: UUID!
    createdAt: DateTime!
  }

  type Epic {
    id: UUID!
    name: String!
    description: String
    projectId: UUID!
    progress: Float!
    completedTasks: Int!
    totalTasks: Int!
    tasks(
      first: Int
      after: String
      filter: TaskFilter
      sortField: TaskSortField
      sortDirection: SortDirection
    ): TaskConnection!
    milestones: [Milestone!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type EpicEdge {
    cursor: String!
    node: Epic!
  }

  type EpicConnection {
    edges: [EpicEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input CreateEpicInput {
    name: String!
    description: String
  }

  input UpdateEpicInput {
    name: String
    description: String
  }

  input CreateMilestoneInput {
    name: String!
    description: String
    dueDate: DateTime
    epicId: UUID
  }

  extend type Project {
    epics(first: Int, after: String): EpicConnection!
  }

  extend type Query {
    epic(id: UUID!): Epic!
  }

  extend type Mutation {
    createEpic(projectId: UUID!, input: CreateEpicInput!): Epic!
    updateEpic(id: UUID!, input: UpdateEpicInput!): Epic!
    deleteEpic(id: UUID!): Boolean!
    refreshEpicProgress(id: UUID!): Epic!
    createMilestone(projectId: UUID!, input: CreateMilestoneInput!): Milestone!
    deleteMilestone(id: UUID!): Boolean!
  }
`;
