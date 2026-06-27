/**
 * Canonical `User` type and the user queries/mutations. This supersedes the
 * Phase 2 platform demo (`shared/graphql/demo.ts`). Relation fields
 * (expertise/skills/statistics/team memberships/organizationCount) are resolved
 * through per-request DataLoaders.
 */
export const userTypeDefs = /* GraphQL */ `
  enum SeniorityLevel {
    JUNIOR
    MID
    SENIOR
    LEAD
    PRINCIPAL
  }

  enum TeamRole {
    LEAD
    MEMBER
  }

  enum AvailabilityStatus {
    AVAILABLE
    BUSY
    AWAY
    OFFLINE
  }

  type UserExpertise {
    id: UUID!
    tag: String!
    confidenceScore: Float!
  }

  type UserStatistics {
    completedTasks: Int!
    avgCompletionSeconds: Float
    velocity: Float
    historicalStoryPoints: Int!
  }

  type UserTeamMembership {
    teamId: UUID!
    teamName: String!
    role: TeamRole!
    availability: AvailabilityStatus!
    workload: Int!
  }

  type User {
    id: UUID!
    email: String!
    name: String!
    avatarUrl: String
    seniority: SeniorityLevel
    createdAt: DateTime!
    updatedAt: DateTime!
    organizationCount: Int!
    skills: [String!]!
    expertise: [UserExpertise!]!
    statistics: UserStatistics!
    teamMemberships: [UserTeamMembership!]!
  }

  type UserEdge {
    cursor: String!
    node: User!
  }

  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input UserFilter {
    emailContains: String
    nameContains: String
  }

  input UpdateProfileInput {
    name: String
    avatarUrl: String
    seniority: SeniorityLevel
  }

  input AddExpertiseInput {
    tag: String!
    confidenceScore: Float
  }

  extend type Query {
    user(id: UUID!): User!
    users(
      first: Int
      after: String
      orderBy: SortDirection
      filter: UserFilter
    ): UserConnection!
  }

  extend type Mutation {
    updateProfile(input: UpdateProfileInput!): User!
    addSkill(skill: String!): User!
    removeSkill(skill: String!): User!
    addExpertise(input: AddExpertiseInput!): User!
    removeExpertise(tag: String!): User!
  }
`;
