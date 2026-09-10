/**
 * Team GraphQL contract: teams under projects, plus per-member role,
 * responsibilities, availability, and workload — the attributes the AI
 * assignment service consumes. Adds the `teams` relation to `Project`.
 * Reuses TeamRole/AvailabilityStatus enums declared by the user module.
 */
export const teamTypeDefs = /* GraphQL */ `
  type Team {
    id: UUID!
    name: String!
    description: String
    projectId: UUID!
    members: [TeamMember!]!
    memberCount: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type TeamMember {
    id: UUID!
    role: TeamRole!
    responsibilities: String
    availability: AvailabilityStatus!
    workload: Int!
    user: User!
    createdAt: DateTime!
  }

  input CreateTeamInput {
    name: String!
    description: String
  }

  input UpdateTeamInput {
    name: String
    description: String
  }

  input AddTeamMemberInput {
    role: TeamRole
    responsibilities: String
    availability: AvailabilityStatus
    workload: Int
  }

  input UpdateTeamMemberInput {
    role: TeamRole
    responsibilities: String
    availability: AvailabilityStatus
    workload: Int
  }

  extend type Project {
    teams: [Team!]!
    teamCount: Int!
  }

  extend type Query {
    team(id: UUID!): Team!
  }

  extend type Mutation {
    createTeam(projectId: UUID!, input: CreateTeamInput!): Team!
    updateTeam(id: UUID!, input: UpdateTeamInput!): Team!
    deleteTeam(id: UUID!): Boolean!
    addTeamMember(teamId: UUID!, userId: UUID!, input: AddTeamMemberInput!): TeamMember!
    updateTeamMember(
      teamId: UUID!
      userId: UUID!
      input: UpdateTeamMemberInput!
    ): TeamMember!
    removeTeamMember(teamId: UUID!, userId: UUID!): Boolean!
  }
`;
