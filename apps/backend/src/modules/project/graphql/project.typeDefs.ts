/**
 * Project GraphQL contract: projects under organizations, a validated status
 * lifecycle, project membership, and workflow/settings. Adds the `projects`
 * relation to `Organization` (deferred from Phase 5). The `teams` relation is
 * added by the team module.
 */
export const projectTypeDefs = /* GraphQL */ `
  enum ProjectState {
    PLANNING
    ACTIVE
    COMPLETED
    ARCHIVED
  }

  enum ProjectRole {
    ADMIN
    MEMBER
    VIEWER
  }

  type ProjectSettings {
    workflow: JSON!
    settings: JSON!
  }

  type Project {
    id: UUID!
    name: String!
    description: String
    status: ProjectState!
    organizationId: UUID!
    settings: ProjectSettings!
    members(first: Int, after: String): ProjectMemberConnection!
    memberCount: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ProjectMember {
    id: UUID!
    role: ProjectRole!
    user: User!
    createdAt: DateTime!
  }

  type ProjectMemberEdge {
    cursor: String!
    node: ProjectMember!
  }

  type ProjectMemberConnection {
    edges: [ProjectMemberEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ProjectEdge {
    cursor: String!
    node: Project!
  }

  type ProjectConnection {
    edges: [ProjectEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input CreateProjectInput {
    name: String!
    description: String
  }

  input UpdateProjectInput {
    name: String
    description: String
  }

  extend type Organization {
    projects(first: Int, after: String, status: ProjectState): ProjectConnection!
  }

  extend type Query {
    project(id: UUID!): Project!
  }

  extend type Mutation {
    createProject(organizationId: UUID!, input: CreateProjectInput!): Project!
    updateProject(id: UUID!, input: UpdateProjectInput!): Project!
    changeProjectStatus(id: UUID!, status: ProjectState!): Project!
    deleteProject(id: UUID!): Boolean!
    configureWorkflow(id: UUID!, workflow: JSON!): Project!
    addProjectMember(projectId: UUID!, userId: UUID!, role: ProjectRole!): ProjectMember!
    updateProjectMemberRole(
      projectId: UUID!
      userId: UUID!
      role: ProjectRole!
    ): ProjectMember!
    removeProjectMember(projectId: UUID!, userId: UUID!): Boolean!
  }
`;
